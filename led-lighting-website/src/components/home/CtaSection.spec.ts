import { flushPromises, mount } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import CtaSection from './CtaSection.vue'

const boundary = vi.hoisted(() => ({ open: vi.fn(), success: vi.fn(), error: vi.fn() }))
vi.mock('@/composables/useQuoteDraft', () => ({ useQuoteDraft: () => ({ open: boundary.open }) }))
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ success: boundary.success, error: boundary.error }),
}))

it('opens an accessible contact dialog and returns to the original CTA on Escape', async () => {
  const cta = mount(CtaSection, { attachTo: document.body })
  const opener = cta.get('[data-contact-open]')
  await opener.trigger('click')
  const dialog = cta.get('dialog')
  expect(dialog.attributes('aria-labelledby')).toBeTruthy()
  expect((dialog.element as HTMLDialogElement).open).toBe(true)
  await dialog.trigger('cancel')
  await flushPromises()
  expect((dialog.element as HTMLDialogElement).open).toBe(false)
  expect(document.activeElement).toBe(opener.element)
  cta.unmount()
})

it('uses the existing quote controller and the company mail from the real footer', async () => {
  const cta = mount(CtaSection, { attachTo: document.body })
  await cta.get('[data-contact-open]').trigger('click')
  expect(cta.text()).toContain('kjukym@dfkorealed.com')
  await cta.get('[data-contact-quote]').trigger('click')
  expect(boundary.open).toHaveBeenCalledOnce()
  expect((cta.get('dialog').element as HTMLDialogElement).open).toBe(false)
  cta.unmount()
})
