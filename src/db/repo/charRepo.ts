import { db } from '../database'
import type { Character } from '../../models/character'

export const characterRepository = {
  async getAll(): Promise<Character[]> {
    return db.characters.toArray()
  },

  async getById(id: string): Promise<Character | undefined> {
    return db.characters.get(id)
  },

  async save(character: Character): Promise<void> {
    await db.characters.put(character)
  },

  async delete(id: string): Promise<void> {
    await db.characters.delete(id)
  }
}
