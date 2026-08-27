/**
 * 제품 속성 단위 정의
 */
export const PRODUCT_UNITS = {
  power: 'W',
  powerFactor: '이상',
  luminanceEfficiency: 'lm/W',
  colorTemp: 'K',
  dimensions: 'mm',
  lifespan: '시간',
} as const

export type ProductUnitKey = keyof typeof PRODUCT_UNITS

/**
 * 값에 단위를 붙여서 반환
 */
export const formatWithUnit = (value: string | number | string[] | number[] | undefined, key: ProductUnitKey): string => {
  if (!value) return 'N/A'
  
  const unit = PRODUCT_UNITS[key]
  
  if (Array.isArray(value)) {
    return value.map(v => `${v}${unit}`).join(', ')
  }
  
  return `${value}${unit}`
}

/**
 * 값에서 단위를 제거하고 반환
 */
export const removeUnit = (value: string, key: ProductUnitKey): string => {
  if (!value) return ''
  
  const unit = PRODUCT_UNITS[key]
  return value.replace(new RegExp(`${unit}$`), '').trim()
}
