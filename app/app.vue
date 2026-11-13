<script setup lang="ts">
import type { Removed, Wish } from '~/composables/useWishes'

const { items, categories, upsert, remove, restore, toggle, toggleStar, categoryOf, parentOf, childrenOf, tagRank, tagOf } = useWishes()
const { rates } = useRates()
/** Baht value for totals and sorting; a foreign price with no rate yet counts as 0 */
const thb = (w: Wish) => priceThb(w, rates.value) ?? 0

/** '' = all, STARRED = starred, NO_CATEGORY = uncategorized, otherwise a category id */
const catFilter = ref('')
try { catFilter.value = localStorage.getItem('wishlist:view-cat') ?? '' }
catch { /* ignore */ }
watch(catFilter, (v) => { try { localStorage.setItem('wishlist:view-cat', v) } catch { /* ignore */ } })
const currentCat = computed(() => categories.value.find(c => c.id === catFilter.value))
// A deleted category falls back to showing everything.
watchEffect(() => {
  if (catFilter.value && catFilter.value !== NO_CATEGORY && catFilter.value !== STARRED && !currentCat.value) catFilter.value = ''
})
const catCounts = computed(() => {
  const m: Record<string, number> = { '': items.value.length, [STARRED]: 0 }
  for (const w of items.value) {
    const k = w.cat || NO_CATEGORY
    m[k] = (m[k] ?? 0) + 1
    if (w.star) m[STARRED]!++
  }
  return m
})
/** Items in the selected category; everything below (summary, list) works on this. */
const scoped = computed(() => {
  if (!catFilter.value) return items.value
  if (catFilter.value === STARRED) return items.value.filter(w => w.star)
  if (catFilter.value === NO_CATEGORY) return items.value.filter(w => !w.cat)
  return items.value.filter(w => w.cat === catFilter.value)
})

type Filter = 'want' | 'done' | 'all'
type Sort = 'new' | 'when' | 'cheap' | 'pricey'
const filter = ref<Filter>('want')
const sort = ref<Sort>('new')
const filterOptions = computed<{ value: Filter, label: string }[]>(() => [
  { value: 'want', label: `ยังไม่ได้ · ${want.value.length}` },
  { value: 'done', label: `ได้แล้ว · ${doneCount.value}` },
  { value: 'all', label: `ทั้งหมด · ${scoped.value.length}` },
])
const sortOptions: { value: Sort, label: string }[] = [
  { value: 'new', label: 'เพิ่มล่าสุด' },
  { value: 'when', label: 'ต้องซื้อก่อน' },
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

const heading = computed(() => currentCat.value?.name
  ?? ({ [NO_CATEGORY]: 'ไม่มีหมวด', [STARRED]: 'ติดดาว' } as Record<string, string>)[catFilter.value]
  ?? 'ของที่อยากได้')

// Search: name, note, shops, category, tag; a card also matches through what's bought with it.
const query = ref('')
const searchEl = ref<HTMLInputElement>()
const words = computed(() => query.value.trim().toLowerCase().split(/\s+/).filter(Boolean))
function textOf(w: Wish) {
  return [w.name, w.note, categoryOf(w)?.name, tagOf(w)?.label, ...w.shops.map(shopName), w.link ? 'official' : '']
    .filter(Boolean).join(' ').toLowerCase()
}
const matches = (w: Wish) => {
  if (!words.value.length) return true
  const text = [textOf(w), ...childrenOf(w.id).map(textOf)].join(' ')
  return words.value.every(q => text.includes(q))
}

const view = computed(() => {
  // Accessories show inside their main item's card, not as cards of their own.
  const list = scoped.value.filter(i => !parentOf(i) && (filter.value === 'all' || (filter.value === 'done' ? i.done : !i.done)) && matches(i))
  const cmp: Record<Sort, (a: Wish, b: Wish) => number> = {
    new: (a, b) => b.created - a.created,
    when: (a, b) => (tagRank(a) - tagRank(b)) || (b.created - a.created),
    cheap: (a, b) => thb(a) - thb(b),
    pricey: (a, b) => thb(b) - thb(a),
  }
  // Not-yet-bought before bought; starred first within each; then the chosen order.
  return [...list].sort((a, b) => (Number(a.done) - Number(b.done)) || (Number(b.star) - Number(a.star)) || cmp[sort.value](a, b))
})

/** Main item preselected when adding an accessory from a card */
const newParent = ref('')
async function openForm(w: Wish | null, parentId = '') {
  editing.value = w ? { ...w, shops: [...w.shops] } : null
  newParent.value = w ? '' : parentId
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
// A delete happens right away; the toast below can bring it back for a few seconds.
const undo = ref<{ removed: Removed, kids: number } | null>(null)
let undoTimer: ReturnType<typeof setTimeout> | undefined
function onRemove(id: string) {
  if (editing.value?.id === id) closeForm()
  const removed = remove(id)
  if (!removed) return
  undo.value = { removed, kids: removed.children.length }
  clearTimeout(undoTimer)
  undoTimer = setTimeout(() => { undo.value = null }, 6000)
}
function undoRemove() {
  if (undo.value) restore(undo.value.removed)
  undo.value = null
  clearTimeout(undoTimer)
}
async function openCats() {
  catsOpen.value = true
  await nextTick()
  if (window.matchMedia('(min-width: 1024px)').matches || !categories.value.length) catManager.value?.focus()
}

const { sync, connected } = useSync()
const syncOpen = ref(false)
const syncPanel = ref<{ focus: () => void }>()
const syncLabel = computed(() => ({ off: 'ยังไม่ได้เชื่อมต่อ', idle: 'เชื่อมต่อแล้ว', syncing: 'กำลัง sync', error: 'sync ไม่สำเร็จ' })[sync.status])
const syncDot = computed(() => ({ off: 'bg-sub/40', idle: 'bg-green', syncing: 'bg-accent animate-pulse', error: 'bg-red' })[sync.status])
async function openSync() {
  syncOpen.value = true
  await nextTick()
  if (sync.status === 'off') syncPanel.value?.focus()
}

watch([modalOpen, catsOpen, syncOpen], ([a, b, c]) => { document.documentElement.style.overflow = a || b || c ? 'hidden' : '' })
const onKey = (e: KeyboardEvent) => {
  // "/" or Ctrl/⌘+K jumps to search (not while typing somewhere or with a sheet open)
  const typing = e.target instanceof HTMLElement && e.target.closest('input, textarea, [contenteditable]')
  const sheetOpen = modalOpen.value || catsOpen.value || syncOpen.value
  if (connected.value && !sheetOpen && ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing))) {
    e.preventDefault()
    searchEl.value?.focus()
    searchEl.value?.select()
    return
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'z' && undo.value && !typing) {
    e.preventDefault()
    undoRemove()
    return
  }
  if (e.key !== 'Escape') return
  if (modalOpen.value) closeForm()
  else if (catsOpen.value) catsOpen.value = false
  else if (syncOpen.value) syncOpen.value = false
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
          <!-- The gift is drawn low in its box; lift it so it centers on the text -->
          <svg viewBox="0 0 24 24" class="size-5 -translate-y-[1.2px] fill-none stroke-accent stroke-[1.8]" aria-hidden="true">
            <rect x="3.5" y="9" width="17" height="11.5" rx="2" /><path d="M2.5 9h19M12 9v11.5M12 9c-1.5-3.5-6-4.5-6-1.8C6 9 12 9 12 9zm0 0c1.5-3.5 6-4.5 6-1.8C18 9 12 9 12 9z" stroke-linejoin="round" />
          </svg>
          Wishbook
        </span>
        <div class="flex items-center gap-2 sm:gap-3">
          <!-- Google Sheet sync: the dot shows its state (hidden until connected; the page itself is the connect screen) -->
          <button
            v-if="connected"
            type="button"
            class="relative grid size-8 place-items-center rounded-full text-sub transition hover:bg-fill hover:text-ink active:scale-90"
            :aria-label="`Google Sheet: ${syncLabel}`"
            :title="`Google Sheet: ${syncLabel}`"
            @click="openSync"
          >
            <svg viewBox="0 0 24 24" class="size-5 fill-none stroke-current stroke-[1.7]" aria-hidden="true">
              <path d="M7 18.5h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.5 9.6 4.5 4.5 0 0 0 7 18.5z" stroke-linejoin="round" />
            </svg>
            <span class="absolute right-1 bottom-1.5 size-2 rounded-full ring-2 ring-bg" :class="syncDot" aria-hidden="true" />
          </button>
          <ThemeToggle />
          <button
            v-if="connected"
            type="button"
            class="rounded-full bg-accent px-4 py-1.5 text-[13px] font-medium text-white transition duration-200 hover:-translate-y-px hover:shadow-[0_6px_16px_-4px_var(--color-accent)] hover:brightness-110 active:translate-y-0 active:scale-95"
            @click="openForm(null)"
          >
            + เพิ่ม<span class="hidden sm:inline">ของใหม่</span>
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-[1200px] pr-[max(20px,env(safe-area-inset-right))] pb-[calc(6rem+env(safe-area-inset-bottom))] pl-[max(20px,env(safe-area-inset-left))] pt-6 lg:pt-10">
      <ConnectScreen v-if="!connected" />
      <template v-else>
      <!-- Hero + summary -->
      <section>
        <CategoryBar v-model="catFilter" :categories="categories" :counts="catCounts" class="mb-4" @manage="openCats" />

        <h1 class="flex items-center gap-3 text-[30px] leading-[1.15] font-semibold tracking-[-0.03em] break-words lg:text-[40px]">
          <span v-if="currentCat" class="size-3 shrink-0 rounded-full lg:size-3.5" :style="{ background: CATEGORY_COLORS[currentCat.color] }" aria-hidden="true" />
          <span class="min-w-0">{{ heading }}</span>
        </h1>
        <p class="mt-1 text-[15px] leading-snug text-sub lg:text-[17px]">
          <template v-if="catFilter && scoped.length">
            {{ scoped.length }} ชิ้น · รวม <span class="font-medium text-ink tabular-nums">{{ baht(total + doneTotal) }}</span>
            <template v-if="doneCount && want.length"> · ยังขาด <span class="tabular-nums">{{ baht(total) }}</span></template>
            <template v-else-if="!want.length"> · ได้ครบแล้ว</template>
          </template>
          <template v-else-if="catFilter">ยังไม่มีของในหมวดนี้</template>
          <template v-else>จดไว้ที่เดียว ได้มาแล้วก็ติ๊กออก</template>
        </p>
      </section>

      <div class="mt-5">
        <section class="min-w-0">
          <div class="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SegmentedControl v-model="filter" :options="filterOptions" label="แสดง" />
            <div class="flex items-center gap-2">
              <label class="group/search relative flex h-8 min-w-0 flex-1 items-center rounded-full bg-fill transition focus-within:bg-card focus-within:ring-1 focus-within:ring-accent sm:w-60 sm:flex-none">
                <svg viewBox="0 0 20 20" class="pointer-events-none absolute left-2.5 size-4 fill-none stroke-sub stroke-[1.8]" aria-hidden="true">
                  <circle cx="8.5" cy="8.5" r="5.5" /><path d="M13 13l4 4" stroke-linecap="round" />
                </svg>
                <input
                  ref="searchEl"
                  v-model="query"
                  type="search"
                  class="h-full min-w-0 flex-1 bg-transparent pr-8 pl-8 text-[14px] outline-none placeholder:text-sub/70 [&::-webkit-search-cancel-button]:hidden"
                  placeholder="ค้นหา"
                  aria-label="ค้นหา"
                  autocomplete="off"
                  @keydown.esc.stop="query ? (query = '') : searchEl?.blur()"
                >
                <button
                  v-if="query"
                  type="button"
                  class="absolute right-1.5 grid size-5 place-items-center rounded-full bg-sub/40 text-bg transition hover:bg-sub/60"
                  aria-label="ล้างคำค้น"
                  @click="query = ''; searchEl?.focus()"
                >
                  <svg viewBox="0 0 12 12" class="size-2.5 stroke-current stroke-2" aria-hidden="true"><path d="M3.5 3.5l5 5M8.5 3.5l-5 5" stroke-linecap="round" /></svg>
                </button>
                <kbd v-else class="pointer-events-none absolute right-2 hidden rounded border border-line px-1.5 text-[11px] leading-4 text-sub lg:block group-focus-within/search:hidden">/</kbd>
              </label>
              <PopupMenu v-model="sort" :options="sortOptions" label="เรียง" align-right compact class="shrink-0" />
            </div>
          </div>

          <!-- items-start: each card is as tall as its own content, not the tallest in its row -->
          <ul v-if="view.length" class="grid items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
            <WishCard
              v-for="w in view"
              :key="w.id"
              :wish="w"
              :category="catFilter ? undefined : categoryOf(w)"
              @toggle="toggle(w.id)"
              :children="childrenOf(w.id)"
              @star="toggleStar(w.id)"
              @edit="openForm(w)"
              @add-child="openForm(null, w.id)"
              @toggle-child="toggle($event)"
              @edit-child="openForm($event)"
              @remove="onRemove(w.id)"
            />
          </ul>
          <div v-else class="flex flex-col items-center rounded-2xl bg-card px-6 py-16 text-center ring-1 ring-line">
            <svg viewBox="0 0 24 24" class="size-10 fill-none stroke-sub/60 stroke-[1.4]" aria-hidden="true">
              <rect x="3.5" y="9" width="17" height="11.5" rx="2" /><path d="M2.5 9h19M12 9v11.5M12 9c-1.5-3.5-6-4.5-6-1.8C6 9 12 9 12 9zm0 0c1.5-3.5 6-4.5 6-1.8C18 9 12 9 12 9z" stroke-linejoin="round" />
            </svg>
            <template v-if="words.length">
              <p class="mt-4 text-[19px] font-semibold tracking-[-0.01em]">ไม่เจอ “{{ query.trim() }}”</p>
              <p class="mt-1 text-[15px] text-sub">
                {{ catFilter || filter !== 'all' ? 'ลองเลือกแสดงทั้งหมด หรือปิดตัวกรองหมวดดู' : 'ลองคำอื่น หรือพิมพ์แค่บางส่วนของชื่อ' }}
              </p>
              <button
                type="button"
                class="mt-5 rounded-full bg-fill px-5 py-2 text-[15px] font-medium transition hover:bg-line active:scale-95"
                @click="query = ''"
              >
                ล้างคำค้น
              </button>
            </template>
            <template v-else>
            <p class="mt-4 text-[19px] font-semibold tracking-[-0.01em]">
              {{ filter === 'done' ? 'ยังไม่มีของที่ได้มา' : catFilter === STARRED ? 'ยังไม่มีของที่ติดดาว' : (catFilter ? 'ยังไม่มีของในหมวดนี้' : 'ยังไม่มีของในสมุด') }}
            </p>
            <p class="mt-1 text-[15px] text-sub">
              {{ filter === 'done' ? 'กดวงกลมหน้าของที่ได้มาแล้ว มันจะมาอยู่ตรงนี้'
                : catFilter === STARRED ? 'กด ☆ บนการ์ดเพื่อเก็บของที่อยากได้ที่สุดไว้ตรงนี้'
                  : (currentCat ? `ของที่เพิ่มตอนนี้จะอยู่ในหมวด “${currentCat.name}”` : 'จดของชิ้นแรกที่อยากได้ไว้ตรงนี้') }}
            </p>
            <button
              v-if="filter !== 'done'"
              type="button"
              class="mt-5 rounded-full bg-accent px-5 py-2 text-[15px] font-medium text-white transition duration-200 hover:-translate-y-px hover:shadow-[0_6px_16px_-4px_var(--color-accent)] hover:brightness-110 active:translate-y-0 active:scale-95"
              @click="openForm(null)"
            >
              + เพิ่มของใหม่
            </button>
            </template>
          </div>
        </section>
      </div>
      </template>
    </main>

    <!-- Undo after a delete -->
    <Transition
      enter-from-class="translate-y-4 opacity-0"
      leave-to-class="translate-y-4 opacity-0"
      enter-active-class="transition duration-200 ease-out"
      leave-active-class="transition duration-150 ease-in"
    >
      <div
        v-if="undo"
        class="fixed inset-x-0 bottom-[calc(1.25rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4"
        role="status"
      >
        <div class="flex max-w-full items-center gap-4 rounded-full bg-ink py-2.5 pr-2.5 pl-5 text-[14px] text-bg shadow-[0_12px_32px_-8px_rgb(0_0_0/0.35)]">
          <span class="min-w-0 truncate">
            ลบ “{{ undo.removed.wish.name }}” แล้ว<span v-if="undo.kids" class="opacity-70"> · ของที่ซื้อคู่ {{ undo.kids }} ชิ้นแยกออกมา</span>
          </span>
          <button
            type="button"
            class="shrink-0 rounded-full bg-bg/15 px-3.5 py-1 font-semibold transition hover:bg-bg/25 active:scale-95"
            @click="undoRemove"
          >
            เลิกทำ
          </button>
        </div>
      </div>
    </Transition>

    <SheetModal :open="modalOpen" :label="editing ? 'แก้ไข' : 'เพิ่มของใหม่'" @close="closeForm">
      <WishForm
        ref="modalForm"
        :key="formKey"
        :item="editing"
        :default-cat="currentCat?.id"
        :default-star="catFilter === STARRED"
        :default-parent="newParent"
        @save="onSave"
        @cancel="closeForm"
      />
    </SheetModal>
    <SheetModal :open="syncOpen" label="Google Sheet" @close="syncOpen = false">
      <SyncSettings ref="syncPanel" @close="syncOpen = false" />
    </SheetModal>
    <SheetModal :open="catsOpen" label="หมวดหมู่" @close="catsOpen = false">
      <CategoryManager ref="catManager" @close="catsOpen = false" @created="catFilter = $event" />
    </SheetModal>
  </div>
</template>
