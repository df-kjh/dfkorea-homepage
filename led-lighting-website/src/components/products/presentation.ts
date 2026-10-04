import type { Product } from '@/types'

export interface RegisteredSpec {
  label: string
  value: string
  icon: string
}
const hasText = (value: unknown) =>
  value != null && String(value).trim() !== '' && String(value).trim() !== '0'
const positive = (value: unknown) => Number.isFinite(Number(value)) && Number(value) > 0
const choices = (values: number[] | undefined, unit: string) =>
  (values || [])
    .filter(positive)
    .map((value) => `${value}${unit}`)
    .join(' / ')
const dimensions = (value: string) =>
  !hasText(value) ? '' : /mm/i.test(value) ? value : `${value.replace(/[xX*]/g, ' × ')} mm`
export const isConnectionComponent = (product: Product) => product.modelName === 'PIPE'

// PIPE is a connection component: its registered raw electrical/certification
// values are placeholders. Keep the API record intact and present model/length only.
export function productCertificationLabels(product: Product): string[] {
  return isConnectionComponent(product) ? [] : (product.certifications || []).filter(hasText)
}
export function productSummary(product: Product): RegisteredSpec[] {
  const entries = isConnectionComponent(product)
    ? [{ label: '길이 규격', value: dimensions(product.dimensions), icon: 'straighten' }]
    : [
        { label: '소비전력', value: choices(product.power, 'W'), icon: 'bolt' },
        { label: '제품 규격', value: dimensions(product.dimensions), icon: 'straighten' },
        { label: '색온도', value: choices(product.colorTemp, 'K'), icon: 'palette' },
        {
          label: '인증 표기',
          value: productCertificationLabels(product).join(' / '),
          icon: 'verified',
        },
      ]
  return entries.filter((entry) => hasText(entry.value))
}
export function productTechnicalSpecs(product: Product): RegisteredSpec[] {
  const model = { label: '모델명', value: product.modelName, icon: 'label' }
  if (isConnectionComponent(product))
    return [model, ...productSummary(product)].filter((entry) => hasText(entry.value))
  return [
    model,
    ...productSummary(product),
    {
      label: '표기 수명',
      value: positive(product.lifespan) ? `${product.lifespan.toLocaleString('ko-KR')}시간` : '',
      icon: 'schedule',
    },
    {
      label: 'LED 칩 제조사',
      value: hasText(product.ledChipManufacturer) ? product.ledChipManufacturer : '',
      icon: 'lightbulb',
    },
    {
      label: '등록 역률',
      value: positive(product.powerFactor) ? String(product.powerFactor) : '',
      icon: 'bolt',
    },
    {
      label: '등록 광효율',
      value: positive(product.luminanceEfficiency) ? `${product.luminanceEfficiency} lm/W` : '',
      icon: 'lightbulb',
    },
    {
      label: '등록 연색성',
      value: positive(product.colorRendering) ? `Ra ${product.colorRendering}` : '',
      icon: 'palette',
    },
    {
      label: '등록 선택 옵션',
      value: (product.options || []).filter(hasText).join(' / '),
      icon: 'tune',
    },
  ].filter((entry) => hasText(entry.value))
}
export function productCardSummary(product: Product): string {
  if (isConnectionComponent(product))
    return productSummary(product)
      .map((entry) => entry.value)
      .join(' · ')
  return [choices(product.power, 'W'), choices(product.colorTemp, 'K')].filter(Boolean).join(' · ')
}
