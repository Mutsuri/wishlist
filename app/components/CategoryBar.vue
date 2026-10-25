<script setup lang="ts">
import type { Category } from '~/composables/useWishes'

/** '' = all, NO_CATEGORY = uncategorized, otherwise a category id */
const props = defineProps<{
  categories: Category[]
  counts: Record<string, number>
}>()
const model = defineModel<string>({ required: true })
const emit = defineEmits<{ manage: [] }>()

// No "all" chip: tap a category to filter, tap it again to show everything.
const chips = computed(() => [
  // Starred first: the shortlist across every category
  { id: STARRED, name: 'ติดดาว', color: '', star: true, count: props.counts[STARRED] ?? 0 },
  ...props.categories.map(c => ({ id: c.id, name: c.name, color: CATEGORY_COLORS[c.color], count: props.counts[c.id] ?? 0 })),
  ...((props.counts[NO_CATEGORY] ?? 0) > 0 && props.categories.length ? [{ id: NO_CATEGORY, name: 'ไม่มีหมวด', color: '', count: props.counts[NO_CATEGORY]! }] : []),
])
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <button
      v-for="c in chips"
      :key="c.id"
      type="button"
      :aria-pressed="model === c.id"
      class="inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition duration-200 active:scale-95"
      :class="model === c.id ? 'bg-ink text-bg' : 'bg-card text-ink ring-1 ring-line hover:-translate-y-px hover:shadow-sm hover:ring-sub/30'"
      @click="model = model === c.id ? '' : c.id"
    >
      <svg v-if="'star' in c" viewBox="0 0 20 20" class="-mx-0.5 size-3.5 fill-[#ffb800] stroke-[#ffb800] stroke-[1.5]" aria-hidden="true">
        <path d="M10 2.8l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 8.1l5-.7L10 2.8z" stroke-linejoin="round" />
      </svg>
      <span v-else-if="c.color" class="size-2 rounded-full" :style="{ background: c.color }" aria-hidden="true" />
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
