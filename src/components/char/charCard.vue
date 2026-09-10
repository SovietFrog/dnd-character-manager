<script setup lang="ts">
import type { Character } from '../../models/character'

defineProps<{
  character: Character
}>()

const emit = defineEmits<{
  delete: [id: string]
}>()
</script>

<template>
  <div class="character-card">
    <div class="character-card__info">
      <h2 class="character-card__name">
        {{ character.name }}
      </h2>

      <p class="character-card__description">
        {{ character.race }}
        ·
        {{ character.class }}
        ·
        {{ character.level }} уровень
      </p>

      <p class="character-card__hp">
        HP:
        {{ character.hitPoints.current }}
        /
        {{ character.hitPoints.maximum }}
      </p>
    </div>

    <button
      class="character-card__delete"
      @click="emit('delete', character.id)"
    >
      Удалить
    </button>
  </div>
</template>

<style scoped lang="scss">
.character-card {
  display: flex;
  align-items: center;
  justify-content: space-between;

  padding: 18px;

  background: #fff;
  border-radius: 14px;

  &__name {
    margin: 0 0 6px;
  }

  &__description,
  &__hp {
    margin: 4px 0;
    color: #666;
  }

  &__delete {
    padding: 8px 12px;

    background: transparent;
    color: #c33;
  }
}
</style>
