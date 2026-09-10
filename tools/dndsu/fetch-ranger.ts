import fs from 'node:fs'
import path from 'node:path'

const CLASS_ID = 'ranger'
const URL = 'https://dnd.su/class/97-ranger/'

const OUTPUT_DIR = path.resolve(
  'tools/dndsu/data'
)

const OUTPUT_FILE = path.join(
  OUTPUT_DIR,
  `${CLASS_ID}.html`
)

async function main() {
  console.log(`Загрузка: ${URL}`)

  const response = await fetch(URL)

  if (!response.ok) {
    throw new Error(
      `Ошибка HTTP: ${response.status} ${response.statusText}`
    )
  }

  const html = await response.text()

  fs.mkdirSync(
    OUTPUT_DIR,
    { recursive: true }
  )

  fs.writeFileSync(
    OUTPUT_FILE,
    html,
    'utf-8'
  )

  console.log('Готово.')
  console.log(`Размер: ${html.length} символов`)
  console.log(`Файл: ${OUTPUT_FILE}`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
