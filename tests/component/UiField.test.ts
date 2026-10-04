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
