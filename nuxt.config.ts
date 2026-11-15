export default defineNuxtConfig({
  srcDir: '.', compatibilityDate: '2026-11-15', devtools: { enabled: false },
  nitro: { preset: 'cloudflare_module', cloudflare: { deployConfig: true, nodeCompat: true } },
  css: ['~/assets/css/main.css'],
  postcss: { plugins: { tailwindcss: {}, autoprefixer: {} } },
  app: { head: { title: 'CampusFix | Campus maintenance', meta: [{ name: 'description', content: 'Report, assign and resolve campus maintenance requests.' }] } },
  typescript: { strict: true },
})
