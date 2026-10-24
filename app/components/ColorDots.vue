<script setup lang="ts">
import type { CategoryColor } from '~/composables/useWishes'

const model = defineModel<CategoryColor>({ required: true })
const keys = Object.keys(CATEGORY_COLORS) as CategoryColor[]
</script>

<template>
  <div role="radiogroup" aria-label="สีของหมวด" class="flex flex-wrap gap-2.5">
    <button
      v-for="k in keys"
      :key="k"
      type="button"
      role="radio"
      :aria-checked="model === k"
      :aria-label="k"
      class="grid size-7 place-items-center rounded-full transition hover:scale-110 active:scale-95"
      :style="{ background: CATEGORY_COLORS[k] }"
      @click="model = k"
    >
      <span v-if="model === k" class="size-2.5 rounded-full bg-white" />
    </button>
  </div>
</template>
