import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Table from './TenderRequirementTable.vue'
import type { TenderRequirement } from '@/types'

describe('TenderRequirementTable', () => {
  it.each([
    [
      { periodYears: 3, values: ['LED'], minimumAmount: '100000000' },
      '최근 3년 이내 · LED · 100,000,000원 이상',
    ],
    [
      { periodYears: 3, values: ['LED'], minimumAmount: '9007199254740993123.50' },
      '최근 3년 이내 · LED · 9,007,199,254,740,993,123.50원 이상',
    ],
    [{ values: ['LED'], minimumAmount: '100000000' }, 'LED · 100,000,000원 이상'],
    [{ periodYears: 3, minimumAmount: '100000000' }, '최근 3년 이내 · 100,000,000원 이상'],
    [{ periodYears: 3, values: ['LED'] }, '최근 3년 이내 · LED'],
    [{ periodYears: 3 }, '최근 3년 이내'],
    [{ minimumAmount: '0' }, '0원 이상'],
    [{ minimumAmount: '' }, '최소 금액 확인 필요'],
    [{ periodYears: 3, values: [], codes: ['391116'] }, '최근 3년 이내 · 391116'],
    [{}, '원문 확인 필요'],
  ] as [Partial<TenderRequirement>, string][])(
    'preserves performance conditions in the rendered cell: %j',
    (fields, expected) => {
      const wrapper = mount(Table, {
        props: {
          title: '참가 조건',
          requirements: [{ id: 'performance', kind: 'PERFORMANCE', ...fields }],
        },
      })
      expect(wrapper.get('tbody td').text()).toBe(expected)
    },
  )

  describe.each([false, true])('required labels when specifications=%s', (specifications) => {
    it.each([
      [true, '필수'],
      [false, '참고'],
      [null, '필수 여부 확인 필요'],
      [undefined, '필수 여부 확인 필요'],
    ] as const)(
      'renders required=%s without treating omitted data as optional',
      (required, expected) => {
        const wrapper = mount(Table, {
          props: { title: '조건', requirements: [{ id: 'one', required }], specifications },
        })
        const label = specifications
          ? wrapper.get('tbody td:last-child')
          : wrapper.get('tbody small')
        expect(label.text()).toBe(expected)
      },
    )
  })
})
