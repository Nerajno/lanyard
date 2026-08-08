// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-08-06',
  devtools: { enabled: true },

  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@nuxt/eslint',
  ],

  css: ['~/assets/css/main.css'],

  typescript: {
    strict: true,
    typeCheck: true,
  },

  runtimeConfig: {
    // Server-only (edge functions / nitro). Never exposed to the client.
    supabaseServiceRole: '',
    twilioSid: '',
    twilioToken: '',
    twilioFrom: '',
    twilioVerifySid: '',
    emailApiKey: '',
    emailFrom: '',
    actLinkSigningSecret: '',
    cronSecret: '',
    public: {
      supabaseUrl: '',
      supabaseAnonKey: '',
      appUrl: '',
    },
  },

  app: {
    head: {
      title: 'lanyard.',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Follow up before it goes cold — three coffees, then a connection.' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap',
        },
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      ],
    },
  },
})