import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { Character } from '../models/character'
import { characterRepository } from '../db/repo/charRepo'

export const useCharacterStore = defineStore('characters', () => {
  const characters = ref<Character[]>([])
  const loading = ref(false)

  async function loadCharacters() {
    loading.value = true

    try {
      characters.value = await characterRepository.getAll()
    } finally {
      loading.value = false
    }
  }

  async function createCharacter() {
    const character: Character = {
      id: crypto.randomUUID(),
      name: 'Новый персонаж',
      race: 'Не выбрано',
      class: 'Не выбрано',
      level: 1,
      hitPoints: {
        current: 1,
        maximum: 1
      }
    }

    await characterRepository.save(character)
    characters.value.push(character)
  }

  async function deleteCharacter(id: string) {
    await characterRepository.delete(id)

    characters.value = characters.value.filter(
      character => character.id !== id
    )
  }

  return {
    characters,
    loading,
    loadCharacters,
    createCharacter,
    deleteCharacter
  }
})
