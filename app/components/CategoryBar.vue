<script setup lang="ts">
import type { Category } from '~/composables/useWishes'

/** '' = all, NO_CATEGORY = uncategorized, otherwise a category id */
const props = defineProps<{
  categories: Category[]
  counts: Record<string, number>
}>()
const model = defineModel<string>({ required: true })
const emit = defineEmits<{ manage: [] }>()

const chips = computed(() => [
  { id: '', name: 'ทุกหมวด', color: '', count: props.counts[''] ?? 0 },
  ...props.categories.map(c => ({ id: c.id, name: c.name, color: CATEGORY_COLORS[c.color], count: props.counts[c.id] ?? 0 })),
  ...((props.counts[NO_CATEGORY] ?? 0) > 0 && props.categories.length ? [{ id: NO_CATEGORY, name: 'ไม่มีหมวด', color: '', count: props.counts[NO_CATEGORY]! }] : []),
])
</script>

<template>
  <div class="-mx-5 flex items-center gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
    <button
      v-for="c in chips"
      :key="c.id"
      type="button"
      :aria-pressed="model === c.id"
      class="inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition duration-200 active:scale-95"
      :class="model === c.id ? 'bg-ink text-bg' : 'bg-card text-ink ring-1 ring-line hover:-translate-y-px hover:shadow-sm hover:ring-sub/30'"
      @click="model = c.id"
    >
      <span v-if="c.color" class="size-2 rounded-full" :style="{ background: c.color }" aria-hidden="true" />
      {{ c.name }}
      <span class="tabular-nums" :class="model === c.id ? 'opacity-60' : 'text-sub'">{{ c.count }}</span>
    </button>
    <button
      type="button"
      class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-accent transition hover:bg-accent/10 active:scale-95"
      @click="emit('manage')"
    >
      <svg viewBox="0 0 16 16" class="size-3.5 fill-none stroke-current stroke-[1.6]" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke-linecap="round" /></svg>
      {{ categories.length ? 'จัดการหมวด' : 'สร้างหมวด' }}
    </button>
  </div>
</template>
