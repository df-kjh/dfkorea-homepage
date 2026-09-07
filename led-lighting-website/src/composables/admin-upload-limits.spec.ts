import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import apiClient from '@/api/client'
import { uploadAPI } from '@/api'
import { useImageUpload } from './useImageUpload'
import ImageUploader from '@/components/common/ImageUploader.vue'
import PDFUploader from '@/components/common/PDFUploader.vue'

const { error } = vi.hoisted(() => ({ error: vi.fn() }))
vi.mock('element-plus', () => ({ ElMessage: { error, success: vi.fn() } }))
vi.mock('@/composables/useToast', () => ({ useToast: () => ({ error }) }))
const file = (size: number, pdf = false) =>
  new File([new Uint8Array(size)], pdf ? 'certificate.pdf' : 'photo.png', {
    type: pdf ? 'application/pdf' : 'image/png',
  })
const originalAdapter = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})
let sent: number
beforeEach(() => {
  sent = 0
  error.mockClear()
  apiClient.defaults.adapter = async (config) => {
    sent += 1
    return {
      data: { url: 'https://assets.example.test/temp/image-1-2.webp' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }
  }
})

describe('hosted admin upload size contract', () => {
  it.each(['uploadImage', 'uploadFile'] as const)(
    'rejects %s above 4MiB before creating an HTTP request',
    async (method) => {
      await expect(
        uploadAPI[method](file(4 * 1024 * 1024 + 1, method === 'uploadFile')),
      ).rejects.toThrow('4MB')
      expect(sent).toBe(0)
    },
  )
  it.each(['uploadImage', 'uploadFile'] as const)(
    'accepts the 4MiB boundary for %s',
    async (method) => {
      await expect(
        uploadAPI[method](file(4 * 1024 * 1024, method === 'uploadFile')),
      ).resolves.toMatchObject({ status: 200 })
      expect(sent).toBe(1)
    },
  )
  it('rejects oversized images in markdown batches before uploading any files', async () => {
    const uploader = useImageUpload()
    await expect(
      uploader.uploadMultipleImages([file(10), file(4 * 1024 * 1024 + 1)]),
    ).rejects.toThrow()
    expect(sent).toBe(0)
    expect(error).toHaveBeenCalledWith(expect.stringContaining('4MB'))
  })
  it('rejects an oversized PDF through the shared hook', async () => {
    await expect(
      useImageUpload().uploadPdfFile(file(4 * 1024 * 1024 + 1, true)),
    ).resolves.toBeNull()
    expect(sent).toBe(0)
    expect(error).toHaveBeenCalledWith(expect.stringContaining('4MB'))
  })
  it.each([
    ['image', ImageUploader, false],
    ['PDF', PDFUploader, true],
  ] as const)(
    'advertises and enforces the same 4MB %s selection limit',
    async (_name, component, pdf) => {
      const upload = vi.fn().mockResolvedValue('https://assets.example.test/file')
      const wrapper = mount(component, {
        global: { provide: { imageUpload: { upload, uploadPdf: upload } } },
      })
      expect(wrapper.text()).toContain('최대 4MB')
      const input = wrapper.find('input[type=file]')
      Object.defineProperty(input.element, 'files', {
        configurable: true,
        value: [file(4 * 1024 * 1024 + 1, pdf)],
      })
      await input.trigger('change')
      await flushPromises()
      expect(upload).not.toHaveBeenCalled()
      expect(error).toHaveBeenCalledWith(expect.stringContaining('4MB'))
      wrapper.unmount()
    },
  )
})
