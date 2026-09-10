import fs from 'node:fs'
import path from 'node:path'

import { parseClass } from './parser'

const CLASS_ID = 'rogue'

const INPUT_FILE = path.resolve(
  `tools/dndsu/data/${CLASS_ID}.html`
)

const OUTPUT_DIR = path.resolve(
  'src/data/classes'
)

const OUTPUT_FILE = path.join(
  OUTPUT_DIR,
  `${CLASS_ID}.json`
)

if (!fs.existsSync(INPUT_FILE)) {
  throw new Error(
    `HTML-файл не найден:\n${INPUT_FILE}\n\n` +
    `Сначала запусти: npm run dndsu:fetch:rogue`
  )
}

const html = fs.readFileSync(
  INPUT_FILE,
  'utf-8'
)

const dndClass = parseClass({
  id: CLASS_ID,
  html,
})

fs.mkdirSync(
  OUTPUT_DIR,
  { recursive: true }
)

fs.writeFileSync(
  OUTPUT_FILE,
  JSON.stringify(
    dndClass,
    null,
    2
  ),
  'utf-8'
)

console.log('')
console.log('=== D&D SU PARSER ===')
console.log(`Класс: ${dndClass.name}`)
console.log(`Уровней: ${dndClass.levels.length}`)
console.log(`Умений: ${dndClass.features.length}`)
console.log(`Происхождений: ${dndClass.origins.length}`)
console.log('')
console.log(`JSON: ${OUTPUT_FILE}`)
console.log('')
