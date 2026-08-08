export function useTheme() {
  const isDark = ref(false)

  function apply(theme: 'light' | 'dark') {
    isDark.value = theme === 'dark'
    if (import.meta.client) {
      document.documentElement.setAttribute('data-theme', theme)
      try {
        localStorage.setItem('lanyard-theme', theme)
      } catch {
        /* storage unavailable */
      }
    }
  }

  function toggle() {
    apply(isDark.value ? 'light' : 'dark')
  }

  if (import.meta.client) {
    const stored = localStorage.getItem('lanyard-theme')
    const theme = stored === 'dark' || (!stored && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light'
    apply(theme)
  }

  return { isDark, toggle }
}