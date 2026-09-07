import { describe, expect, it } from 'vitest'
import { adminOperationTimeoutMessage } from './admin-operation-timeout'

describe('admin operation timeout feedback', () => {
  it.each([{ response: { status: 504 } }, { code: 'ECONNABORTED' }, { code: 'ETIMEDOUT' }])(
    'explains an uncertain result without encouraging immediate retry',
    (error) => {
      const message = adminOperationTimeoutMessage(error)
      expect(message).toContain('완료 여부를 확인하지 못했습니다')
      expect(message).toContain('결과를 먼저 확인')
    },
  )
  it('leaves non-timeout errors to the existing operation error message', () => {
    expect(adminOperationTimeoutMessage({ response: { status: 400 } })).toBeUndefined()
  })
})
