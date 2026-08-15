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

  // Keep the dev file watcher off build/test artifacts — watching them
  // exhausts macOS file descriptors (EMFILE: too many open files, watch).
  vite: {
    server: {
      watch: {
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.nuxt/**',
          '**/.output/**',
          '**/dist/**',
          '**/coverage/**',
          '**/playwright-report/**',
          '**/test-results/**',
          '**/supabase/.temp/**',
          '**/supabase/.branches/**',
        ],
      },
    },
  },

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

  routeRules: {
    '/contacts': { redirect: { to: '/app', statusCode: 301 } },
    '/add': { redirect: { to: '/app/add', statusCode: 301 } },
    '/settings': { redirect: { to: '/app/settings', statusCode: 301 } },
    '/stats': { redirect: { to: '/app/stats', statusCode: 301 } },
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
      script: [
        {
          innerHTML: `(function(){try{var t=localStorage.getItem('lanyard-theme');if(t==='dark'){document.documentElement.setAttribute('data-theme','dark')}else if(t!=='light'&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.setAttribute('data-theme','dark')}}catch(e){}})()`,
        },
      ],
    },
  },
})