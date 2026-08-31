import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TenderOpportunityBadge from './TenderOpportunityBadge.vue'

describe('TenderOpportunityBadge', () => {
  it.each([
    ['GOODS_SUPPLY', '📦 물품 납품', 'inventory_2'],
    ['MAS', '🧾 MAS', 'description'],
  ] as const)('renders the %s opportunity with its Korean accessible label', (opportunityType, label, icon) => {
    const wrapper = mount(TenderOpportunityBadge, { props: { opportunityType } })

    expect(wrapper.attributes()).toMatchObject({ role: 'img', 'aria-label': label })
    expect(wrapper.text()).toContain(label.replace(/^[^ ]+ /, ''))
    expect(wrapper.get('.material-symbols-outlined').text()).toBe(icon)
  })
})
