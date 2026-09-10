<script setup lang="ts">
import { onMounted } from 'vue'

import CharacterCard from '../components/char/charCard.vue'
import ClassList from '../components/char/classList.vue'
import { useCharacterStore } from '../stores/char'

const characterStore = useCharacterStore()

onMounted(() => {
  characterStore.loadCharacters()
})
</script>

<template>
  <main class="characters-page">
    <header class="page-header">
      <div>
        <h1>Мои персонажи</h1>

        <p>
          D&D Character Manager
        </p>
      </div>

      <button
        class="create-button"
        @click="characterStore.createCharacter"
      >
        + Создать
      </button>
    </header>

    <ClassList />

    <div
      v-if="characterStore.loading"
      class="state"
    >
      Загрузка...
    </div>

    <div
      v-else-if="characterStore.characters.length === 0"
      class="state"
    >
      <h2>Персонажей пока нет</h2>
      <p>Создай первого персонажа</p>
    </div>

    <div
      v-else
      class="characters-list"
    >
      <CharacterCard
        v-for="character in characterStore.characters"
        :key="character.id"
        :character="character"
        @delete="characterStore.deleteCharacter"
      />
    </div>
  </main>
</template>

<style scoped lang="scss">
.characters-page {
  width: min(900px, 100%);
  margin: 0 auto;
  padding: 32px 20px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  margin-bottom: 24px;

  h1 {
    margin: 0 0 4px;
  }

  p {
    margin: 0;
    color: #777;
  }
}

.create-button {
  padding: 10px 16px;

  border-radius: 10px;
  background: #1f1f1f;
  color: #fff;
}

.characters-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.state {
  padding: 60px 20px;
  text-align: center;

  color: #777;

  h2 {
    margin-bottom: 8px;
    color: #1f1f1f;
  }
}
</style>
