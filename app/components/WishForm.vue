<script setup lang="ts">
import type { Currency, PricePoint, Wish } from '~/composables/useWishes'

const props = defineProps<{
  item: Wish | null
  /** Category preselected for a new item (the one currently being viewed) */
  defaultCat?: string
  /** New items start starred when added from the starred view */
  defaultStar?: boolean
  /** Main item preselected when adding an accessory from its card */
  defaultParent?: string
}>()
const emit = defineEmits<{ save: [Wish], cancel: [] }>()
const { items, categories, tags, addCategory, childrenOf, addTag, removeTag } = useWishes()

const startParent = props.item?.parent ?? props.defaultParent ?? ''
const f = reactive({
  parent: startParent,
  // An accessory starts in its main item's category
  cat: props.item?.cat ?? (startParent ? items.value.find(w => w.id === startParent)?.cat : undefined) ?? props.defaultCat ?? '',
  when: props.item?.when ?? '',
  name: props.item?.name ?? '',
  price: props.item?.price ? String(props.item.price) : '',
  currency: (props.item?.currency ?? 'THB') as Currency,
  link: props.item?.link ?? '',
  shops: [...(props.item?.shops ?? [])],
  prices: (props.item?.prices ?? []).map(p => ({ ...p })),
  note: props.item?.note ?? '',
  image: props.item?.image ?? '',
})
/** The picture preview hides itself when the address doesn't load */
const imageBroken = ref(false)
watch(() => f.image, () => { imageBroken.value = false })
const error = ref('')
const nameEl = ref<HTMLInputElement>()
const shopsEl = ref<HTMLElement>()
const title = computed(() => props.item ? 'แก้ไข' : 'เพิ่มของใหม่')

defineExpose({ focus: () => nameEl.value?.focus() })

// "Buy together with": one level only, so an item that already has accessories can't be one.
const hasChildren = computed(() => !!props.item && childrenOf(props.item.id).length > 0)
/** The main item this one is bought with; an accessory follows its category and timing */
const mainItem = computed(() => hasChildren.value ? undefined : items.value.find(w => w.id === f.parent && !w.parent))
const parentOptions = computed(() => [
  { value: '', label: 'ไม่ซื้อคู่กับอะไร', short: 'ไม่มี' },
  ...items.value
    .filter(w => !w.parent && w.id !== props.item?.id)
    .sort((a, b) => b.created - a.created)
    .map(w => ({ value: w.id, label: w.name, short: w.name.length > 22 ? w.name.slice(0, 21) + '…' : w.name })),
])

const { rates, loading: rateLoading, failed: rateFailed, refresh: refreshRate } = useRates()
// Accept pasted prices like "HK$1,129.00" or "¥12,800": keep only digits and the decimal point.
const parsedPrice = computed(() => Number(f.price.replace(/[^\d.]/g, '')) || 0)
/** Live "≈ ฿…" preview while typing a foreign price */
const converted = computed(() => {
  const per = thbPer(f.currency, rates.value)
  return f.currency !== 'THB' && per !== null && parsedPrice.value > 0 ? baht(parsedPrice.value * per) : ''
})
const lowest = computed(() => f.prices.reduce<PricePoint | null>((m, p) => (!m || p.price < m.price ? p : m), null))
const seenDate = (at: number) => new Date(at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })

const currencyOptions = CURRENCY_CODES.map(c => ({
  value: c,
  label: `${CURRENCIES[c].symbol}  ${CURRENCIES[c].name}`,
  short: c === 'THB' ? '฿' : CURRENCIES[c].symbol,
  hint: c,
}))

const addingCat = ref(false)
const newCat = ref('')
const newCatEl = ref<HTMLInputElement>()
async function startNewCat() {
  addingCat.value = true
  await nextTick()
  newCatEl.value?.focus()
}
// "When to buy" tags: pick one, add your own (it's kept for next time), or delete one everywhere.
const writingWhen = ref(false)
const whenDraft = ref('')
const whenEl = ref<HTMLInputElement>()
const editingTags = ref(false)
const confirmTag = ref<string | null>(null)
function pickWhen(id: string) {
  // Tapping the chosen one again clears it.
  f.when = f.when === id ? '' : id
  writingWhen.value = false
}
async function startCustomWhen() {
  whenDraft.value = ''
  writingWhen.value = true
  editingTags.value = false
  await nextTick()
  whenEl.value?.focus()
}
function saveCustomWhen() {
  const t = whenDraft.value.trim()
  if (t) f.when = addTag(t).id
  writingWhen.value = false
}
const tagUses = (id: string) => items.value.filter(w => w.when === id).length
function deleteTag(id: string) {
  removeTag(id)
  if (f.when === id) f.when = ''
  confirmTag.value = null
  if (!tags.value.length) editingTags.value = false
}

function createCat() {
  const name = newCat.value.trim()
  if (name) f.cat = addCategory(name).id
  newCat.value = ''
  addingCat.value = false
}

async function addShop() {
  f.shops.push('')
  await nextTick()
  shopsEl.value?.querySelector<HTMLInputElement>(`#wf-shop-${f.shops.length - 1}`)?.focus()
}

function submit() {
  error.value = ''
  const name = f.name.trim()
  if (!name) { error.value = 'ใส่ชื่อของก่อนนะ'; nameEl.value?.focus(); return }
  const price = parsedPrice.value
  if (price < 0) { error.value = 'ราคาต้องไม่ติดลบ'; return }
  const link = normUrl(f.link)
  if (link === null) { error.value = 'ลิงก์ Official ไม่ถูกต้อง ลองวางใหม่อีกครั้ง'; return }
  const shops: string[] = []
  for (const s of f.shops) {
    const u = normUrl(s)
    if (u === null) { error.value = 'ลิงก์ร้านอื่นมีอันที่ไม่ถูกต้อง ลองวางใหม่อีกครั้ง'; return }
    if (u && !shops.includes(u)) shops.push(u)
  }
  emit('save', {
    id: props.item?.id ?? 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    price,
    currency: f.currency,
    link,
    shops,
    note: f.note.trim(),
    cat: mainItem.value ? mainItem.value.cat : categories.value.some(c => c.id === f.cat) ? f.cat : '',
    when: mainItem.value ? '' : f.when.trim().slice(0, 40),
    star: props.item?.star ?? props.defaultStar ?? false,
    image: normUrl(f.image) || '',
    parent: !hasChildren.value && items.value.some(w => w.id === f.parent && !w.parent) ? f.parent : '',
    // The store adds the new price to this log when it changed.
    prices: f.prices,
    done: props.item?.done ?? false,
    created: props.item?.created ?? Date.now(),
    updatedAt: Date.now(),
  })
}

const row = 'flex min-h-11 items-center gap-3 px-4'
const rowLabel = 'w-16 shrink-0 text-[15px]'
const input = 'min-w-0 flex-1 bg-transparent py-2.5 text-[15px] outline-none placeholder:text-sub/60'
const group = 'overflow-hidden rounded-xl bg-card divide-y divide-line ring-1 ring-line'
const groupLabel = 'px-4 pb-1.5 text-[13px] text-sub'
</script>

<template>
  <form novalidate class="flex flex-col" @submit.prevent="submit">
    <!-- iOS sheet nav bar -->
    <div class="sticky top-0 z-10 -mx-4 mb-4 grid grid-cols-[1fr_auto_1fr] items-center border-b border-line bg-bg/85 px-4 py-3 backdrop-blur-xl lg:-mx-6 lg:px-6">
      <button type="button" class="justify-self-start text-[17px] text-accent transition-opacity hover:opacity-70 active:opacity-40" @click="emit('cancel')">ยกเลิก</button>
      <span class="text-[17px] font-semibold">{{ title }}</span>
      <button type="submit" class="justify-self-end text-[17px] font-semibold text-accent transition-opacity hover:opacity-70 active:opacity-40">{{ item ? 'บันทึก' : 'เพิ่ม' }}</button>
    </div>

    <div class="flex flex-col gap-6">
      <div :class="group">
        <label :class="row">
          <span :class="rowLabel">ชื่อ</span>
          <input id="wf-name" ref="nameEl" v-model="f.name" :class="input" maxlength="120" placeholder="เช่น หูฟังไร้สาย" autocomplete="off">
        </label>
        <div :class="row">
          <label for="wf-price" :class="rowLabel">ราคา</label>
          <input id="wf-price" v-model="f.price" :class="[input, 'tabular-nums']" inputmode="decimal" placeholder="0" autocomplete="off">
          <PopupMenu v-model="f.currency" :options="currencyOptions" label="สกุลเงิน" hide-label align-right class="shrink-0" />
        </div>
        <div :class="row">
          <label for="wf-image" :class="rowLabel">รูป</label>
          <input id="wf-image" v-model="f.image" :class="input" type="url" placeholder="วางลิงก์รูปสินค้า" autocomplete="off">
          <img
            v-if="f.image && !imageBroken"
            :src="f.image"
            alt=""
            referrerpolicy="no-referrer"
            class="size-8 shrink-0 rounded-md bg-fill object-cover ring-1 ring-line"
            @error="imageBroken = true"
          >
          <button
            v-if="f.image"
            type="button"
            class="grid size-[22px] shrink-0 place-items-center rounded-full bg-sub/30 text-bg transition hover:bg-sub/50 active:scale-90"
            aria-label="ล้างรูป"
            @click="f.image = ''"
          >
            <svg viewBox="0 0 12 12" class="size-2.5 stroke-current stroke-2" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6" stroke-linecap="round" /></svg>
          </button>
        </div>
      </div>
      <p v-if="f.image && imageBroken" class="-mt-4 px-4 text-[13px] text-red">เปิดรูปจากลิงก์นี้ไม่ได้ ลองคลิกขวาที่รูปในเว็บร้าน แล้วเลือกคัดลอกที่อยู่รูปภาพ</p>
      <!-- Foreign price: show what it is in baht at the current rate -->
      <p v-if="f.currency !== 'THB'" class="-mt-4 flex flex-wrap items-center gap-x-1.5 px-4 text-[13px] text-sub" aria-live="polite">
        <template v-if="rates && thbPer(f.currency, rates) !== null">
          <span v-if="converted" class="font-medium text-ink tabular-nums">≈ {{ converted }}</span>
          <span class="tabular-nums">({{ rateLine(f.currency, rates) }}</span>
          <span>· อัปเดต {{ ratesWhen(rates) }})</span>
        </template>
        <span v-else-if="rateLoading">กำลังโหลดอัตราแลกเปลี่ยน…</span>
        <template v-else-if="rateFailed">
          <span>โหลดอัตราแลกเปลี่ยนไม่ได้ ราคาจะแปลงเป็นบาทเมื่อออนไลน์</span>
          <button type="button" class="font-medium text-accent transition-opacity hover:opacity-70" @click="refreshRate(true)">ลองใหม่</button>
        </template>
      </p>

      <!-- Price log: every saved price change lands here; newest first -->
      <div v-if="f.prices.length">
        <p :class="groupLabel">ราคาที่เคยเจอ<span v-if="lowest"> · ต่ำสุด {{ money(lowest.price, f.currency) }}</span></p>
        <div :class="group">
          <div v-for="p in [...f.prices].reverse()" :key="p.at" :class="[row, 'min-h-10']">
            <span class="w-16 shrink-0 text-[14px] text-sub tabular-nums">{{ seenDate(p.at) }}</span>
            <span class="flex-1 text-[15px] tabular-nums" :class="p === lowest && 'font-semibold text-green'">{{ money(p.price, f.currency) }}</span>
            <button
              type="button"
              class="grid size-[22px] shrink-0 place-items-center rounded-full bg-red text-white transition hover:brightness-110 active:scale-90"
              :aria-label="`ลบราคา ${money(p.price, f.currency)} วันที่ ${seenDate(p.at)}`"
              @click="f.prices = f.prices.filter(x => x !== p)"
            >
              <span class="h-0.5 w-2.5 rounded bg-white" />
            </button>
          </div>
        </div>
        <p class="px-4 pt-1.5 text-[13px] text-sub">แก้ราคาด้านบนแล้วบันทึก ราคาใหม่จะต่อท้ายรายการนี้เอง</p>
      </div>

      <!-- Bought together with a main item: shows inside that item's card -->
      <div>
        <div :class="group">
          <div :class="row">
            <span class="shrink-0 text-[15px]">ซื้อคู่กับ</span>
            <span class="min-w-0 flex-1" />
            <span v-if="hasChildren" class="text-[14px] text-sub">มีของซื้อคู่อยู่แล้ว</span>
            <PopupMenu v-else v-model="f.parent" :options="parentOptions" label="ซื้อคู่กับ" hide-label align-right class="min-w-0" />
          </div>
        </div>
        <p class="px-4 pt-1.5 text-[13px] text-sub">
          {{ hasChildren ? 'ชิ้นนี้มีของที่ซื้อคู่กันอยู่ เลยไปซ้อนในชิ้นอื่นไม่ได้'
            : mainItem ? `อยู่ในการ์ดของ ${mainItem.name} หมวดกับจะซื้อเมื่อไหร่ใช้ตามชิ้นนั้น`
              : 'เช่น Apple Pencil คู่กับ iPad จะแสดงอยู่ในการ์ดของ iPad' }}
        </p>
      </div>

      <div v-if="!mainItem">
        <p :class="groupLabel">หมวด</p>
        <div role="radiogroup" aria-label="หมวด" class="flex flex-wrap gap-2">
          <button
            v-for="c in [{ id: '', name: 'ไม่มีหมวด', color: '' }, ...categories.map(x => ({ id: x.id, name: x.name, color: CATEGORY_COLORS[x.color] }))]"
            :key="c.id"
            type="button"
            role="radio"
            :aria-checked="f.cat === c.id"
            class="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[14px] font-medium transition duration-200 active:scale-95"
            :class="f.cat === c.id ? 'bg-ink text-bg' : 'bg-card text-ink ring-1 ring-line hover:-translate-y-px hover:shadow-sm hover:ring-sub/30'"
            @click="f.cat = c.id"
          >
            <span v-if="c.color" class="size-2 rounded-full" :style="{ background: c.color }" aria-hidden="true" />
            {{ c.name }}
          </button>
          <div v-if="addingCat" class="inline-flex items-center gap-1 rounded-full bg-card py-1 pr-1 pl-3.5 ring-1 ring-accent">
            <input
              id="wf-newcat"
              ref="newCatEl"
              v-model="newCat"
              class="w-32 bg-transparent text-[14px] outline-none placeholder:text-sub/60"
              maxlength="40"
              placeholder="ชื่อหมวดใหม่"
              autocomplete="off"
              @keydown.enter.prevent="createCat"
              @keydown.esc.stop.prevent="addingCat = false; newCat = ''"
            >
            <button type="button" class="rounded-full bg-accent px-3 py-0.5 text-[13px] font-medium text-white transition hover:brightness-110 active:scale-95" @click="createCat">เพิ่ม</button>
          </div>
          <button
            v-else
            type="button"
            class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[14px] font-medium text-accent ring-1 ring-accent/30 ring-inset transition hover:bg-accent/10 active:scale-95"
            @click="startNewCat"
          >
            + หมวดใหม่
          </button>
        </div>
      </div>

      <div v-if="!mainItem">
        <div class="flex items-baseline justify-between pr-1">
          <p :class="groupLabel">จะซื้อเมื่อไหร่</p>
          <button
            v-if="tags.length"
            type="button"
            class="text-[13px] font-medium text-accent transition-opacity hover:opacity-70"
            @click="editingTags = !editingTags; confirmTag = null; writingWhen = false"
          >
            {{ editingTags ? 'เสร็จ' : 'แก้ไขป้าย' }}
          </button>
        </div>
        <!-- Deleting a tag removes it from every item that has it -->
        <div v-if="confirmTag" class="mb-2 flex items-center gap-3 rounded-xl bg-red/8 px-3 py-2 text-[13px]" role="alert">
          <span class="min-w-0 flex-1">
            ลบป้าย “{{ tags.find(t => t.id === confirmTag)?.label }}”?
            <span v-if="tagUses(confirmTag)" class="text-sub">ของ {{ tagUses(confirmTag) }} ชิ้นที่ใช้ป้ายนี้จะไม่มีป้าย</span>
          </span>
          <button type="button" class="shrink-0 font-medium text-sub transition hover:text-ink" @click="confirmTag = null">ยกเลิก</button>
          <button type="button" class="shrink-0 font-semibold text-red transition hover:opacity-70" @click="deleteTag(confirmTag)">ลบ</button>
        </div>
        <div role="radiogroup" aria-label="จะซื้อเมื่อไหร่" class="flex flex-wrap gap-2">
          <template v-for="t in tags" :key="t.id">
            <!-- Edit mode: tap a tag's minus to delete it -->
            <button
              v-if="editingTags"
              type="button"
              class="inline-flex items-center gap-2 rounded-full bg-card py-1.5 pr-3.5 pl-1.5 text-[14px] font-medium text-ink ring-1 ring-line transition active:scale-95"
              :aria-label="`ลบป้าย ${t.label}`"
              @click="confirmTag = t.id"
            >
              <span class="grid size-[18px] place-items-center rounded-full bg-red text-white"><span class="h-0.5 w-2 rounded bg-white" /></span>
              {{ t.label }}
            </button>
            <button
              v-else
              type="button"
              role="radio"
              :aria-checked="f.when === t.id"
              class="inline-flex max-w-full items-center gap-2 rounded-full px-3.5 py-1.5 text-[14px] font-medium transition duration-200 active:scale-95"
              :class="f.when === t.id ? 'bg-ink text-bg' : 'bg-card text-ink ring-1 ring-line hover:-translate-y-px hover:shadow-sm hover:ring-sub/30'"
              @click="pickWhen(t.id)"
            >
              <span class="size-2 shrink-0 rounded-full" :style="{ background: t.color }" aria-hidden="true" />
              <span class="truncate">{{ t.label }}</span>
            </button>
          </template>
          <!-- The user's own words become a tag that can be picked again -->
          <div v-if="writingWhen" class="inline-flex items-center gap-1 rounded-full bg-card py-1 pr-1 pl-3.5 ring-1 ring-accent">
            <input
              id="wf-when"
              ref="whenEl"
              v-model="whenDraft"
              class="w-36 bg-transparent text-[14px] outline-none placeholder:text-sub/60"
              maxlength="40"
              placeholder="เช่น รอเงินเดือนออก"
              autocomplete="off"
              @keydown.enter.prevent="saveCustomWhen"
              @keydown.esc.stop.prevent="writingWhen = false"
            >
            <button type="button" class="rounded-full bg-accent px-3 py-0.5 text-[13px] font-medium text-white transition hover:brightness-110 active:scale-95" @click="saveCustomWhen">เพิ่ม</button>
          </div>
          <button
            v-else-if="!editingTags"
            type="button"
            class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[14px] font-medium text-accent ring-1 ring-accent/30 ring-inset transition hover:bg-accent/10 active:scale-95"
            @click="startCustomWhen"
          >
            + ป้ายใหม่
          </button>
        </div>
      </div>

      <div>
        <p :class="groupLabel">ลิงก์ร้าน</p>
        <div ref="shopsEl" :class="group">
          <label :class="row">
            <span class="flex w-16 shrink-0 items-center"><span class="block rounded-[5px] bg-accent px-1.5 py-0.5 text-[10px] leading-3 font-bold tracking-wide text-white uppercase">Official</span></span>
            <input id="wf-link" v-model="f.link" :class="input" type="url" placeholder="เว็บหรือร้านของแบรนด์" autocomplete="off"          </label>
          <div v-for="(_, i) in f.shops" :key="i" :class="row">
            <button
              type="button"
              class="grid size-[22px] shrink-0 place-items-center rounded-full bg-red text-white transition hover:brightness-110 active:scale-90"
              aria-label="ลบลิงก์ร้านนี้"
              @click="f.shops.splice(i, 1)"
            >
              <span class="h-0.5 w-2.5 rounded bg-white" />
            </button>
            <input :id="`wf-shop-${i}`" v-model="f.shops[i]" :class="input" type="url" placeholder="Shopee, Lazada, …" aria-label="ลิงก์ร้านอื่น" autocomplete="off"          </div>
          <button type="button" :class="[row, 'w-full text-left text-[15px] text-accent transition-colors hover:bg-fill/60 active:bg-fill']" @click="addShop">
            <span class="grid size-[22px] shrink-0 place-items-center rounded-full bg-green text-white">
              <svg viewBox="0 0 12 12" class="size-2.5 stroke-current stroke-2" aria-hidden="true"><path d="M6 1.5v9M1.5 6h9" stroke-linecap="round" /></svg>
            </span>
            เพิ่มร้านอื่น
          </button>
        </div>
      </div>

      <div>
        <p :class="groupLabel">โน้ต</p>
        <div :class="group">
          <textarea
            id="wf-note"
            v-model="f.note"
            rows="3"
            maxlength="500"
            class="block w-full resize-none bg-transparent px-4 py-3 text-[15px] outline-none placeholder:text-sub/60"
            placeholder="สี ขนาด รุ่น หรือรอช่วงลดราคา"
          />
        </div>
      </div>

      <p v-if="error" class="px-1 text-[13px] text-red" role="alert">{{ error }}</p>
    </div>
  </form>
</template>
