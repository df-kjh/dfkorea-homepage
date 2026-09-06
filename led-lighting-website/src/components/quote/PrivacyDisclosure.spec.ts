import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import PrivacyDisclosure from './PrivacyDisclosure.vue'
const state = vi.hoisted(() => ({
  draft: { session: { privacy: { version: 'email-attachments-v2', retentionDays: 365 } } },
}))
vi.mock('@/composables/useQuoteDraft', () => ({ useQuoteDraft: () => state }))
describe('quote photo retention disclosure', () => {
  it.each([
    { requestDays: 365, photoDays: 7 },
    { requestDays: 3, photoDays: 3 },
  ])(
    'separates request retention $requestDays days from temporary photo retention $photoDays days',
    ({ requestDays, photoDays }) => {
      state.draft.session.privacy.retentionDays = requestDays
      const wrapper = mount(PrivacyDisclosure)
      const requestNotice = wrapper
        .findAll('p')
        .find((paragraph) => paragraph.text().includes('견적 정보 및 첨부 기록'))
      const photoNotice = wrapper
        .findAll('p')
        .find((paragraph) => paragraph.text().includes('사진 파일'))
      expect(requestNotice?.text()).toContain(`접수일로부터 ${requestDays}일`)
      expect(photoNotice?.text()).toContain('접수 전 최대 24시간')
      expect(photoNotice?.text()).toContain(`접수 후 최대 ${photoDays}일`)
      expect(photoNotice?.text()).toContain('발송을 수락하면')
      expect(photoNotice?.text()).toContain('즉시 삭제')
      if (requestDays > 7) expect(photoNotice?.text()).not.toContain(`${requestDays}일`)
      expect(wrapper.text()).toContain('수신 메일의 첨부 사본은 삭제되지 않으며')
      expect(wrapper.text()).toContain('백업 데이터의 삭제 시점')
      wrapper.unmount()
    },
  )
})
