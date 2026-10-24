// Wishbook keeps its data in a Google Sheet, reached through the sheet's Apps Script web app
// (same approach as the expenses app). The app can't be used until it's connected, so nothing
// is written on a device that isn't linked to the sheet; disconnecting clears this device.
// The link is built in (on its own it opens nothing); the secret is typed on each device and
// stays in that device's localStorage, never in the code on GitHub.
import type { Tombstone } from './useWishes'

/** The "DataBase of Wishbook" sheet's web app */
export const SHEET_URL = 'https://script.google.com/macros/s/AKfycbx_YvV85WLu2wOGsNsRu_afYK5AzU3dXA1YmfaoXnAQUlBn6IYQIqx_YdXrtVzlSYvd/exec'

interface SyncState {
  url: string
  secret: string
  lastSyncAt: number | null
  status: 'off' | 'idle' | 'syncing' | 'error'
  error: string
  /** Edits made here that haven't reached the sheet yet */
  pending: boolean
}

const KEY = 'wishlist:sync'
const sync = reactive<SyncState>({ url: SHEET_URL, secret: '', lastSyncAt: null, status: 'off', error: '', pending: false })

let started = false
let timer: ReturnType<typeof setTimeout> | undefined
let running: Promise<void> | null = null
let again = false

const configured = () => Boolean(sync.url && sync.secret)

function saveConfig() {
  try {
    if (configured()) localStorage.setItem(KEY, JSON.stringify({ url: sync.url, secret: sync.secret, lastSyncAt: sync.lastSyncAt }))
    else localStorage.removeItem(KEY)
  }
  catch { /* ignore */ }
}

function loadConfig() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (v?.secret) Object.assign(sync, { url: String(v.url || SHEET_URL), secret: String(v.secret), lastSyncAt: v.lastSyncAt ?? null })
  }
  catch { /* ignore */ }
}

type SheetReply = { ok: true, wishes: unknown[], categories: unknown[] } | { ok: false, error: string }

async function post(url: string, secret: string): Promise<SheetReply> {
  const { wishes, categories } = useWishes().syncPayload()
  // text/plain so the browser skips the CORS preflight, which Apps Script doesn't answer
  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ secret, wishes, categories }),
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  })
  return await res.json() as SheetReply
}

const describe = (err: unknown) => !navigator.onLine ? 'ไม่มีอินเทอร์เน็ต' : err instanceof Error ? err.message : String(err)

async function run() {
  const store = useWishes()
  const { tombstones } = store.syncPayload()
  const carried = sync.pending
  sync.pending = false
  sync.status = 'syncing'
  try {
    const data = await post(sync.url, sync.secret)
    if (!data.ok) throw new Error(data.error)
    store.applyRemote(data, tombstones as Tombstone[])
    sync.lastSyncAt = Date.now()
    sync.status = 'idle'
    sync.error = ''
    saveConfig()
  }
  catch (err) {
    if (carried) sync.pending = true
    sync.status = 'error'
    sync.error = describe(err)
  }
}

/** Sync now; if one is already running, queue another round after it. */
async function syncNow() {
  if (!configured()) return
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    do {
      again = false
      await run()
    } while (again)
  })()
  try { await running }
  finally { running = null }
}

/** After an edit: wait for a pause in typing/clicking, then send. */
function scheduleSync() {
  if (configured()) sync.pending = true
  clearTimeout(timer)
  timer = setTimeout(syncNow, 1500)
}

function start() {
  if (started) return
  started = true
  loadConfig()
  sync.status = configured() ? 'idle' : 'off'
  setLocalChangeListener(scheduleSync)
  window.addEventListener('online', () => syncNow())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncNow()
  })
  syncNow()
}

export function useSync() {
  start()
  return {
    sync: readonly(sync),
    /** True once this device is linked to the sheet; until then the app shows the connect screen. */
    connected: computed(() => configured()),
    syncNow,
    /**
     * Link this device. The secret is only kept if the sheet accepts it.
     * Resolves to an error message, or '' on success.
     */
    async connect(secret: string, url = SHEET_URL): Promise<string> {
      secret = secret.trim()
      url = url.trim() || SHEET_URL
      if (!secret) return 'ใส่รหัสลับก่อน'
      sync.status = 'syncing'
      sync.error = ''
      try {
        const store = useWishes()
        const { tombstones } = store.syncPayload()
        const data = await post(url, secret)
        if (!data.ok) throw new Error(data.error)
        Object.assign(sync, { url, secret, lastSyncAt: Date.now(), status: 'idle', error: '', pending: false })
        store.applyRemote(data, tombstones as Tombstone[])
        saveConfig()
        return ''
      }
      catch (err) {
        sync.status = configured() ? 'error' : 'off'
        return describe(err)
      }
    },
    /** Send anything unsent, then unlink this device and clear its copy of the data. */
    async disconnect() {
      clearTimeout(timer)
      if (sync.pending) await syncNow()
      if (running) await running
      Object.assign(sync, { url: SHEET_URL, secret: '', lastSyncAt: null, status: 'off', error: '', pending: false })
      saveConfig()
      useWishes().clearLocal()
    },
  }
}
