// Exchange rates to baht, fetched straight from the browser (works on GitHub Pages, no server).
// 1. Live: Coinbase's public exchange-rates API (no key, updated about every minute).
// 2. Fallback, once a day: github.com/fawazahmed0/exchange-api via jsDelivr, then open.er-api.com.

/** Currencies the app offers. `decimals` is how many places prices are shown with. */
export const CURRENCIES = {
  // Whole baht, matching how the card's main price is shown
  THB: { symbol: '฿', name: 'บาท', decimals: 0 },
  USD: { symbol: '$', name: 'ดอลลาร์สหรัฐ', decimals: 2 },
  HKD: { symbol: 'HK$', name: 'ดอลลาร์ฮ่องกง', decimals: 2 },
  JPY: { symbol: '¥', name: 'เยน', decimals: 0 },
  CNY: { symbol: 'CN¥', name: 'หยวน', decimals: 2 },
  EUR: { symbol: '€', name: 'ยูโร', decimals: 2 },
  GBP: { symbol: '£', name: 'ปอนด์', decimals: 2 },
  KRW: { symbol: '₩', name: 'วอน', decimals: 0 },
  SGD: { symbol: 'S$', name: 'ดอลลาร์สิงคโปร์', decimals: 2 },
  TWD: { symbol: 'NT$', name: 'ดอลลาร์ไต้หวัน', decimals: 0 },
  AUD: { symbol: 'A$', name: 'ดอลลาร์ออสเตรเลีย', decimals: 2 },
  MYR: { symbol: 'RM', name: 'ริงกิต', decimals: 2 },
} as const
export type CurrencyCode = keyof typeof CURRENCIES
export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[]
export const isCurrency = (c: unknown): c is CurrencyCode => typeof c === 'string' && c in CURRENCIES

export interface Rates {
  /** Baht per 1 unit of each currency */
  thb: Partial<Record<CurrencyCode, number>>
  /** 'live' = Coinbase, 'daily' = once-a-day fallback */
  source: 'live' | 'daily'
  /** When the rates were quoted/published (ms) */
  at: number
  fetchedAt: number
}

const KEY = 'wishlist:rates:v2'
const LIVE_MAX_AGE = 15 * 60 * 1000
/** While on the daily fallback, try the live source again this often. */
const DAILY_RECHECK = 30 * 60 * 1000

/** UTC date (YYYY-MM-DD) `offset` days ago, matching how the daily source names its versions */
const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10)

/** Turn "units of X per 1 baht" into "baht per 1 unit of X" for the currencies we use. */
function invert(perThb: Record<string, unknown>, lowerCase = false) {
  const out: Rates['thb'] = { THB: 1 }
  for (const code of CURRENCY_CODES) {
    const v = Number(perThb[lowerCase ? code.toLowerCase() : code])
    if (v > 0) out[code] = 1 / v
  }
  return out
}

async function getJson(url: string) {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(String(res.status))
  return res.json()
}

async function fetchLive(): Promise<Rates | null> {
  try {
    const j = await getJson('https://api.coinbase.com/v2/exchange-rates?currency=THB')
    const thb = invert(j?.data?.rates ?? {})
    return thb.USD ? { thb, source: 'live', at: Date.now(), fetchedAt: Date.now() } : null
  }
  catch {
    return null
  }
}

async function fetchDaily(): Promise<Rates | null> {
  // jsDelivr caches "@latest" for days, so try today's and yesterday's dated versions first.
  const cdn = (v: string) => `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${v}/v1/currencies/thb.min.json`
  for (const url of [cdn(day(0)), cdn(day(1)), cdn('latest')]) {
    try {
      const j = await getJson(url)
      const thb = invert(j?.thb ?? {}, true)
      if (thb.USD) return { thb, source: 'daily', at: Date.parse(j.date) || Date.now(), fetchedAt: Date.now() }
    }
    catch { /* try the next one */ }
  }
  try {
    const j = await getJson('https://open.er-api.com/v6/latest/THB')
    const thb = invert(j?.rates ?? {})
    if (thb.USD) return { thb, source: 'daily', at: (j.time_last_update_unix ?? 0) * 1000 || Date.now(), fetchedAt: Date.now() }
  }
  catch { /* give up */ }
  return null
}

function readCache(): Rates | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    return v?.thb?.USD > 0 ? v : null
  }
  catch {
    return null
  }
}

function isFresh(r: Rates | null) {
  if (!r) return false
  // A daily rate is only a stand-in: try live again soon.
  return Date.now() - r.fetchedAt < (r.source === 'live' ? LIVE_MAX_AGE : DAILY_RECHECK)
}

function createRates() {
  const rates = ref<Rates | null>(readCache())
  const loading = ref(false)
  const failed = ref(false)

  async function refresh(force = false) {
    if (loading.value || (!force && isFresh(rates.value))) return
    loading.value = true
    failed.value = false
    const next = await fetchLive() ?? await fetchDaily()
    if (next) {
      rates.value = next
      try { localStorage.setItem(KEY, JSON.stringify(next)) }
      catch { /* ignore */ }
    }
    else {
      // Keep showing the last cached rates if there are any.
      failed.value = true
    }
    loading.value = false
  }

  try { localStorage.removeItem('wishlist:rate:usd-thb') } // USD-only cache from an earlier version
  catch { /* ignore */ }
  refresh()
  // Keep a page left open current; also catch up when coming back to the tab.
  setInterval(() => refresh(), LIVE_MAX_AGE)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh()
  })
  return { rates, loading, failed, refresh }
}

let store: ReturnType<typeof createRates> | undefined

/** Shared exchange rates to baht, cached in localStorage. */
export function useRates() {
  store ??= effectScope(true).run(createRates)!
  return store
}

/** Baht per 1 unit of `code`, or null while unknown */
export function thbPer(code: CurrencyCode, r: Rates | null): number | null {
  if (code === 'THB') return 1
  return r?.thb[code] ?? null
}

/** Price in baht; null for a foreign price while its rate is unknown. */
export function priceThb(w: { price: number, currency: CurrencyCode }, r: Rates | null): number | null {
  const per = thbPer(w.currency, r)
  return per === null ? null : w.price * per
}

/** "HK$1,129.00", "¥12,800" */
export function money(n: number, code: CurrencyCode) {
  const { symbol, decimals } = CURRENCIES[code]
  return symbol + (n || 0).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

/** "HK$1 = ฿4.30", or per 100 for small units: "¥100 = ฿21.49" */
export function rateLine(code: CurrencyCode, r: Rates | null) {
  const per = thbPer(code, r)
  if (per === null) return ''
  const unit = per < 1 ? 100 : 1
  return `${CURRENCIES[code].symbol}${unit} = ฿${(per * unit).toFixed(2)}`
}

/** When the rates are from: a time today for live quotes ("14:05"), otherwise a date ("23 ต.ค."). */
export function ratesWhen(r: Rates) {
  const d = new Date(r.at)
  const sameDay = d.toDateString() === new Date().toDateString()
  if (r.source === 'live' && sameDay) return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}
