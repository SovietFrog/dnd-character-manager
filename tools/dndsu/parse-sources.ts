import fs from 'node:fs'
import path from 'node:path'

import * as cheerio from 'cheerio'
import type { Element } from 'domhandler'

import type {
  DndSource,
  DndSourceCategory,
} from './types'

const INPUT_FILE = path.resolve(
  'tools/dndsu/data/sources.html'
)

const OUTPUT_DIR = path.resolve(
  'src/data'
)

const OUTPUT_FILE = path.join(
  OUTPUT_DIR,
  'sources.json'
)

if (!fs.existsSync(INPUT_FILE)) {
  throw new Error(
    `HTML-файл не найден:\n${INPUT_FILE}\n\n` +
    `Сначала выполни:\n` +
    `npm run dndsu:fetch:sources`
  )
}

const html = fs.readFileSync(
  INPUT_FILE,
  'utf-8'
)

const $ = cheerio.load(html)

function cleanText(text: string): string {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeCategory(
  text: string
): DndSourceCategory | null {
  const value = cleanText(text).toLowerCase()

  if (value === 'core') {
    return 'core'
  }

  if (value === 'source books') {
    return 'sourcebook'
  }

  if (value === 'campaigns') {
    return 'campaign'
  }

  if (value === 'adventures & supplements') {
    return 'supplement'
  }

  if (value === 'homebrew') {
    return 'homebrew'
  }

  return null
}

function looksLikeLocalizedName(
  text: string
): boolean {
  const value = cleanText(text)

  if (!value) {
    return false
  }

  // Русское название
  if (/[А-Яа-яЁё]/.test(value)) {
    return true
  }

  // Например: HB: SC (2015)
  if (
    /^[A-Z0-9][A-Z0-9 .:&/-]{1,30}\s*\(\d{4}\)$/.test(value)
  ) {
    return true
  }

  return false
}

function getLocalizedName(
  heading: cheerio.Cheerio<Element>
): string | undefined {
  let sibling = heading.next()

  while (sibling.length > 0) {
    const tagName = sibling[0]?.tagName?.toLowerCase()

    // Дальше уже пошёл следующий блок
    if (
      tagName === 'h2'
    ) {
      return undefined
    }

    if (
      tagName === 'h3'
    ) {
      const text = cleanText(sibling.text())

      if (looksLikeLocalizedName(text)) {
        return text
      }

      return undefined
    }

    sibling = sibling.next()
  }

  return undefined
}

function getShortName(
  localizedName: string | undefined
): string | undefined {
  if (!localizedName) {
    return undefined
  }

  /*
   * Примеры:
   *
   * Книга Игрока, PH (2014)
   * Руководство Занатара обо всём, XGE (2017)
   * Котёл Таши со всякой всячиной, TCE (11 2020)
   *
   * Берём сокращение между запятой и скобками.
   */

  const match = localizedName.match(
    /,\s*([A-Z][A-Z0-9-]{1,10})\s*\(/
  )

  return match?.[1]
}

function getUrl(
  heading: cheerio.Cheerio<Element>
): string | undefined {
  const link = heading.find('a').first()

  if (link.length === 0) {
    return undefined
  }

  return link.attr('href') || undefined
}

function parseSources(): DndSource[] {
  const sources: DndSource[] = []
  const seen = new Set<string>()

  let category: DndSourceCategory | null = null

  $('h2, h3').each((_, element) => {
    const tagName = element.tagName.toLowerCase()
    const heading = $(element)
    const text = cleanText(heading.text())

    if (!text) {
      return
    }

    if (tagName === 'h2') {
      category = normalizeCategory(text)
      return
    }

    if (tagName !== 'h3' || !category) {
      return
    }

    /*
     * Не каждый h3 является источником.
     * Источник должен находиться внутри текущей секции.
     */
    const localizedName = getLocalizedName(heading)

    /*
     * Если h3 похож на локализованное название,
     * это не самостоятельный источник.
     */
    if (looksLikeLocalizedName(text)) {
      return
    }

    const name = text
    const id = slugify(name)

    if (!id || seen.has(id)) {
      return
    }

    seen.add(id)

    const url = getUrl(heading)
    const shortName = getShortName(localizedName)

    sources.push({
      id,
      name,
      ...(shortName ? { shortName } : {}),
      ...(localizedName ? { localizedName } : {}),
      category,
      ...(url ? { url } : {}),
    })
  })

  return sources
}

const sources = parseSources()

fs.mkdirSync(
  OUTPUT_DIR,
  { recursive: true }
)

fs.writeFileSync(
  OUTPUT_FILE,
  JSON.stringify(
    sources,
    null,
    2
  ),
  'utf-8'
)

const counts = sources.reduce<
  Record<string, number>
>((result, source) => {
  result[source.category] =
    (result[source.category] || 0) + 1

  return result
}, {})

console.log('')
console.log('=== D&D SU SOURCES PARSER ===')
console.log(`Всего источников: ${sources.length}`)
console.log('')

for (const [category, count] of Object.entries(counts)) {
  console.log(`${category}: ${count}`)
}

console.log('')
console.log(`JSON: ${OUTPUT_FILE}`)
console.log('')
