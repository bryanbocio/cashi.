import tailwindcss from '@tailwindcss/vite'
import Icons from 'unplugin-icons/vite'
import CashiPreset from './app/themes/cashi'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/supabase', '@pinia/nuxt', '@primevue/nuxt-module'],
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
    '/inventario': { ssr: false },
    '/fiados': { ssr: false },
    '/gastos': { ssr: false },
    '/compras': { ssr: false },
    '/reportes': { ssr: false },
    '/ajustes': { ssr: false },
  },
  supabase: {
    redirect: false,
    types: false,
  },
  primevue: {
    components: {
      prefix: 'Prime',
      include: [
        'Button',
        'Card',
        'Column',
        'DataTable',
        'Dialog',
        'Drawer',
        'InputText',
        'Message',
        'SelectButton',
        'Skeleton',
        'Tag',
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
