import Dexie, { type Table } from 'dexie'
import type { Character } from '../models/character'

export class DndDatabase extends Dexie {
  characters!: Table<Character, string>

  constructor() {
    super('DndCharacterManager')

    this.version(1).stores({
      characters: 'id, name'
    })
  }
}

export const db = new DndDatabase()
