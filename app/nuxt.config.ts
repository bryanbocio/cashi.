import tailwindcss from '@tailwindcss/vite'
import Icons from 'unplugin-icons/vite'
import CashiPreset from './app/themes/cashi'

const runtimeProcess = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> }
}).process
const appRevision = runtimeProcess?.env?.VERCEL_GIT_COMMIT_SHA || 'local'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/supabase', '@pinia/nuxt', '@primevue/nuxt-module', '@vite-pwa/nuxt'],
  app: {
    head: {
      meta: [
        { name: 'theme-color', content: '#1f5aff' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'apple-mobile-web-app-title', content: 'Cashi' },
      ],
      link: [
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
      ],
    },
  },
  css: [
    '@fontsource/space-grotesk/latin-500.css',
    '@fontsource/space-grotesk/latin-600.css',
    '@fontsource/space-grotesk/latin-700.css',
    '@fontsource/ibm-plex-sans/latin-400.css',
    '@fontsource/ibm-plex-sans/latin-500.css',
    '@fontsource/ibm-plex-sans/latin-600.css',
    '@fontsource/ibm-plex-mono/latin-400.css',
    '~/assets/css/main.css',
  ],
  routeRules: {
    '/': { ssr: false },
    '/caja': { ssr: false },
    '/cotizaciones': { ssr: false },
    '/catalogo': { ssr: false },
    '/catalogo/**': { ssr: true },
    '/inventario': { ssr: false },
    '/fiados': { ssr: false },
    '/gastos': { ssr: false },
    '/compras': { ssr: false },
    '/reportes': { ssr: false },
    '/ajustes': { ssr: false },
  },
  supabase: {
    redirect: false,
    types: '~/types/database.ts',
  },
  pwa: {
    registerType: 'autoUpdate',
    strategies: 'generateSW',
    manifest: {
      id: '/',
      name: 'Cashi · Inventario y ganancias',
      short_name: 'Cashi',
      description: 'Inventario, caja, gastos y finanzas de tu negocio en un solo lugar.',
      lang: 'es',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#fbfaf6',
      theme_color: '#1f5aff',
      icons: [
        {
          src: '/pwa-192x192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/pwa-maskable-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
      navigateFallback: '/',
      additionalManifestEntries: [
        { url: '/', revision: `app-shell-${appRevision}` },
      ],
      cleanupOutdatedCaches: true,
      clientsClaim: true,
      skipWaiting: true,
    },
    client: {
      installPrompt: true,
      periodicSyncForUpdates: 3600,
    },
    devOptions: {
      enabled: false,
    },
  },
  primevue: {
    components: {
      prefix: 'Prime',
      include: [
        'Button',
        'Card',
        'Column',
        'DatePicker',
        'DataTable',
        'Dialog',
        'Drawer',
        'InputNumber',
        'InputText',
        'Message',
        'Popover',
        'Select',
        'SelectButton',
        'Skeleton',
        'Tag',
        'Toast',
      ],
    },
    options: {
      ripple: true,
      theme: {
        preset: CashiPreset,
        options: {
          darkModeSelector: false,
          cssLayer: {
            name: 'primevue',
            order: 'theme, base, primevue',
          },
        },
      },
    },
  },
  vite: {
    plugins: [tailwindcss(), Icons({ compiler: 'vue3' })],
  },
})
