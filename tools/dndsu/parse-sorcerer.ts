import fs from 'node:fs'
import path from 'node:path'
import * as cheerio from 'cheerio'

const INPUT_FILE = path.resolve(
  'tools/dndsu/data/sorcerer.html'
)

if (!fs.existsSync(INPUT_FILE)) {
  throw new Error(
    `HTML-файл не найден:\n${INPUT_FILE}\n\n` +
    `Сначала запусти: npm run dndsu:fetch`
  )
}

const html = fs.readFileSync(
  INPUT_FILE,
  'utf-8'
)

const $ = cheerio.load(html)

console.log('=== TITLE ===')

const title = $('.card-title').first().text().trim()

console.log(title)

console.log('\n=== SOURCE ===')

const source = $('.params').first().text().trim()

console.log(source)

console.log('\n=== FEATURES ===')

const features = new Map<string, string>()

$('a[href^="#feature."]').each((_, element) => {
  const href = $(element).attr('href')

  if (!href) {
    return
  }

  const id = href.replace('#feature.', '')
  const name = $(element)
    .find('.new-article-menu__li-text')
    .text()
    .trim()

  if (!name) {
    return
  }

  features.set(id, name)
})

for (const [id, name] of features) {
  console.log(`${id} → ${name}`)
}

console.log('\n=== SPELLS ===')

const spells = new Map<string, {
  slug: string
  ru: string
  en: string
}>()

$('a[href^="/spells/"]').each((_, element) => {
  const href = $(element).attr('href')

  if (!href) {
    return
  }

  const match = href.match(
    /^\/spells\/(\d+)-([^/]+)\/?$/
  )

  if (!match) {
    return
  }

  const [, id, slug] = match
  const text = $(element).text().trim()

  const englishMatch = text.match(
    /^(.+?)\s*\[([^\]]+)\]$/
  )

  if (!englishMatch) {
    return
  }

  const [, ru, en] = englishMatch

  spells.set(id, {
    slug,
    ru: ru.trim(),
    en: en.trim()
  })
})

for (const [id, spell] of spells) {
  console.log(
    `${id} → ${spell.ru} → ${spell.en}`
  )
}

console.log('\n=== SUMMARY ===')

console.log(`Способностей: ${features.size}`)
console.log(`Заклинаний: ${spells.size}`)

console.log('\n=== HEADINGS ===')

$('h1, h2, h3, h4, h5').each((_, element) => {
  const tag = element.tagName
  const text = $(element)
    .text()
    .replace(/\s+/g, ' ')
    .trim()

  if (text) {
    console.log(`${tag}: ${text}`)
  }
})

console.log('\n=== FEATURES ===')

$('[id^="feature."]').each((_, element) => {
  const id = $(element).attr('id')

  if (!id) {
    return
  }

  const featureId = id.replace('feature.', '')

  const parent = $(element).parent()

  console.log(`\n--- ${featureId} ---`)
  console.log(
    parent
      .text()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1000)
  )
})

console.log('\n=== METAMAGIC STRUCTURE ===')

const metamagic = $('[id="feature.metamagic"]').first()

if (metamagic.length === 0) {
  console.log('Не найден')
} else {
  console.log('TAG:', metamagic.prop('tagName'))
  console.log('ID:', metamagic.attr('id'))
  console.log('TEXT:', metamagic.text().trim())

  console.log('\n--- PARENTS ---')

  metamagic.parents().each((_, element) => {
    const tag = element.tagName
    const id = $(element).attr('id') ?? ''
    const className = $(element).attr('class') ?? ''

    console.log(
      `${tag}#${id}.${className}`
    )
  })

  console.log('\n--- NEXT SIBLINGS ---')

  let current = metamagic.parent()

  for (let i = 0; i < 15 && current.length; i++) {
    const tag = current.prop('tagName')
    const id = current.attr('id') ?? ''
    const className = current.attr('class') ?? ''
    const text = current
      .clone()
      .children()
      .remove()
      .end()
      .text()
      .replace(/\s+/g, ' ')
      .trim()

    console.log(
      `${i}: ${tag}#${id}.${className} → ${text.slice(0, 200)}`
    )

    current = current.next()
  }
}
