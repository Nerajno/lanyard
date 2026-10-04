# App UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the logged-in app and the public share page from the Stitch screens: shared UI primitives, a grouped queue with a one-tap Message button, a faster capture form, and editable quiet hours.

**Architecture:** New presentational primitives live in `components/ui/` (Nuxt auto-imports them as `Ui*`). New behaviour is kept in small pure functions in `utils/` (`queue.ts`, `howMet.ts`, `quietHours.ts`, plus `hasUsableChannel` in `composer.ts`), unit-tested without Nuxt. Pages are then rebuilt from those pieces. No schema, RLS, or server change.

**Tech Stack:** Nuxt 3.21, Vue 3.5 (`defineModel`), Tailwind 3.4, Pinia, Vitest (`unit` project in node; `nuxt` project with `mountSuspended` for components), Playwright e2e via `@nuxt/test-utils/playwright`.

**Spec:** `project_docs/specs/2026-10-03-app-ui-redesign-design.md`

**Depends on:** `fix/in-app-act-claims-nudge` merged first (plan `project_docs/plans/2026-10-03-in-app-act-claims-nudge.md`). It changes `useContacts.markFollowedUp` to return `Promise<FollowUpResult>` (from `utils/followUp.ts`):

```ts
type FollowUpResult =
  | { outcome: 'advanced'; touchpointsDone: number; followUpBy: string }
  | { outcome: 'graduated' }
  | { outcome: 'skipped' }
```

Before Task 1, rebase this branch on `main` after that fix merges: `git fetch origin && git rebase origin/main`.

## Global Constraints

- `<script setup lang="ts">` only. Tailwind classes only, no component CSS files. Use existing tokens (`bg-paper`, `bg-surface`, `text-ink`, `text-muted`, `border-line`, `bg-accent`, `text-on-accent`, `hover:bg-accent-press`, `bg-accent-soft`, `text-error`, `bg-error-soft`, `text-due`/`bg-due-soft`, `text-warm`/`bg-warm-soft`, `text-graduated`, `text-label-caps`, `font-display`). **No new colour tokens.**
- **Naming deviation from the spec:** files are `components/ui/Button.vue` etc., so components are `UiButton`, `UiMenu`, `UiIcon`, `UiAvatar`, `UiSectionHeader`, `UiEmptyState`, `UiField`, `UiInput`, `UiToast`. This matches the repo's existing `AuthOAuthButtons` prefixing. `UiField` takes `inputId` (not `for`, a reserved word).
- Minimum interactive height 44px (`min-h-11`) on buttons, tab-bar items, menu items, and inputs.
- No schema / RLS / migration / server-route change. No service-role use. `server/routes/act/[token].get.ts` untouched.
- `how_met` is stored and sent verbatim. The SMS consent copy and verification flow in `NudgePrefsForm` keep their exact text and logic.
- Every contact needs email or phone: the DB CHECK is unchanged and form validation mirrors it.
- Each task leaves `npm run lint && npx nuxi typecheck && npm run test` green.
- Commits end with `Facilitated-by: Claude Opus 5.5 <noreply@anthropic.com>`. Never `Co-Authored-By`.

## Review Focus

- **Message on a contact with an invalid email and no phone:** `composerUrl` would build `sms:?body=…`. The card must disable Message and promote Edit instead (Task 7 test: "disables Message without a usable channel").
- **Queue at local midnight / timezone edges:** a contact due at 23:30 local tonight is "Later today", one due at 00:10 tomorrow is "Upcoming"; the UTC-based `daysUntil` must not be used for grouping (Task 6 tests use local-time `Date` constructors around midnight).
- **Quiet hours start equal to end:** would mean a 0-hour or 24-hour quiet window. Rejected inline before save (Task 13 test).
- **Keyboard-only menu use:** Esc returns focus to the ⋯ trigger, arrows wrap, and the submenu has a Back item (Task 3 tests).
- **Background follow-up failure after Message opened the composer:** the user already left for their mail app, so the error must persist on return with the "⋯ › Mark done" recovery (Task 8 test).

---

### Task 1: `UiButton` and `UiIcon`

**Files:**
- Create: `components/ui/Button.vue`, `components/ui/Icon.vue`
- Test: `tests/component/UiButton.test.ts`

**Interfaces:**
- Produces: `<UiButton variant="primary|secondary|ghost|danger" size="sm|md" :to? :href? :block? :disabled? :type?>`. It renders `NuxtLink` when `to` is set, `<a>` when `href` is set, otherwise `<button>`. Listeners such as `@click` fall through.
- Produces: `<UiIcon name="queue|plus|settings|stats|more|message|sun|moon|check|clock" :label? class>`. `aria-hidden="true"` unless `label` is given, in which case it uses `role="img"` and `aria-label`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/component/UiButton.test.ts
import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import UiButton from '~/components/ui/Button.vue'

describe('UiButton', () => {
  it('renders a button with the primary classes by default', async () => {
    const w = await mountSuspended(UiButton, { slots: { default: () => 'Save' } })
    const el = w.find('button')
    expect(el.exists()).toBe(true)
    expect(el.attributes('type')).toBe('button')
    expect(el.classes()).toContain('bg-accent')
    expect(el.classes()).toContain('min-h-11')
    expect(el.text()).toBe('Save')
  })

  it('renders an <a> when given href', async () => {
    const w = await mountSuspended(UiButton, { props: { href: 'mailto:a@b.co' }, slots: { default: () => 'Message' } })
    expect(w.find('a').attributes('href')).toBe('mailto:a@b.co')
  })

  it('renders a NuxtLink when given to', async () => {
    const w = await mountSuspended(UiButton, { props: { to: '/app/add' }, slots: { default: () => 'Add' } })
    expect(w.find('a').attributes('href')).toBe('/app/add')
  })

  it('renders a disabled button instead of a link when disabled', async () => {
    const w = await mountSuspended(UiButton, { props: { href: 'mailto:a@b.co', disabled: true }, slots: { default: () => 'Message' } })
    expect(w.find('a').exists()).toBe(false)
    expect(w.find('button').attributes('disabled')).toBeDefined()
  })

  it('applies danger and block variants', async () => {
    const w = await mountSuspended(UiButton, { props: { variant: 'danger', block: true }, slots: { default: () => 'Delete' } })
    expect(w.find('button').classes()).toEqual(expect.arrayContaining(['text-error', 'w-full']))
  })

  it('forwards click listeners', async () => {
    let clicked = 0
    const w = await mountSuspended(UiButton, { attrs: { onClick: () => { clicked += 1 } }, slots: { default: () => 'Go' } })
    await w.find('button').trigger('click')
    expect(clicked).toBe(1)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/component/UiButton.test.ts`
Expected: FAIL, cannot resolve `~/components/ui/Button.vue`.

- [ ] **Step 3: Implement `components/ui/Button.vue`**

```vue
<template>
  <NuxtLink v-if="to && !disabled" :to="to" :class="classes"><slot /></NuxtLink>
  <a v-else-if="href && !disabled" :href="href" :class="classes"><slot /></a>
  <button v-else :type="type" :disabled="disabled" :class="classes"><slot /></button>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  to?: string
  href?: string
  block?: boolean
  disabled?: boolean
  type?: 'button' | 'submit'
}>(), { variant: 'primary', size: 'md', block: false, disabled: false, type: 'button' })

const VARIANTS = {
  primary: 'bg-accent text-on-accent hover:bg-accent-press',
  secondary: 'border border-line bg-surface text-ink hover:bg-paper',
  ghost: 'text-muted hover:bg-paper hover:text-ink',
  danger: 'border border-error/40 bg-surface text-error hover:bg-error-soft',
} as const

const SIZES = { sm: 'px-3 text-xs', md: 'px-4 text-sm' } as const

const classes = computed(() => [
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
  VARIANTS[props.variant],
  SIZES[props.size],
  props.block ? 'w-full' : '',
])
</script>
```

- [ ] **Step 4: Implement `components/ui/Icon.vue`**

```vue
<template>
  <svg
    viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5 shrink-0"
    :aria-hidden="label ? undefined : 'true'" :role="label ? 'img' : undefined" :aria-label="label"
  >
    <path :d="PATHS[name]" />
  </svg>
</template>

<script setup lang="ts">
// Stroke icons drawn on a 24px grid. Add a name here before using it.
const PATHS = {
  queue: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  plus: 'M12 5v14M5 12h14',
  settings: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  stats: 'M12 20V10M18 20V4M6 20v-4',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  message: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42',
  moon: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  check: 'M20 6 9 17l-5-5',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
} as const

defineProps<{ name: keyof typeof PATHS; label?: string }>()
</script>
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/component/UiButton.test.ts`
Expected: PASS (6).

- [ ] **Step 6: Commit**

```bash
git add components/ui/Button.vue components/ui/Icon.vue tests/component/UiButton.test.ts
git commit -m "feat(ui): add UiButton and UiIcon primitives

Facilitated-by: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `UiField` and `UiInput`

**Files:**
- Create: `components/ui/Field.vue`, `components/ui/Input.vue`
- Test: `tests/component/UiField.test.ts`

**Interfaces:**
- Produces: `<UiField label inputId :hint? :error? :required?>`, whose default slot receives `{ describedby: string | undefined, invalid: boolean }`. The hint id is `${inputId}-hint`; the error id is `${inputId}-error`.
- Produces: `<UiInput v-model as="input|textarea" :rows? :invalid? ...attrs>`. The model is `string | null`. Attributes (`id`, `type`, `placeholder`, `autocomplete`, `aria-describedby`, `@blur`) go to the native element.

- [ ] **Step 1: Write the failing test**

```ts
// tests/component/UiField.test.ts
import { describe, it, expect } from 'vitest'
import { h } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import UiField from '~/components/ui/Field.vue'
import UiInput from '~/components/ui/Input.vue'

describe('UiField', () => {
  it('links the label and shows the hint', async () => {
    const w = await mountSuspended(UiField, {
      props: { label: 'Email', inputId: 'email', hint: 'We never share it.' },
      slots: { default: ({ describedby }: { describedby?: string }) => h('input', { id: 'email', 'aria-describedby': describedby }) },
    })
    expect(w.find('label').attributes('for')).toBe('email')
    expect(w.find('#email-hint').text()).toBe('We never share it.')
    expect(w.find('input').attributes('aria-describedby')).toBe('email-hint')
  })

  it('shows the error instead of the hint and marks the required star', async () => {
    const w = await mountSuspended(UiField, {
      props: { label: 'Name', inputId: 'name', hint: 'h', error: 'Required.', required: true },
      slots: { default: ({ describedby, invalid }: { describedby?: string; invalid: boolean }) => h('input', { id: 'name', 'aria-describedby': describedby, 'aria-invalid': String(invalid) }) },
    })
    expect(w.find('#name-hint').exists()).toBe(false)
    expect(w.find('#name-error').text()).toBe('Required.')
    expect(w.find('input').attributes('aria-describedby')).toBe('name-error')
    expect(w.find('input').attributes('aria-invalid')).toBe('true')
    expect(w.find('label').text()).toContain('*')
  })
})

describe('UiInput', () => {
  it('binds v-model on an input and passes attrs through', async () => {
    const w = await mountSuspended(UiInput, { props: { modelValue: 'Ada', id: 'name', placeholder: 'Name' } })
    const el = w.find('input')
    expect((el.element as HTMLInputElement).value).toBe('Ada')
    expect(el.attributes('id')).toBe('name')
    expect(el.attributes('placeholder')).toBe('Name')
    await el.setValue('Grace')
    expect(w.emitted('update:modelValue')![0]).toEqual(['Grace'])
  })

  it('renders a textarea and the invalid border', async () => {
    const w = await mountSuspended(UiInput, { props: { as: 'textarea', modelValue: '', invalid: true } })
    expect(w.find('textarea').classes()).toContain('border-error')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/component/UiField.test.ts`
Expected: FAIL, cannot resolve `~/components/ui/Field.vue`.

- [ ] **Step 3: Implement `components/ui/Field.vue`**

```vue
<template>
  <div>
    <label :for="inputId" class="text-sm font-medium text-ink">
      {{ label }}<span v-if="required" aria-hidden="true" class="text-muted"> *</span>
    </label>
    <div class="mt-1">
      <slot :describedby="describedby" :invalid="Boolean(error)" />
    </div>
    <p v-if="error" :id="`${inputId}-error`" class="mt-1 text-sm text-error">{{ error }}</p>
    <p v-else-if="hint" :id="`${inputId}-hint`" class="mt-1 text-xs text-muted">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ label: string; inputId: string; hint?: string; error?: string | null; required?: boolean }>()

const describedby = computed(() => {
  if (props.error) return `${props.inputId}-error`
  if (props.hint) return `${props.inputId}-hint`
  return undefined
})
</script>
```

- [ ] **Step 4: Implement `components/ui/Input.vue`**

```vue
<template>
  <textarea v-if="as === 'textarea'" v-model="model" :rows="rows" :class="classes" v-bind="$attrs" />
  <input v-else v-model="model" :class="classes" v-bind="$attrs">
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const model = defineModel<string | null>({ default: '' })
const props = withDefaults(defineProps<{ as?: 'input' | 'textarea'; rows?: number; invalid?: boolean }>(), {
  as: 'input',
  rows: 2,
  invalid: false,
})

const classes = computed(() => [
  'min-h-11 w-full rounded-lg border bg-surface px-3 py-2 text-ink placeholder:text-muted transition-colors focus:border-accent focus:outline-none',
  props.invalid ? 'border-error' : 'border-line',
])
</script>
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run tests/component/UiField.test.ts`
Expected: PASS (4).

- [ ] **Step 6: Commit**

```bash
git add components/ui/Field.vue components/ui/Input.vue tests/component/UiField.test.ts
git commit -m "feat(ui): add UiField and UiInput primitives

Facilitated-by: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `UiMenu`

**Files:**
- Create: `components/ui/Menu.vue`
- Test: `tests/component/UiMenu.test.ts`

**Interfaces:**
- Produces: `export interface MenuItem { label: string; onSelect?: () => void; danger?: boolean; separatorBefore?: boolean; children?: MenuItem[] }`, exported from `components/ui/Menu.vue` via a plain `<script lang="ts">` block.
- Produces: `<UiMenu :items="MenuItem[]" label="More actions for Ada">`. The trigger is a 44px ghost button showing `UiIcon name="more"`. An item with `children` swaps the list to those children plus a leading "‹ Back" item, instead of opening a flyout (works on small screens).

- [ ] **Step 1: Write the failing test**

```ts
// tests/component/UiMenu.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import UiMenu from '~/components/ui/Menu.vue'

const archive = vi.fn()
const remind15 = vi.fn()
const items = [
  { label: 'Set aside', onSelect: archive },
  { label: 'Nudge me later', children: [{ label: '15 min', onSelect: remind15 }] },
  { label: 'Delete', danger: true, separatorBefore: true, onSelect: vi.fn() },
]

async function mount() {
  return mountSuspended(UiMenu, { props: { items, label: 'More actions for Ada' }, attachTo: document.body })
}

afterEach(() => {
  archive.mockReset()
  remind15.mockReset()
  document.body.innerHTML = ''
})

describe('UiMenu', () => {
  it('is closed until the trigger is clicked', async () => {
    const w = await mount()
    const trigger = w.find('button[aria-haspopup="menu"]')
    expect(trigger.attributes('aria-label')).toBe('More actions for Ada')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(w.find('[role="menu"]').exists()).toBe(false)
    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(w.findAll('[role="menuitem"]').map((i) => i.text())).toEqual(['Set aside', 'Nudge me later ›', 'Delete'])
  })

  it('focuses the first item on open and wraps with the arrow keys', async () => {
    const w = await mount()
    await w.find('button[aria-haspopup="menu"]').trigger('click')
    const menuItems = () => w.findAll('[role="menuitem"]')
    expect(document.activeElement).toBe(menuItems()[0].element)
    await w.find('[role="menu"]').trigger('keydown', { key: 'ArrowUp' })
    expect(document.activeElement).toBe(menuItems()[2].element)
    await w.find('[role="menu"]').trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement).toBe(menuItems()[0].element)
  })

  it('runs onSelect and closes', async () => {
    const w = await mount()
    await w.find('button[aria-haspopup="menu"]').trigger('click')
    await w.findAll('[role="menuitem"]')[0].trigger('click')
    expect(archive).toHaveBeenCalledOnce()
    expect(w.find('[role="menu"]').exists()).toBe(false)
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    const w = await mount()
    const trigger = w.find('button[aria-haspopup="menu"]')
    await trigger.trigger('click')
    await w.find('[role="menu"]').trigger('keydown', { key: 'Escape' })
    expect(w.find('[role="menu"]').exists()).toBe(false)
    expect(document.activeElement).toBe(trigger.element)
  })

  it('opens a submenu with a Back item', async () => {
    const w = await mount()
    await w.find('button[aria-haspopup="menu"]').trigger('click')
    await w.findAll('[role="menuitem"]')[1].trigger('click')
    expect(w.findAll('[role="menuitem"]').map((i) => i.text())).toEqual(['‹ Back', '15 min'])
    await w.findAll('[role="menuitem"]')[1].trigger('click')
    expect(remind15).toHaveBeenCalledOnce()
  })

  it('closes on an outside pointerdown', async () => {
    const w = await mount()
    await w.find('button[aria-haspopup="menu"]').trigger('click')
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[role="menu"]').exists()).toBe(false)
  })

  it('styles danger items', async () => {
    const w = await mount()
    await w.find('button[aria-haspopup="menu"]').trigger('click')
    expect(w.findAll('[role="menuitem"]')[2].classes()).toContain('text-error')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/component/UiMenu.test.ts`
Expected: FAIL, cannot resolve `~/components/ui/Menu.vue`.

- [ ] **Step 3: Implement `components/ui/Menu.vue`**

```vue
<template>
  <div ref="root" class="relative">
    <button
      ref="trigger" type="button" aria-haspopup="menu" :aria-expanded="String(open)" :aria-label="label"
      class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted transition-colors hover:bg-paper hover:text-ink"
      @click="toggle"
    >
      <UiIcon name="more" />
    </button>
    <div
      v-if="open" ref="menu" role="menu" :aria-label="label"
      class="absolute right-0 z-20 mt-1 min-w-48 rounded-xl border border-line bg-surface py-1 shadow-lg"
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
```

Note: `min-w-48` is not in Tailwind 3.4's default `minWidth` scale. If lint/typecheck passes but the class has no effect, use `min-w-[12rem]`. Check in the browser in Task 17.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/component/UiMenu.test.ts`
Expected: PASS (7). If the arrow-key test fails because the `focusItem` `nextTick` has not flushed, add `await nextTick()` (import from `vue`) after each `trigger('keydown')` in the test. That is a test timing fix, not a behaviour change.

- [ ] **Step 5: Commit**

```bash
git add components/ui/Menu.vue tests/component/UiMenu.test.ts
git commit -m "feat(ui): add keyboard-accessible UiMenu with one-level submenu

Facilitated-by: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `UiAvatar`, `UiSectionHeader`, `UiEmptyState`, `UiToast`

**Files:**
- Create: `components/ui/Avatar.vue`, `components/ui/SectionHeader.vue`, `components/ui/EmptyState.vue`, `components/ui/Toast.vue`
- Create: `utils/initials.ts`
- Test: `tests/unit/initials.test.ts`, `tests/component/UiDisplay.test.ts`

**Interfaces:**
- Produces: `initials(name: string): string`. First letter of the first and last word, uppercased; one word gives one letter; blank gives `'?'`.
- Produces: `<UiAvatar :name size="sm|md">`, `<UiSectionHeader :label :count? tone="due|warm|muted">` (renders an `h2`), `<UiEmptyState :title :body>` with an `action` slot, and `<UiToast :message="string | null">` (`role="status"`, renders nothing when `message` is null).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/initials.test.ts
import { describe, it, expect } from 'vitest'
import { initials } from '~/utils/initials'

describe('initials', () => {
  it('uses the first and last word', () => expect(initials('Ada King Lovelace')).toBe('AL'))
  it('uses one letter for one word', () => expect(initials('cher')).toBe('C'))
  it('trims extra whitespace', () => expect(initials('  grace   hopper ')).toBe('GH'))
  it('falls back to ? for blank', () => expect(initials('   ')).toBe('?'))
})
```

```ts
// tests/component/UiDisplay.test.ts
import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import UiAvatar from '~/components/ui/Avatar.vue'
import UiSectionHeader from '~/components/ui/SectionHeader.vue'
import UiEmptyState from '~/components/ui/EmptyState.vue'
import UiToast from '~/components/ui/Toast.vue'

describe('display primitives', () => {
  it('UiAvatar shows initials and hides from screen readers', async () => {
    const w = await mountSuspended(UiAvatar, { props: { name: 'Sarah Jenkins' } })
    expect(w.text()).toBe('SJ')
    expect(w.attributes('aria-hidden')).toBe('true')
  })

  it('UiSectionHeader renders the label, count and tone', async () => {
    const w = await mountSuspended(UiSectionHeader, { props: { label: 'Due now', count: 3, tone: 'due' } })
    expect(w.find('h2').text()).toContain('Due now')
    expect(w.text()).toContain('3')
    expect(w.find('h2').classes()).toContain('text-due')
  })

  it('UiEmptyState renders title, body and action slot', async () => {
    const w = await mountSuspended(UiEmptyState, {
      props: { title: 'All caught up', body: 'Next nudge: Elena, in 4d' },
      slots: { action: () => 'Add' },
    })
    expect(w.text()).toContain('All caught up')
    expect(w.text()).toContain('Next nudge: Elena, in 4d')
    expect(w.text()).toContain('Add')
  })

  it('UiToast renders a status only when there is a message', async () => {
    const empty = await mountSuspended(UiToast, { props: { message: null } })
    expect(empty.find('[role="status"]').text()).toBe('')
    const w = await mountSuspended(UiToast, { props: { message: 'Coffee 1 of 3 logged' } })
    expect(w.find('[role="status"]').text()).toBe('Coffee 1 of 3 logged')
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/unit/initials.test.ts tests/component/UiDisplay.test.ts`
Expected: FAIL, cannot resolve the modules.

- [ ] **Step 3: Implement**

```ts
// utils/initials.ts
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = words[0][0]
  const last = words.length > 1 ? words[words.length - 1][0] : ''
  return `${first}${last}`.toUpperCase()
}
```

```vue
<!-- components/ui/Avatar.vue -->
<template>
  <span
    aria-hidden="true"
    class="inline-flex shrink-0 items-center justify-center rounded-full bg-navy/10 font-semibold text-ink dark:bg-navy"
    :class="size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm'"
  >{{ initials(name) }}</span>
</template>

<script setup lang="ts">
import { initials } from '~/utils/initials'

withDefaults(defineProps<{ name: string; size?: 'sm' | 'md' }>(), { size: 'md' })
</script>
```

The `dark:` variant only works if `tailwind.config.js` sets `darkMode` to the `[data-theme="dark"]` selector. Run `grep -n darkMode tailwind.config.js`. If it is absent, drop `dark:bg-navy` and use `bg-sunken` instead (a token that already flips with the theme).

```vue
<!-- components/ui/SectionHeader.vue -->
<template>
  <h2 class="flex items-center gap-2 text-label-caps uppercase" :class="TONES[tone]">
    <span>{{ label }}</span>
    <span v-if="count !== undefined" class="rounded-full bg-sunken px-2 py-0.5 font-mono text-[11px] text-muted">{{ count }}</span>
  </h2>
</template>

<script setup lang="ts">
const TONES = { due: 'text-due', warm: 'text-warm', muted: 'text-muted' } as const
withDefaults(defineProps<{ label: string; count?: number; tone?: keyof typeof TONES }>(), { tone: 'muted' })
</script>
```

```vue
<!-- components/ui/EmptyState.vue -->
<template>
  <div class="rounded-xl border border-dashed border-line bg-surface px-6 py-10 text-center">
    <p class="font-display text-xl font-bold tracking-[-0.02em] text-ink">{{ title }}</p>
    <p class="mt-1 text-sm text-muted">{{ body }}</p>
    <div v-if="$slots.action" class="mt-4 flex justify-center"><slot name="action" /></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string; body: string }>()
</script>
```

```vue
<!-- components/ui/Toast.vue -->
<template>
  <div
    role="status" aria-live="polite"
    class="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex justify-center px-4 md:bottom-6"
  >
    <p v-if="message" class="pointer-events-auto rounded-full bg-navy px-4 py-2 text-sm font-medium text-white shadow-lg">{{ message }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{ message: string | null }>()
</script>
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run tests/unit/initials.test.ts tests/component/UiDisplay.test.ts`
Expected: PASS (4 + 4).

- [ ] **Step 5: Commit**

```bash
git add utils/initials.ts components/ui/Avatar.vue components/ui/SectionHeader.vue components/ui/EmptyState.vue components/ui/Toast.vue tests/unit/initials.test.ts tests/component/UiDisplay.test.ts
git commit -m "feat(ui): add avatar, section header, empty state and toast

Facilitated-by: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: App shell (`layouts/app.vue`)

**Files:**
- Modify: `layouts/app.vue` (full rewrite)
- Test: `tests/component/AppLayout.test.ts`

**Interfaces:**
- Consumes: `UiIcon` (Task 1), `useTheme()` → `{ isDark, toggle }` (existing).
- Produces: nav links named exactly **Queue**, **Add**, **Stats**, **Settings** (the e2e tests in Task 11 use these names). Active link has `aria-current="page"`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/component/AppLayout.test.ts
import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import AppLayout from '~/layouts/app.vue'

describe('app layout', () => {
  it('renders the four destinations in both navs', async () => {
    const w = await mountSuspended(AppLayout, { route: '/app', slots: { default: () => 'page' } })
    const navs = w.findAll('nav')
    expect(navs).toHaveLength(2)
    for (const nav of navs) {
      expect(nav.findAll('a').map((a) => a.text())).toEqual(['Queue', 'Add', 'Stats', 'Settings'])
    }
  })

  it('marks the current route', async () => {
    const w = await mountSuspended(AppLayout, { route: '/app/settings', slots: { default: () => 'page' } })
    const current = w.findAll('a[aria-current="page"]').map((a) => a.text())
    expect(current).toEqual(['Settings', 'Settings'])
  })

  it('hides navigation during onboarding', async () => {
    const w = await mountSuspended(AppLayout, { route: '/app/onboarding', slots: { default: () => 'page' } })
    expect(w.findAll('nav')).toHaveLength(0)
  })

  it('labels the theme toggle', async () => {
    const w = await mountSuspended(AppLayout, { route: '/app', slots: { default: () => 'page' } })
    expect(w.find('button[aria-label*="mode"]').exists()).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/component/AppLayout.test.ts`
Expected: FAIL. Link text is "Due" today, and there is no `aria-current`.

- [ ] **Step 3: Rewrite `layouts/app.vue`**

```vue
<template>
  <div class="min-h-screen bg-paper pb-[calc(4.5rem+env(safe-area-inset-bottom))] text-ink md:pb-0">
    <header v-if="!isOnboarding" class="sticky top-0 z-10 hidden border-b border-line bg-surface/95 backdrop-blur md:block">
      <div class="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <NuxtLink to="/app" aria-label="Lanyard home"><BrandMark /></NuxtLink>
        <div class="flex items-center gap-1">
          <nav class="flex items-center gap-1" aria-label="App">
            <NuxtLink
              v-for="link in links" :key="link.to" :to="link.to" :aria-current="isActive(link.to) ? 'page' : undefined"
              class="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors"
              :class="isActive(link.to) ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-paper hover:text-ink'"
            >
              <UiIcon :name="link.icon" />
              <span>{{ link.label }}</span>
            </NuxtLink>
          </nav>
          <button
            type="button"
            class="ml-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line text-ink transition-colors hover:border-accent"
            :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
            @click="toggleTheme"
          >
            <UiIcon :name="isDark ? 'sun' : 'moon'" />
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-3xl px-4 py-6 md:py-8">
      <slot />
    </main>

    <nav
      v-if="!isOnboarding" aria-label="App"
      class="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div class="mx-auto flex max-w-3xl items-stretch justify-around">
        <NuxtLink
          v-for="link in links" :key="link.to" :to="link.to" :aria-current="isActive(link.to) ? 'page' : undefined"
          class="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold"
          :class="isActive(link.to) ? 'text-accent' : 'text-muted'"
        >
          <span
            class="inline-flex h-8 w-12 items-center justify-center rounded-full"
            :class="link.to === '/app/add' ? 'bg-accent text-on-accent' : isActive(link.to) ? 'bg-accent-soft' : ''"
          >
            <UiIcon :name="link.icon" />
          </span>
          <span>{{ link.label }}</span>
        </NuxtLink>
      </div>
    </nav>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const { isDark, toggle: toggleTheme } = useTheme()
const isOnboarding = computed(() => route.path === '/app/onboarding')

const links = [
  { to: '/app', label: 'Queue', icon: 'queue' },
  { to: '/app/add', label: 'Add', icon: 'plus' },
  { to: '/app/stats', label: 'Stats', icon: 'stats' },
  { to: '/app/settings', label: 'Settings', icon: 'settings' },
] as const

function isActive(to: string): boolean {
  if (to === '/app') return route.path === '/app' || route.path.startsWith('/app/c/')
  return route.path.startsWith(to)
}
</script>
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/component/AppLayout.test.ts`
Expected: PASS (4).

- [ ] **Step 5: Update the e2e selectors that named the old links**

In `tests/e2e/change-password.spec.ts` and `tests/e2e/signout.spec.ts`, the `getByRole('link', { name: 'Settings' })` call now matches two links (desktop and mobile). Playwright ignores the hidden one, so the call stays valid as is. Only change a spec if it fails with a "strict mode violation", and then use:

```ts
await page.getByRole('link', { name: 'Settings', exact: true }).first().click()
```

- [ ] **Step 6: Full checks, then commit**

Run: `npm run lint && npx nuxi typecheck && npm run test`
Expected: PASS.

```bash
git add layouts/app.vue tests/component/AppLayout.test.ts tests/e2e
git commit -m "feat(app): icon tab bar and top nav with Queue/Add/Stats/Settings

Facilitated-by: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Queue grouping and labels (`utils/queue.ts`)

**Files:**
- Create: `utils/queue.ts`
- Modify: `utils/composer.ts` (add `hasUsableChannel`)
- Test: `tests/unit/queue.test.ts`, `tests/unit/composer.test.ts` (append)

**Interfaces:**
- Consumes: `Contact` from `~/types`; `FollowUpResult` from `~/utils/followUp` (from the fix branch); `isValidContactEmail` from `~/utils/email`.
- Produces:
  - `export type QueueGroups = { due: Contact[]; today: Contact[]; upcoming: Contact[] }`
  - `export function groupQueue(contacts: Contact[], now?: Date): QueueGroups`. Active contacts only, each group sorted by `follow_up_by` ascending.
  - `export function localDayDiff(date: Date | string, now?: Date): number`. Local calendar days from `now` to `date` (negative means past).
  - `export type Badge = { label: string; tone: 'due' | 'warm' | 'muted' | 'graduated' }`
  - `export function dueBadge(contact: Pick<Contact, 'status' | 'follow_up_by'>, now?: Date): Badge`
  - `export function followUpToast(result: FollowUpResult, total: number, now?: Date): string | null`
  - In `utils/composer.ts`: `export function hasUsableChannel(contact: { email: string | null; phone: string | null }): boolean`

- [ ] **Step 1: Write the failing queue test**

All dates are built with the local-time `Date` constructor, so the test passes in any machine timezone.

```ts
// tests/unit/queue.test.ts
import { describe, it, expect } from 'vitest'
import type { Contact } from '~/types'
import { dueBadge, followUpToast, groupQueue, localDayDiff } from '~/utils/queue'

const NOW = new Date(2026, 9, 3, 12, 0) // 3 Oct 2026, 12:00 local

function makeContact(over: Partial<Contact>): Contact {
  return {
    id: over.id ?? 'c', user_id: 'u', name: over.name ?? 'Ada', how_met: 'Met at X', email: 'ada@example.com', phone: null,
    cadence_ladder: [{ value: 2, unit: 'day' }, { value: 14, unit: 'day' }, { value: 45, unit: 'day' }],
    touchpoints_done: 0, follow_up_by: NOW.toISOString(), remind_at: null, status: 'active',
    created_at: NOW.toISOString(), updated_at: NOW.toISOString(), ...over,
  } as Contact
}

describe('localDayDiff', () => {
  it('is 0 later the same local day', () => expect(localDayDiff(new Date(2026, 9, 3, 23, 30), NOW)).toBe(0))
  it('is 1 just after local midnight', () => expect(localDayDiff(new Date(2026, 9, 4, 0, 10), NOW)).toBe(1))
  it('is negative for earlier days', () => expect(localDayDiff(new Date(2026, 9, 1, 9, 0), NOW)).toBe(-2))
})

describe('groupQueue', () => {
  it('splits active contacts into due / today / upcoming, soonest first', () => {
    const contacts = [
      makeContact({ id: 'up2', follow_up_by: new Date(2026, 9, 9).toISOString() }),
      makeContact({ id: 'due-old', follow_up_by: new Date(2026, 9, 1, 9).toISOString() }),
      makeContact({ id: 'today', follow_up_by: new Date(2026, 9, 3, 23, 30).toISOString() }),
      makeContact({ id: 'due-now', follow_up_by: new Date(2026, 9, 3, 11, 59).toISOString() }),
      makeContact({ id: 'up1', follow_up_by: new Date(2026, 9, 4, 0, 10).toISOString() }),
    ]
    const g = groupQueue(contacts, NOW)
    expect(g.due.map((c) => c.id)).toEqual(['due-old', 'due-now'])
    expect(g.today.map((c) => c.id)).toEqual(['today'])
    expect(g.upcoming.map((c) => c.id)).toEqual(['up1', 'up2'])
  })

  it('treats exactly-now as due', () => {
    const g = groupQueue([makeContact({ id: 'x', follow_up_by: NOW.toISOString() })], NOW)
    expect(g.due).toHaveLength(1)
  })

  it('handles a sub-day rung later today', () => {
    const g = groupQueue([makeContact({ id: 'x', follow_up_by: new Date(2026, 9, 3, 12, 15).toISOString() })], NOW)
    expect(g.today.map((c) => c.id)).toEqual(['x'])
  })

  it('excludes graduated and archived contacts', () => {
    const g = groupQueue([
      makeContact({ id: 'g', status: 'graduated' }),
      makeContact({ id: 'a', status: 'archived' }),
    ], NOW)
    expect([...g.due, ...g.today, ...g.upcoming]).toHaveLength(0)
  })
})

describe('dueBadge', () => {
  it('counts overdue days for earlier days', () => {
    expect(dueBadge(makeContact({ follow_up_by: new Date(2026, 9, 1, 9).toISOString() }), NOW)).toEqual({ label: 'Overdue · 2d', tone: 'due' })
  })
  it('says Due for earlier today', () => {
    expect(dueBadge(makeContact({ follow_up_by: new Date(2026, 9, 3, 8).toISOString() }), NOW)).toEqual({ label: 'Due', tone: 'due' })
  })
  it('shows the local time for later today', () => {
    const at = new Date(2026, 9, 3, 15, 0)
    const expected = at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    expect(dueBadge(makeContact({ follow_up_by: at.toISOString() }), NOW)).toEqual({ label: expected, tone: 'warm' })
  })
  it('shows days for upcoming', () => {
    expect(dueBadge(makeContact({ follow_up_by: new Date(2026, 9, 7, 9).toISOString() }), NOW)).toEqual({ label: 'In 4d', tone: 'muted' })
  })
  it('marks graduated', () => {
    expect(dueBadge(makeContact({ status: 'graduated' }), NOW)).toEqual({ label: 'Graduated · 3 coffees', tone: 'graduated' })
  })
})

describe('followUpToast', () => {
  it('reports progress and the next nudge', () => {
    const r = { outcome: 'advanced' as const, touchpointsDone: 1, followUpBy: new Date(2026, 9, 15, 12).toISOString() }
    expect(followUpToast(r, 3, NOW)).toBe('Coffee 1 of 3 logged · next nudge in 12d')
  })
  it('says later today for a same-day next rung', () => {
    const r = { outcome: 'advanced' as const, touchpointsDone: 1, followUpBy: new Date(2026, 9, 3, 18).toISOString() }
    expect(followUpToast(r, 3, NOW)).toBe('Coffee 1 of 3 logged · next nudge later today')
  })
  it('celebrates graduation', () => {
    expect(followUpToast({ outcome: 'graduated' }, 3, NOW)).toBe('Graduated — all 3 coffees 🎓')
  })
  it('stays quiet when skipped', () => {
    expect(followUpToast({ outcome: 'skipped' }, 3, NOW)).toBeNull()
  })
})
```

- [ ] **Step 2: Append the failing composer test**

Add to the end of `tests/unit/composer.test.ts`. If `hasUsableChannel` is not yet imported there, add it to the existing `~/utils/composer` import line.

```ts
describe('hasUsableChannel', () => {
  it('accepts a valid email', () => expect(hasUsableChannel({ email: 'a@b.co', phone: null })).toBe(true))
  it('accepts a phone with digits', () => expect(hasUsableChannel({ email: null, phone: '+1 555 000 0000' })).toBe(true))
  it('rejects an invalid email with no phone', () => expect(hasUsableChannel({ email: 'a@b.co?bcc=x@y.z', phone: null })).toBe(false))
  it('rejects a phone with no digits', () => expect(hasUsableChannel({ email: null, phone: '--' })).toBe(false))
})
```

- [ ] **Step 3: Run to verify both fail**

Run: `npx vitest run --project unit tests/unit/queue.test.ts tests/unit/composer.test.ts`
Expected: FAIL, `~/utils/queue` is not found and `hasUsableChannel` is not exported.

- [ ] **Step 4: Implement `utils/queue.ts`**

```ts
// Queue grouping by the viewer's LOCAL calendar day. Don't use cadence.daysUntil
// here — it counts UTC days, which mis-buckets evening contacts west of UTC.
import type { Contact } from '~/types'
import type { FollowUpResult } from '~/utils/followUp'

export type QueueGroups = { due: Contact[]; today: Contact[]; upcoming: Contact[] }
export type Badge = { label: string; tone: 'due' | 'warm' | 'muted' | 'graduated' }

const DAY_MS = 24 * 60 * 60 * 1000

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export function localDayDiff(date: Date | string, now: Date = new Date()): number {
  return Math.round((startOfLocalDay(new Date(date)) - startOfLocalDay(now)) / DAY_MS)
}

export function groupQueue(contacts: Contact[], now: Date = new Date()): QueueGroups {
  const groups: QueueGroups = { due: [], today: [], upcoming: [] }
  const active = contacts
    .filter((c) => c.status === 'active')
    .sort((a, b) => a.follow_up_by.localeCompare(b.follow_up_by))
  for (const c of active) {
    if (new Date(c.follow_up_by).getTime() <= now.getTime()) groups.due.push(c)
    else if (localDayDiff(c.follow_up_by, now) === 0) groups.today.push(c)
    else groups.upcoming.push(c)
  }
  return groups
}

export function dueBadge(contact: Pick<Contact, 'status' | 'follow_up_by'>, now: Date = new Date()): Badge {
  if (contact.status === 'graduated') return { label: 'Graduated · 3 coffees', tone: 'graduated' }
  const at = new Date(contact.follow_up_by)
  const days = localDayDiff(at, now)
  if (at.getTime() <= now.getTime()) {
    return days < 0 ? { label: `Overdue · ${-days}d`, tone: 'due' } : { label: 'Due', tone: 'due' }
  }
  if (days === 0) return { label: at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), tone: 'warm' }
  return { label: `In ${days}d`, tone: 'muted' }
}

export function followUpToast(result: FollowUpResult, total: number, now: Date = new Date()): string | null {
  if (result.outcome === 'skipped') return null
  if (result.outcome === 'graduated') return `Graduated — all ${total} coffees 🎓`
  const days = localDayDiff(result.followUpBy, now)
  const when = days <= 0 ? 'later today' : `in ${days}d`
  return `Coffee ${result.touchpointsDone} of ${total} logged · next nudge ${when}`
}
```

- [ ] **Step 5: Add `hasUsableChannel` to `utils/composer.ts`**

Append below `composerUrl`:

```ts
/** True when composerUrl would address someone: a safe email or a phone with digits. */
export function hasUsableChannel(contact: { email: string | null; phone: string | null }): boolean {
  return isValidContactEmail(contact.email) || (contact.phone ?? '').replace(/\D/g, '').length > 0
}
```

- [ ] **Step 6: Run to verify they pass**

Run: `npx vitest run --project unit tests/unit/queue.test.ts tests/unit/composer.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add utils/queue.ts utils/composer.ts tests/unit/queue.test.ts tests/unit/composer.test.ts
git commit -m "feat(queue): local-day grouping, due badges and follow-up toast copy

Facilitated-by: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `ContactCard` and `CoffeeDots`

**Files:**
- Modify: `components/ContactCard.vue` (full rewrite), `components/CoffeeDots.vue` (accessibility label)
- Test: `tests/component/ContactCard.test.ts` (new), `tests/component/CoffeeDots.test.ts` (append)

**Interfaces:**
- Consumes: `UiAvatar`, `UiButton`, `UiMenu` + `MenuItem`, `CoffeeDots`; `dueBadge`, `localDayDiff`, `groupQueue` semantics from Task 6; `composerUrl`, `hasUsableChannel` from `utils/composer.ts`; `coffeeProgress` from `utils/cadence.ts`.
- Produces: `<ContactCard :contact :now?>` emitting `message`, `mark-done`, `snooze`, `archive`, `delete` (each with `contact: Contact`) and `remind` (`rung: LadderRung`). The emit names are the old ones, except `follow-up` is replaced by `message` and `mark-done`.

- [ ] **Step 1: Write the failing card test**

```ts
// tests/component/ContactCard.test.ts
import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ContactCard from '~/components/ContactCard.vue'
import { composerUrl } from '~/utils/composer'
import type { Contact } from '~/types'

const NOW = new Date(2026, 9, 3, 12, 0)

function makeContact(over: Partial<Contact> = {}): Contact {
  return {
    id: 'c1', user_id: 'u', name: 'Sarah Jenkins', how_met: 'WebSummit · talked Postgres', email: 'sarah@example.com', phone: null,
    cadence_ladder: [{ value: 2, unit: 'day' }, { value: 14, unit: 'day' }, { value: 45, unit: 'day' }],
    touchpoints_done: 1, follow_up_by: new Date(2026, 9, 1, 9).toISOString(), remind_at: null, status: 'active',
    created_at: NOW.toISOString(), updated_at: NOW.toISOString(), ...over,
  } as Contact
}

async function mount(contact: Contact) {
  return mountSuspended(ContactCard, { props: { contact, now: NOW }, attachTo: document.body })
}

async function openMenu(w: Awaited<ReturnType<typeof mount>>) {
  await w.find('button[aria-haspopup="menu"]').trigger('click')
  return w.findAll('[role="menuitem"]').map((i) => i.text())
}

describe('ContactCard', () => {
  it('shows name, verbatim how_met, badge and coffee progress', async () => {
    const w = await mount(makeContact())
    expect(w.text()).toContain('Sarah Jenkins')
    expect(w.text()).toContain('WebSummit · talked Postgres')
    expect(w.text()).toContain('Overdue · 2d')
    expect(w.find('[aria-label="1 of 3 coffees"]').exists()).toBe(true)
  })

  it('links Message to the prefilled composer and emits message on click', async () => {
    const c = makeContact()
    const w = await mount(c)
    const link = w.find('a[data-test="message"]')
    expect(link.attributes('href')).toBe(composerUrl(c, c.how_met))
    await link.trigger('click')
    expect(w.emitted('message')![0]).toEqual([c])
  })

  it('makes Snooze primary for upcoming contacts and moves Message to the menu', async () => {
    const w = await mount(makeContact({ follow_up_by: new Date(2026, 9, 7).toISOString() }))
    expect(w.find('a[data-test="message"]').exists()).toBe(false)
    await w.find('button[data-test="snooze"]').trigger('click')
    expect(w.emitted('snooze')).toHaveLength(1)
    expect(await openMenu(w)).toContain('Message')
  })

  it('disables Message without a usable channel and promotes Edit', async () => {
    const w = await mount(makeContact({ email: 'bad@x.co?bcc=y@z.co', phone: null }))
    expect(w.find('a[data-test="message"]').exists()).toBe(false)
    expect(w.find('button[data-test="message"]').attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('Add a valid email or phone')
    expect(w.find('a[data-test="edit"]').attributes('href')).toBe('/app/c/c1')
  })

  it('lists the due-contact menu in order', async () => {
    const w = await mount(makeContact())
    expect(await openMenu(w)).toEqual(['Mark done', 'Nudge me later ›', 'Set aside', 'Edit', 'Delete'])
  })

  it('emits mark-done and remind from the menu', async () => {
    const w = await mount(makeContact())
    await openMenu(w)
    await w.findAll('[role="menuitem"]')[0].trigger('click')
    expect(w.emitted('mark-done')).toHaveLength(1)
    await openMenu(w)
    await w.findAll('[role="menuitem"]')[1].trigger('click')
    await w.findAll('[role="menuitem"]')[1].trigger('click') // "15 min"
    expect(w.emitted('remind')![0]).toEqual([{ value: 15, unit: 'min' }])
  })

  it('shows only Edit for graduated contacts', async () => {
    const w = await mount(makeContact({ status: 'graduated', touchpoints_done: 3 }))
    expect(w.text()).toContain('Graduated · 3 coffees')
    expect(w.find('[data-test="message"]').exists()).toBe(false)
    expect(await openMenu(w)).toEqual(['Edit'])
  })
})
```

- [ ] **Step 2: Append the failing CoffeeDots test**

Add inside the `describe('CoffeeDots', ...)` block in `tests/component/CoffeeDots.test.ts`:

```ts
  it('exposes progress to screen readers', async () => {
    const wrapper = await mountSuspended(CoffeeDots, { props: { filled: 2 } })
    expect(wrapper.attributes('aria-label')).toBe('2 of 3 coffees')
    expect(wrapper.attributes('role')).toBe('img')
  })
```

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run tests/component/ContactCard.test.ts tests/component/CoffeeDots.test.ts`
Expected: FAIL.

- [ ] **Step 4: Update `components/CoffeeDots.vue`**

Change only the root element's opening tag. The existing `2/3 coffees` text stays, so existing tests keep passing.

```vue
  <div class="flex items-center gap-2" role="img" :aria-label="`${filled} of ${total} coffees`">
```

- [ ] **Step 5: Rewrite `components/ContactCard.vue`**

```vue
<template>
  <article class="rounded-xl border border-line bg-surface p-4 shadow-sm">
    <div class="flex items-start gap-3">
      <UiAvatar :name="contact.name" />
      <div class="min-w-0 flex-1">
        <div class="flex items-start justify-between gap-2">
          <h3 class="truncate font-display text-base font-bold tracking-[-0.02em] text-ink">{{ contact.name }}</h3>
          <span class="shrink-0 rounded-full px-2.5 py-1 text-label-caps uppercase" :class="BADGE_TONES[badge.tone]">{{ badge.label }}</span>
        </div>
        <p class="mt-0.5 line-clamp-2 text-sm text-muted">{{ contact.how_met }}</p>
        <div class="mt-2"><CoffeeDots :filled="coffee" /></div>
      </div>
    </div>

    <footer class="mt-4 flex items-center gap-2">
      <template v-if="contact.status === 'active'">
        <template v-if="!usable">
          <UiButton data-test="message" disabled class="flex-1 sm:flex-none">Message</UiButton>
          <UiButton data-test="edit" variant="secondary" :to="editTo">Edit</UiButton>
        </template>
        <UiButton
          v-else-if="!isUpcoming" data-test="message" :href="composer" class="flex-1 sm:flex-none"
          @click="emit('message', contact)"
        >
          <UiIcon name="message" /> Message
        </UiButton>
        <UiButton v-else data-test="snooze" variant="secondary" class="flex-1 sm:flex-none" @click="emit('snooze', contact)">
          <UiIcon name="clock" /> Snooze
        </UiButton>
      </template>
      <p v-if="contact.status === 'active' && !usable" class="text-xs text-muted">Add a valid email or phone</p>
      <div class="ml-auto"><UiMenu :items="menuItems" :label="`More actions for ${contact.name}`" /></div>
    </footer>
  </article>
</template>

<script setup lang="ts">
import type { Contact, LadderRung } from '~/types'
import type { MenuItem } from '~/components/ui/Menu.vue'
import { coffeeProgress } from '~/utils/cadence'
import { composerUrl, hasUsableChannel } from '~/utils/composer'
import { dueBadge, localDayDiff } from '~/utils/queue'

const props = defineProps<{ contact: Contact; now?: Date }>()
const emit = defineEmits<{
  message: [contact: Contact]
  'mark-done': [contact: Contact]
  snooze: [contact: Contact]
  archive: [contact: Contact]
  delete: [contact: Contact]
  remind: [rung: LadderRung]
}>()

const BADGE_TONES = {
  due: 'bg-due-soft text-due',
  warm: 'bg-warm-soft text-warm',
  muted: 'bg-sunken text-muted',
  graduated: 'bg-accent-soft text-graduated',
} as const

const nowRef = computed(() => props.now ?? new Date())
const coffee = computed(() => coffeeProgress(props.contact.cadence_ladder, props.contact.touchpoints_done))
const badge = computed(() => dueBadge(props.contact, nowRef.value))
const usable = computed(() => hasUsableChannel(props.contact))
const composer = computed(() => composerUrl(props.contact, props.contact.how_met))
const editTo = computed(() => `/app/c/${props.contact.id}`)
const isUpcoming = computed(() => {
  const at = new Date(props.contact.follow_up_by)
  return at.getTime() > nowRef.value.getTime() && localDayDiff(at, nowRef.value) > 0
})

const REMIND: { label: string; rung: LadderRung }[] = [
  { label: '15 min', rung: { value: 15, unit: 'min' } },
  { label: '1 hr', rung: { value: 1, unit: 'hour' } },
  { label: '4 hr', rung: { value: 4, unit: 'hour' } },
  { label: '1 day', rung: { value: 1, unit: 'day' } },
]

function openComposer() {
  emit('message', props.contact)
  window.location.href = composer.value
}

const menuItems = computed<MenuItem[]>(() => {
  const edit: MenuItem = { label: 'Edit', onSelect: () => void navigateTo(editTo.value) }
  if (props.contact.status === 'graduated') return [edit]
  const items: MenuItem[] = []
  if (isUpcoming.value && usable.value) items.push({ label: 'Message', onSelect: openComposer })
  items.push(
    { label: 'Mark done', onSelect: () => emit('mark-done', props.contact) },
    { label: 'Nudge me later', children: REMIND.map((o) => ({ label: o.label, onSelect: () => emit('remind', o.rung) })) },
    { label: 'Set aside', onSelect: () => emit('archive', props.contact) },
    edit,
    { label: 'Delete', danger: true, separatorBefore: true, onSelect: () => emit('delete', props.contact) },
  )
  return items
})
</script>
```

- [ ] **Step 6: Run to verify they pass**

Run: `npx vitest run tests/component/ContactCard.test.ts tests/component/CoffeeDots.test.ts`
Expected: PASS. `pages/app/index.vue` still listens for `@follow-up`, which no longer exists. That's harmless until Task 8, but `npx nuxi typecheck` may flag it, so run the typecheck only after Task 8.

- [ ] **Step 7: Commit**

```bash
git add components/ContactCard.vue components/CoffeeDots.vue tests/component/ContactCard.test.ts tests/component/CoffeeDots.test.ts
git commit -m "feat(card): one-tap Message, overflow menu, due badges

Facilitated-by: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Queue page (`pages/app/index.vue`)

**Files:**
- Modify: `pages/app/index.vue` (full rewrite)
- Test: `tests/component/QueuePage.test.ts`

**Interfaces:**
- Consumes: `useContacts()` → `{ contacts, loading, error, markFollowedUp, snoozeContact, archive, remove, remindContact }`, where `markFollowedUp` returns `Promise<FollowUpResult>` (fix branch); `groupQueue`, `localDayDiff`, `followUpToast` (Task 6); `ContactCard` (Task 7); `UiSectionHeader`, `UiEmptyState`, `UiToast`, `UiButton`.
- Produces: page copy used by the e2e tests: heading "Queue"; filter links "Due" and "Graduated".

- [ ] **Step 1: Write the failing page test**

```ts
// tests/component/QueuePage.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import QueuePage from '~/pages/app/index.vue'
import type { Contact } from '~/types'

const contacts = ref<Contact[]>([])
const error = ref<string | null>(null)
const markFollowedUp = vi.fn()

mockNuxtImport('useContacts', () => () => ({
  contacts, loading: ref(false), error, markFollowedUp,
  snoozeContact: vi.fn(), archive: vi.fn(), remove: vi.fn(), remindContact: vi.fn(),
}))

function makeContact(over: Partial<Contact>): Contact {
  const now = new Date()
  return {
    id: 'c', user_id: 'u', name: 'Ada', how_met: 'Met at X', email: 'ada@example.com', phone: null,
    cadence_ladder: [{ value: 2, unit: 'day' }, { value: 14, unit: 'day' }, { value: 45, unit: 'day' }],
    touchpoints_done: 0, follow_up_by: now.toISOString(), remind_at: null, status: 'active',
    created_at: now.toISOString(), updated_at: now.toISOString(), ...over,
  } as Contact
}

const DAY = 24 * 60 * 60 * 1000

beforeEach(() => {
  contacts.value = []
  error.value = null
  markFollowedUp.mockReset()
})

describe('queue page', () => {
  it('shows the first-run empty state with no contacts', async () => {
    const w = await mountSuspended(QueuePage, { route: '/app' })
    expect(w.text()).toContain('Met someone? Add them.')
  })

  it('groups contacts under Due now and Upcoming', async () => {
    contacts.value = [
      makeContact({ id: 'a', name: 'Due Person', follow_up_by: new Date(Date.now() - DAY).toISOString() }),
      makeContact({ id: 'b', name: 'Later Person', follow_up_by: new Date(Date.now() + 5 * DAY).toISOString() }),
    ]
    const w = await mountSuspended(QueuePage, { route: '/app' })
    const headings = w.findAll('h2').map((h) => h.text())
    expect(headings.some((t) => t.startsWith('Due now'))).toBe(true)
    expect(headings.some((t) => t.startsWith('Upcoming'))).toBe(true)
    expect(w.text()).not.toContain('All caught up')
  })

  it('shows All caught up when only upcoming contacts remain', async () => {
    contacts.value = [makeContact({ id: 'b', name: 'Elena', follow_up_by: new Date(Date.now() + 4 * DAY).toISOString() })]
    const w = await mountSuspended(QueuePage, { route: '/app' })
    expect(w.text()).toContain('All caught up')
    expect(w.text()).toContain('Next nudge: Elena, in 4d')
  })

  it('shows a toast after Message advances the ladder', async () => {
    contacts.value = [makeContact({ id: 'a', follow_up_by: new Date(Date.now() - DAY).toISOString() })]
    markFollowedUp.mockResolvedValue({ outcome: 'advanced', touchpointsDone: 1, followUpBy: new Date(Date.now() + 14 * DAY).toISOString() })
    const w = await mountSuspended(QueuePage, { route: '/app' })
    await w.find('a[data-test="message"]').trigger('click')
    await vi.waitFor(() => expect(w.find('[role="status"]').text()).toContain('Coffee 1 of 3 logged'))
  })

  it('keeps a recovery error when the background follow-up fails', async () => {
    contacts.value = [makeContact({ id: 'a', follow_up_by: new Date(Date.now() - DAY).toISOString() })]
    markFollowedUp.mockRejectedValue(new Error('network down'))
    const w = await mountSuspended(QueuePage, { route: '/app' })
    await w.find('a[data-test="message"]').trigger('click')
    await vi.waitFor(() => expect(w.find('[role="alert"]').text()).toContain("Couldn't log that follow-up. Use ⋯ › Mark done."))
  })

  it('lists graduated contacts under the Graduated filter', async () => {
    contacts.value = [makeContact({ id: 'g', name: 'Grad', status: 'graduated', touchpoints_done: 3 })]
    const w = await mountSuspended(QueuePage, { route: '/app?filter=graduated' })
    expect(w.text()).toContain('Grad')
    expect(w.text()).toContain('Graduated · 3 coffees')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/component/QueuePage.test.ts`
Expected: FAIL. There is no "All caught up", no toast, and the card emits `message` but the page doesn't handle it.

- [ ] **Step 3: Rewrite `pages/app/index.vue`**

```vue
<template>
  <div>
    <div class="flex items-center justify-between gap-3">
      <h1 class="font-display text-3xl font-bold tracking-[-0.02em]">Queue</h1>
      <div class="flex rounded-lg border border-line bg-surface p-1 text-sm">
        <NuxtLink
          to="/app" class="inline-flex min-h-9 items-center rounded-md px-3 font-medium"
          :class="!showGraduated ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink'"
          :aria-current="!showGraduated ? 'page' : undefined"
        >Due</NuxtLink>
        <NuxtLink
          to="/app?filter=graduated" class="inline-flex min-h-9 items-center rounded-md px-3 font-medium"
          :class="showGraduated ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink'"
          :aria-current="showGraduated ? 'page' : undefined"
        >Graduated</NuxtLink>
      </div>
    </div>

    <p v-if="error" role="alert" class="mt-4 rounded-lg bg-error-soft px-3 py-2 text-sm text-error">{{ error }}</p>

    <UiEmptyState
      v-if="!loading && contacts.length === 0" class="mt-8"
      title="Met someone? Add them." body="We'll nudge you before it cools."
    >
      <template #action><UiButton to="/app/add">Add your first contact</UiButton></template>
    </UiEmptyState>

    <template v-else-if="!showGraduated">
      <UiEmptyState v-if="caughtUp" class="mt-6" title="All caught up" :body="nextNudgeLine" />

      <section v-for="g in sections" :key="g.key" class="mt-6">
        <UiSectionHeader :label="g.label" :count="g.items.length" :tone="g.tone" />
        <div class="mt-3 grid gap-3 sm:grid-cols-2">
          <ContactCard
            v-for="c in g.items" :key="c.id" :contact="c"
            @message="onMessage" @mark-done="onMarkDone" @snooze="onSnooze" @archive="onArchive"
            @delete="onDelete" @remind="onRemind(c, $event)"
          />
        </div>
      </section>

      <p v-if="!caughtUp && sections.length === 0" class="mt-6 text-sm text-muted">Nothing on the docket. Add a contact or wait for the next rung.</p>
    </template>

    <section v-else class="mt-6">
      <UiSectionHeader label="Graduated" :count="graduated.length" />
      <div v-if="graduated.length" class="mt-3 grid gap-3 sm:grid-cols-2">
        <ContactCard v-for="c in graduated" :key="c.id" :contact="c" />
      </div>
      <p v-else class="mt-3 text-sm text-muted">No one has finished their three coffees yet.</p>
    </section>

    <UiToast :message="toast" />
  </div>
</template>

<script setup lang="ts">
import type { Contact, LadderRung } from '~/types'
import { followUpToast, groupQueue, localDayDiff } from '~/utils/queue'

definePageMeta({ layout: 'app', middleware: 'app' })

const { contacts, loading, error, markFollowedUp, snoozeContact, archive, remove, remindContact } = useContacts()
const route = useRoute()

const showGraduated = computed(() => route.query.filter === 'graduated')
const groups = computed(() => groupQueue(contacts.value))
const graduated = computed(() => contacts.value.filter((c) => c.status === 'graduated'))

const sections = computed(() => [
  { key: 'due', label: 'Due now', tone: 'due' as const, items: groups.value.due },
  { key: 'today', label: 'Later today', tone: 'warm' as const, items: groups.value.today },
  { key: 'upcoming', label: 'Upcoming', tone: 'muted' as const, items: groups.value.upcoming },
].filter((g) => g.items.length > 0))

const caughtUp = computed(() => groups.value.due.length === 0 && groups.value.today.length === 0 && groups.value.upcoming.length > 0)
const nextNudgeLine = computed(() => {
  const next = groups.value.upcoming[0]
  return next ? `Next nudge: ${next.name}, in ${localDayDiff(next.follow_up_by)}d` : ''
})

const toast = ref<string | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | undefined
function showToast(message: string | null) {
  if (!message) return
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = null }, 4000)
}
onBeforeUnmount(() => clearTimeout(toastTimer))

async function followUp(c: Contact, failureMessage?: string) {
  error.value = null
  try {
    const result = await markFollowedUp(c.id)
    showToast(followUpToast(result, c.cadence_ladder.length))
  } catch (e) {
    error.value = failureMessage ?? (e instanceof Error ? e.message : String(e))
  }
}

// Message is an <a href="sms:/mailto:">; the browser opens the composer and we
// log the touchpoint in the background. The error must survive the trip out.
function onMessage(c: Contact) {
  void followUp(c, "Couldn't log that follow-up. Use ⋯ › Mark done.")
}
function onMarkDone(c: Contact) {
  void followUp(c)
}
async function onSnooze(c: Contact) {
  await run(snoozeContact(c.id))
}
async function onArchive(c: Contact) {
  await run(archive(c.id))
}
async function onDelete(c: Contact) {
  if (!confirm(`Delete ${c.name}?`)) return
  await run(remove(c.id))
}
async function onRemind(c: Contact, rung: LadderRung) {
  await run(remindContact(c.id, rung))
}

async function run(p: Promise<unknown>) {
  try {
    await p
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
</script>
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/component/QueuePage.test.ts`
Expected: PASS (6). If the "All caught up" test is off by one day near local midnight, the fixture's `Date.now() + 4 * DAY` crossed a DST boundary. Build it with `new Date(y, m, d + 4, 12)` instead.

- [ ] **Step 5: Full checks, then commit**

Run: `npm run lint && npx nuxi typecheck && npm run test`
Expected: PASS.

```bash
git add pages/app/index.vue tests/component/QueuePage.test.ts
git commit -m "feat(queue): grouped queue with all-caught-up state and follow-up toast

Facilitated-by: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Recent `how_met` chips (`utils/howMet.ts`)

**Files:**
- Create: `utils/howMet.ts`
- Test: `tests/unit/howMet.test.ts`

**Interfaces:**
- Produces:
  - `export function recentHowMetPrefixes(contacts: Pick<Contact, 'how_met' | 'created_at'>[], limit?: number): string[]`. Defaults to 3. Newest first, text before the first `·`, trimmed, capped at 30 characters, de-duplicated case-insensitively, blanks dropped.
  - `export function applyHowMetChip(current: string, chip: string): string`. Returns `` `${chip} · ${rest}` ``. If the text already starts with the chip it is returned unchanged, so repeated taps don't stack.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/howMet.test.ts
import { describe, it, expect } from 'vitest'
import { applyHowMetChip, recentHowMetPrefixes } from '~/utils/howMet'

const c = (how_met: string, created_at: string) => ({ how_met, created_at })

describe('recentHowMetPrefixes', () => {
  it('takes the text before the first · from the newest contacts', () => {
    expect(recentHowMetPrefixes([
      c('Design Summit · talked tokens', '2026-10-01T00:00:00Z'),
      c('WebSummit 2026 · coffee line', '2026-10-03T00:00:00Z'),
      c('Intro via Sam', '2026-10-02T00:00:00Z'),
    ])).toEqual(['WebSummit 2026', 'Intro via Sam', 'Design Summit'])
  })

  it('de-duplicates case-insensitively and respects the limit', () => {
    expect(recentHowMetPrefixes([
      c('webSummit · a', '2026-10-03T00:00:00Z'),
      c('WebSummit · b', '2026-10-02T00:00:00Z'),
      c('Meetup', '2026-10-01T00:00:00Z'),
    ], 1)).toEqual(['webSummit'])
  })

  it('caps long prefixes at 30 characters and drops blanks', () => {
    const long = 'A very long conference name that keeps going'
    expect(recentHowMetPrefixes([c(long, '2026-10-03T00:00:00Z'), c('  · x', '2026-10-02T00:00:00Z')]))
      .toEqual([long.slice(0, 30).trim()])
  })
})

describe('applyHowMetChip', () => {
  it('prefixes the chip', () => expect(applyHowMetChip('talked Postgres', 'WebSummit')).toBe('WebSummit · talked Postgres'))
  it('fills an empty field', () => expect(applyHowMetChip('  ', 'WebSummit')).toBe('WebSummit · '))
  it('does not stack the same chip', () => expect(applyHowMetChip('WebSummit · x', 'WebSummit')).toBe('WebSummit · x'))
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --project unit tests/unit/howMet.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `utils/howMet.ts`**

```ts
// Suggestion chips for the capture form, built from the user's own recent
// how_met values. Display-only: how_met is still stored verbatim.
import type { Contact } from '~/types'

const MAX_CHIP = 30

export function recentHowMetPrefixes(contacts: Pick<Contact, 'how_met' | 'created_at'>[], limit = 3): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const newest = [...contacts].sort((a, b) => b.created_at.localeCompare(a.created_at))
  for (const { how_met } of newest) {
    const prefix = (how_met.split('·')[0] ?? '').trim().slice(0, MAX_CHIP).trim()
    const key = prefix.toLowerCase()
    if (!prefix || seen.has(key)) continue
    seen.add(key)
    out.push(prefix)
    if (out.length >= limit) break
  }
  return out
}

export function applyHowMetChip(current: string, chip: string): string {
  const rest = current.trim()
  if (rest.toLowerCase().startsWith(chip.toLowerCase())) return current
  return `${chip} · ${rest}`
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run --project unit tests/unit/howMet.test.ts`
Expected: PASS (6). Note that `applyHowMetChip('  ', chip)` returns `'WebSummit · '` with a trailing space, because `rest` is empty. That matches the test.

- [ ] **Step 5: Commit**

```bash
git add utils/howMet.ts tests/unit/howMet.test.ts
git commit -m "feat(capture): recent how-met suggestion chips helper

Facilitated-by: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: `ContactForm` rebuild

**Files:**
- Modify: `components/ContactForm.vue` (full rewrite; `ContactFormValues` export unchanged)
- Modify: `tests/component/ContactForm.test.ts` (one assertion changes; new tests added)

**Interfaces:**
- Consumes: `UiField`, `UiInput`, `UiButton` (Tasks 1–2); `applyHowMetChip` (Task 9); `formatLadder`, `LADDER_NAMES`, `LADDER_PRESETS` (existing).
- Produces: props `submitLabel?: string`, `initial?: Partial<ContactFormValues> | null`, **new** `suggestions?: string[]`, **new** `autofocus?: boolean`. Emits `submit: [ContactFormValues]`, same as before. Element ids are unchanged: `#name`, `#how_met`, `#email`, `#phone`.
- Validation copy:
  - Name or how_met missing on submit → form error `Name and how you met are required.` (unchanged).
  - No channel → field error `Add an email or a phone number.`, shown after the email or phone field is blurred, or after a submit attempt.

- [ ] **Step 1: Update and extend the tests**

In `tests/component/ContactForm.test.ts`, change the expectation in `'requires at least an email or phone (mirrors the DB CHECK)'` from:

```ts
    expect(w.text()).toContain('Add an email or phone number.')
```

to:

```ts
    expect(w.text()).toContain('Add an email or a phone number.')
```

Then add these tests inside the `describe('ContactForm', ...)` block:

```ts
  it('does not show the channel error before the user leaves the field or submits', async () => {
    const w = await mount()
    expect(w.text()).not.toContain('Add an email or a phone number.')
    await w.find('#email').trigger('blur')
    expect(w.text()).toContain('Add an email or a phone number.')
  })

  it('inserts a suggestion chip at the start of how you met', async () => {
    const w = await mountSuspended(ContactForm, { props: { initial: null, suggestions: ['WebSummit 2026'] } })
    await w.find('#how_met').setValue('talked Postgres')
    const chip = w.findAll('button').find((b) => b.text() === 'WebSummit 2026')!
    await chip.trigger('click')
    expect((w.find('#how_met').element as HTMLTextAreaElement).value).toBe('WebSummit 2026 · talked Postgres')
  })

  it('keeps the pace picker collapsed until asked', async () => {
    const w = await mount()
    const toggle = w.find('button[aria-controls="pace-options"]')
    expect(toggle.text()).toContain('Pace: Default')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(w.find('#pace-options').exists()).toBe(false)
    await toggle.trigger('click')
    expect(w.find('#pace-options').exists()).toBe(true)
  })

  it('opens the pace picker when editing a custom ladder', async () => {
    const w = await mount({ name: 'Ada', how_met: 'x', email: 'a@b.co', ladderPreset: 'custom', customLadder: [{ value: 3, unit: 'day' }] })
    expect(w.find('#pace-options').exists()).toBe(true)
  })
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run tests/component/ContactForm.test.ts`
Expected: the 4 new tests and the changed assertion FAIL.

- [ ] **Step 3: Rewrite `components/ContactForm.vue`**

```vue
<template>
  <form class="space-y-5" novalidate @submit.prevent="onSubmit">
    <UiField label="Name" input-id="name" required>
      <template #default="{ describedby }">
        <UiInput id="name" ref="nameInput" v-model="form.name" type="text" autocomplete="off" placeholder="Ada Lovelace" :aria-describedby="describedby" />
      </template>
    </UiField>

    <UiField label="How you met" input-id="how_met" hint="Sent verbatim in your follow-up nudge." required>
      <template #default="{ describedby }">
        <UiInput id="how_met" v-model="form.how_met" as="textarea" placeholder="Met at the analytics track after her lightning talk…" :aria-describedby="describedby" />
        <div v-if="suggestions?.length" class="mt-2 flex flex-wrap gap-2">
          <button
            v-for="chip in suggestions" :key="chip" type="button"
            class="min-h-9 rounded-full border border-line bg-sunken px-3 text-xs font-medium text-ink transition-colors hover:border-accent"
            @click="form.how_met = applyHowMetChip(form.how_met, chip)"
          >{{ chip }}</button>
        </div>
      </template>
    </UiField>

    <fieldset class="rounded-xl border border-line bg-surface p-4" :aria-describedby="channelError ? 'channel-error' : undefined">
      <legend class="px-1 text-label-caps uppercase text-ink">Reach them via (at least one) *</legend>
      <div class="space-y-3">
        <UiField label="Email" input-id="email">
          <UiInput id="email" v-model="form.email" type="email" autocomplete="off" placeholder="ada@example.com" :invalid="Boolean(channelError)" @blur="channelTouched = true" />
        </UiField>
        <div class="flex items-center gap-3 text-muted" aria-hidden="true">
          <span class="h-px flex-1 bg-line" /><span class="text-label-caps uppercase">or</span><span class="h-px flex-1 bg-line" />
        </div>
        <UiField label="Phone" input-id="phone">
          <UiInput id="phone" v-model="form.phone" type="tel" autocomplete="off" placeholder="+1 555 000 0000" :invalid="Boolean(channelError)" @blur="channelTouched = true" />
        </UiField>
      </div>
      <p v-if="channelError" id="channel-error" class="mt-2 text-sm text-error">{{ channelError }}</p>
    </fieldset>

    <div>
      <button
        type="button" aria-controls="pace-options" :aria-expanded="String(paceOpen)"
        class="flex min-h-11 w-full items-center justify-between rounded-lg px-1 text-sm text-ink"
        @click="paceOpen = !paceOpen"
      >
        <span><span class="text-muted">Pace:</span> {{ paceSummary }}</span>
        <span aria-hidden="true" class="text-muted">{{ paceOpen ? '▾' : '▸' }}</span>
      </button>

      <fieldset v-if="paceOpen" id="pace-options" class="mt-2">
        <legend class="sr-only">Follow-up pace</legend>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            v-for="preset in presets" :key="preset.key" type="button"
            class="min-h-11 rounded-lg border px-3 py-2 text-left text-sm transition"
            :class="form.ladderPreset === preset.key ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-ink hover:border-muted'"
            :aria-pressed="form.ladderPreset === preset.key"
            @click="form.ladderPreset = preset.key"
          >
            {{ preset.label }}
            <span :class="form.ladderPreset === preset.key ? 'text-accent' : 'text-muted'" class="block text-xs">{{ preset.summary }}</span>
          </button>
          <button
            type="button" class="min-h-11 rounded-lg border px-3 py-2 text-left text-sm transition"
            :class="form.ladderPreset === 'custom' ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-ink hover:border-muted'"
            :aria-pressed="form.ladderPreset === 'custom'"
            @click="form.ladderPreset = 'custom'"
          >
            Custom
            <span :class="form.ladderPreset === 'custom' ? 'text-accent' : 'text-muted'" class="block text-xs">{{ customSummary }}</span>
          </button>
        </div>

        <div v-if="form.ladderPreset === 'custom'" class="mt-3 space-y-2">
          <div v-for="(rung, i) in form.customLadder" :key="i" class="flex items-center gap-2">
            <input
              v-model.number="form.customLadder[i].value" type="number" min="1" :aria-label="`Rung ${i + 1} amount`"
              class="min-h-11 w-24 rounded-lg border border-line bg-surface px-3 text-sm text-ink transition-colors focus:border-accent focus:outline-none"
            >
            <select
              v-model="form.customLadder[i].unit" :aria-label="`Rung ${i + 1} unit`"
              class="min-h-11 rounded-lg border border-line bg-surface px-2 text-sm text-ink transition-colors focus:border-accent focus:outline-none"
            >
              <option value="min">min</option>
              <option value="hour">hours</option>
              <option value="day">days</option>
            </select>
            <UiButton variant="ghost" size="sm" @click="removeRung(i)">Remove</UiButton>
          </div>
          <UiButton v-if="form.customLadder.length < 3" variant="ghost" size="sm" @click="addRung()">+ Add rung</UiButton>
        </div>
      </fieldset>
    </div>

    <p v-if="formError" role="alert" class="text-sm text-error">{{ formError }}</p>

    <div class="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] -mx-4 bg-paper/95 px-4 py-2 backdrop-blur md:static md:mx-0 md:bg-transparent md:p-0">
      <UiButton type="submit" block :disabled="submitting">
        <UiIcon name="check" /> {{ submitting ? 'Saving…' : submitLabel }}
      </UiButton>
    </div>
  </form>
</template>

<script setup lang="ts">
import type { Ladder, LadderRung } from '~/types'
import type { LadderPreset } from '~/utils/cadence'
import { formatLadder } from '~/utils/cadence'
import { applyHowMetChip } from '~/utils/howMet'
import { LADDER_NAMES, LADDER_PRESETS } from '~/types'

export interface ContactFormValues {
  name: string
  how_met: string
  email: string | null
  phone: string | null
  ladderPreset: LadderPreset | 'custom'
  customLadder: Ladder
}

const props = withDefaults(defineProps<{
  submitLabel?: string
  initial?: Partial<ContactFormValues> | null
  suggestions?: string[]
  autofocus?: boolean
}>(), { submitLabel: 'Save contact', initial: null, suggestions: () => [], autofocus: false })

const emit = defineEmits<{ submit: [values: ContactFormValues] }>()

const presets = LADDER_NAMES.map((key) => ({
  key,
  label: key.charAt(0).toUpperCase() + key.slice(1),
  summary: formatLadder(LADDER_PRESETS[key]),
}))

const form = reactive<ContactFormValues>({
  name: props.initial?.name ?? '',
  how_met: props.initial?.how_met ?? '',
  email: props.initial?.email ?? '',
  phone: props.initial?.phone ?? '',
  ladderPreset: props.initial?.ladderPreset ?? 'default',
  customLadder: props.initial?.customLadder ?? [
    { value: 1, unit: 'day' },
    { value: 7, unit: 'day' },
    { value: 21, unit: 'day' },
  ],
})

const submitting = ref(false)
const formError = ref<string | null>(null)
const channelTouched = ref(false)
const paceOpen = ref(form.ladderPreset === 'custom')
const nameInput = ref<{ $el: HTMLInputElement } | null>(null)

const hasChannel = computed(() => Boolean((form.email ?? '').trim() || (form.phone ?? '').trim()))
const channelError = computed(() => (channelTouched.value && !hasChannel.value ? 'Add an email or a phone number.' : null))
const customSummary = computed(() => (form.ladderPreset === 'custom' ? formatLadder(form.customLadder) : ''))
const paceSummary = computed(() => {
  if (form.ladderPreset === 'custom') return `Custom (${formatLadder(form.customLadder)})`
  const p = presets.find((x) => x.key === form.ladderPreset)
  return p ? `${p.label} (${p.summary})` : 'Default'
})

onMounted(() => {
  // Desktop only: on phones autofocus throws the keyboard over the form.
  if (props.autofocus && window.matchMedia('(min-width: 768px)').matches) {
    (nameInput.value?.$el as HTMLInputElement | undefined)?.focus()
  }
})

function addRung(): void {
  if (form.customLadder.length >= 3) return
  const rung: LadderRung = { value: 1, unit: 'day' }
  form.customLadder.push(rung)
}

function removeRung(i: number): void {
  if (form.customLadder.length <= 1) return
  form.customLadder.splice(i, 1)
}

async function onSubmit() {
  formError.value = null
  channelTouched.value = true
  if (!form.name.trim() || !form.how_met.trim()) {
    formError.value = 'Name and how you met are required.'
    return
  }
  if (!hasChannel.value) return
  submitting.value = true
  try {
    emit('submit', { ...form, email: (form.email ?? '').trim() || null, phone: (form.phone ?? '').trim() || null })
  } finally {
    submitting.value = false
  }
}
</script>
```

Note: the `ref="nameInput"` sits on `UiInput`, whose root is the native `<input>` (because `inheritAttrs: false` plus `v-bind="$attrs"` on the element). `$el` is therefore the input itself.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/component/ContactForm.test.ts`
Expected: PASS (9). The "requires a name" test still sees `Name and how you met are required.`

- [ ] **Step 5: Commit**

```bash
git add components/ContactForm.vue tests/component/ContactForm.test.ts
git commit -m "feat(capture): rebuild ContactForm with chips, collapsed pace, blur validation

Facilitated-by: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Add flow, share link, scan, e2e

**Files:**
- Modify: `pages/app/add/index.vue` (becomes the form page), `pages/app/add/manual.vue` (redirect), `pages/app/add/link.vue` (restyle + copied state), `pages/app/add/scan.vue` (link target)
- Modify: `tests/e2e/add-contact.spec.ts`, `tests/e2e/validation.spec.ts`
- Test: `tests/component/AddPage.test.ts`

**Interfaces:**
- Consumes: `ContactForm` with the `suggestions` and `autofocus` props (Task 10); `recentHowMetPrefixes` (Task 9); `useContacts().add` and `contacts`.
- Produces: `/app/add` renders the form directly (heading "Add a contact"), with a "Other ways to add" section linking to `/app/add/link` ("Share link") and `/app/add/scan` ("Scan a badge"). `/app/add/manual` redirects to `/app/add`.

- [ ] **Step 1: Write the failing page test**

```ts
// tests/component/AddPage.test.ts
import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import AddPage from '~/pages/app/add/index.vue'

mockNuxtImport('useContacts', () => () => ({
  contacts: ref([{ how_met: 'WebSummit · coffee', created_at: '2026-10-03T00:00:00Z' }]),
  add: vi.fn(),
}))

describe('add page', () => {
  it('renders the capture form with recent chips and other ways to add', async () => {
    const w = await mountSuspended(AddPage, { route: '/app/add' })
    expect(w.find('h1').text()).toBe('Add a contact')
    expect(w.find('#name').exists()).toBe(true)
    expect(w.findAll('button').some((b) => b.text() === 'WebSummit')).toBe(true)
    const links = w.findAll('a').map((a) => a.attributes('href'))
    expect(links).toEqual(expect.arrayContaining(['/app/add/link', '/app/add/scan']))
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/component/AddPage.test.ts`
Expected: FAIL. The current page is the three-card chooser and has no `#name`.

- [ ] **Step 3: Rewrite `pages/app/add/index.vue`**

Built from the old `manual.vue` logic plus the new layout:

```vue
<template>
  <div class="mx-auto max-w-xl md:grid md:max-w-3xl md:grid-cols-[1fr_14rem] md:gap-8">
    <div>
      <h1 class="font-display text-3xl font-bold tracking-[-0.02em]">Add a contact</h1>
      <p class="mt-1 text-sm text-muted">Who you met, where you met, and a way to reach them.</p>
      <p v-if="error" role="alert" class="mt-4 rounded-lg bg-error-soft px-3 py-2 text-sm text-error">{{ error }}</p>
      <div class="mt-6">
        <ContactForm submit-label="Save contact" :suggestions="suggestions" autofocus @submit="onSubmit" />
      </div>
    </div>

    <aside class="mt-8 md:mt-14" aria-labelledby="other-ways">
      <h2 id="other-ways" class="text-label-caps uppercase text-muted">Other ways to add</h2>
      <div class="mt-3 grid grid-cols-2 gap-3 md:grid-cols-1">
        <NuxtLink to="/app/add/link" class="rounded-xl border border-line bg-surface p-4 transition hover:border-accent">
          <p class="font-display text-sm font-bold">Share link</p>
          <p class="mt-1 text-xs text-muted">They fill in their own details.</p>
        </NuxtLink>
        <NuxtLink to="/app/add/scan" class="rounded-xl border border-line bg-surface p-4 transition hover:border-accent">
          <p class="font-display text-sm font-bold">Scan a badge</p>
          <p class="mt-1 text-xs text-muted">Coming soon.</p>
        </NuxtLink>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import type { ContactFormValues } from '~/components/ContactForm.vue'
import { recentHowMetPrefixes } from '~/utils/howMet'

definePageMeta({ layout: 'app', middleware: 'app' })

const { contacts, add } = useContacts()
const suggestions = computed(() => recentHowMetPrefixes(contacts.value))
const submitting = ref(false)
const error = ref<string | null>(null)

async function onSubmit(values: ContactFormValues) {
  if (submitting.value) return
  submitting.value = true
  error.value = null
  try {
    await add({
      name: values.name,
      how_met: values.how_met,
      email: values.email,
      phone: values.phone,
      ladderPreset: values.ladderPreset,
      customLadder: values.customLadder,
    })
    await navigateTo('/app')
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    submitting.value = false
  }
}
</script>
```

- [ ] **Step 4: Replace `pages/app/add/manual.vue` with a redirect**

```vue
<template>
  <div />
</template>

<script setup lang="ts">
// Old entry point; the Add tab now lands on the form directly.
definePageMeta({ layout: 'app', middleware: 'app', redirect: '/app/add' })
</script>
```

If `nuxi typecheck` rejects `redirect` alongside `middleware`, replace the script with:

```ts
definePageMeta({ layout: 'app', middleware: 'app' })
await navigateTo('/app/add', { replace: true })
```

- [ ] **Step 5: Point Scan's button at the form**

In `pages/app/add/scan.vue`, replace the `NuxtLink` line with:

```vue
    <UiButton to="/app/add" class="mt-6">Add by hand</UiButton>
```

- [ ] **Step 6: Restyle `pages/app/add/link.vue`**

Replace the `<template>` block (the script stays the same except for the `copy` function, which comes next):

```vue
<template>
  <div class="mx-auto max-w-xl">
    <h1 class="font-display text-3xl font-bold tracking-[-0.02em]">Share link</h1>
    <p class="mt-1 text-sm text-muted">A link anyone can open to add their own details to your list. One-time use.</p>

    <div class="mt-6 space-y-4 rounded-xl border border-line bg-surface p-5">
      <UiField label="How you met (optional hint)" input-id="how_met_default">
        <UiInput id="how_met_default" v-model="howMetDefault" placeholder="Met at the hallway track…" />
      </UiField>
      <UiButton :disabled="creating" @click="create">{{ creating ? 'Creating…' : 'Generate link' }}</UiButton>
    </div>

    <div v-if="shareUrl" class="mt-6 rounded-xl border border-line bg-surface p-5 text-center">
      <img v-if="qrDataUrl" :src="qrDataUrl" alt="QR code for the share link" class="mx-auto h-40 w-40">
      <p class="mt-3 break-all font-mono text-xs text-muted">{{ shareUrl }}</p>
      <UiButton variant="secondary" class="mt-3" @click="copy">
        <UiIcon v-if="copied" name="check" /> {{ copied ? 'Copied' : 'Copy link' }}
      </UiButton>
    </div>
    <p v-if="error" role="alert" class="mt-4 text-sm text-error">{{ error }}</p>
  </div>
</template>
```

In the script, add `const copied = ref(false)` next to the other refs, and replace `copy` with:

```ts
async function copy() {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch { /* clipboard blocked — the URL is visible inline */ }
}
```

- [ ] **Step 7: Update the e2e specs**

`tests/e2e/add-contact.spec.ts`: replace lines 8–10 (the Add click, the "By hand" click, and the URL assertion) with:

```ts
  await page.getByRole('navigation').getByRole('link', { name: 'Add', exact: true }).click()
  await expect(page).toHaveURL('/app/add')
```

`tests/e2e/validation.spec.ts`: replace the whole test body after `loginAs` and the URL check with:

```ts
  await page.getByRole('navigation').getByRole('link', { name: 'Add', exact: true }).click()
  await expect(page).toHaveURL('/app/add')

  await page.locator('#name').fill('No Channel')
  await page.locator('#how_met').fill('Somewhere')
  await expect(page.getByText('Add an email or a phone number.')).toBeHidden()

  await page.getByRole('button', { name: 'Save contact' }).click()
  await expect(page.getByText('Add an email or a phone number.')).toBeVisible()
  await expect(page).toHaveURL('/app/add')
```

- [ ] **Step 8: Run component tests and full checks**

Run: `npx vitest run tests/component/AddPage.test.ts && npm run lint && npx nuxi typecheck && npm run test`
Expected: PASS. e2e needs the local Supabase stack (Docker). If it's available, run `npx playwright test tests/e2e/add-contact.spec.ts tests/e2e/validation.spec.ts`; otherwise note in the PR that e2e was not run locally.

- [ ] **Step 9: Commit**

```bash
git add pages/app/add tests/component/AddPage.test.ts tests/e2e/add-contact.spec.ts tests/e2e/validation.spec.ts
git commit -m "feat(capture): Add tab lands on the form; restyle share link and scan

Facilitated-by: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Contact detail (`pages/app/c/[id].vue`)

**Files:**
- Modify: `pages/app/c/[id].vue` (template only; the script is unchanged)
- Test: `tests/component/ContactDetail.test.ts`

**Interfaces:**
- Consumes: `UiAvatar`, `CoffeeDots`, `ContactForm`, `UiButton`; `coffeeProgress` from `utils/cadence.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/component/ContactDetail.test.ts
import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import DetailPage from '~/pages/app/c/[id].vue'

mockNuxtImport('useContacts', () => () => ({
  contacts: ref([{
    id: 'c1', name: 'Sarah Jenkins', how_met: 'WebSummit', email: 's@example.com', phone: null,
    cadence_ladder: [{ value: 2, unit: 'day' }, { value: 14, unit: 'day' }, { value: 45, unit: 'day' }],
    touchpoints_done: 2, status: 'active',
  }]),
  loading: ref(false), update: vi.fn(), remove: vi.fn(),
}))

describe('contact detail', () => {
  it('shows the header, form and a danger delete', async () => {
    const w = await mountSuspended(DetailPage, { route: '/app/c/c1' })
    expect(w.find('h1').text()).toBe('Sarah Jenkins')
    expect(w.find('[aria-label="2 of 3 coffees"]').exists()).toBe(true)
    expect((w.find('#name').element as HTMLInputElement).value).toBe('Sarah Jenkins')
    const del = w.findAll('button').find((b) => b.text() === 'Delete Sarah Jenkins')!
    expect(del.classes()).toContain('text-error')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/component/ContactDetail.test.ts`
Expected: FAIL. The h1 currently reads "Edit contact".

- [ ] **Step 3: Replace the template in `pages/app/c/[id].vue`**

```vue
<template>
  <div class="mx-auto max-w-xl">
    <p v-if="error" role="alert" class="rounded-lg bg-error-soft px-3 py-2 text-sm text-error">{{ error }}</p>
    <p v-else-if="!contact && !loading" class="text-sm text-muted">Contact not found.</p>

    <template v-if="contact">
      <header class="flex items-center gap-3">
        <UiAvatar :name="contact.name" />
        <div class="min-w-0">
          <h1 class="truncate font-display text-2xl font-bold tracking-[-0.02em]">{{ contact.name }}</h1>
          <CoffeeDots :filled="coffeeProgress(contact.cadence_ladder, contact.touchpoints_done)" />
        </div>
      </header>

      <div class="mt-6">
        <ContactForm submit-label="Save changes" :initial="initial" @submit="onSubmit" />
      </div>

      <div class="mt-10 border-t border-line pt-6 pb-8">
        <h2 class="text-label-caps uppercase text-muted">Danger</h2>
        <UiButton variant="danger" class="mt-3" @click="onDelete">Delete {{ contact.name }}</UiButton>
      </div>
    </template>
  </div>
</template>
```

In the script, extend the cadence import to `import { coffeeProgress, presetOf, resolveLadder } from '~/utils/cadence'`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/component/ContactDetail.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add 'pages/app/c/[id].vue' tests/component/ContactDetail.test.ts
git commit -m "feat(contact): detail header with avatar and coffee progress

Facilitated-by: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Settings and quiet hours

**Files:**
- Create: `utils/quietHours.ts`
- Modify: `components/NudgePrefsForm.vue`, `pages/app/settings.vue`
- Test: `tests/unit/quietHours.test.ts`, `tests/component/NudgePrefsForm.test.ts` (append)

**Interfaces:**
- Consumes: `useProfile()` → `{ profile, save, optInSms }`. `save(patch: Partial<Profile>)` already forwards any profile columns, and `Profile` includes `quiet_hours_start: number` and `quiet_hours_end: number` (`types/database.ts`). **`useProfile` needs no change.**
- Produces:
  - `export function validateQuietHours(start: number, end: number): string | null`
  - `export function formatHour(h: number): string` (24-hour, `'21:00'`)
  - `export const HOURS: number[]` (0–23)
  - Selects `#quiet_start` and `#quiet_end`.

- [ ] **Step 1: Write the failing unit test**

```ts
// tests/unit/quietHours.test.ts
import { describe, it, expect } from 'vitest'
import { HOURS, formatHour, validateQuietHours } from '~/utils/quietHours'

describe('quiet hours', () => {
  it('lists 24 hours', () => expect(HOURS).toEqual(Array.from({ length: 24 }, (_, i) => i)))
  it('formats as HH:00', () => {
    expect(formatHour(9)).toBe('09:00')
    expect(formatHour(21)).toBe('21:00')
  })
  it('accepts a window that wraps midnight', () => expect(validateQuietHours(21, 9)).toBeNull())
  it('rejects equal start and end', () => expect(validateQuietHours(9, 9)).toBe('Quiet hours need different start and end times.'))
  it('rejects out-of-range or fractional hours', () => {
    expect(validateQuietHours(24, 9)).toBe('Pick hours between 00:00 and 23:00.')
    expect(validateQuietHours(-1, 9)).toBe('Pick hours between 00:00 and 23:00.')
    expect(validateQuietHours(9.5, 10)).toBe('Pick hours between 00:00 and 23:00.')
  })
})
```

- [ ] **Step 2: Append the failing form tests**

In `tests/component/NudgePrefsForm.test.ts`, add inside the top-level `describe`:

```ts
  it('saves quiet hours with the channel and timezone', async () => {
    const w = await mount()
    await w.find('#quiet_start').setValue('22')
    await w.find('#quiet_end').setValue('7')
    await w.find('form').trigger('submit')
    await vi.dynamicImportSettled()
    expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({ quiet_hours_start: 22, quiet_hours_end: 7 }))
  })

  it('blocks saving when quiet hours start and end match', async () => {
    const w = await mount()
    await w.find('#quiet_start').setValue('9')
    await w.find('#quiet_end').setValue('9')
    await w.find('form').trigger('submit')
    await vi.dynamicImportSettled()
    expect(w.text()).toContain('Quiet hours need different start and end times.')
    expect(saveMock).not.toHaveBeenCalled()
  })
```

`mount` and `saveMock` already exist in that file. If the profile mock there lacks quiet-hours fields, the form falls back to 21 and 9, which is fine for these tests.

- [ ] **Step 3: Run to verify they fail**

Run: `npx vitest run tests/unit/quietHours.test.ts tests/component/NudgePrefsForm.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement `utils/quietHours.ts`**

```ts
// Quiet-hours window in the user's local time. start → end may wrap midnight
// (21 → 9 means 21:00 to 09:00). The cron already honours these columns.
export const HOURS: number[] = Array.from({ length: 24 }, (_, i) => i)

export function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`
}

export function validateQuietHours(start: number, end: number): string | null {
  const ok = (h: number) => Number.isInteger(h) && h >= 0 && h <= 23
  if (!ok(start) || !ok(end)) return 'Pick hours between 00:00 and 23:00.'
  if (start === end) return 'Quiet hours need different start and end times.'
  return null
}
```

- [ ] **Step 5: Rebuild `components/NudgePrefsForm.vue`**

Keep the existing `<script setup>` logic and add the following:

1. Import: `import { HOURS, formatHour, validateQuietHours } from '~/utils/quietHours'`
2. Extend `form`:

```ts
const form = reactive({
  nudge_channel: (profile.value?.nudge_channel ?? 'email') as 'sms' | 'email' | 'both',
  phone: profile.value?.phone ?? '',
  timezone: profile.value?.timezone ?? detectedTimezone,
  quiet_hours_start: profile.value?.quiet_hours_start ?? 21,
  quiet_hours_end: profile.value?.quiet_hours_end ?? 9,
})
```

3. Replace `onSave`:

```ts
async function onSave() {
  error.value = validateQuietHours(form.quiet_hours_start, form.quiet_hours_end)
  if (error.value) return
  saving.value = true
  try {
    await save({
      nudge_channel: form.nudge_channel,
      timezone: form.timezone,
      phone: form.phone || null,
      quiet_hours_start: form.quiet_hours_start,
      quiet_hours_end: form.quiet_hours_end,
    })
    emit('saved')
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally { saving.value = false }
}
```

Replace the template. The consent sentence, `Send code` / `Verify` / `Confirm` labels and all handlers are kept verbatim. Channel buttons keep `bg-accent-soft` when selected, because the existing tests assert it.

```vue
<template>
  <form class="space-y-6" @submit.prevent="onSave">
    <fieldset>
      <legend class="text-label-caps uppercase text-ink">Channel</legend>
      <p v-if="profile?.sms_opted_out_at" class="mt-1 text-xs text-error">You've opted out of SMS. Choose email to receive nudges.</p>
      <div class="mt-2 grid grid-cols-3 gap-1 rounded-lg border border-line bg-surface p-1">
        <button
          v-for="c in channels" :key="c.value" type="button" :aria-pressed="form.nudge_channel === c.value"
          class="min-h-11 rounded-md px-2 text-sm font-medium transition-colors"
          :class="form.nudge_channel === c.value ? 'bg-accent-soft text-accent' : 'text-muted hover:text-ink'"
          @click="form.nudge_channel = c.value"
        >{{ c.label }}</button>
      </div>
    </fieldset>

    <div v-if="!profile?.sms_opted_out_at" class="space-y-3">
      <label class="flex items-start gap-3 text-sm">
        <input v-model="smsOptInConsent" type="checkbox" class="mt-0.5 h-5 w-5 accent-accent">
        <span>I agree to receive conference follow-up reminders by text. <span class="text-muted">Reply STOP to opt out, HELP for help. Message &amp; data rates may apply.</span></span>
      </label>
      <div v-if="smsOptInConsent" class="flex items-end gap-2">
        <UiField class="flex-1" label="Mobile number" input-id="phone">
          <UiInput id="phone" v-model="form.phone" type="tel" placeholder="+1 555 000 0000" />
        </UiField>
        <UiButton variant="secondary" :disabled="sendingCode" @click="sendCode">{{ smsOptedIn ? 'Verify' : 'Send code' }}</UiButton>
      </div>
      <div v-if="smsCodeSent" class="flex items-end gap-2">
        <UiField class="flex-1" label="Enter the code we texted you" input-id="code">
          <UiInput id="code" v-model="code" inputmode="numeric" placeholder="123456" />
        </UiField>
        <UiButton variant="secondary" @click="verifyCode">Confirm</UiButton>
      </div>
    </div>

    <UiField label="Timezone" input-id="timezone" hint="Used to send nudges at sensible local times as you travel.">
      <select id="timezone" v-model="form.timezone" class="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-ink transition-colors focus:border-accent focus:outline-none">
        <option v-for="tz in commonTimezones" :key="tz" :value="tz">{{ tz }}</option>
      </select>
    </UiField>

    <fieldset class="rounded-xl border border-line bg-sunken p-4">
      <legend class="px-1 text-label-caps uppercase text-ink">Quiet hours</legend>
      <div class="grid grid-cols-2 gap-3">
        <UiField label="Don't disturb after" input-id="quiet_start">
          <select id="quiet_start" v-model.number="form.quiet_hours_start" class="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-ink focus:border-accent focus:outline-none">
            <option v-for="h in HOURS" :key="h" :value="h">{{ formatHour(h) }}</option>
          </select>
        </UiField>
        <UiField label="Resume nudges at" input-id="quiet_end">
          <select id="quiet_end" v-model.number="form.quiet_hours_end" class="min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-ink focus:border-accent focus:outline-none">
            <option v-for="h in HOURS" :key="h" :value="h">{{ formatHour(h) }}</option>
          </select>
        </UiField>
      </div>
      <p class="mt-3 text-xs text-muted">
        Lanyard won't nudge you between {{ formatHour(form.quiet_hours_start) }} and {{ formatHour(form.quiet_hours_end) }} your time. Anything due then waits until {{ formatHour(form.quiet_hours_end) }}.
      </p>
    </fieldset>

    <p v-if="error" role="alert" class="text-sm text-error">{{ error }}</p>

    <UiButton type="submit" block :disabled="saving">{{ saving ? 'Saving…' : 'Save preferences' }}</UiButton>
  </form>
</template>
```

The old hint "Nudges are sent during your local daytime (09:00–21:00)." is removed. Run `grep -rn "09:00–21:00" tests` to confirm nothing still asserts on it; if something does, delete that assertion.

- [ ] **Step 6: Card layout for `pages/app/settings.vue`**

Replace the template; the script is unchanged:

```vue
<template>
  <div class="mx-auto max-w-xl space-y-6">
    <h1 class="font-display text-3xl font-bold tracking-[-0.02em]">Settings</h1>

    <section class="rounded-xl border border-line bg-surface p-5" aria-labelledby="s-nudges">
      <h2 id="s-nudges" class="font-display text-lg font-bold">Nudge preferences</h2>
      <p class="mt-1 text-sm text-muted">When and how Lanyard reminds you to follow up.</p>
      <div class="mt-4"><NudgePrefsForm @saved="onSaved" /></div>
    </section>

    <section class="rounded-xl border border-line bg-surface p-5" aria-labelledby="s-appearance">
      <h2 id="s-appearance" class="font-display text-lg font-bold">Appearance</h2>
      <UiButton variant="secondary" class="mt-3" @click="toggleTheme">
        <UiIcon :name="isDark ? 'sun' : 'moon'" /> Switch to {{ isDark ? 'light' : 'dark' }}
      </UiButton>
    </section>

    <section class="rounded-xl border border-line bg-surface p-5" aria-labelledby="s-account">
      <h2 id="s-account" class="font-display text-lg font-bold">Account</h2>
      <p v-if="user" class="mt-1 text-sm text-muted">{{ user.email }}</p>
      <UiButton variant="secondary" class="mt-3" @click="onSignOut">Sign out</UiButton>
      <div class="mt-6 border-t border-line pt-5">
        <h3 class="text-label-caps uppercase text-muted">Password</h3>
        <div class="mt-3"><ChangePasswordForm /></div>
      </div>
      <div class="mt-6 border-t border-line pt-5">
        <h3 class="text-label-caps uppercase text-error">Danger zone</h3>
        <UiButton variant="danger" class="mt-3" @click="showDeleteConfirm = true">Delete account</UiButton>
      </div>
    </section>

    <ConfirmDeleteAccount v-if="showDeleteConfirm" @close="showDeleteConfirm = false" />
  </div>
</template>
```

The `signout.spec.ts` e2e clicks `getByRole('button', { name: 'Sign out' })`; that name is unchanged.

- [ ] **Step 7: Run to verify, then full checks**

Run: `npx vitest run tests/unit/quietHours.test.ts tests/component/NudgePrefsForm.test.ts && npm run lint && npx nuxi typecheck && npm run test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add utils/quietHours.ts components/NudgePrefsForm.vue pages/app/settings.vue tests/unit/quietHours.test.ts tests/component/NudgePrefsForm.test.ts
git commit -m "feat(settings): editable quiet hours and card layout

The quiet_hours_start/end columns already drive the cron; the UI only
showed a hard-coded 09:00–21:00 hint.

Facilitated-by: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Stats and onboarding

**Files:**
- Modify: `pages/app/stats.vue` (template only), `pages/app/onboarding.vue` (template only)

These are markup-only restyles with no new logic, so no new tests. The existing `tests/unit/onboarding.test.ts` must stay green.

- [ ] **Step 1: Replace the `stats.vue` template**

```vue
<template>
  <div class="mx-auto max-w-xl">
    <h1 class="font-display text-3xl font-bold tracking-[-0.02em]">Your loop, so far</h1>
    <p class="mt-1 text-sm text-muted">Measured from the <code class="font-mono">nudges</code> table — not self-report.</p>

    <p v-if="error" role="alert" class="mt-4 rounded-lg bg-error-soft px-3 py-2 text-sm text-error">{{ error }}</p>
    <p v-if="loading" class="mt-8 text-sm text-muted">Crunching numbers…</p>

    <template v-else-if="stats">
      <section class="mt-6 rounded-xl bg-navy p-6 text-white" aria-labelledby="hero-metric">
        <h2 id="hero-metric" class="text-label-caps uppercase text-white/70">The one metric</h2>
        <p class="mt-2 font-display text-5xl font-bold tracking-[-0.02em]">{{ formatMinutes(stats.nudges.medianLatencyMinutes) }}</p>
        <p class="mt-1 text-sm text-white/70">median time from nudge to message</p>
      </section>

      <section class="mt-4 grid grid-cols-2 gap-3">
        <div class="rounded-xl border border-line bg-surface p-4">
          <p class="font-display text-3xl font-bold tracking-[-0.02em]">{{ stats.nudges.actedOnPercent }}%</p>
          <p class="mt-1 text-xs text-muted">nudges acted on ({{ stats.nudges.actedOn }} / {{ stats.nudges.total }})</p>
        </div>
        <div class="rounded-xl border border-line bg-surface p-4">
          <p class="font-display text-3xl font-bold tracking-[-0.02em] text-graduated">{{ stats.contacts.graduatedPercent }}%</p>
          <p class="mt-1 text-xs text-muted">reached all three coffees ({{ stats.contacts.graduated }} / {{ stats.contacts.total }})</p>
        </div>
      </section>

      <UiEmptyState
        v-if="stats.nudges.total === 0" class="mt-6"
        title="No nudges yet" body="The first hourly pass after your next event fills this in."
      />
    </template>
  </div>
</template>
```

`bg-navy` with `text-white` is about 17:1 in light mode. In dark mode `--navy` is `26 43 60` (#1a2b3c), still above 13:1. `text-white/70` on navy is also above 4.5:1 in both themes; Task 17's contrast test checks this.

- [ ] **Step 2: Replace the `onboarding.vue` template**

```vue
<template>
  <div class="mx-auto max-w-md py-6">
    <div class="text-center">
      <BrandMark class="pointer-events-none" />
      <h1 class="mt-4 font-display text-3xl font-bold tracking-[-0.02em]">Almost there</h1>
      <p class="mt-1 text-sm text-muted">Lanyard needs a destination before it can nudge you.</p>
    </div>
    <div class="mt-6 rounded-xl border border-line bg-surface p-5">
      <NudgePrefsForm @saved="onSaved" />
    </div>
  </div>
</template>
```

- [ ] **Step 3: Full checks, then commit**

Run: `npm run lint && npx nuxi typecheck && npm run test`
Expected: PASS.

```bash
git add pages/app/stats.vue pages/app/onboarding.vue
git commit -m "feat(app): stat tiles with hero metric; onboarding card

Facilitated-by: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Auth screens

**Files:**
- Modify: `pages/login.vue`, `pages/auth/reset-password.vue`, `pages/auth/confirm.vue` (templates only)
- Modify: `components/auth/PasswordAuthForm.vue`, `components/auth/OAuthButtons.vue` (templates only)

There is no logic change. The existing `PasswordAuthForm.test.ts` (selectors `#email`, `#password`, button text "Forgot password", "Create account") and the e2e `signin`, `magic-link` and `change-password` specs must stay green. Every id and every visible label is kept exactly.

- [ ] **Step 1: `components/auth/OAuthButtons.vue` template**

```vue
<template>
  <div class="space-y-3">
    <UiButton variant="secondary" block :disabled="loading" @click="start('google')">Continue with Google</UiButton>
    <UiButton variant="secondary" block :disabled="loading" @click="start('apple')">Continue with Apple</UiButton>
    <p v-if="error" role="alert" class="text-sm text-error">{{ error }}</p>
  </div>
</template>
```

- [ ] **Step 2: `components/auth/PasswordAuthForm.vue` template**

```vue
<template>
  <form class="space-y-4" @submit.prevent="submit">
    <UiField label="Email" input-id="email">
      <UiInput id="email" v-model="email" type="email" required autocomplete="email" placeholder="you@example.com" />
    </UiField>

    <div>
      <UiField label="Password" input-id="password">
        <UiInput id="password" v-model="password" type="password" required autocomplete="current-password" placeholder="••••••••" />
      </UiField>
      <button v-if="!forgotSent" type="button" class="mt-2 min-h-9 text-sm text-muted hover:text-ink hover:underline" @click="forgotPassword">
        Forgot password?
      </button>
      <p v-else class="mt-2 text-sm text-graduated">Check your inbox — we sent a reset link.</p>
    </div>

    <p v-if="notice" class="text-sm" :role="notice.tone === 'error' ? 'alert' : undefined" :class="notice.tone === 'error' ? 'text-error' : notice.tone === 'graduated' ? 'text-graduated' : 'text-muted'">
      {{ notice.text }}
    </p>

    <UiButton type="submit" block :disabled="loading">{{ buttonLabel }}</UiButton>

    <UiButton v-if="phase.phase === 'duplicate'" variant="ghost" block @click="backToSignIn">Back to sign in</UiButton>
  </form>
</template>
```

`v-model` on `UiInput` with `email` and `password`: these are refs returned by `useAuthForm()`. If `nuxi typecheck` complains that `Ref<string>` is not assignable to `string | null`, the refs are fine at runtime; check that `useAuthForm` returns `Ref<string>`, which unwraps in templates.

- [ ] **Step 3: `pages/login.vue` template**

```vue
<template>
  <div class="mx-auto max-w-sm px-4 py-12">
    <div class="rounded-xl border border-line bg-surface p-6 shadow-sm">
      <h1 class="font-display text-3xl font-bold tracking-[-0.02em]">Sign in</h1>

      <div class="mt-6 space-y-4">
        <AuthOAuthButtons />

        <div class="flex items-center gap-3 text-muted">
          <span class="h-px flex-1 bg-line" />
          <span class="text-label-caps uppercase">or</span>
          <span class="h-px flex-1 bg-line" />
        </div>

        <div class="grid grid-cols-2 gap-1 rounded-lg border border-line bg-paper p-1" role="tablist" aria-label="Sign-in method">
          <button
            type="button" role="tab" :aria-selected="tab === 'password'"
            class="min-h-9 rounded-md px-3 text-sm font-medium transition-colors"
            :class="tab === 'password' ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'"
            @click="tab = 'password'"
          >Password</button>
          <button
            type="button" role="tab" :aria-selected="tab === 'magic'"
            class="min-h-9 rounded-md px-3 text-sm font-medium transition-colors"
            :class="tab === 'magic' ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'"
            @click="tab = 'magic'"
          >Magic link</button>
        </div>

        <AuthPasswordAuthForm v-if="tab === 'password'" />

        <form v-else class="space-y-4" @submit.prevent="send">
          <UiField label="Email" input-id="email">
            <UiInput id="email" v-model="email" type="email" required autocomplete="email" placeholder="you@example.com" />
          </UiField>
          <p v-if="sent" class="text-sm text-graduated">Check your inbox for the sign-in link.</p>
          <p v-if="error" role="alert" class="text-sm text-error">{{ error }}</p>
          <UiButton type="submit" block :disabled="sending">{{ sending ? 'Sending…' : 'Send magic link' }}</UiButton>
        </form>
      </div>
    </div>
  </div>
</template>
```

If an e2e spec selects the Password / Magic link toggles with `getByRole('button', { name: 'Magic link' })`, the new `role="tab"` breaks it. Check with `grep -rn "Magic link" tests/e2e`. If it matches, change those calls to `getByRole('tab', { name: 'Magic link' })`.

- [ ] **Step 4: `pages/auth/reset-password.vue` template**

```vue
<template>
  <div class="mx-auto max-w-sm px-4 py-12">
    <div class="rounded-xl border border-line bg-surface p-6 shadow-sm">
      <template v-if="ready">
        <h1 class="font-display text-3xl font-bold tracking-[-0.02em]">Set a new password</h1>
        <form class="mt-6 space-y-4" @submit.prevent="update">
          <UiField label="New password" input-id="pw" hint="At least 8 characters.">
            <UiInput id="pw" v-model="password" type="password" required minlength="8" autocomplete="new-password" />
          </UiField>
          <p v-if="message" class="text-sm" :role="updated ? undefined : 'alert'" :class="updated ? 'text-graduated' : 'text-error'">{{ message }}</p>
          <UiButton type="submit" block :disabled="busy">Update password</UiButton>
          <UiButton v-if="updated" variant="ghost" block @click="navigateTo('/login')">Back to sign in</UiButton>
        </form>
      </template>
      <p v-else class="text-sm text-muted">{{ message }}</p>
    </div>
  </div>
</template>
```

- [ ] **Step 5: `pages/auth/confirm.vue` template**

```vue
<template>
  <div class="mx-auto max-w-sm px-4 py-12">
    <div class="rounded-xl border border-line bg-surface p-6 text-center shadow-sm" role="status">
      <BrandMark class="pointer-events-none" />
      <p class="mt-4 text-ink">{{ message }}</p>
    </div>
  </div>
</template>
```

- [ ] **Step 6: Full checks, then commit**

Run: `npm run lint && npx nuxi typecheck && npm run test`
Expected: PASS, including `PasswordAuthForm.test.ts`.

```bash
git add pages/login.vue pages/auth/reset-password.vue pages/auth/confirm.vue components/auth/PasswordAuthForm.vue components/auth/OAuthButtons.vue tests/e2e
git commit -m "feat(auth): card layout on shared UI primitives

Facilitated-by: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Public share page (`pages/share/[token].vue`)

**Files:**
- Modify: `pages/share/[token].vue` (template only; the script is unchanged)
- Test: `tests/component/SharePage.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/component/SharePage.test.ts
import { describe, it, expect, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import SharePage from '~/pages/share/[token].vue'

registerEndpoint('/api/share/t1', { method: 'GET', handler: () => ({ valid: true, how_met_default: 'Hallway track' }) })

describe('share page', () => {
  it('renders the form on the new primitives and shows the channel error only after submit', async () => {
    const w = await mountSuspended(SharePage, { route: '/share/t1' })
    await flushPromises()
    await vi.waitFor(() => expect(w.find('#name').exists()).toBe(true))
    expect(w.find('label[for="name"]').text()).toContain('Name')
    expect(w.find('#how_met').attributes('placeholder')).toBe('Hallway track')
    expect(w.text()).not.toContain('Add an email or a phone number.')
    await w.find('#name').setValue('Ada')
    await w.find('#how_met').setValue('Hallway')
    await w.find('form').trigger('submit')
    expect(w.text()).toContain('Add an email or a phone number.')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/component/SharePage.test.ts`
Expected: FAIL. The submit button is disabled while the form is invalid, so `touched` never flips. The new template enables the button and lets `submit()` validate.

- [ ] **Step 3: Replace the template**

The `submit()` function already sets `touched` and returns early when the form is invalid; that is unchanged.

```vue
<template>
  <div class="flex min-h-screen items-center justify-center bg-paper px-4 py-10 text-ink">
    <div class="w-full max-w-md">
      <div class="text-center">
        <BrandMark class="pointer-events-none" />
        <h1 class="mt-4 font-display text-2xl font-bold tracking-[-0.02em]">Let's stay in touch</h1>
        <p class="mt-1 text-sm text-muted">Add the details you're comfortable sharing — it becomes a follow-up for the person who sent this.</p>
      </div>

      <p v-if="loading" class="mt-6 rounded-xl border border-line bg-surface p-5 text-center text-sm text-muted" role="status">Checking this link…</p>

      <p v-else-if="!valid" class="mt-6 rounded-xl border border-line bg-surface p-5 text-center text-sm text-muted">This link has expired or was already used.</p>

      <div v-else-if="done" class="mt-6 rounded-xl border border-graduated bg-surface p-6 text-center" role="status">
        <span class="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent"><UiIcon name="check" /></span>
        <p class="mt-3 font-display text-lg font-bold">Saved — thanks, {{ doneName }}</p>
        <p class="mt-1 text-sm text-muted">They'll be prompted to follow up with you.</p>
      </div>

      <form v-else class="mt-6 space-y-4 rounded-xl border border-line bg-surface p-5 shadow-sm" novalidate @submit.prevent="submit">
        <p v-if="submitError" role="alert" class="text-sm text-error">{{ submitError }}</p>
        <UiField label="Name" input-id="name" required>
          <UiInput id="name" v-model="name" placeholder="Ada Lovelace" />
        </UiField>
        <UiField label="How you met" input-id="how_met" required>
          <UiInput id="how_met" v-model="howMet" as="textarea" :placeholder="howMetDefault || 'Where did you run into each other?'" />
        </UiField>
        <div class="space-y-3">
          <UiField label="Email" input-id="email">
            <UiInput id="email" v-model="email" type="email" :invalid="!hasChannel && touched" />
          </UiField>
          <UiField label="Phone" input-id="phone">
            <UiInput id="phone" v-model="phone" type="tel" placeholder="+1 555 000 0000" :invalid="!hasChannel && touched" />
          </UiField>
        </div>
        <p v-if="!hasChannel && touched" class="text-sm text-error">Add an email or a phone number.</p>
        <UiButton type="submit" block :disabled="submitting">{{ submitting ? 'Saving…' : 'Save it' }}</UiButton>
      </form>
    </div>
  </div>
</template>
```

Note: the button was previously `:disabled="submitting || !valid"`, where `valid` meant *link* validity (a naming collision). With the form only rendered when the link is valid, `submitting` alone is enough.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/component/SharePage.test.ts && npm run test`
Expected: PASS, including `tests/unit/share.test.ts` (server-side, unaffected).

- [ ] **Step 5: Commit**

```bash
git add 'pages/share/[token].vue' tests/component/SharePage.test.ts
git commit -m "feat(share): public share page on shared primitives

Facilitated-by: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Contrast guard, docs, cleanup, visual verification

**Files:**
- Create: `tests/unit/contrast.test.ts`
- Modify: `AGENTS.md`, `project_docs/tasks.md`
- Delete: empty directory `pages/contacts/[id]/` (untracked; `rmdir`)

- [ ] **Step 1: Write the contrast guard**

This parses the real token values from `assets/css/main.css`, so a future palette edit that breaks AA fails CI.

```ts
// tests/unit/contrast.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync('assets/css/main.css', 'utf8')

function tokens(block: string): Record<string, [number, number, number]> {
  const out: Record<string, [number, number, number]> = {}
  for (const m of block.matchAll(/--([\w-]+):\s*(\d+)\s+(\d+)\s+(\d+);/g)) out[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])]
  return out
}

const light = tokens(css.slice(css.indexOf(':root'), css.indexOf("[data-theme='dark']")))
const dark = { ...light, ...tokens(css.slice(css.indexOf("[data-theme='dark']"))) }

function lum([r, g, b]: [number, number, number]): number {
  const ch = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
}
function ratio(a: [number, number, number], b: [number, number, number]): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

// [foreground, background] pairs the redesign renders as text.
const PAIRS: [string, string][] = [
  ['on-accent', 'accent'], ['ink', 'surface'], ['ink', 'paper'], ['muted', 'surface'], ['muted', 'paper'],
  ['due', 'due-soft'], ['warm', 'warm-soft'], ['graduated', 'accent-soft'], ['accent', 'accent-soft'],
  ['error', 'surface'], ['error', 'error-soft'], ['muted', 'sunken'], ['ink', 'sunken'],
]

describe('WCAG AA contrast for redesign text pairs', () => {
  for (const [theme, t] of [['light', light], ['dark', dark]] as const) {
    for (const [fg, bg] of PAIRS) {
      it(`${theme}: ${fg} on ${bg} ≥ 4.5`, () => {
        expect(t[fg], `missing --${fg}`).toBeDefined()
        expect(t[bg], `missing --${bg}`).toBeDefined()
        expect(ratio(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5)
      })
    }
    it(`${theme}: white on navy (stats hero, toast) ≥ 4.5`, () => {
      expect(ratio([255, 255, 255], t.navy)).toBeGreaterThanOrEqual(4.5)
    })
  }
})
```

- [ ] **Step 2: Run it**

Run: `npx vitest run --project unit tests/unit/contrast.test.ts`
Expected: PASS. **If a pair fails, do not weaken the test.** Change the component to a passing pair: for example, use `text-ink` instead of `text-muted` on `bg-sunken`, or `text-accent` instead of `text-graduated` on `bg-accent-soft`. Then re-run. Record any swap in the commit message.

- [ ] **Step 3: Docs**

In `AGENTS.md`, under `## Stack & conventions`, add after the Tailwind bullet:

```markdown
- Build UI from the `components/ui/` primitives (`UiButton`, `UiField`, `UiInput`, `UiMenu`, `UiIcon`, …) rather than repeating Tailwind class strings. Interactive targets are at least 44px (`min-h-11`).
```

In `project_docs/tasks.md`, append to the end of the file:

```markdown
## App UI redesign (2026-10-03)

- [x] Shared `components/ui/` primitives, icon tab bar, grouped queue (Due now / Later today / Upcoming) with one-tap Message, capture form with recent chips, editable quiet hours, restyled stats/auth/share. Spec: `project_docs/specs/2026-10-03-app-ui-redesign-design.md`. Plan: `project_docs/plans/2026-10-03-app-ui-redesign.md`.
```

- [ ] **Step 4: Remove the empty directory**

Run: `rmdir 'pages/contacts/[id]' pages/contacts`
Expected: no output. If `rmdir` reports "Directory not empty", stop and list the contents; do not delete files you haven't inspected.

- [ ] **Step 5: Full verification**

Run: `npm run lint && npx nuxi typecheck && npm run test && npm run build`
Expected: all PASS. If the local Supabase stack is running, also run `npx playwright test`.

- [ ] **Step 6: Visual check**

Start the dev server (`npm run dev`). Sign in with the project's seed or test user (see `tests/e2e/helpers.ts`), then capture each screen at 375×812 and 1280×800, in light and dark mode:

- `/app` with due, today and upcoming contacts
- `/app` with the ⋯ menu open
- `/app?filter=graduated`
- `/app/add`
- `/app/c/<id>`
- `/app/settings`
- `/app/stats`
- `/login`
- `/share/<valid token>`

Check:
- No horizontal scroll at 375px.
- The tab bar doesn't cover the sticky Save button.
- The menu isn't clipped by the card.
- `min-w-48` took effect on the menu (if not, switch to `min-w-[12rem]`).
- Focus rings are visible when tabbing.

Save the screenshots to the scratchpad, not the repo. Attach them to the PR description instead.

- [ ] **Step 7: Commit**

```bash
git add tests/unit/contrast.test.ts AGENTS.md project_docs/tasks.md
git commit -m "test(a11y): contrast guard for redesign text pairs; docs

Facilitated-by: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Done when

- [ ] `npm run lint`, `npx nuxi typecheck`, `npm run test`, `npm run build` pass. e2e passes, or is noted as not run locally (needs Docker).
- [ ] Screens checked at 375px and 1280px, light and dark (Task 17 Step 6).
- [ ] The contrast guard passes.
- [ ] No migration, no server-route change, no service-role use.
- [ ] `AGENTS.md` and `project_docs/tasks.md` updated.
