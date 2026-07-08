export default defineNuxtConfig({
  devtools: { enabled: false },
  modules: ['nuxt-auth-utils'],
  runtimeConfig: {
    // server-only — filled from NUXT_* env vars
    adminPasswordHash: '',
    dbUrl: 'file:.data/farah.db',
    dbAuthToken: '',
    // nuxt-auth-utils reads session.password from NUXT_SESSION_PASSWORD
    session: {
      name: 'farah-admin',
      cookie: {
        sameSite: 'lax',
        // Secure cookie in production (behind HTTPS via Cloudflare/nginx),
        // but not in dev (plain http://localhost) where a Secure cookie would
        // be dropped by the browser and login wouldn't stick.
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  app: {
    head: {
      title: 'FARAH — Wanderer in Shadow',
      htmlAttrs: { lang: 'en', dir: 'ltr' },
      meta: [
        { charset: 'UTF-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
        { name: 'description', content: 'Essays, weblog, music, films and reveries from Farah — a writer at the edge of the candlelight.' },
        { name: 'theme-color', content: '#060505' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500;1,600&family=EB+Garamond:ital,wght@0,400;0,500;1,400;1,500&family=Italiana&family=Spectral:ital,wght@0,300;0,400;0,500;1,300;1,400&display=swap',
        },
      ],
    },
  },
  css: ['swiper/css', 'swiper/css/pagination', '~/assets/css/main.css'],
})
