/** Move only the quote body's viewport: scrollIntoView would also move the host page. */
export function revealQuoteElement(element: HTMLElement | null) {
  if (!element) return
  element.focus({ preventScroll: true })
  const body = element.closest<HTMLElement>('.q-body')
  if (!body) return
  const target = element.getBoundingClientRect()
  const viewport = body.getBoundingClientRect()
  if (target.top < viewport.top + 12 || target.bottom > viewport.bottom - 12) {
    // An immediate transition also respects reduced-motion preferences.
    body.scrollTo({ top: body.scrollTop + target.top - viewport.top - 12, behavior: 'instant' })
  }
}
