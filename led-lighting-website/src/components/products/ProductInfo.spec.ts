import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ProductInfo from './ProductInfo.vue'

describe('product information actions', () => {
  it('renders the product action directly after the summary specifications', () => {
    const wrapper = mount(ProductInfo, {
      props: {
        productName: '주차장 LED 조명',
        specs: [{ icon: 'bolt', label: '전력', value: '40W' }],
      },
      slots: {
        actions: '<button type="button">견적에 담기</button>',
      },
    })

    const specifications = wrapper.get('.grid')
    const action = wrapper.get('button')
    expect(
      specifications.element.compareDocumentPosition(action.element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})
