<template>
  <div class="mx-auto max-w-sm py-12 text-center">
    <p>{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
const auth = useAuthStore()
const message = ref('Confirming your sign-in…')

onMounted(async () => {
  const route = useRoute()
  const sb = useSupabase()

  const code = route.query.code as string | undefined
  const token = route.query.token as string | undefined

  try {
    let ok = false
    if (code) {
      const { error } = await sb.auth.exchangeCodeForSession(code)
      ok = !error
      if (error) message.value = error.message
    } else if (token) {
      const { error } = await sb.auth.verifyOtp({
        token_hash: token,
        type: 'email',
      })
      ok = !error
      if (error) message.value = error.message
    }

    if (ok) {
      await auth.hydrate()
      message.value = 'Signed in.'
      const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : '/app'
      await navigateTo(redirect)
    }
  } catch (e) {
    message.value = e instanceof Error ? e.message : String(e)
  }
})
</script>