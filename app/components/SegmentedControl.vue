<script setup lang="ts" generic="T extends string | number">
defineProps<{
  options: { value: T, label: string }[]
  label: string
}>()
const model = defineModel<T>({ required: true })
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="label"
    class="inline-flex w-full gap-1 rounded-[9px] bg-fill p-0.5 sm:w-auto"
  >
    <button
      v-for="o in options"
      :key="o.value"
      type="button"
      role="radio"
      :aria-checked="model === o.value"
      class="flex-1 whitespace-nowrap rounded-[7px] px-4 py-1 text-[13px] font-medium transition active:scale-[0.97] sm:flex-none"
      :class="model === o.value
        ? 'bg-card text-ink shadow-[0_1px_3px_rgb(0_0_0/0.12),0_1px_1px_rgb(0_0_0/0.04)]'
        : 'text-sub hover:bg-card/50 hover:text-ink'"
      @click="model = o.value"
    >
      {{ o.label }}
    </button>
  </div>
</template>
