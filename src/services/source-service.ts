import sources from '../data/sources.json'

import type { DndSource } from '../../tools/dndsu/types'

const sourceList = sources as DndSource[]

const sourcesById = new Map(
  sourceList.map(source => [
    source.id,
    source,
  ])
)

function normalizeSourceName(
  value: string
): string {
  return value
    // Удаляем Unicode control/format characters.
    // Сюда попадут невидимые символы вроде того,
    // который оказался между ’ и s в Tasha’‎s.
    .replace(/[\p{C}]/gu, '')

    // Все варианты апострофа → обычный
    .replace(/[’‘‛`´]/g, "'")

    // Кавычки
    .replace(/[«»"]/g, '')

    // Длинные тире
    .replace(/[–—]/g, '-')

    // Апострофы не участвуют в сравнении
    .replace(/'/g, '')

    // Остальные разделители → пробел
    .replace(/[^a-zа-я0-9]+/gi, ' ')

    // Лишние пробелы
    .replace(/\s+/g, ' ')

    .trim()
}

function getSourceNames(
  source: DndSource
): string[] {
  return [
    source.name,
    source.localizedName,
    source.shortName,
  ]
    .filter(
      (value): value is string =>
        Boolean(value)
    )
    .map(normalizeSourceName)
}

function sourceMatches(
  source: DndSource,
  value: string
): boolean {
  const normalizedValue =
    normalizeSourceName(value)

  if (!normalizedValue) {
    return false
  }

  const names =
    getSourceNames(source)

  /*
   * 1. Полное совпадение
   */
  if (
    names.some(
      name => name === normalizedValue
    )
  ) {
    return true
  }

  /*
   * 2. Одно название является частью другого
   *
   * Например:
   *
   * Sprouting Chaos
   * Sprouting Chaos Player's Companion
   */
  if (
    names.some(name =>
      normalizedValue.includes(name) ||
      name.includes(normalizedValue)
    )
  ) {
    return true
  }

  return false
}

export function getSourceById(
  id: string
): DndSource | undefined {
  return sourcesById.get(id)
}

export function findSource(
  name: string
): DndSource | undefined {
  const normalizedName =
    normalizeSourceName(name)

  if (!normalizedName) {
    return undefined
  }

  /*
   * Сначала ищем точное совпадение.
   */
  const exact =
    sourceList.find(source =>
      getSourceNames(source).some(
        sourceName =>
          sourceName === normalizedName
      )
    )

  if (exact) {
    return exact
  }

  /*
   * Затем частичное совпадение.
   */
  const partial =
    sourceList.find(source =>
      sourceMatches(
        source,
        name
      )
    )

  if (partial) {
    return partial
  }

  /*
   * Unearthed Arcana — Ranger and Rogue
   *
   * На странице класса указывается
   * конкретный выпуск UA, а справочник
   * содержит общий источник Unearthed Arcana.
   */
  if (
    normalizedName.startsWith(
      'unearthed arcana '
    )
  ) {
    return sourceList.find(source =>
      normalizeSourceName(
        source.name
      ) === 'unearthed arcana'
    )
  }

  return undefined
}

export function getAllSources(): DndSource[] {
  return sourceList
}
