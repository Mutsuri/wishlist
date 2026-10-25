import tailwindcss from '@tailwindcss/vite'

// Where the site is served from: /wishlist/ on GitHub Pages, / locally.
const base = process.env.PAGES_BASE || '/'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  // Data lives in the Google Sheet (cached in localStorage), so there is nothing to render on a server.
  ssr: false,
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
  },
  app: {
    // GitHub Pages serves this repo under /wishlist/ (the deploy workflow sets PAGES_BASE).
    // It's a one-page app with no routes, so only the asset URLs need the prefix: setting
    // baseURL instead makes `nuxt generate` pre-render "Redirecting..." pages.
    cdnURL: base === '/' ? '' : base,
    head: {
      title: 'Wishbook',
      htmlAttrs: { lang: 'th' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#f5f5f7', media: '(prefers-color-scheme: light)' },
        { name: 'theme-color', content: '#000000', media: '(prefers-color-scheme: dark)' },
        // Add to Home Screen: open full screen like an app
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-title', content: 'Wishbook' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      ],
      // Apply the saved theme before first paint so there's no flash of the wrong colors.
      script: [
        {
          innerHTML: `try{var t=localStorage.getItem('wishlist:theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`,
          tagPosition: 'head',
        },
      ],
      link: [
        // Home-screen icons (made from the .ico with tools/icons-from-ico.mjs)
        { rel: 'apple-touch-icon', href: `${base}apple-touch-icon.png` },
        { rel: 'icon', type: 'image/png', href: `${base}favicon.png` },
        { rel: 'manifest', href: `${base}manifest.webmanifest` },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Thai:wght@400;500;600;700&display=swap',
        },
      ],
    },
  },
})
