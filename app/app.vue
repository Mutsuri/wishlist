<script setup lang="ts">
import type { Wish } from '~/composables/useWishes'

const { items, categories, upsert, remove, toggle, categoryOf } = useWishes()
const { rates } = useRates()
/** Baht value for totals and sorting; a foreign price with no rate yet counts as 0 */
const thb = (w: Wish) => priceThb(w, rates.value) ?? 0

/** '' = all, NO_CATEGORY = uncategorized, otherwise a category id */
const catFilter = ref('')
try { catFilter.value = localStorage.getItem('wishlist:view-cat') ?? '' }
catch { /* ignore */ }
watch(catFilter, (v) => { try { localStorage.setItem('wishlist:view-cat', v) } catch { /* ignore */ } })
const currentCat = computed(() => categories.value.find(c => c.id === catFilter.value))
// A deleted category falls back to showing everything.
watchEffect(() => {
  if (catFilter.value && catFilter.value !== NO_CATEGORY && !currentCat.value) catFilter.value = ''
})
const catCounts = computed(() => {
  const m: Record<string, number> = { '': items.value.length }
  for (const w of items.value) {
    const k = w.cat || NO_CATEGORY
    m[k] = (m[k] ?? 0) + 1
  }
  return m
})
/** Items in the selected category; everything below (summary, list) works on this. */
const scoped = computed(() => {
  if (!catFilter.value) return items.value
  if (catFilter.value === NO_CATEGORY) return items.value.filter(w => !w.cat)
  return items.value.filter(w => w.cat === catFilter.value)
})

type Filter = 'want' | 'done' | 'all'
type Sort = 'new' | 'cheap' | 'pricey'
const filter = ref<Filter>('want')
const sort = ref<Sort>('new')
const filterOptions = computed<{ value: Filter, label: string }[]>(() => [
  { value: 'want', label: `ยังไม่ได้ · ${want.value.length}` },
  { value: 'done', label: `ได้แล้ว · ${doneCount.value}` },
  { value: 'all', label: `ทั้งหมด · ${scoped.value.length}` },
])
const sortOptions: { value: Sort, label: string }[] = [
  { value: 'new', label: 'เพิ่มล่าสุด' },
  { value: 'cheap', label: 'ราคาถูกก่อน' },
  { value: 'pricey', label: 'ราคาแพงก่อน' },
]

// The form opens in a modal: centered dialog on PC, bottom sheet on phones.
const modalOpen = ref(false)
const editing = ref<Wish | null>(null)
const formKey = ref(0)
const modalForm = ref<{ focus: () => void }>()
const catsOpen = ref(false)
const catManager = ref<{ focus: () => void }>()

const want = computed(() => scoped.value.filter(i => !i.done))
const total = computed(() => want.value.reduce((a, i) => a + thb(i), 0))
const doneCount = computed(() => scoped.value.length - want.value.length)
const doneTotal = computed(() => scoped.value.reduce((a, i) => a + (i.done ? thb(i) : 0), 0))

const heading = computed(() => currentCat.value?.name ?? (catFilter.value === NO_CATEGORY ? 'ไม่มีหมวด' : 'ของที่อยากได้'))

const view = computed(() => {
  const list = scoped.value.filter(i => filter.value === 'all' || (filter.value === 'done' ? i.done : !i.done))
  const cmp: Record<Sort, (a: Wish, b: Wish) => number> = {
    new: (a, b) => b.created - a.created,
    cheap: (a, b) => thb(a) - thb(b),
    pricey: (a, b) => thb(b) - thb(a),
  }
  return [...list].sort((a, b) => (Number(a.done) - Number(b.done)) || cmp[sort.value](a, b))
})

async function openForm(w: Wish | null) {
  editing.value = w ? { ...w, shops: [...w.shops] } : null
  formKey.value++
  modalOpen.value = true
  await nextTick()
  // Phones would pop the keyboard over the sheet animation; let them tap a field.
  if (window.matchMedia('(min-width: 1024px)').matches) modalForm.value?.focus()
}
function onSave(w: Wish) {
  upsert(w)
  closeForm()
}
function closeForm() {
  editing.value = null
  modalOpen.value = false
}
function onRemove(id: string) {
  if (editing.value?.id === id) closeForm()
  remove(id)
}
async function openCats() {
  catsOpen.value = true
  await nextTick()
  if (window.matchMedia('(min-width: 1024px)').matches || !categories.value.length) catManager.value?.focus()
}

watch([modalOpen, catsOpen], ([a, b]) => { document.documentElement.style.overflow = a || b ? 'hidden' : '' })
const onKey = (e: KeyboardEvent) => {
  if (e.key !== 'Escape') return
  if (modalOpen.value) closeForm()
  else if (catsOpen.value) catsOpen.value = false
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="min-h-dvh bg-bg font-sans text-ink">
    <!-- Translucent nav bar -->
    <header class="sticky top-0 z-30 border-b border-line bg-bg/75 pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-150">
      <div class="mx-auto flex h-13 max-w-[1200px] items-center justify-between pr-[max(20px,env(safe-area-inset-right))] pl-[max(20px,env(safe-area-inset-left))]">
        <span class="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em]">
          <svg viewBox="0 0 24 24" class="size-5 fill-none stroke-accent stroke-[1.8]" aria-hidden="true">
            <rect x="3.5" y="9" width="17" height="11.5" rx="2" /><path d="M2.5 9h19M12 9v11.5M12 9c-1.5-3.5-6-4.5-6-1.8C6 9 12 9 12 9zm0 0c1.5-3.5 6-4.5 6-1.8C18 9 12 9 12 9z" stroke-linejoin="round" />
          </svg>
          Wishbook
        </span>
        <div class="flex items-center gap-3">
          <ThemeToggle />
          <button
            type="button"
            class="rounded-full bg-accent px-4 py-1.5 text-[13px] font-medium text-white transition duration-200 hover:-translate-y-px hover:shadow-[0_6px_16px_-4px_var(--color-accent)] hover:brightness-110 active:translate-y-0 active:scale-95"
            @click="openForm(null)"
          >
            + เพิ่มของใหม่
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-[1200px] pt-10 pr-[max(20px,env(safe-area-inset-right))] pb-[calc(6rem+env(safe-area-inset-bottom))] pl-[max(20px,env(safe-area-inset-left))] lg:pt-12">
      <!-- Hero + summary -->
      <section>
        <CategoryBar v-model="catFilter" :categories="categories" :counts="catCounts" class="mb-8" @manage="openCats" />

        <h1 class="flex items-center gap-3 text-[32px] leading-tight font-semibold tracking-[-0.03em] break-words lg:text-[44px]">
          <span v-if="currentCat" class="size-3 shrink-0 rounded-full lg:size-3.5" :style="{ background: CATEGORY_COLORS[currentCat.color] }" aria-hidden="true" />
          <span class="min-w-0">{{ heading }}</span>
        </h1>
        <p class="mt-1.5 text-[16px] text-sub lg:text-[18px]">
          <template v-if="catFilter && scoped.length">ทั้งชุด {{ scoped.length }} ชิ้น รวม {{ baht(total + doneTotal) }}</template>
          <template v-else-if="catFilter">ยังไม่มีของในหมวดนี้</template>
          <template v-else>จดไว้ที่เดียว ได้มาแล้วก็ติ๊กออก</template>
        </p>
      </section>

      <div class="mt-6">
        <section class="min-w-0">
          <div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SegmentedControl v-model="filter" :options="filterOptions" label="แสดง" />
            <PopupMenu v-model="sort" :options="sortOptions" label="เรียง" class="self-start sm:self-auto" />
          </div>

          <ul v-if="view.length" class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <WishCard
              v-for="w in view"
              :key="w.id"
              :wish="w"
              :category="catFilter ? undefined : categoryOf(w)"
              @toggle="toggle(w.id)"
              @edit="openForm(w)"
              @remove="onRemove(w.id)"
            />
          </ul>
          <div v-else class="flex flex-col items-center rounded-2xl bg-card px-6 py-16 text-center ring-1 ring-line">
            <svg viewBox="0 0 24 24" class="size-10 fill-none stroke-sub/60 stroke-[1.4]" aria-hidden="true">
              <rect x="3.5" y="9" width="17" height="11.5" rx="2" /><path d="M2.5 9h19M12 9v11.5M12 9c-1.5-3.5-6-4.5-6-1.8C6 9 12 9 12 9zm0 0c1.5-3.5 6-4.5 6-1.8C18 9 12 9 12 9z" stroke-linejoin="round" />
            </svg>
            <p class="mt-4 text-[19px] font-semibold tracking-[-0.01em]">
              {{ filter === 'done' ? 'ยังไม่มีของที่ได้มา' : (catFilter ? 'ยังไม่มีของในหมวดนี้' : 'ยังไม่มีของในสมุด') }}
            </p>
            <p class="mt-1 text-[15px] text-sub">
              {{ filter === 'done' ? 'กดวงกลมหน้าของที่ได้มาแล้ว มันจะมาอยู่ตรงนี้' : (currentCat ? `ของที่เพิ่มตอนนี้จะอยู่ในหมวด “${currentCat.name}”` : 'จดของชิ้นแรกที่อยากได้ไว้ตรงนี้') }}
            </p>
            <button
              v-if="filter !== 'done'"
              type="button"
              class="mt-5 rounded-full bg-accent px-5 py-2 text-[15px] font-medium text-white transition duration-200 hover:-translate-y-px hover:shadow-[0_6px_16px_-4px_var(--color-accent)] hover:brightness-110 active:translate-y-0 active:scale-95"
              @click="openForm(null)"
            >
              + เพิ่มของใหม่
            </button>
          </div>
        </section>
      </div>
    </main>

    <SheetModal :open="modalOpen" :label="editing ? 'แก้ไข' : 'เพิ่มของใหม่'" @close="closeForm">
      <WishForm
        ref="modalForm"
        :key="formKey"
        :item="editing"
        :default-cat="currentCat?.id"
        @save="onSave"
        @cancel="closeForm"
      />
    </SheetModal>
    <SheetModal :open="catsOpen" label="หมวดหมู่" @close="catsOpen = false">
      <CategoryManager ref="catManager" @close="catsOpen = false" @created="catFilter = $event" />
    </SheetModal>
  </div>
</template>
