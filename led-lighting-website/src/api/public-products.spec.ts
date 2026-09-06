import { afterEach, describe, expect, it } from 'vitest'
import { AxiosError } from 'axios'
import publicClient from './public-client'
import { productsAPI } from './index'
const original = publicClient.defaults.adapter
afterEach(() => {
  publicClient.defaults.adapter = original
  localStorage.removeItem('admin_token')
})
describe('anonymous public catalog requests', () => {
  it('sends no admin credentials and serializes nonempty spec filters as CSV', async () => {
    localStorage.setItem('admin_token', 'private-admin-token')
    publicClient.defaults.adapter = async (config) => {
      expect(config.headers.Authorization).toBeUndefined()
      expect(config.params).toEqual({
        page: 1,
        limit: 8,
        search: 'MODEL',
        power: '20,40',
        options: '센서',
      })
      return { data: { data: [], total: 0 }, status: 200, statusText: 'OK', headers: {}, config }
    }
    await productsAPI.getPaginated(1, 8, 'MODEL', '', {
      power: [20, 40],
      colorTemp: [],
      certifications: [],
      options: ['센서'],
    })
  })
  it('does not redirect to admin login or remove admin credentials on a public catalog401', async () => {
    localStorage.setItem('admin_token', 'keep-admin-token')
    const location = window.location.href
    publicClient.defaults.adapter = async (config) => {
      throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, {
        status: 401,
        data: {},
        statusText: 'Unauthorized',
        headers: {},
        config,
      })
    }
    await expect(productsAPI.getFilterOptions()).rejects.toThrow('Unauthorized')
    expect(window.location.href).toBe(location)
    expect(localStorage.getItem('admin_token')).toBe('keep-admin-token')
  })
})
