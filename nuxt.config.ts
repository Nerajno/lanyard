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
      title: 'Lanyard',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Conference follow-up nudger — three cups of coffee' },
      ],
    },
  },
})