<script setup lang="ts">
import type { Category, Wish } from '~/composables/useWishes'

const props = defineProps<{
  wish: Wish
  /** Shown as a tag; omit when the list is already filtered to this category */
  category?: Category
  /** Things bought together with this item, listed inside the card */
  children?: Wish[]
}>()
const emit = defineEmits<{
  toggle: [], star: [], edit: [], remove: [],
  addChild: [], toggleChild: [id: string], editChild: [child: Wish],
}>()
const kids = computed(() => props.children ?? [])
/** Whole set (this item + what's bought with it) in baht */
const setTotal = computed(() => [props.wish, ...kids.value].reduce((a, w) => a + (priceThb(w, rates.value) ?? 0), 0))
const kidPrice = (w: Wish) => {
  if (!w.price) return '—'
  const t = priceThb(w, rates.value)
  return t !== null ? baht(t) : money(w.price, w.currency)
}

const confirming = ref(false)
const { rates } = useRates()
const thb = computed(() => priceThb(props.wish, rates.value))
const isForeign = computed(() => props.wish.currency !== 'THB' && props.wish.price > 0)
const when = computed(() => whenInfo(props.wish.when))
const low = computed(() => lowestSeen(props.wish))
const lowDate = computed(() => low.value ? new Date(low.value.at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : '')
const links = computed(() => [
  ...(props.wish.link ? [{ url: props.wish.link, official: true }] : []),
  ...props.wish.shops.map(url => ({ url, official: false })),
])
</script>

<template>
  <li
    class="group flex flex-col rounded-2xl bg-card p-5 ring-1 ring-line transition duration-200 hover:ring-sub/25"
    :class="wish.done && 'opacity-55'"
  >
    <div class="flex items-start gap-3">
      <button
        type="button"
        class="group/check grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] transition duration-200 hover:scale-110 active:scale-90"
        :class="wish.done ? 'border-accent bg-accent' : 'border-sub/40 hover:border-accent hover:bg-accent/10'"
        :aria-label="wish.done ? 'ย้ายกลับไปยังไม่ได้' : 'ทำเครื่องหมายว่าได้แล้ว'"
        @click="emit('toggle')"
      >
        <!-- Done: white check. Not done: a faint preview of the check on hover. -->
        <svg
          viewBox="0 0 24 24"
          class="size-3 fill-none stroke-[3.5] transition-opacity"
          :class="wish.done ? 'stroke-white' : 'stroke-accent opacity-0 group-hover/check:opacity-60'"
          aria-hidden="true"
        >
          <path d="M5 12.5l4.5 4.5L19 7.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>

      <h3 class="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-[16px] leading-tight font-semibold tracking-[-0.01em] break-words">
        <span class="min-w-0" :class="wish.done && 'text-sub line-through decoration-sub/50'">{{ wish.name }}</span>
        <!-- Tags sit after the name, centered on its line; they wrap below a long name -->
        <span
          v-if="category"
          class="max-w-full shrink-0 truncate rounded-md px-1.5 py-px text-[11px] leading-4 font-medium tracking-normal"
          :style="{ color: CATEGORY_COLORS[category.color], background: `color-mix(in srgb, ${CATEGORY_COLORS[category.color]} 14%, transparent)` }"
        >{{ category.name }}</span>
        <span
          v-if="when"
          class="inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-md bg-fill px-1.5 py-px text-[11px] leading-4 font-medium tracking-normal text-sub"
        >
          <span class="size-1.5 shrink-0 rounded-full" :style="{ background: when.color }" aria-hidden="true" />
          <span class="truncate">{{ when.label }}</span>
        </span>
      </h3>

      <!-- Star stays visible once set; edit / delete show on touch, or on hover with a mouse -->
      <div class="-mt-1 -mr-2 flex shrink-0">
        <button
          type="button"
          class="grid size-8 place-items-center rounded-full transition hover:bg-fill active:scale-90"
          :class="wish.star ? 'text-[#ffb800]' : 'reveal text-sub hover:text-ink'"
          :aria-label="wish.star ? 'เอาดาวออก' : 'ติดดาว'"
          :aria-pressed="wish.star"
          @click="emit('star')"
        >
          <svg viewBox="0 0 20 20" class="size-[17px] stroke-current stroke-[1.5]" :class="wish.star ? 'fill-current' : 'fill-none'" aria-hidden="true">
            <path d="M10 2.8l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L2.8 8.1l5-.7L10 2.8z" stroke-linejoin="round" />
          </svg>
        </button>
      <div class="reveal flex transition-opacity">
        <button
          type="button"
          class="grid size-8 place-items-center rounded-full text-sub transition hover:bg-fill hover:text-ink active:scale-90"
          aria-label="เพิ่มของที่ซื้อคู่กัน"
          title="เพิ่มของที่ซื้อคู่กัน"
          @click="emit('addChild')"
        >
          <svg viewBox="0 0 20 20" class="size-4 fill-none stroke-current stroke-[1.6]" aria-hidden="true">
            <path d="M8.5 11.5a3 3 0 0 0 4.2 0l2.6-2.6a3 3 0 0 0-4.2-4.2l-.9.9M11.5 8.5a3 3 0 0 0-4.2 0l-2.6 2.6a3 3 0 0 0 4.2 4.2l.9-.9" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          class="grid size-8 place-items-center rounded-full text-sub transition hover:bg-fill hover:text-ink active:scale-90"
          aria-label="แก้ไข"
          @click="emit('edit')"
        >
          <svg viewBox="0 0 20 20" class="size-4 fill-none stroke-current stroke-[1.6]" aria-hidden="true"><path d="M12.5 4.5l3 3L7 16H4v-3l8.5-8.5z" stroke-linejoin="round" /></svg>
        </button>
        <button
          type="button"
          class="grid size-8 place-items-center rounded-full text-sub transition hover:bg-red/10 hover:text-red active:scale-90"
          aria-label="ลบ"
          @click="confirming = true"
        >
          <svg viewBox="0 0 20 20" class="size-4 fill-none stroke-current stroke-[1.6]" aria-hidden="true"><path d="M4 6h12M8 6V4.5h4V6M5.5 6l.8 10h7.4l.8-10" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
      </div>
      </div>
    </div>

    <!-- Body: price, note and shop buttons on one rhythm -->
    <div class="flex flex-col pl-8">
      <!-- Foreign prices show their baht value first; until a rate loads, the original amount -->
      <p class="mt-2.5 text-[24px] leading-none font-semibold tracking-[-0.02em] tabular-nums">
        {{ !wish.price ? '—' : thb !== null ? baht(thb) : money(wish.price, wish.currency) }}
      </p>
      <p v-if="isForeign && thb !== null" class="mt-1 text-[12px] text-sub tabular-nums">
        {{ money(wish.price, wish.currency) }} · {{ rateLine(wish.currency, rates) }}
      </p>
      <p v-if="low" class="mt-1 flex items-center gap-1 text-[12px] font-medium text-green tabular-nums">
        <svg viewBox="0 0 12 12" class="size-3 fill-none stroke-current stroke-[1.6]" aria-hidden="true"><path d="M6 2.5v7M3 6.5l3 3 3-3" stroke-linecap="round" stroke-linejoin="round" /></svg>
        ต่ำสุดที่เคยเจอ {{ money(low.price, wish.currency) }} · {{ lowDate }}
      </p>
      <p v-if="wish.note" class="mt-1.5 line-clamp-2 text-[14px] leading-snug break-words text-sub">{{ wish.note }}</p>

      <!-- Shop buttons: Official is the filled primary, other shops are tinted -->
      <div v-if="links.length" class="mt-3.5 flex flex-wrap gap-2">
        <a
          v-for="l in links"
          :key="l.url"
          :href="l.url"
          target="_blank"
          rel="noopener noreferrer"
          :title="l.url"
          class="inline-flex max-w-full items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition duration-200 hover:-translate-y-px active:translate-y-0 active:scale-95"
          :class="l.official
            ? 'bg-accent text-white hover:shadow-[0_6px_16px_-4px_var(--color-accent)] hover:brightness-110'
            : 'bg-accent/10 text-accent hover:bg-accent/18'"
        >
          <svg viewBox="0 0 16 16" class="size-3.5 shrink-0 fill-none stroke-current stroke-[1.5]" aria-hidden="true">
            <path d="M2.5 6.5h11l-.8 7h-9.4l-.8-7zM5.5 6.5V5a2.5 2.5 0 0 1 5 0v1.5" stroke-linejoin="round" stroke-linecap="round" />
          </svg>
          <span class="truncate">{{ l.official ? 'Official' : shopName(l.url) }}</span>
          <svg viewBox="0 0 12 12" class="size-2.5 shrink-0 fill-none stroke-current stroke-[1.6] opacity-70" aria-hidden="true"><path d="M3.5 8.5l5-5M4.5 3.5h4v4" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </a>
      </div>

      <!-- Bought together: accessories listed under the main item, with the set's total -->
      <div v-if="kids.length" class="mt-4 rounded-xl bg-fill/60 px-3 py-2">
        <p class="pb-1 text-[11px] font-medium tracking-wide text-sub">ซื้อคู่กัน</p>
        <ul class="divide-y divide-line">
          <li v-for="k in kids" :key="k.id" class="group/kid flex min-h-9 items-center gap-2.5 py-1.5" :class="k.done && 'opacity-55'">
            <button
              type="button"
              class="grid size-4 shrink-0 place-items-center rounded-full border-[1.5px] transition hover:scale-110 active:scale-90"
              :class="k.done ? 'border-accent bg-accent' : 'border-sub/40 hover:border-accent'"
              :aria-label="k.done ? `ย้าย ${k.name} กลับไปยังไม่ได้` : `ทำเครื่องหมายว่าได้ ${k.name} แล้ว`"
              @click="emit('toggleChild', k.id)"
            >
              <svg v-if="k.done" viewBox="0 0 24 24" class="size-2.5 fill-none stroke-white stroke-[4]" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </button>
            <button
              type="button"
              class="min-w-0 flex-1 truncate text-left text-[14px] font-medium transition hover:text-accent"
              :class="k.done && 'line-through decoration-sub/50'"
              :title="`แก้ไข ${k.name}`"
              @click="emit('editChild', k)"
            >
              {{ k.name }}
            </button>
            <span class="shrink-0 text-[14px] font-semibold tabular-nums">{{ kidPrice(k) }}</span>
          </li>
        </ul>
        <p class="flex items-baseline justify-between border-t border-line pt-1.5 text-[12px] text-sub">
          <span>รวมทั้งชุด</span>
          <span class="text-[14px] font-semibold text-ink tabular-nums">{{ baht(setTotal) }}</span>
        </p>
      </div>

      <div v-if="confirming" class="mt-3.5 flex items-center gap-3 rounded-xl bg-red/8 px-3 py-2 text-[13px]">
        <span class="min-w-0 flex-1 text-ink">{{ kids.length ? 'ลบรายการนี้? ของที่ซื้อคู่จะแยกเป็นการ์ดของตัวเอง' : 'ลบรายการนี้?' }}</span>
        <button type="button" class="shrink-0 font-medium text-sub transition hover:text-ink" @click="confirming = false">ยกเลิก</button>
        <button type="button" class="shrink-0 font-semibold text-red transition hover:opacity-70" @click="emit('remove')">ลบ</button>
      </div>
    </div>
  </li>
</template>
