import * as cheerio from 'cheerio'

import type {
  ClassFeature,
  ClassLevel,
  ClassLevelColumn,
  ClassOrigin,
  ClassArchetype,
  ContentNode,
  DndClass,
  LinkTargetType,
} from './types'

export interface ParseClassOptions {
  id: string
  html: string
}

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------

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

function detectOptional(
  $: cheerio.CheerioAPI,
  element: cheerio.Cheerio<any>
): boolean {
  return (
    element.find('[tooltip-for="option.TCE"]').length > 0 ||
    element.closest('.TCE-feature-on').length > 0
  )
}

function detectLinkType(href: string): LinkTargetType {
  if (href.startsWith('/spells/')) {
    return 'spell'
  }

  if (href.startsWith('/homebrew/spells/')) {
    return 'homebrew-spell'
  }

  if (href.startsWith('/bestiary/')) {
    return 'bestiary'
  }

  if (href.startsWith('/homebrew/')) {
    return 'homebrew'
  }

  return 'other'
}

function parseLink(
  $: cheerio.CheerioAPI,
  element: cheerio.Element
): ContentNode {
  const node = $(element)

  const href = node.attr('href') ?? ''
  const text = cleanText(node.text())

  const targetType = detectLinkType(href)

  const result: {
    type: 'link'
    text: string
    href: string
    targetType: LinkTargetType
    targetId?: string
    targetSlug?: string
  } = {
    type: 'link',
    text,
    href,
    targetType,
  }

  const spellMatch = href.match(
    /^\/(?:homebrew\/)?spells\/(\d+)-([^/]+)\/?$/
  )

  if (spellMatch) {
    result.targetId = spellMatch[1]
    result.targetSlug = spellMatch[2]
  }

  const bestiaryMatch = href.match(
    /^\/bestiary\/(\d+)-([^/]+)\/?$/
  )

  if (bestiaryMatch) {
    result.targetId = bestiaryMatch[1]
    result.targetSlug = bestiaryMatch[2]
  }

  return result
}

// ---------------------------------------------------------
// Inline content
// ---------------------------------------------------------

function parseInline(
  $: cheerio.CheerioAPI,
  element: cheerio.Element
): ContentNode[] {
  const result: ContentNode[] = []

  $(element)
    .contents()
    .each((_, child) => {
      if (child.type === 'text') {
        const text = cleanText($(child).text())

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
        result.push(parseLink($, child))
        return
      }

      const nested = parseInline($, child)

      result.push(...nested)
    })

  return result
}

// ---------------------------------------------------------
// Tables
// ---------------------------------------------------------

function parseTable(
  $: cheerio.CheerioAPI,
  element: cheerio.Element
): ContentNode {
  const table = $(element)

  const rows: ContentNode[][][] = []

  table
    .find('tr')
    .each((_, rowElement) => {
      const row: ContentNode[][] = []

      $(rowElement)
        .children('td, th')
        .each((_, cellElement) => {
          row.push(
            parseInline($, cellElement)
          )
        })

      if (row.length > 0) {
        rows.push(row)
      }
    })

  if (rows.length === 0) {
    return {
      type: 'table',
      headers: [],
      rows: [],
    }
  }

  const firstRow = table
    .find('tr')
    .first()

  const isHeader =
    firstRow.hasClass('table_header')

  if (isHeader) {
    return {
      type: 'table',
      headers: rows[0],
      rows: rows.slice(1),
    }
  }

  return {
    type: 'table',
    headers: [],
    rows,
  }
}

// ---------------------------------------------------------
// Lists
// ---------------------------------------------------------

function parseList(
  $: cheerio.CheerioAPI,
  element: cheerio.Element
): ContentNode {
  const list = $(element)

  const items: ContentNode[][] = []

  list
    .children('li')
    .each((_, itemElement) => {
      items.push(
        parseInline($, itemElement)
      )
    })

  return {
    type: 'list',
    ordered: list.prop('tagName') === 'OL',
    items,
  }
}

// ---------------------------------------------------------
// Content block parser
// ---------------------------------------------------------

function parseContent(
  $: cheerio.CheerioAPI,
  elements: cheerio.Cheerio<any>
): ContentNode[] {
  const result: ContentNode[] = []

  elements.each((_, element) => {
    const node = $(element)

    if (element.type !== 'tag') {
      return
    }

    const tag = element.tagName.toLowerCase()

    if (tag === 'p') {
      const children = parseInline($, element)

      if (children.length > 0) {
        result.push({
          type: 'paragraph',
          children,
        })
      }

      return
    }

    if (
      tag === 'h1' ||
      tag === 'h2' ||
      tag === 'h3' ||
      tag === 'h4' ||
      tag === 'h5'
    ) {
      const children = parseInline($, element)

      result.push({
        type: 'heading',
        level: Number(tag.substring(1)),
        children,
      })

      return
    }

    if (
      tag === 'ul' ||
      tag === 'ol'
    ) {
      result.push(
        parseList($, element)
      )

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

    const children = node.children(
      'p, h1, h2, h3, h4, h5, ul, ol, table'
    )

    if (children.length > 0) {
      result.push(
        ...parseContent($, children)
      )
    }
  })

  return result
}

// ---------------------------------------------------------
// Class table
// ---------------------------------------------------------

function normalizeColumnId(label: string): string {
  return cleanText(label)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
}

function getCellLabel(
  $: cheerio.CheerioAPI,
  cell: cheerio.Element
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

function parseClassTable(
  $: cheerio.CheerioAPI
): ClassLevel[] {
  const table = $('table[class*="class_table"]').first()

  if (table.length === 0) {
    console.warn('Таблица класса не найдена')
    return []
  }

  const headerRows = table.find('tr.table_header')

  if (headerRows.length === 0) {
    console.warn('Заголовок таблицы класса не найден')
    return []
  }

  const mainHeader = headerRows.first()

  const columnDefinitions: {
    id: string
    label: string
    index: number
  }[] = []

  let cellIndex = 0
  let spellSlotsStartIndex: number | null = null
  let spellSlotsCount = 0

  mainHeader.children('td').each((_, cell) => {
    const element = $(cell)

    const colspan = Number(
      element.attr('colspan') ?? '1'
    )

    const rowspan = Number(
      element.attr('rowspan') ?? '1'
    )

    const label = getCellLabel($, cell)

    if (
      label
        .toLowerCase()
        .includes('ячейки заклинаний')
    ) {
      spellSlotsStartIndex = cellIndex
      spellSlotsCount = colspan
      cellIndex += colspan
      return
    }

    if (rowspan >= 2) {
      columnDefinitions.push({
        id: normalizeColumnId(label),
        label,
        index: cellIndex,
      })
    }

    cellIndex += colspan
  })

  const spellSlotLevels: string[] = []

  if (spellSlotsStartIndex !== null) {
    const spellSlotsHeader = headerRows
      .filter('.spell-slots-row')
      .first()

    spellSlotsHeader.children('td').each((_, cell) => {
      const level = cleanText(
        $(cell).text()
      )

      if (level) {
        spellSlotLevels.push(level)
      }
    })
  }

  if (
    spellSlotsStartIndex !== null &&
    spellSlotLevels.length !== spellSlotsCount
  ) {
    console.warn(
      `Количество ячеек заклинаний не совпадает: ` +
      `ожидалось ${spellSlotsCount}, ` +
      `найдено ${spellSlotLevels.length}`
    )
  }

  const levelColumn = columnDefinitions.find(
    column =>
      column.label
        .toLowerCase()
        .includes('уровень')
  )

  const proficiencyColumn = columnDefinitions.find(
    column =>
      column.label
        .toLowerCase()
        .includes('бонус') &&
      column.label
        .toLowerCase()
        .includes('мастер')
  )

  const featureColumn = columnDefinitions.find(
    column =>
      column.label
        .toLowerCase()
        .trim() === 'умения'
  )

  if (!levelColumn) {
    console.warn(
      'Колонка уровня класса не найдена'
    )

    return []
  }

  const levels: ClassLevel[] = []

  table.find('tbody > tr').each((_, rowElement) => {
    const row = $(rowElement)

    if (row.hasClass('table_header')) {
      return
    }

    const cells = row.children('td')

    if (cells.length === 0) {
      return
    }

    const values = cells
      .map((_, cell) => cleanText($(cell).text()))
      .get()

    const level = parseNumber(
      values[levelColumn.index] ?? ''
    )

    if (!level) {
      return
    }

    const proficiencyBonus = proficiencyColumn
      ? parseNumber(
          values[proficiencyColumn.index] ?? ''
        )
      : null

    const columns: ClassLevelColumn[] = []

    for (const column of columnDefinitions) {
      if (
        column.index === levelColumn.index ||
        column.index === proficiencyColumn?.index ||
        column.index === featureColumn?.index
      ) {
        continue
      }

      columns.push({
        id: column.id,
        label: column.label,
        value: parseNumber(
          values[column.index] ?? ''
        ),
      })
    }

    const features: string[] = []

    if (featureColumn) {
      cells
        .eq(featureColumn.index)
        .find('a[href^="#feature."]')
        .each((_, link) => {
          const href = $(link).attr('href')

          if (!href) {
            return
          }

          features.push(
            href.replace('#feature.', '')
          )
        })
    }

    const spellSlots: Record<
      string,
      number | null
    > = {}

    if (spellSlotsStartIndex !== null) {
      spellSlotLevels.forEach(
        (spellLevel, index) => {
          const valueIndex =
            spellSlotsStartIndex! + index

          spellSlots[spellLevel] =
            parseNumber(
              values[valueIndex] ?? ''
            )
        }
      )
    }

    levels.push({
      level,
      proficiencyBonus,
      columns,
      spellSlots,
      features,
    })
  })

  return levels
}

// ---------------------------------------------------------
// Feature extraction
// ---------------------------------------------------------

function extractLevel(
  $: cheerio.CheerioAPI,
  featureHeading: cheerio.Cheerio<any>
): number | null {
  const levelParagraph = featureHeading
    .nextAll('p')
    .first()

  if (levelParagraph.length === 0) {
    return null
  }

  const em = levelParagraph
    .find('em')
    .first()

  if (em.length === 0) {
    return null
  }

  const text = cleanText(em.text())

  return parseNumber(text)
}

function extractFeatureContent(
  $: cheerio.CheerioAPI,
  heading: cheerio.Cheerio<any>
): ContentNode[] {
  const elements: cheerio.Element[] = []

  let current = heading

  while (current.length > 0) {
    current = current.next()

    if (current.length === 0) {
      break
    }

    const tag = current
      .prop('tagName')
      ?.toLowerCase()

    if (
      current.find(
        'span[id^="feature."]'
      ).length > 0
    ) {
      break
    }

    if (tag === 'h2') {
      break
    }

    elements.push(
      current.get(0)
    )
  }

  return parseContent(
    $,
    $(elements)
  )
}

function parseFeatures(
  $: cheerio.CheerioAPI
): ClassFeature[] {
  const features: ClassFeature[] = []

  $('span[id^="feature."]').each(
    (_, spanElement) => {
      const span = $(spanElement)

      const id = span
        .attr('id')
        ?.replace('feature.', '')

      if (!id) {
        return
      }

      const heading = span.parent()

      const name = cleanText(
        span.text()
      )

      if (!name) {
        return
      }

      features.push({
        id,
        name,
        level: extractLevel($, heading),
        optional: detectOptional($, heading),
        content: extractFeatureContent(
          $,
          heading
        ),
      })
    }
  )

  return features
}


function parseArchetypes(
  $: cheerio.CheerioAPI
): ClassArchetype[] {
  const archetypes: ClassArchetype[] = []

  $('span[id^="archetype."]').each((_, element) => {
    const span = $(element)

    const id = span.attr('id')

    if (!id) {
      return
    }

    const name = cleanText(span.text())

    if (!name) {
      return
    }

    const heading = span.closest('h2')

    if (heading.length === 0) {
      return
    }

    const contentWrapper = heading.next('.hide-wrapper')

    if (contentWrapper.length === 0) {
      return
    }

    archetypes.push({
      id: id.replace(/^archetype\./, ''),
      name,
      content: parseContent(
        $,
        contentWrapper
      ),
    })
  })

  return archetypes
}

// ---------------------------------------------------------
// Origins
// ---------------------------------------------------------

function extractOriginContent(
  $: cheerio.CheerioAPI,
  heading: cheerio.Cheerio<any>
): ContentNode[] {
  const elements: cheerio.Element[] = []

  let current = heading

  while (current.length > 0) {
    current = current.next()

    if (current.length === 0) {
      break
    }

    const tag = current
      .prop('tagName')
      ?.toLowerCase()

    if (tag === 'h2') {
      break
    }

    if (
      current.find(
        'span[id^="origin."]'
      ).length > 0
    ) {
      break
    }

    elements.push(
      current.get(0)
    )
  }

  return parseContent(
    $,
    $(elements)
  )
}

function parseOrigins(
  $: cheerio.CheerioAPI
): ClassOrigin[] {
  const origins: ClassOrigin[] = []

  $('span[id^="origin."]').each(
    (_, spanElement) => {
      const span = $(spanElement)

      const id = span
        .attr('id')
        ?.replace('origin.', '')

      if (!id) {
        return
      }

      const heading = span.parent()

      const name = cleanText(
        span.text()
      )

      if (!name) {
        return
      }

      origins.push({
        id,
        name,
        content: extractOriginContent(
          $,
          heading
        ),
      })
    }
  )

  return origins
}

// ---------------------------------------------------------
// Public parser
// ---------------------------------------------------------

export function parseClass(
  options: ParseClassOptions
): DndClass {
  const $ = cheerio.load(options.html)

  const title = cleanText(
    $('.card-title')
      .first()
      .text()
  )

  const source = cleanText(
    $('.params')
      .first()
      .text()
  )

  return {
    id: options.id,
    name: title,
    source,
    levels: parseClassTable($),
    features: parseFeatures($),
    origins: parseOrigins($),
    archetypes: parseArchetypes($),
  }
}
