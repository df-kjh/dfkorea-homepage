import { afterEach, describe, expect, it, vi } from 'vitest'
import { revealQuoteElement } from './quote-focus'
afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})
describe('quote focus transitions', () => {
  it('reveals an offscreen heading in the quote body without scrolling the host page', () => {
    const body = document.createElement('div')
    body.className = 'q-body'
    body.scrollTop = 420
    const heading = document.createElement('h4')
    heading.tabIndex = -1
    body.append(heading)
    document.body.append(body)
    vi.spyOn(body, 'getBoundingClientRect').mockReturnValue({ top: 100, bottom: 600 } as DOMRect)
    vi.spyOn(heading, 'getBoundingClientRect').mockReturnValue({ top: 850, bottom: 880 } as DOMRect)
    const scroll = vi.spyOn(body, 'scrollTo')
    const windowScroll = vi.spyOn(window, 'scrollTo')
    revealQuoteElement(heading)
    expect(document.activeElement).toBe(heading)
    expect(scroll).toHaveBeenCalledWith({ top: 1158, behavior: 'instant' })
    expect(windowScroll).not.toHaveBeenCalled()
  })
  it('leaves an already visible heading in place', () => {
    const body = document.createElement('div')
    body.className = 'q-body'
    const heading = document.createElement('h4')
    body.append(heading)
    vi.spyOn(body, 'getBoundingClientRect').mockReturnValue({ top: 100, bottom: 600 } as DOMRect)
    vi.spyOn(heading, 'getBoundingClientRect').mockReturnValue({ top: 130, bottom: 160 } as DOMRect)
    const scroll = vi.spyOn(body, 'scrollTo')
    revealQuoteElement(heading)
    expect(scroll).not.toHaveBeenCalled()
  })
})
