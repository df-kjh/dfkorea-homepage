import type { Product } from '@/types'

export interface DimensionAxis {
  label: string
  value: number
}
export interface RegisteredDimensions {
  kind: 'linear' | 'round' | 'registered'
  axes: DimensionAxis[]
  source: string
}

/** Only a complete, unambiguous registered set becomes numeric axes.
 * Multiple sizes, cutout annotations and PIPE lengths remain the original text:
 * combining those numbers would invent dimensions the manufacturer did not give.
 */
export function resolveRegisteredDimensions(product: Product): RegisteredDimensions {
  const source = typeof product.dimensions === 'string' ? product.dimensions.trim() : ''
  const fallback: RegisteredDimensions = { kind: 'registered', axes: [], source }
  if (product.modelName === 'PIPE') return fallback
  const triple = source.match(
    /^\s*(\d+(?:\.\d+)?)\s*(?:\(L\))?\s*(?:mm)?\s*[*x×]\s*(\d+(?:\.\d+)?)\s*(?:\(W\))?\s*(?:mm)?\s*[*x×]\s*(\d+(?:\.\d+)?)\s*(?:\(H\))?\s*(?:mm)?\s*$/i,
  )
  const round = /원형/.test(`${product.name} ${product.category}`)
    ? source.match(/^\s*(\d+(?:\.\d+)?)\s*(?:mm)?\s*[*x×]\s*(\d+(?:\.\d+)?)\s*(?:mm)?\s*$/i)
    : null
  const values = (triple || round)?.slice(1).map(Number)
  if (!values || values.some((value) => !Number.isFinite(value) || value <= 0)) return fallback
  return {
    kind: triple ? 'linear' : 'round',
    axes: values.map((value, index) => ({
      label: (triple ? ['길이', '폭', '높이'] : ['지름', '높이'])[index]!,
      value,
    })),
    source,
  }
}
