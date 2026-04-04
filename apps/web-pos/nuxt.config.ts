export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  ssr: false,
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  modules: ['@pinia/nuxt'],
  runtimeConfig: {
    public: {
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY,
      printerGatewayUrl: process.env.NUXT_PUBLIC_PRINTER_GATEWAY_URL,
      appName: process.env.NUXT_PUBLIC_APP_NAME || 'Angkringan POS Pro'
    }
  },
  app: {
    head: {
      title: 'Angkringan POS Pro',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#0f172a' },
        { name: 'description', content: 'POS angkringan modern untuk kasir, laporan, stok menu, pengeluaran, shift, dan pengaturan outlet.' }
      ]
    }
  }
})
