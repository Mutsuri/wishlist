// Sync with a Google Sheet through its Apps Script web app (same approach as the expenses app).
// The link and secret live only on this device (localStorage), never in the code on GitHub.
import type { Tombstone } from './useWishes'

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
const sync = reactive<SyncState>({ url: '', secret: '', lastSyncAt: null, status: 'off', error: '', pending: false })

let started = false
let timer: ReturnType<typeof setTimeout> | undefined
let running: Promise<void> | null = null
let again = false

const configured = () => Boolean(sync.url && sync.secret)

function saveConfig() {
  try { localStorage.setItem(KEY, JSON.stringify({ url: sync.url, secret: sync.secret, lastSyncAt: sync.lastSyncAt })) }
  catch { /* ignore */ }
}

function loadConfig() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (v) Object.assign(sync, { url: String(v.url || ''), secret: String(v.secret || ''), lastSyncAt: v.lastSyncAt ?? null })
  }
  catch { /* ignore */ }
}

async function run() {
  const store = useWishes()
  const { tombstones, wishes, categories } = store.syncPayload()
  const carried = sync.pending
  sync.pending = false
  sync.status = 'syncing'
  try {
    // text/plain so the browser skips the CORS preflight, which Apps Script doesn't answer
    const res = await fetch(sync.url, {
      method: 'POST',
      body: JSON.stringify({ secret: sync.secret, wishes, categories }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    })
    const data = await res.json() as { ok: true, wishes: unknown[], categories: unknown[] } | { ok: false, error: string }
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
    sync.error = !navigator.onLine ? 'ไม่มีอินเทอร์เน็ต' : err instanceof Error ? err.message : String(err)
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
    syncNow,
    async configure(url: string, secret: string) {
      sync.url = url.trim()
      sync.secret = secret.trim()
      sync.status = configured() ? 'idle' : 'off'
      sync.error = ''
      saveConfig()
      await syncNow()
    },
    disconnect() {
      Object.assign(sync, { url: '', secret: '', lastSyncAt: null, status: 'off', error: '', pending: false })
      saveConfig()
    },
  }
}
