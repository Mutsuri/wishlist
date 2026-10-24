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
  /** When/why to buy: a WHEN preset key, free text of the user's own, or '' */
  when: string
  done: boolean
  created: number
  /** Last edit (ms); the Google Sheet sync keeps whichever copy changed last */
  updatedAt: number
}

export interface Category {
  id: string
  name: string
  color: CategoryColor
  updatedAt: number
}

/** A deletion still to be sent to the Google Sheet */
export interface Tombstone {
  kind: 'wish' | 'category'
  id: string
  updatedAt: number
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

/** Ready-made "when to buy" choices, most urgent first (also the order of the "ต้องซื้อก่อน" sort). */
export const WHEN = {
  now: { label: 'ซื้อเลย', color: '#30c254' },
  sale: { label: 'รอลดราคา', color: '#ff9500' },
  broken: { label: 'รอของเดิมพัง', color: '#ac8e68' },
  later: { label: 'ซื้อทีหลังได้', color: '#8e8e93' },
} as const
export type WhenKey = keyof typeof WHEN
export const WHEN_KEYS = Object.keys(WHEN) as WhenKey[]
const CUSTOM_WHEN_COLOR = '#5e5ce6'

/** Label and color for a wish's `when`; null when not set. Free text keeps its own words. */
export function whenInfo(when: string) {
  if (!when) return null
  return when in WHEN ? WHEN[when as WhenKey] : { label: when, color: CUSTOM_WHEN_COLOR }
}
/** Sort rank: presets in urgency order, then custom notes, then unset. */
export function whenRank(when: string) {
  const i = WHEN_KEYS.indexOf(when as WhenKey)
  return i >= 0 ? i : when ? WHEN_KEYS.length : WHEN_KEYS.length + 1
}

const KEY = 'wishlist:v1'
const CAT_KEY = 'wishlist:categories:v1'
const TOMB_KEY = 'wishlist:tombstones:v1'

const isUrl = (s: unknown): s is string => typeof s === 'string' && /^https?:\/\//i.test(s)
export const newId = (prefix: string) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

function cleanWish(raw: any): Wish | null {
  if (!raw || typeof raw.id !== 'string') return null
  // Starter examples from earlier versions are dropped.
  if (raw.example) return null
  return {
    id: raw.id,
    name: String(raw.name || 'ไม่มีชื่อ'),
    price: Number(raw.price) || 0,
    currency: isCurrency(raw.currency) ? raw.currency : 'THB',
    link: isUrl(raw.link) ? raw.link : '',
    shops: Array.isArray(raw.shops) ? raw.shops.filter(isUrl) : [],
    note: String(raw.note || ''),
    cat: typeof raw.cat === 'string' ? raw.cat : '',
    when: typeof raw.when === 'string' ? raw.when.trim().slice(0, 40) : '',
    done: !!raw.done,
    created: Number(raw.created) || 0,
    updatedAt: Number(raw.updatedAt) || Number(raw.created) || 0,
  }
}

function cleanCategory(raw: any): Category | null {
  if (!raw || typeof raw.id !== 'string' || !raw.name) return null
  return { id: raw.id, name: String(raw.name), color: COLOR_KEYS.includes(raw.color) ? raw.color : 'blue', updatedAt: Number(raw.updatedAt) || 0 }
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
  const items = ref<Wish[]>(read(KEY, cleanWish, () => []))
  const categories = ref<Category[]>(read(CAT_KEY, cleanCategory, () => []))

  const tombstones = ref<Tombstone[]>(read(TOMB_KEY, t => (t?.id && t?.kind ? t as Tombstone : null), () => []))

  watch(items, v => persist(KEY, v), { deep: true })
  watch(categories, v => persist(CAT_KEY, v), { deep: true })
  watch(tombstones, v => persist(TOMB_KEY, v), { deep: true })

  // Every edit made here (not ones coming back from the sheet) tells the sync to send.
  const changed = () => onLocalChange()
  function bury(kind: Tombstone['kind'], id: string) {
    tombstones.value = [...tombstones.value.filter(t => t.id !== id), { kind, id, updatedAt: Date.now() }]
  }

  function upsert(w: Wish) {
    const stamped = { ...w, updatedAt: Date.now() }
    const i = items.value.findIndex(x => x.id === w.id)
    if (i >= 0) items.value[i] = stamped
    else items.value.push(stamped)
    changed()
  }
  function remove(id: string) {
    items.value = items.value.filter(x => x.id !== id)
    bury('wish', id)
    changed()
  }
  function toggle(id: string) {
    const w = items.value.find(x => x.id === id)
    if (!w) return
    w.done = !w.done
    w.updatedAt = Date.now()
    changed()
  }

  /** Next color not yet used, so new categories look distinct. */
  function nextColor(): CategoryColor {
    const used = new Set(categories.value.map(c => c.color))
    return COLOR_KEYS.find(k => !used.has(k)) ?? COLOR_KEYS[categories.value.length % COLOR_KEYS.length]!
  }
  function addCategory(name: string, color: CategoryColor = nextColor()): Category {
    const c = { id: newId('c'), name: name.trim(), color, updatedAt: Date.now() }
    categories.value.push(c)
    changed()
    return c
  }
  function updateCategory(id: string, patch: Partial<Omit<Category, 'id' | 'updatedAt'>>) {
    const c = categories.value.find(x => x.id === id)
    if (!c) return
    Object.assign(c, patch, { updatedAt: Date.now() })
    changed()
  }
  /** Items in the category stay; they just become uncategorized. */
  function removeCategory(id: string) {
    categories.value = categories.value.filter(c => c.id !== id)
    bury('category', id)
    const now = Date.now()
    for (const w of items.value) {
      if (w.cat === id) {
        w.cat = ''
        w.updatedAt = now
      }
    }
    changed()
  }
  function categoryOf(w: Wish) {
    return w.cat ? categories.value.find(c => c.id === w.cat) : undefined
  }

  /** What the sync sends: every item and category plus pending deletions. */
  function syncPayload() {
    const dead = (kind: Tombstone['kind']) =>
      tombstones.value.filter(t => t.kind === kind).map(t => ({ id: t.id, updatedAt: t.updatedAt, deleted: true }))
    return {
      tombstones: tombstones.value.map(t => ({ ...t })),
      wishes: [...items.value.map(w => ({ ...w, shops: [...w.shops] })), ...dead('wish')],
      categories: [...categories.value.map(c => ({ ...c })), ...dead('category')],
    }
  }

  /** Merge what the sheet sent back; the copy with the later updatedAt wins. */
  function applyRemote(remote: { wishes: any[], categories: any[] }, sentTombstones: Tombstone[]) {
    items.value = mergeRemote(items.value, remote.wishes, cleanWish)
    categories.value = mergeRemote(categories.value, remote.categories, cleanCategory)
    // Deletions the sheet now has can be forgotten; ones made during the request stay queued.
    const sent = new Set(sentTombstones.map(t => `${t.id}@${t.updatedAt}`))
    tombstones.value = tombstones.value.filter(t => !sent.has(`${t.id}@${t.updatedAt}`))
  }

  /** Forget this device's copy (after disconnecting from the sheet). */
  function clearLocal() {
    items.value = []
    categories.value = []
    tombstones.value = []
  }

  return {
    items, categories, upsert, remove, toggle,
    addCategory, updateCategory, removeCategory, categoryOf, nextColor,
    syncPayload, applyRemote, clearLocal,
  }
}

function mergeRemote<T extends { id: string, updatedAt: number }>(local: T[], remote: any[], clean: (raw: any) => T | null): T[] {
  const byId = new Map(local.map(r => [r.id, r]))
  for (const raw of remote ?? []) {
    const id = String(raw?.id ?? '')
    if (!id) continue
    const mine = byId.get(id)
    if (mine && mine.updatedAt >= (Number(raw.updatedAt) || 0)) continue
    if (raw.deleted) byId.delete(id)
    else {
      const r = clean(raw)
      if (r) byId.set(id, r)
    }
  }
  return [...byId.values()]
}

let onLocalChange = () => {}
/** The sync registers here to hear about edits made on this device. */
export function setLocalChangeListener(fn: () => void) {
  onLocalChange = fn
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
