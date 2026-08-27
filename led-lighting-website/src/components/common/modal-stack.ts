interface ModalStackEntry {
  id: string
  restoreFocus: HTMLElement | null
  focus: () => void
}

const entries: ModalStackEntry[] = []
let originalBodyOverflow: string | null = null

const hasDocument = () => typeof document !== 'undefined'

const lockBodyScroll = () => {
  if (!hasDocument()) return
  if (entries.length === 1) originalBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
}

const restoreBodyScroll = () => {
  if (!hasDocument() || entries.length !== 0) return
  document.body.style.overflow = originalBodyOverflow ?? ''
  originalBodyOverflow = null
}

/**
 * Coordinates teleported dialogs so nested or concurrently mounted modals
 * behave as one stack rather than competing global keyboard handlers.
 */
export const modalStack = {
  register(entry: ModalStackEntry) {
    const existing = entries.findIndex((item) => item.id === entry.id)
    if (existing >= 0) entries.splice(existing, 1)
    entries.push(entry)
    lockBodyScroll()
  },

  unregister(id: string) {
    const index = entries.findIndex((entry) => entry.id === id)
    if (index < 0) return

    const wasTop = index === entries.length - 1
    const [removed] = entries.splice(index, 1)
    if (!wasTop) {
      // The next dialog may have captured a control inside the removed one.
      // Carry the stable predecessor trigger forward without moving focus.
      const nextEntry = entries[index]
      if (nextEntry && removed) nextEntry.restoreFocus = removed.restoreFocus
      return
    }

    const nextTop = entries.at(-1)
    if (nextTop) {
      // A still-open parent dialog owns focus; do not restore an external trigger.
      nextTop.focus()
      return
    }

    restoreBodyScroll()
    if (removed?.restoreFocus?.isConnected) removed.restoreFocus.focus()
  },

  isTop(id: string) {
    return entries.at(-1)?.id === id
  },
}
