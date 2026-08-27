import axios from 'axios'
import { describe, expect, it } from 'vitest'
import { getServerValidationMessage } from './http-error'

describe('getServerValidationMessage', () => {
  it('returns a string Axios validation message and rejects unsafe shapes', () => {
    const axiosError = new axios.AxiosError(
      'Request failed',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      {
        data: { message: '이미 등록된 인증서입니다.' },
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: { headers: new axios.AxiosHeaders() },
      },
    )

    expect(getServerValidationMessage(axiosError)).toBe('이미 등록된 인증서입니다.')
    expect(getServerValidationMessage({ response: { data: { message: 42 } } })).toBeNull()
    expect(getServerValidationMessage(new Error('local failure'))).toBeNull()
  })

  it('joins Nest validation message arrays without accepting non-string entries', () => {
    const response = {
      data: { message: ['인증서 이름은 필수입니다.', '인증 업체는 필수입니다.'] },
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: { headers: new axios.AxiosHeaders() },
    }
    const error = new axios.AxiosError(
      'Request failed',
      'ERR_BAD_REQUEST',
      undefined,
      undefined,
      response,
    )

    expect(getServerValidationMessage(error)).toBe(
      '인증서 이름은 필수입니다. 인증 업체는 필수입니다.',
    )
  })
})
