import * as cheerio from 'cheerio'
import type { Element } from 'domhandler'
import { findSource } from '../../src/services/source-service'

import type {
  ClassFeature,
  ClassLevel,
  ClassLevelColumn,
  ClassSubclass,
  ContentNode,
  DndClass,
  DndEntityType,
  LinkNode,
  TableNode,
} from './types'

function cleanText(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseNumber(text: string): number | null {
  const match = text.match(/\d+/)

  if (!match) {
    return null
  }

  return Number(match[0])
}

function getCellLabel(
  $: cheerio.CheerioAPI,
  cell: Element
): string {
  const element = $(cell)

  const long = element.find('.long').first()

  if (long.length > 0) {
    const clone = long.clone()

    clone.find('br').replaceWith(' ')

    return cleanText(clone.text())
  }

  const clone = element.clone()

  clone.find('br').replaceWith(' ')

  return cleanText(clone.text())
}

function normalizeColumnId(label: string): string {
  return cleanText(label)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Определяет тип ссылки dnd.su.
 *
 * Пока мы не пытаемся загрузить связанные сущности.
 * Здесь только определяем, что именно находится по ссылке.
 */
function getLinkTarget(
  href: string
): {
  targetType: LinkNode['targetType']
  targetId?: string
  targetSlug?: string
} {
  const normalized = href.trim()

  if (normalized.startsWith('#feature.')) {
    return {
      targetType: 'other',
      targetId: normalized.slice('#feature.'.length),
    }
  }

  const spellMatch = normalized.match(
    /\/spells\/(?:\d+-)?([^/?#]+)/
  )

  if (spellMatch) {
    return {
      targetType: 'spell',
      targetSlug: spellMatch[1],
    }
  }

  const equipmentMatch = normalized.match(
    /\/(?:equipment|item)\/(?:\d+-)?([^/?#]+)/
  )

  if (equipmentMatch) {
    return {
      targetType: 'equipment',
      targetSlug: equipmentMatch[1],
    }
  }

  const classMatch = normalized.match(
    /\/class\/(?:\d+-)?([^/?#]+)/
  )

  if (classMatch) {
    return {
      targetType: 'class',
      targetSlug: classMatch[1],
    }
  }

  const subclassMatch = normalized.match(
    /\/(?:subclass|archetype)\/(?:\d+-)?([^/?#]+)/
  )

  if (subclassMatch) {
    return {
      targetType: 'subclass',
      targetSlug: subclassMatch[1],
    }
  }

  if (
    normalized.includes('homebrew') ||
    normalized.startsWith('#hb.')
  ) {
    return {
      targetType: 'homebrew',
      targetId: normalized.startsWith('#')
        ? normalized.slice(1)
        : undefined,
    }
  }

  return {
    targetType: 'other',
  }
}

function parseLink(
  $: cheerio.CheerioAPI,
  element: Element
): LinkNode {
  const link = $(element)

  const href = link.attr('href') ?? ''
  const text = cleanText(link.text())

  const target = getLinkTarget(href)

  return {
    type: 'link',
    text,
    href,
    ...target,
  }
}

function parseInlineContent(
  $: cheerio.CheerioAPI,
  element: Element
): ContentNode[] {
  const result: ContentNode[] = []

  $(element)
    .contents()
    .each((_, child) => {
      if (child.type === 'text') {
        const text = cleanText(
          $(child).text()
        )

        if (text) {
          result.push({
            type: 'text',
            text,
          })
        }

        return
      }

      if (child.type !== 'tag') {
        return
      }

      const tag = child.tagName.toLowerCase()

      if (tag === 'a') {
        result.push(
          parseLink($, child)
        )

        return
      }

      const nested = parseInlineContent(
        $,
        child
      )

      result.push(...nested)
    })

  return result
}

function parseTable(
  $: cheerio.CheerioAPI,
  table: Element
): TableNode {
  const headers: ContentNode[][] = []
  const rows: ContentNode[][][] = []

  const rowsElements = $(table)
    .find('tr')
    .toArray()

  let headerFound = false

  for (const row of rowsElements) {
    const cells = $(row)
      .find('th, td')
      .toArray()

    if (cells.length === 0) {
      continue
    }

    const parsedCells = cells.map(cell =>
      parseInlineContent($, cell)
    )

    const hasHeaderCell = cells.some(
      cell => $(cell).is('th')
    )

    if (
      !headerFound &&
      hasHeaderCell
    ) {
      headers.push(parsedCells)
      headerFound = true
      continue
    }

    rows.push(parsedCells)
  }

  return {
    type: 'table',
    headers,
    rows,
  }
}

function parseContent(
  $: cheerio.CheerioAPI,
  root: Element | cheerio.Cheerio<any>
): ContentNode[] {
  const result: ContentNode[] = []

  $(root)
    .children()
    .each((_, element) => {
      const tag = element.tagName?.toLowerCase()

      if (!tag) {
        return
      }

      if (
        tag === 'p' ||
        tag === 'div'
      ) {
        const className =
          $(element).attr('class') ?? ''

        if (
          className.includes('additionalInfo')
        ) {
          result.push({
            type: 'paragraph',
            children: parseInlineContent(
              $,
              element
            ),
          })

          return
        }

        const children =
          parseContent($, element)

        if (children.length > 0) {
          result.push(...children)
          return
        }

        const inline =
          parseInlineContent($, element)

        if (inline.length > 0) {
          result.push({
            type: 'paragraph',
            children: inline,
          })
        }

        return
      }

      if (/^h[1-6]$/.test(tag)) {
        result.push({
          type: 'heading',
          level: Number(tag.slice(1)),
          children: parseInlineContent(
            $,
            element
          ),
        })

        return
      }

      if (
        tag === 'ul' ||
        tag === 'ol'
      ) {
        const items: ContentNode[][] = []

        $(element)
          .children('li')
          .each((_, li) => {
            items.push(
              parseContent($, li)
            )
          })

        result.push({
          type: 'list',
          ordered: tag === 'ol',
          items,
        })

        return
      }

      if (tag === 'table') {
        result.push(
          parseTable($, element)
        )

        return
      }

      if (tag === 'br') {
        return
      }

      const inline =
        parseInlineContent(
          $,
          element
        )

      if (inline.length > 0) {
        result.push({
          type: 'paragraph',
          children: inline,
        })
      }
    })

  return result
}

function parseClassTable(
  $: cheerio.CheerioAPI
): ClassLevel[] {
  const table = $('table[class*="class_table"]')
    .first()

  if (table.length === 0) {
    return []
  }

  const headerRows = table
    .find('tr.table_header')
    .toArray()

  if (headerRows.length === 0) {
    return []
  }

  const firstHeader = headerRows[0]

  const headerCells = $(firstHeader)
    .find('th, td')
    .toArray()

  const columns: Array<{
    index: number
    label: string
    id: string
    rowspan: number
  }> = []

  let columnIndex = 0

  for (const cell of headerCells) {
    const label = getCellLabel(
      $,
      cell
    )

    const rowspan = Number(
      $(cell).attr('rowspan') ?? '1'
    )

    const colspan = Number(
      $(cell).attr('colspan') ?? '1'
    )

    if (
      label.toLowerCase().includes(
        'ячейки заклинаний'
      )
    ) {
      columnIndex += colspan
      continue
    }

    columns.push({
      index: columnIndex,
      label,
      id: normalizeColumnId(label),
      rowspan,
    })

    columnIndex += colspan
  }

  const bodyRows = table
    .find('tbody tr')
    .toArray()

  const levels: ClassLevel[] = []

  for (let rowIndex = 0; rowIndex < bodyRows.length; rowIndex++) {
    const row = bodyRows[rowIndex]

    const cells = $(row)
      .find('td')
      .toArray()

    if (cells.length === 0) {
      continue
    }

    const level =
      parseNumber(
        $(cells[0]).text()
      )

    if (level === null) {
      continue
    }

    const expectedLevel = levels.length + 1

    if (level !== expectedLevel) {
      continue
    }

    const proficiencyBonus =
      parseNumber(
        $(cells[1]).text()
      )

    const classLevel: ClassLevel = {
      level,
      proficiencyBonus,
      columns: [],
      spellSlots: {},
      features: [],
    }

    let cellIndex = 2

    for (
      let columnIndex = 2;
      columnIndex < columns.length;
      columnIndex++
    ) {
      const column = columns[columnIndex]

      if (
        cellIndex >= cells.length
      ) {
        break
      }

      const cell = cells[cellIndex]

      const value =
        parseNumber(
          $(cell).text()
        )

      if (
        column.label
          .toLowerCase()
          .includes('ячей')
      ) {
        classLevel.spellSlots[
          column.id
        ] = value

        cellIndex++
        continue
      }

      classLevel.columns.push({
        id: column.id,
        label: column.label,
        value,
      })

      const featureLinks =
        $(cell)
          .find('a[href^="#feature."]')
          .toArray()

      for (const link of featureLinks) {
        const href =
          $(link).attr('href')

        if (!href) {
          continue
        }

        classLevel.features.push(
          href.slice('#feature.'.length)
        )
      }

      cellIndex++
    }

    levels.push(classLevel)
  }

  return levels
}

function extractSourceNameFromContent(
  content: ContentNode[]
): string | undefined {
  for (const node of content) {
    if (node.type !== 'paragraph') {
      continue
    }

    const text = node.children
      .filter(child => child.type === 'text')
      .map(child => child.text)
      .join(' ')

    const match = text.match(
      /^Источник:\s*[«"](.+?)[»"]\s*$/i
    )

    if (match) {
      return cleanText(match[1])
    }
  }

  return undefined
}

function extractSourceFromContent(
  content: ContentNode[]
): string | undefined {
  for (const node of content) {
    if (node.type !== 'paragraph') {
      continue
    }

    const text = node.children
      .filter(child => child.type === 'text')
      .map(child => child.text)
      .join(' ')

    const match = text.match(
      /^Источник:\s*[«"](.+?)[»"]\s*$/i
    )

    if (!match) {
      continue
    }

    const sourceName = cleanText(match[1])
    const source = findSource(sourceName)

    if (!source) {
      console.warn(
        `[SOURCE NOT FOUND] ${sourceName}`
      )

      return undefined
    }

    return source.id
  }

  return undefined
}

function getFeatureContent(
  $: cheerio.CheerioAPI,
  feature: Element
): ContentNode[] {
  const parent = $(feature).closest(
    '.card__article-body'
  )

  if (parent.length === 0) {
    return []
  }

  return parseContent(
    $,
    parent
  )
}

function parseFeatures(
  $: cheerio.CheerioAPI
): ClassFeature[] {
  const features: ClassFeature[] = []
  const seen = new Set<string>()

  $('span[id^="feature."]')
    .each((_, element) => {
      const rawId =
        $(element).attr('id')

      if (!rawId) {
        return
      }

      const id =
        rawId.slice(
          'feature.'.length
        )

      if (!id || seen.has(id)) {
        return
      }

      const heading =
        $(element).closest(
          'h2, h3, h4'
        )

      const name =
        cleanText(
          heading.length > 0
            ? heading.text()
            : $(element).text()
        )

      if (!name) {
        return
      }

      seen.add(id)

      features.push({
        id,
        name,
        level:
          extractFeatureLevel(
            $,
            element
          ),
        optional:
          isFeatureOptional(
            $,
            element
          ),
        content:
          getFeatureContent(
            $,
            element
          ),
      })
    })

  return features
}

function getFeatureId(
  $: cheerio.CheerioAPI,
  heading: cheerio.Cheerio<any>
): string {
  const anchor =
    heading
      .find('[id^="feature."]')
      .first()

  const rawId =
    anchor.attr('id')

  if (rawId) {
    return rawId.slice(
      'feature.'.length
    )
  }

  return normalizeColumnId(
    cleanText(
      heading.text()
    )
  )
}

function isSubclassId(
  id: string
): boolean {
  return (
    id.startsWith('archetype.') ||
    id.startsWith('ua.archetype.') ||
    id.startsWith('hb.archetype.') ||
    id.startsWith('mhh.archetype.')
  )
}

function normalizeSubclassId(
  id: string
): string {
  return id
    .replace(/^ua\./, '')
    .replace(/^hb\./, '')
    .replace(/^mhh\./, '')
}

function isSubclassHeading(
  $: cheerio.CheerioAPI,
  element: Element
): boolean {
  return (
    $(element).is('h2, h3, h4') &&
    $(element).find(
      'span[id^="archetype."], ' +
      'span[id^="ua.archetype."], ' +
      'span[id^="hb.archetype."], ' +
      'span[id^="mhh.archetype."]'
    ).length > 0
  )
}

function parseUntilSubclassHeading(
  $: cheerio.CheerioAPI,
  element: Element
): {
  content: ContentNode[]
  stopped: boolean
} {
  const content: ContentNode[] = []

  const children =
    $(element)
      .children()
      .toArray()

  for (const child of children) {
    if (
      isSubclassHeading(
        $,
        child
      )
    ) {
      return {
        content,
        stopped: true,
      }
    }

    const nestedSubclassHeading =
      $(child).find(
        'h2, h3, h4'
      ).toArray().some(
        heading =>
          isSubclassHeading(
            $,
            heading
          )
      )

    if (
      nestedSubclassHeading
    ) {
      const nested =
        parseUntilSubclassHeading(
          $,
          child
        )

      content.push(
        ...nested.content
      )

      if (nested.stopped) {
        return {
          content,
          stopped: true,
        }
      }

      continue
    }

    content.push(
      ...parseContent(
        $,
        child
      )
    )
  }

  return {
    content,
    stopped: false,
  }
}

function getSectionContent(
  $: cheerio.CheerioAPI,
  heading: cheerio.Cheerio<any>
): ContentNode[] {
  const content: ContentNode[] = []

  let current =
    heading.next()

  while (
    current.length > 0
  ) {
    if (
      current.is('h2.bigSectionTitle')
    ) {
      break
    }

    if (
      isSubclassHeading(
        $,
        current[0] as Element
      )
    ) {
      break
    }

    const nested =
      parseUntilSubclassHeading(
        $,
        current[0] as Element
      )

    content.push(
      ...nested.content
    )

    if (nested.stopped) {
      break
    }

    current =
      current.next()
  }

  return content
}

function extractContentLevel(
  content: ContentNode[]
): number | null {
  const first = content[0]

  if (!first || first.type !== 'paragraph') {
    return null
  }

  const text = first.children
    .filter(child => child.type === 'text')
    .map(child => child.text)
    .join(' ')
    .trim()

  const match = text.match(/^(\d+)/)

  return match
    ? Number(match[1])
    : null
}


function parseSubclassFeatures(
  $: cheerio.CheerioAPI,
  heading: cheerio.Cheerio<any>
): ClassFeature[] {
  const features: ClassFeature[] = []

  const content =
    getSectionContent($, heading)

  let currentName: string | null = null
  let currentContent: ContentNode[] = []

  const saveCurrentFeature = () => {
    if (!currentName) {
      return
    }

    let level: number | null = null

    const firstNode = currentContent[0]

    if (firstNode?.type === 'paragraph') {
      const text = firstNode.children
        .filter(
          child => child.type === 'text'
        )
        .map(
          child => child.text
        )
        .join(' ')

      const match = text.match(
        /(\d+)[-йя]\s*уровень/i
      )

      if (match) {
        level = Number(match[1])
      }
    }

    features.push({
      id: normalizeColumnId(
        currentName
      ),
      name: currentName,
      level,
      optional: false,
      content: currentContent,
    })
  }

  for (const node of content) {
    if (
      node.type === 'heading' &&
      node.level === 3
    ) {
      saveCurrentFeature()

      currentName =
        node.children
          .filter(
            child => child.type === 'text'
          )
          .map(
            child => child.text
          )
          .join(' ')
          .trim()

      currentContent = []

      continue
    }

    if (currentName) {
      currentContent.push(node)
    }
  }

  saveCurrentFeature()

  return features
}

function extractFeatureLevel(
  $: cheerio.CheerioAPI,
  element: Element
): number | null {
  const parent =
    $(element).closest(
      '.card__article-body'
    )

  if (parent.length === 0) {
    return null
  }

  const text =
    cleanText(
      parent.text()
    )

  const match =
    text.match(
      /(\d+)[-йя]\s*уровень/i
    )

  if (!match) {
    return null
  }

  return Number(match[1])
}

function isFeatureOptional(
  $: cheerio.CheerioAPI,
  element: Element
): boolean {
  const parent =
    $(element).closest(
      '.card__article-body'
    )

  return (
    parent.find(
      '.optional, .feature-optional'
    ).length > 0
  )
}

function parseSubclasses(
  $: cheerio.CheerioAPI
): ClassSubclass[] {
  const subclasses: ClassSubclass[] = []
  const seen = new Set<string>()

  const subclassSelectors = [
    'span[id^="archetype."]',
    'span[id^="ua.archetype."]',
    'span[id^="hb.archetype."]',
    'span[id^="mhh.archetype."]',
  ].join(', ')

  $(subclassSelectors).each((_, element) => {
    const rawId =
      $(element).attr('id')

    if (!rawId) {
      return
    }

    const id =
      normalizeSubclassId(rawId)

    if (seen.has(id)) {
      return
    }

    const heading =
      $(element).closest(
        'h2, h3, h4'
      )

    if (heading.length === 0) {
      return
    }

    const name =
      cleanText(
        heading.text()
      )

    if (!name) {
      return
    }

    const content =
      getSectionContent(
        $,
        heading
      )

    const source =
      extractSourceFromContent(
        content
      )

    seen.add(id)

    subclasses.push({
      id,
      name,
      source,
      content,
      features:
        parseSubclassFeatures(
          $,
          heading
        ),
    })
  })

  return subclasses
}

export interface ParseClassOptions {
  id: string
  html: string
  source?: string
}

export function parseClass(
  options: ParseClassOptions
): DndClass {
  const $ =
    cheerio.load(
      options.html
    )

  const title =
    cleanText(
      $('.card-title')
        .first()
        .text()
    )

  const pageSource =
    cleanText(
      $('.params')
        .first()
        .text()
    )

  return {
    id: options.id,
    name: title,
    source:
      options.source ??
      (pageSource || undefined),
    levels:
      parseClassTable($),
    features:
      parseFeatures($),
    subclasses:
      parseSubclasses($),
  }
}
