<script setup lang="ts">
import type { Currency, Wish } from '~/composables/useWishes'

const props = defineProps<{
  item: Wish | null
  /** Category preselected for a new item (the one currently being viewed) */
  defaultCat?: string
}>()
const emit = defineEmits<{ save: [Wish], cancel: [] }>()
const { categories, addCategory } = useWishes()

const f = reactive({
  cat: props.item?.cat ?? props.defaultCat ?? '',
  name: props.item?.name ?? '',
  price: props.item?.price ? String(props.item.price) : '',
  currency: (props.item?.currency ?? 'THB') as Currency,
  link: props.item?.link ?? '',
  shops: [...(props.item?.shops ?? [])],
  note: props.item?.note ?? '',
})
const error = ref('')
const nameEl = ref<HTMLInputElement>()
const shopsEl = ref<HTMLElement>()
const title = computed(() => props.item ? 'แก้ไข' : 'เพิ่มของใหม่')

defineExpose({ focus: () => nameEl.value?.focus() })

const { rates, loading: rateLoading, failed: rateFailed, refresh: refreshRate } = useRates()
// Accept pasted prices like "HK$1,129.00" or "¥12,800": keep only digits and the decimal point.
const parsedPrice = computed(() => Number(f.price.replace(/[^\d.]/g, '')) || 0)
/** Live "≈ ฿…" preview while typing a foreign price */
const converted = computed(() => {
  const per = thbPer(f.currency, rates.value)
  return f.currency !== 'THB' && per !== null && parsedPrice.value > 0 ? baht(parsedPrice.value * per) : ''
})
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
    cat: categories.value.some(c => c.id === f.cat) ? f.cat : '',
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
      </div>
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

      <div>
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

      <div>
        <p :class="groupLabel">ลิงก์ร้าน</p>
        <div ref="shopsEl" :class="group">
          <label :class="row">
            <span class="flex w-16 shrink-0 items-center"><span class="block rounded-[5px] bg-accent px-1.5 py-0.5 text-[10px] leading-3 font-bold tracking-wide text-white uppercase">Official</span></span>
            <input id="wf-link" v-model="f.link" :class="input" type="url" placeholder="เว็บหรือร้านของแบรนด์" autocomplete="off">
          </label>
          <div v-for="(_, i) in f.shops" :key="i" :class="row">
            <button
              type="button"
              class="grid size-[22px] shrink-0 place-items-center rounded-full bg-red text-white transition hover:brightness-110 active:scale-90"
              aria-label="ลบลิงก์ร้านนี้"
              @click="f.shops.splice(i, 1)"
            >
              <span class="h-0.5 w-2.5 rounded bg-white" />
            </button>
            <input :id="`wf-shop-${i}`" v-model="f.shops[i]" :class="input" type="url" placeholder="Shopee, Lazada, …" aria-label="ลิงก์ร้านอื่น" autocomplete="off">
          </div>
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
