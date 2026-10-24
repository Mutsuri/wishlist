import { isCurrency, type CurrencyCode } from './useRates'
export type { CurrencyCode as Currency } from './useRates'

export interface Wish {
  id: string
  name: string
  /** In the item's own currency; use priceThb() for totals */
  price: number
  currency: CurrencyCode
  /** Official brand store / site */
  link: string
  /** Other shops (Shopee, Lazada, …) */
  shops: string[]
  note: string
  /** Category id, '' when uncategorized */
  cat: string
  done: boolean
  created: number
  example?: boolean
}

export interface Category {
  id: string
  name: string
  color: CategoryColor
}

/** Category filter value meaning "items without a category" */
export const NO_CATEGORY = '__none'

// Apple system colors; mid tones that read on both light and dark backgrounds.
export const CATEGORY_COLORS = {
  blue: '#0a84ff',
  green: '#30c254',
  orange: '#ff9500',
  red: '#ff453a',
  purple: '#bf5af2',
  pink: '#ff375f',
  teal: '#40b8d0',
  indigo: '#5e5ce6',
  yellow: '#ffc400',
  brown: '#ac8e68',
} as const
export type CategoryColor = keyof typeof CATEGORY_COLORS
const COLOR_KEYS = Object.keys(CATEGORY_COLORS) as CategoryColor[]

const KEY = 'wishlist:v1'
const CAT_KEY = 'wishlist:categories:v1'

const EXAMPLES: Wish[] = [
  { id: 'ex1', name: 'หูฟังไร้สายตัดเสียงรบกวน', price: 5990, currency: 'THB', link: '', shops: [], note: 'สีดำ รอช่วงลดราคากลางเดือน', cat: '', done: false, created: 3, example: true },
  { id: 'ex2', name: 'รองเท้าวิ่ง', price: 3200, currency: 'THB', link: '', shops: [], note: 'ไซซ์ 42', cat: '', done: false, created: 2, example: true },
  { id: 'ex3', name: 'หนังสือนิยายเล่มใหม่', price: 350, currency: 'THB', link: '', shops: [], note: '', cat: '', done: true, created: 1, example: true },
]

const isUrl = (s: unknown): s is string => typeof s === 'string' && /^https?:\/\//i.test(s)
export const newId = (prefix: string) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

function cleanWish(raw: any): Wish | null {
  if (!raw || typeof raw.id !== 'string') return null
  return {
    id: raw.id,
    name: String(raw.name || 'ไม่มีชื่อ'),
    price: Number(raw.price) || 0,
    currency: isCurrency(raw.currency) ? raw.currency : 'THB',
    link: isUrl(raw.link) ? raw.link : '',
    shops: Array.isArray(raw.shops) ? raw.shops.filter(isUrl) : [],
    note: String(raw.note || ''),
    cat: typeof raw.cat === 'string' ? raw.cat : '',
    done: !!raw.done,
    created: Number(raw.created) || 0,
    example: !!raw.example,
  }
}

function cleanCategory(raw: any): Category | null {
  if (!raw || typeof raw.id !== 'string' || !raw.name) return null
  return { id: raw.id, name: String(raw.name), color: COLOR_KEYS.includes(raw.color) ? raw.color : 'blue' }
}

function read<T>(key: string, clean: (raw: any) => T | null, fallback: () => T[]): T[] {
  try {
    const text = localStorage.getItem(key)
    if (text === null) return fallback()
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed.map(clean).filter((x): x is T => !!x) : []
  }
  catch {
    return []
  }
}

function persist(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) }
  catch { /* storage full or blocked: keep working in memory */ }
}

function createStore() {
  // First visit: a few marked examples so the page isn't empty.
  const items = ref<Wish[]>(read(KEY, cleanWish, () => EXAMPLES.map(w => ({ ...w, shops: [...w.shops] }))))
  const categories = ref<Category[]>(read(CAT_KEY, cleanCategory, () => []))

  // Drop references to categories that no longer exist.
  const known = new Set(categories.value.map(c => c.id))
  for (const w of items.value) if (w.cat && !known.has(w.cat)) w.cat = ''

  watch(items, v => persist(KEY, v), { deep: true })
  watch(categories, v => persist(CAT_KEY, v), { deep: true })

  function upsert(w: Wish) {
    const i = items.value.findIndex(x => x.id === w.id)
    if (i >= 0) items.value[i] = w
    else items.value.push(w)
  }
  function remove(id: string) {
    items.value = items.value.filter(x => x.id !== id)
  }
  function toggle(id: string) {
    const w = items.value.find(x => x.id === id)
    if (w) w.done = !w.done
  }

  /** Next color not yet used, so new categories look distinct. */
  function nextColor(): CategoryColor {
    const used = new Set(categories.value.map(c => c.color))
    return COLOR_KEYS.find(k => !used.has(k)) ?? COLOR_KEYS[categories.value.length % COLOR_KEYS.length]!
  }
  function addCategory(name: string, color: CategoryColor = nextColor()): Category {
    const c = { id: newId('c'), name: name.trim(), color }
    categories.value.push(c)
    return c
  }
  function updateCategory(id: string, patch: Partial<Omit<Category, 'id'>>) {
    const c = categories.value.find(x => x.id === id)
    if (c) Object.assign(c, patch)
  }
  /** Items in the category stay; they just become uncategorized. */
  function removeCategory(id: string) {
    categories.value = categories.value.filter(c => c.id !== id)
    for (const w of items.value) if (w.cat === id) w.cat = ''
  }
  function categoryOf(w: Wish) {
    return w.cat ? categories.value.find(c => c.id === w.cat) : undefined
  }

  return { items, categories, upsert, remove, toggle, addCategory, updateCategory, removeCategory, categoryOf, nextColor }
}

let store: ReturnType<typeof createStore> | undefined

/** One shared store for the whole app (client-only; persisted to localStorage). */
export function useWishes() {
  // Detached scope so the persistence watchers live as long as the app, not the first caller.
  store ??= effectScope(true).run(createStore)!
  return store
}

export const baht = (n: number) => '฿' + Math.round(n || 0).toLocaleString('th-TH')

export function hostOf(u: string) {
  try { return new URL(u).hostname.replace(/^www\./, '') }
  catch { return 'ลิงก์' }
}

// Friendly names for shops people commonly link to; anything else shows its domain.
const SHOP_NAMES: [RegExp, string][] = [
  [/(^|\.)shopee\./, 'Shopee'],
  [/(^|\.)lazada\./, 'Lazada'],
  [/(^|\.)tiktok\.com$/, 'TikTok Shop'],
  [/(^|\.)amazon\./, 'Amazon'],
  [/(^|\.)aliexpress\./, 'AliExpress'],
  [/(^|\.)jib\.co\.th$/, 'JIB'],
  [/(^|\.)advice\.co\.th$/, 'Advice'],
  [/(^|\.)bnn\.in\.th$/, 'BaNANA'],
  [/(^|\.)powerbuy\.co\.th$/, 'Power Buy'],
  [/(^|\.)central\.co\.th$/, 'Central'],
  [/(^|\.)bigc\.co\.th$/, 'Big C'],
  [/(^|\.)ikea\.com$/, 'IKEA'],
  [/(^|\.)apple\.com$/, 'Apple'],
]

export function shopName(u: string) {
  const host = hostOf(u)
  return SHOP_NAMES.find(([re]) => re.test(host))?.[1] ?? host
}

/** '' for empty, null for unusable, otherwise a full http(s) URL */
export function normUrl(v: string): string | null {
  v = v.trim()
  if (!v) return ''
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v
  try { new URL(v); return v }
  catch { return null }
}
