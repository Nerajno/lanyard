<template>
  <div ref="root" class="relative">
    <button
      ref="trigger" type="button" aria-haspopup="menu" :aria-expanded="open ? 'true' : 'false'" :aria-label="label"
      class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-paper hover:text-ink"
      @click="toggle"
    >
      <UiIcon name="more" />
    </button>
    <div
      v-if="open" ref="menu" role="menu" :aria-label="label"
      class="absolute right-0 z-20 mt-1 min-w-[12rem] rounded-xl border border-line bg-surface py-1 shadow-lg"
      @keydown="onKeydown"
    >
      <template v-for="(item, i) in visible" :key="`${depth}-${item.label}`">
        <div v-if="item.separatorBefore" class="my-1 h-px bg-line" role="separator" />
        <button
          :ref="(el) => { itemEls[i] = el as HTMLButtonElement }"
          type="button" role="menuitem" tabindex="-1"
          class="flex min-h-11 w-full items-center px-4 text-left text-sm transition-colors hover:bg-paper focus:bg-paper focus:outline-none"
          :class="item.danger ? 'text-error' : 'text-ink'"
          @click="select(item)"
        >{{ item.children ? `${item.label} ›` : item.label }}</button>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
export interface MenuItem {
  label: string
  onSelect?: () => void
  danger?: boolean
  separatorBefore?: boolean
  children?: MenuItem[]
}
</script>

<script setup lang="ts">
const props = defineProps<{ items: MenuItem[]; label: string }>()

const open = ref(false)
const submenu = ref<MenuItem[] | null>(null)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const itemEls = ref<HTMLButtonElement[]>([])

const depth = computed(() => (submenu.value ? 1 : 0))
const visible = computed<MenuItem[]>(() =>
  submenu.value ? [{ label: '‹ Back', onSelect: () => { submenu.value = null; void focusItem(0) } }, ...submenu.value] : props.items,
)

async function focusItem(i: number) {
  await nextTick()
  const els = itemEls.value.filter(Boolean)
  if (els.length === 0) return
  els[(i + els.length) % els.length].focus()
}

function close(returnFocus = false) {
  open.value = false
  submenu.value = null
  itemEls.value = []
  if (returnFocus) trigger.value?.focus()
}

async function toggle() {
  if (open.value) return close()
  open.value = true
  await focusItem(0)
}

function select(item: MenuItem) {
  if (item.children) {
    submenu.value = item.children
    itemEls.value = []
    void focusItem(1)
    return
  }
  const back = item.label === '‹ Back'
  item.onSelect?.()
  if (!back) close(true)
}

function onKeydown(e: KeyboardEvent) {
  const els = itemEls.value.filter(Boolean)
  const current = els.indexOf(document.activeElement as HTMLButtonElement)
  if (e.key === 'ArrowDown') { e.preventDefault(); void focusItem(current + 1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); void focusItem(current - 1) }
  else if (e.key === 'Home') { e.preventDefault(); void focusItem(0) }
  else if (e.key === 'End') { e.preventDefault(); void focusItem(els.length - 1) }
  else if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); close(true) }
}

function onOutside(e: Event) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) close()
}

onMounted(() => document.addEventListener('pointerdown', onOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside))
</script>
