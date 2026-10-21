import fs from 'node:fs'
import path from 'node:path'

const URL =
  'https://dnd.su/articles/lore/321-sources-and-translations/'

const OUTPUT_DIR = path.resolve('tools/dndsu/data')
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'sources.html')

async function main() {
  console.log('Загрузка страницы источников...')

  const response = await fetch(URL)

  if (!response.ok) {
    throw new Error(
      `Ошибка загрузки: ${response.status} ${response.statusText}`
    )
  }

  const html = await response.text()

  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  fs.writeFileSync(
    OUTPUT_FILE,
    html,
    'utf-8'
  )

  console.log('')
  console.log('=== D&D SU SOURCES FETCH ===')
  console.log(`Источник: ${URL}`)
  console.log(`HTML: ${OUTPUT_FILE}`)
  console.log(`Размер: ${html.length} символов`)
  console.log('')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
