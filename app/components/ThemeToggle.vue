<script setup lang="ts">
import type { ThemeChoice } from '~/composables/useTheme'

const theme = useTheme()
const options: { value: ThemeChoice, label: string }[] = [
  { value: 'light', label: 'สว่าง' },
  { value: 'dark', label: 'มืด' },
]
</script>

<template>
  <div role="radiogroup" aria-label="ธีม" class="inline-flex rounded-full bg-fill p-0.5">
    <button
      v-for="o in options"
      :key="o.value"
      type="button"
      role="radio"
      :aria-checked="theme === o.value"
      :aria-label="o.label"
      :title="o.label"
      class="grid size-7 place-items-center rounded-full transition active:scale-90"
      :class="theme === o.value ? 'bg-card text-ink shadow-[0_1px_3px_rgb(0_0_0/0.15)]' : 'text-sub hover:bg-card/60 hover:text-ink'"
      @click="theme = o.value"
    >
      <!-- sun -->
      <svg v-if="o.value === 'light'" viewBox="0 0 20 20" class="size-4 fill-none stroke-current stroke-[1.6]" aria-hidden="true">
        <circle cx="10" cy="10" r="3.2" />
        <path d="M10 2.5v1.8M10 15.7v1.8M2.5 10h1.8M15.7 10h1.8M4.7 4.7l1.3 1.3M14 14l1.3 1.3M4.7 15.3L6 14M14 6l1.3-1.3" stroke-linecap="round" />
      </svg>
      <!-- moon -->
      <svg v-else viewBox="0 0 20 20" class="size-4 fill-none stroke-current stroke-[1.6]" aria-hidden="true">
        <path d="M16 12.3A6.5 6.5 0 0 1 7.7 4a6.5 6.5 0 1 0 8.3 8.3z" stroke-linejoin="round" />
      </svg>
    </button>
  </div>
</template>
