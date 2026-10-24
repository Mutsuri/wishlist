export type ThemeChoice = 'light' | 'dark'

// Keep in sync with the inline script in nuxt.config.ts, which applies it before first paint.
const KEY = 'wishlist:theme'

let theme: Ref<ThemeChoice> | undefined

export function useTheme() {
  if (!theme) {
    let saved: string | null = null
    try { saved = localStorage.getItem(KEY) }
    catch { /* ignore */ }
    // Nothing picked yet: start from the OS setting.
    const initial: ThemeChoice = saved === 'light' || saved === 'dark'
      ? saved
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    theme = ref<ThemeChoice>(initial)
    effectScope(true).run(() => {
      watch(theme!, (t, old) => {
        document.documentElement.setAttribute('data-theme', t)
        // Only remember an actual choice, so first-time visitors keep following the OS.
        if (old !== undefined) {
          try { localStorage.setItem(KEY, t) }
          catch { /* ignore */ }
        }
      }, { immediate: true })
    })
  }
  return theme
}
