import { enableAutoUnmount, mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ProductFilterPopover from './ProductFilterPopover.vue'

const empty = () => ({ power: [], colorTemp: [], certifications: [], options: [] })
const options = {
  categories: ['주차장 조명'],
  power: [20, 40],
  colorTemp: [4000, 5700],
  certifications: ['KS', '고효율'],
  options: ['센서'],
}

const initialVisualViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport')

enableAutoUnmount(afterEach)
afterEach(() => {
  document.body.replaceChildren()
  vi.restoreAllMocks()
  if (initialVisualViewport) Object.defineProperty(window, 'visualViewport', initialVisualViewport)
  else Reflect.deleteProperty(window, 'visualViewport')
})

describe('product filter popover', () => {
  it('keeps checkbox changes in a draft until the user applies them', async () => {
    const wrapper = mount(ProductFilterPopover, {
      attachTo: document.body,
      props: { modelValue: empty(), options },
    })

    const trigger = wrapper.get('button[aria-label="제품 필터 열기"]')
    await trigger.trigger('click')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('[role="dialog"]').attributes('aria-label')).toBe('제품 필터')

    await wrapper.get('input[type="checkbox"]').setValue(true)
    expect(wrapper.emitted('apply')).toBeUndefined()

    await wrapper.get('button[data-test="apply-product-filters"]').trigger('click')
    expect(wrapper.emitted('apply')).toEqual([
      [{ power: [20], colorTemp: [], certifications: [], options: [] }],
    ])
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('discards unapplied changes on Escape and restores focus to the trigger', async () => {
    const wrapper = mount(ProductFilterPopover, {
      attachTo: document.body,
      props: {
        modelValue: { ...empty(), certifications: ['KS'] },
        options,
      },
    })

    const trigger = wrapper.get('button[aria-label="제품 필터 열기"]')
    await trigger.trigger('click')
    const checkboxes = wrapper.findAll('input[type="checkbox"]')
    await checkboxes
      .find((node) => node.element.parentElement?.textContent?.includes('고효율'))!
      .setValue(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('apply')).toBeUndefined()
    expect(document.activeElement).toBe(trigger.element)

    await trigger.trigger('click')
    const reopened = wrapper.findAll<HTMLInputElement>('input[type="checkbox"]')
    expect(
      reopened.find((node) => node.element.parentElement?.textContent?.includes('KS'))?.element
        .checked,
    ).toBe(true)
    expect(
      reopened.find((node) => node.element.parentElement?.textContent?.includes('고효율'))?.element
        .checked,
    ).toBe(false)
  })

  it('closes on an outside press without applying the draft', async () => {
    const outside = document.createElement('button')
    document.body.append(outside)
    const wrapper = mount(ProductFilterPopover, {
      attachTo: document.body,
      props: { modelValue: empty(), options },
    })
    await wrapper.get('button[aria-label="제품 필터 열기"]').trigger('click')
    await wrapper.get('input[type="checkbox"]').setValue(true)

    outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.emitted('apply')).toBeUndefined()
  })

  it('clears the draft and waits for apply before changing the product filters', async () => {
    const wrapper = mount(ProductFilterPopover, {
      attachTo: document.body,
      props: { modelValue: { ...empty(), power: [40] }, options },
    })
    await wrapper.get('button[aria-label="제품 필터 열기"]').trigger('click')
    await wrapper
      .findAll('button')
      .find((node) => node.text() === '초기화')!
      .trigger('click')

    expect(wrapper.emitted('apply')).toBeUndefined()
    expect(wrapper.get<HTMLInputElement>('input[type="checkbox"]').element.checked).toBe(false)

    await wrapper.get('button[data-test="apply-product-filters"]').trigger('click')
    expect(wrapper.emitted('apply')).toEqual([
      [{ power: [], colorTemp: [], certifications: [], options: [] }],
    ])
  })
})

// DOM layout is the browser boundary: happy-dom has no layout engine, so supply
// real viewport events and measured rectangles while mounting the real dialog.
function viewport(width = 390, height = 844) {
  vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(width)
  vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(height)
  const visual = Object.assign(new EventTarget(), {
    width,
    height,
    offsetTop: 0,
    offsetLeft: 0,
  })
  Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => visual })
  return visual
}

async function openMeasuredFilter(top = 100, contentHeight = 380) {
  const wrapper = mount(ProductFilterPopover, {
    attachTo: document.body,
    props: { modelValue: empty(), options },
  })
  const trigger = wrapper.get('button[aria-label="제품 필터 열기"]')
  const anchor = { top, bottom: top + 50, left: 324, right: 374, width: 50, height: 50 }
  const measure = vi
    .spyOn(trigger.element, 'getBoundingClientRect')
    .mockImplementation(() => anchor as DOMRect)
  let naturalHeight = contentHeight
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.classList.contains('product-filter-panel') ? naturalHeight : 0
  })
  await trigger.trigger('click')
  await nextTick()
  const panel = wrapper.get<HTMLElement>('[role="dialog"]').element
  return {
    wrapper,
    trigger,
    panel,
    anchor,
    measure,
    expand: () => {
      naturalHeight = 900
    },
  }
}

describe('product filter visible viewport placement', () => {
  it.each([
    { width: 320, panelWidth: '288px' },
    { width: 390, panelWidth: '358px' },
    { width: 545, panelWidth: '430px' },
  ])(
    'anchors below the mobile trigger and fits a $width px viewport',
    async ({ width, panelWidth }) => {
      viewport(width)
      const { panel } = await openMeasuredFilter()

      expect(panel.style.top).toBe('160px')
      expect(panel.style.left).toBe('16px')
      expect(panel.style.width).toBe(panelWidth)
      expect(panel.style.maxHeight).toBe('620px')
    },
  )

  it('opens above a low trigger when the panel fits there', async () => {
    viewport()
    const { panel } = await openMeasuredFilter(650)

    expect(panel.style.top).toBe('258px')
    expect(panel.style.maxHeight).toBe('620px')
  })

  it('fits an expanded panel inside a keyboard-reduced viewport and tracks visual scroll offsets', async () => {
    const visual = viewport()
    const { panel } = await openMeasuredFilter()
    Object.assign(visual, { height: 300, width: 320, offsetTop: 200, offsetLeft: 20 })
    visual.dispatchEvent(new Event('resize'))
    await nextTick()

    expect(panel.style.top).toBe('216px')
    expect(panel.style.maxHeight).toBe('268px')
    expect(panel.style.left).toBe('36px')
    expect(panel.style.width).toBe('288px')
    expect(Number.parseFloat(panel.style.top) + Number.parseFloat(panel.style.maxHeight)).toBe(484)

    visual.offsetTop = 320
    visual.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(panel.style.top).toBe('336px')
    expect(panel.style.maxHeight).toBe('268px')
  })

  it('measures wrapped content at the new width before choosing an above-trigger position', async () => {
    const visual = viewport(545)
    const { panel } = await openMeasuredFilter(650)
    expect(panel.style.top).toBe('258px')
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.classList.contains('product-filter-panel')
        ? this.style.width === '288px'
          ? 900
          : 380
        : 0
    })
    visual.width = 320
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(320)
    visual.dispatchEvent(new Event('resize'))
    await nextTick()

    expect(panel.style.width).toBe('288px')
    expect(panel.style.top).toBe('20px')
    expect(panel.style.maxHeight).toBe('620px')
  })

  it('keeps apply usable after scrolling all expanded filters in a short visual viewport', async () => {
    const visual = viewport()
    Object.assign(visual, { height: 300, offsetTop: 200 })
    const { wrapper, panel } = await openMeasuredFilter(300, 900)
    for (const details of wrapper.findAll('details')) {
      details.element.open = true
      details.element.dispatchEvent(new Event('toggle'))
    }
    await nextTick()
    await nextTick()
    await wrapper.get('input[type="checkbox"]').setValue(true)

    expect(panel.style.top).toBe('216px')
    expect(panel.style.maxHeight).toBe('268px')
    panel.scrollTop = panel.scrollHeight
    panel.dispatchEvent(new Event('scroll'))
    await nextTick()
    const apply = wrapper.get<HTMLButtonElement>('button[data-test="apply-product-filters"]')
    apply.element.focus()
    expect(document.activeElement).toBe(apply.element)
    await apply.trigger('click')

    expect(wrapper.emitted('apply')).toEqual([
      [{ power: [20], colorTemp: [], certifications: [], options: [] }],
    ])
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('uses window resize and scroll when visualViewport is unavailable', async () => {
    viewport()
    vi.spyOn(window, 'visualViewport', 'get').mockReturnValue(null)
    const { panel, anchor } = await openMeasuredFilter()
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(500)
    window.dispatchEvent(new Event('resize'))
    await nextTick()

    expect(panel.style.top).toBe('102px')
    expect(panel.style.maxHeight).toBe('468px')

    Object.assign(anchor, { top: 20, bottom: 70 })
    window.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(panel.style.top).toBe('80px')
    expect(panel.style.maxHeight).toBe('404px')
  })

  it('reclamps the panel when native filter details expand', async () => {
    viewport()
    const { wrapper, panel, expand } = await openMeasuredFilter(300)
    expect(panel.style.top).toBe('360px')
    expect(panel.style.maxHeight).toBe('468px')

    expand()
    wrapper.get('details').element.dispatchEvent(new Event('toggle'))
    await nextTick()
    await nextTick()

    expect(panel.style.top).toBe('208px')
    expect(panel.style.maxHeight).toBe('620px')
  })

  it('clears mobile geometry after switching to the desktop anchor layout', async () => {
    viewport()
    const { panel } = await openMeasuredFilter()
    expect(panel.style.top).toBe('160px')
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1280)
    window.dispatchEvent(new Event('resize'))
    await nextTick()

    expect(panel.getAttribute('style') ?? '').toBe('')
  })

  it('removes viewport listeners and stops measuring after disposal', async () => {
    const visual = viewport()
    const visualAdd = vi.spyOn(visual, 'addEventListener')
    // Narrow the browser surface so ambient worker event-map overloads cannot
    // turn window's scroll listener into a DedicatedWorkerGlobalScope listener.
    const browserWindow: Window = window
    const windowAdd = vi.spyOn(browserWindow, 'addEventListener')
    const visualRemove = vi.spyOn(visual, 'removeEventListener')
    const windowRemove = vi.spyOn(browserWindow, 'removeEventListener')
    const { wrapper, measure } = await openMeasuredFilter()
    vi.spyOn(window, 'visualViewport', 'get').mockReturnValue(null)
    wrapper.unmount()
    measure.mockClear()

    visual.dispatchEvent(new Event('resize'))
    visual.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new Event('resize'))
    window.dispatchEvent(new Event('scroll'))
    await nextTick()

    expect(measure).not.toHaveBeenCalled()
    expect(visualRemove.mock.calls.map(([type]) => type)).toEqual(
      expect.arrayContaining(['resize', 'scroll']),
    )
    expect(windowRemove.mock.calls.map(([type]) => type)).toEqual(
      expect.arrayContaining(['resize', 'scroll']),
    )
    for (const [type, listener] of visualAdd.mock.calls) {
      expect(visualRemove).toHaveBeenCalledWith(type, listener)
    }
    for (const [type, listener] of windowAdd.mock.calls.filter(([type]) =>
      ['resize', 'scroll'].includes(type),
    )) {
      if (type === 'scroll') expect(windowRemove).toHaveBeenCalledWith(type, listener, true)
      else expect(windowRemove).toHaveBeenCalledWith(type, listener)
    }
  })
})

it('renders safely without browser viewport APIs during SSR', async () => {
  vi.stubGlobal('window', undefined)
  try {
    const html = await renderToString(h(ProductFilterPopover, { modelValue: empty(), options }))
    expect(html).toContain('제품 필터 열기')
    expect(html).not.toContain('role="dialog"')
  } finally {
    vi.unstubAllGlobals()
  }
})
