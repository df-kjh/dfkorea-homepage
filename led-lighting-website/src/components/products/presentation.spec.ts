import { describe, expect, it } from 'vitest'
import type { Product } from '@/types'
import {
  productSummary,
  productTechnicalSpecs,
  productCardSummary,
  productCertificationLabels,
} from './presentation'
const fixture = {
  modelName: 'DF-MOL-40',
  dimensions: '1200*65*60',
  power: [30, 40],
  colorTemp: [5700],
  lifespan: 50000,
  ledChipManufacturer: '서울반도체',
  certifications: ['KS'],
  powerFactor: '0.95',
  luminanceEfficiency: 120,
  colorRendering: '80',
  options: ['센서'],
} as Product

describe('registered product presentation', () => {
  it('shows PIPE only as a model and length component despite raw electrical/cert placeholders', () => {
    const pipe = {
      ...fixture,
      modelName: 'PIPE',
      dimensions: '1200,900,600,300',
      power: [1],
      colorTemp: [5700],
      certifications: ['KS'],
    }
    const rows = [...productSummary(pipe), ...productTechnicalSpecs(pipe)]
    expect(rows.every((row) => ['길이 규격', '모델명'].includes(row.label))).toBe(true)
    expect(JSON.stringify(rows)).not.toMatch(/1W|5700|KS|50,000/)
    expect(productCardSummary(pipe)).toContain('1200')
    expect(productCardSummary(pipe)).not.toMatch(/1W|5700|KS/)
    expect(productCertificationLabels(pipe)).toEqual([])
  })
  it('omits zero/nonfinite/missing metrics without changing input; retains registered choices', () => {
    const incomplete = {
      ...fixture,
      dimensions: '0',
      power: [0, 30],
      colorTemp: [0, 5700],
      lifespan: 0,
      powerFactor: '0',
      luminanceEfficiency: NaN,
      colorRendering: '',
      ledChipManufacturer: '0',
      certifications: [],
      options: [],
    }
    const before = structuredClone(incomplete)
    const rows = productTechnicalSpecs(incomplete)
    expect(rows.map((row) => row.label)).toEqual(['모델명', '소비전력', '색온도'])
    expect(rows.find((row) => row.label === '소비전력')?.value).toBe('30W')
    expect(incomplete).toEqual(before)
  })
  it('keeps real model, registered choices, units and certifications available', () => {
    expect(productSummary(fixture).find((row) => row.label === '소비전력')?.value).toBe('30W / 40W')
    expect(productTechnicalSpecs(fixture).find((row) => row.label === '제품 규격')?.value).toBe(
      '1200 × 65 × 60 mm',
    )
    expect(
      productTechnicalSpecs(fixture).find((row) => row.label === '등록 선택 옵션')?.value,
    ).toBe('센서')
    expect(productCertificationLabels(fixture)).toEqual(['KS'])
  })
})
