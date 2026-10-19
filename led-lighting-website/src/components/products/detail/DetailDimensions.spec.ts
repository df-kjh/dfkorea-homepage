import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { Product } from '@/types'
import { resolveProductDetail } from './content'
import DetailDimensions from './DetailDimensions.vue'

const product = (changes: Partial<Product> = {}): Product => ({
  id: 'other-product',
  name: '등록 조명',
  category: '조명',
  modelName: 'DF-TEST',
  images: [],
  dimensions: '1200*60*45',
  power: [20],
  colorTemp: [4000],
  lifespan: 40000,
  ledChipManufacturer: '',
  certifications: [],
  description: '',
  createdAt: '',
  updatedAt: '',
  ...changes,
})
const render = (changes: Partial<Product> = {}) => {
  const record = product(changes)
  return mount(DetailDimensions, {
    props: { product: record, detail: resolveProductDetail(record), preview: false },
  })
}

describe('registered dimension bounds', () => {
  it.each(['1200*60*45', '1200 x 60 x 45 mm', '1200×60×45', '1200(L)*60(W)*45(H)'])(
    'preserves three registered axes for %s on any product',
    (dimensions) => {
      const wrapper = render({ dimensions })
      expect(wrapper.find('svg').exists()).toBe(true)
      expect(wrapper.findAll('dl dt').map((entry) => entry.text())).toEqual(['길이', '폭', '높이'])
      expect(wrapper.findAll('dl dd').map((entry) => entry.text())).toEqual([
        '1,200mm',
        '60mm',
        '45mm',
      ])
      expect(wrapper.findAll('svg text').map((entry) => entry.text())).toEqual(
        expect.arrayContaining(['1,200 mm', '60 mm', '45 mm']),
      )
      expect(wrapper.text()).toContain('실제 비율·설치 도면과 다릅니다.')
    },
  )

  it('preserves registered fractional millimetres without rounding to a different measurement', () => {
    const wrapper = render({ dimensions: '1200.1234*60.2345*45.3456' })
    expect(wrapper.findAll('dl dd').map((entry) => entry.text())).toEqual([
      '1,200.1234mm',
      '60.2345mm',
      '45.3456mm',
    ])
  })

  it('shows the round product diameter and height without inventing a third dimension', () => {
    const wrapper = render({ name: '원형직부', category: '원형직부', dimensions: '240*62' })
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.findAll('dl dt').map((entry) => entry.text())).toEqual(['지름', '높이'])
    expect(wrapper.findAll('dl dd').map((entry) => entry.text())).toEqual(['240mm', '62mm'])
    expect(wrapper.findAll('svg [data-measurement]')).toHaveLength(2)
    expect(wrapper.text()).toContain('실제 제품 형상')
  })

  it.each([
    { dimensions: '1330*300*8,1560*300*8' },
    { dimensions: '165 타공 150' },
    { dimensions: '1200,900,600,300', modelName: 'PIPE' },
    { dimensions: '1200', modelName: 'PIPE' },
    { dimensions: '240*62' },
    { dimensions: '규격 확인 필요' },
    { dimensions: '0*60*45' },
    { dimensions: '-1200*60*45' },
    { dimensions: 'NaN*60*45' },
  ])('keeps $dimensions as registered text without fabricated axes', (changes) => {
    const wrapper = render(changes)
    expect(wrapper.find('svg').exists()).toBe(true)
    expect(wrapper.findAll('svg [data-measurement]')).toHaveLength(0)
    expect(wrapper.findAll('dl dt').map((entry) => entry.text())).toEqual(['등록 규격'])
    expect(wrapper.find('dl dd').text()).toContain(changes.dimensions)
  })

  it('draws every measurement between projections of the corresponding bounds corners', () => {
    const wrapper = render()
    expect(wrapper.find('svg').exists()).toBe(true)
    const lines = wrapper.findAll('line[data-measurement]')
    expect(lines).toHaveLength(3)
    for (const line of lines) {
      const axis = line.attributes('data-measurement')
      const guides = wrapper.findAll(`line[data-guide="${axis}"]`)
      expect(guides).toHaveLength(2)
      expect([line.attributes('x1'), line.attributes('y1')]).toEqual([
        guides[0]!.attributes('x2'),
        guides[0]!.attributes('y2'),
      ])
      expect([line.attributes('x2'), line.attributes('y2')]).toEqual([
        guides[1]!.attributes('x2'),
        guides[1]!.attributes('y2'),
      ])
      for (const guide of guides) {
        expect(
          wrapper
            .find(
              `circle[data-corner][cx="${guide.attributes('x1')}"][cy="${guide.attributes('y1')}"]`,
            )
            .exists(),
        ).toBe(true)
      }
    }
  })

  it('gives a custom dimension image priority and preserves the zoom event', async () => {
    const wrapper = render({
      detailContent: {
        version: 1,
        dimensionImage: { url: 'https://example.com/drawing.webp', alt: '등록 치수 도면' },
      },
    })
    expect(wrapper.find('svg').exists()).toBe(false)
    expect(wrapper.get('img').attributes('src')).toBe('https://example.com/drawing.webp')
    await wrapper.get('[data-image]').trigger('click')
    expect(wrapper.emitted('zoom')?.[0]).toEqual(['https://example.com/drawing.webp'])
  })
})
