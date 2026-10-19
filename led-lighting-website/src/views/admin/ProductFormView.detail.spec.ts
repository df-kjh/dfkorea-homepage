import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ProductFormView from './ProductFormView.vue'
import type { Product, ProductDetailContent } from '@/types'

// Only network, router and the third-party Markdown widget are replaced. The product
// form, upload composable, detail editor and public preview renderer run together.
const boundary = vi.hoisted(() => ({
  params: {} as Record<string, string>,
  source: null as Product | null,
  getAll: vi.fn(),
  getOne: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  uploadImage: vi.fn(),
  deleteImage: vi.fn(),
  push: vi.fn(),
  error: vi.fn(),
}))
vi.mock('@/api', () => ({
  productsAPI: {
    getAll: boundary.getAll,
    getOne: boundary.getOne,
    create: boundary.create,
    update: boundary.update,
    generateDescription: vi.fn(),
  },
  uploadAPI: { uploadImage: boundary.uploadImage, deleteImage: boundary.deleteImage },
}))
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: boundary.params, query: {} }),
  useRouter: () => ({ push: boundary.push }),
}))
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ error: boundary.error, success: vi.fn() }),
}))
vi.mock('md-editor-v3', () => ({
  MdEditor: {
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template:
      '<textarea data-markdown :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
}))

const content: ProductDetailContent = {
  version: 1,
  heroTitle: '등록된 제목',
  heroDescription: '등록된 소개',
  heroImage: { url: '/hero.webp', alt: '히어로 사진', caption: '히어로 출처' },
  storyTitle: '제품 소개',
  storyImage: { url: '/story.webp', alt: '소개 사진' },
  features: [{ title: '특징', body: '등록된 특징 설명' }],
  structureTitle: '제품 구조',
  structureImages: [{ url: '/structure.webp', alt: '구조 사진', caption: '구조 출처' }],
  application: {
    title: '적용 공간',
    description: '적용 설명',
    image: { url: '/application.webp', alt: '적용 이미지', caption: '이미지 캡션' },
    caption: '적용 출처',
  },
  controlTitle: '제어 제목',
  showControl: false,
  dimensionsTitle: '규격 제목',
  showDimensions: false,
  dimensionImage: { url: '/dimension.webp', alt: '규격 도식', caption: '도식 출처' },
}
const fixture = (
  detailContent: ProductDetailContent | null = structuredClone(content),
): Product => ({
  id: 'fixture-product',
  name: '테스트 조명',
  category: '실내조명',
  images: [{ image: '/registered.webp', description: '기존 썸네일' }],
  modelName: 'MODEL-10',
  dimensions: '100 x 200 x 30',
  power: [10, 20],
  lifespan: 50000,
  colorTemp: [3000, 5000],
  ledChipManufacturer: 'Samsung',
  certifications: ['KS'],
  powerFactor: '0.9',
  luminanceEfficiency: 100,
  colorRendering: '80',
  options: ['센서'],
  description: '기존 기술 자료 ![도식](/technical.webp) [기술 링크](https://example.com/technical)',
  detailContent,
  isNew: true,
  isFeatured: false,
  createdAt: '',
  updatedAt: '',
})

const wrappers: VueWrapper[] = []
async function renderProduct(product: Product | null = fixture()) {
  boundary.params = product ? { id: product.id } : {}
  boundary.source = product
  boundary.getOne.mockResolvedValue({ data: product })
  const wrapper = mount(ProductFormView, {
    attachTo: document.body,
    global: { stubs: { NuxtLink: { template: '<a><slot /></a>' } } },
  })
  wrappers.push(wrapper)
  await flushPromises()
  // Removing the new editor must fail at its first consumer, including legacy products.
  expect(wrapper.find('[data-detail-editor]').exists()).toBe(true)
  return wrapper
}
const field = (wrapper: VueWrapper, key: string) => wrapper.get(`[data-detail-field="${key}"]`)
async function save(wrapper: VueWrapper) {
  const button = wrapper.findAll('button').find((node) => /^(수정|등록)\s*send$/.test(node.text()))
  expect(button).toBeDefined()
  await button!.trigger('click')
  await flushPromises()
}
async function customize(wrapper: VueWrapper) {
  await wrapper.get('[data-detail-mode="custom"]').setValue()
}
async function upload(wrapper: VueWrapper, selector: string) {
  const input = wrapper.get(selector)
  Object.defineProperty(input.element, 'files', {
    value: [new File(['image'], 'fixture.png', { type: 'image/png' })],
    configurable: true,
  })
  await input.trigger('change')
  await flushPromises()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('useRuntimeConfig', () => ({
    public: { apiBaseUrl: 'https://api.example.test/', siteUrl: 'https://site.example.test/' },
  }))
  boundary.getAll.mockResolvedValue({ data: [] })
  boundary.create.mockResolvedValue({ data: fixture() })
  boundary.update.mockResolvedValue({ data: fixture() })
  boundary.uploadImage.mockResolvedValue({
    data: {
      url: '/uploaded.webp',
      filename: 'uploaded.webp',
      originalname: 'fixture.png',
      size: 5,
    },
  })
  boundary.deleteImage.mockResolvedValue({ data: { success: true } })
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

describe('product detail administration', () => {
  it('loads and saves all editable content without changing source data, specifications or technical Markdown', async () => {
    const product = fixture()
    const original = structuredClone(product)
    const wrapper = await renderProduct(product)
    expect(field(wrapper, 'heroTitle').element).toHaveProperty('value', '등록된 제목')
    expect(field(wrapper, 'application.caption').element).toHaveProperty('value', '적용 출처')
    await field(wrapper, 'heroTitle').setValue('수정한 제목')
    await field(wrapper, 'features.0.body').setValue('수정한 특징 설명')
    await save(wrapper)
    expect(boundary.update).toHaveBeenCalledOnce()
    const [id, payload] = boundary.update.mock.calls[0]!
    expect(id).toBe('fixture-product')
    expect(payload.detailContent).toEqual({
      ...content,
      heroTitle: '수정한 제목',
      features: [{ title: '특징', body: '수정한 특징 설명' }],
    })
    expect(payload).toMatchObject({
      power: [10, 20],
      colorTemp: [3000, 5000],
      dimensions: '100 x 200 x 30',
      description: original.description,
      options: ['센서'],
    })
    expect(product).toEqual(original)
  })

  it('explicitly saves null for legacy products using common defaults', async () => {
    const product = fixture(null)
    delete product.detailContent
    const wrapper = await renderProduct(product)
    expect(wrapper.get('[data-detail-mode="default"]').element).toHaveProperty('checked', true)
    await save(wrapper)
    expect(boundary.update.mock.calls[0]![1]).toHaveProperty('detailContent', null)
  })

  it('resets custom content to null while retaining registered product specifications', async () => {
    const wrapper = await renderProduct()
    await wrapper.get('[data-detail-reset]').trigger('click')
    expect(wrapper.find('[data-detail-field="heroTitle"]').exists()).toBe(false)
    await save(wrapper)
    expect(boundary.update.mock.calls[0]![1]).toMatchObject({
      detailContent: null,
      modelName: 'MODEL-10',
      power: [10, 20],
    })
  })

  it('creates a product with custom content and uses the authenticated products upload boundary', async () => {
    const wrapper = await renderProduct(null)
    await wrapper.get('input[placeholder="예: Pro-Series High Bay LED"]').setValue('새 조명')
    await wrapper.get('.base-select').trigger('click')
    await wrapper.get('.base-select__option').trigger('click')
    await wrapper.get('input[placeholder="예: LED-PRO-150W"]').setValue('NEW-10')
    await wrapper.get('input[placeholder="예: 1200 x 45 x 60"]').setValue('100 x 200 x 30')
    await wrapper.get('input[placeholder="150"]').setValue(10)
    await wrapper.get('input[placeholder="예: 50000"]').setValue(50000)
    await wrapper.get('input[placeholder="예: 3000"]').setValue(3000)
    await wrapper.get('input[placeholder="예: Samsung, LG"]').setValue('Samsung')
    await wrapper.get('input[value="KS"]').setValue(true)
    await wrapper.get('[data-markdown]').setValue('기술 자료')
    await upload(wrapper, 'input[type="file"]')
    await customize(wrapper)
    await field(wrapper, 'heroTitle').setValue('새 제품 소개')
    await upload(wrapper, '[data-detail-image="heroImage"] input[type="file"]')
    await field(wrapper, 'heroImage.alt').setValue('새 제품 사진')
    await save(wrapper)
    expect(boundary.create).toHaveBeenCalledOnce()
    expect(boundary.create.mock.calls[0]![0].detailContent).toEqual({
      version: 1,
      heroTitle: '새 제품 소개',
      heroImage: { url: '/uploaded.webp', alt: '새 제품 사진' },
    })
    expect(boundary.uploadImage.mock.calls.every((args) => args[1] === 'products')).toBe(true)
    expect(boundary.deleteImage).not.toHaveBeenCalled()
  })

  it('omits untouched image and feature placeholders instead of sending invalid nested blocks', async () => {
    const wrapper = await renderProduct(fixture(null))
    await customize(wrapper)
    await wrapper.get('[data-detail-add="feature"]').trigger('click')
    await wrapper.get('[data-detail-add="structure"]').trigger('click')
    await save(wrapper)
    expect(boundary.update.mock.calls[0]![1].detailContent).toEqual({
      version: 1,
      features: [],
      structureImages: [],
    })
  })

  it.each([
    '//evil.example/image.png',
    'javascript:alert(1)',
    '/\\evil.example/image.png',
    'https://example.com/white space.png',
  ])('blocks an unsafe image URL %s before saving', async (url) => {
    const wrapper = await renderProduct()
    await field(wrapper, 'heroImage.url').setValue(url)
    await save(wrapper)
    expect(boundary.update).not.toHaveBeenCalled()
    expect(wrapper.get('[data-detail-errors]').text()).toContain('이미지 주소')
  })

  it('validates text limits and incomplete features before saving', async () => {
    const wrapper = await renderProduct()
    await field(wrapper, 'heroTitle').setValue('가'.repeat(161))
    await field(wrapper, 'features.0.body').setValue('')
    await save(wrapper)
    expect(boundary.update).not.toHaveBeenCalled()
    expect(wrapper.get('[data-detail-errors]').text()).toContain('160자')
    expect(wrapper.get('[data-detail-errors]').text()).toContain('특징 1')
  })

  it('requires an enabled application title and image, and removes it when disabled', async () => {
    const wrapper = await renderProduct(fixture(null))
    await customize(wrapper)
    await wrapper.get('[data-detail-application-enabled]').setValue(true)
    await save(wrapper)
    expect(boundary.update).not.toHaveBeenCalled()
    expect(wrapper.get('[data-detail-errors]').text()).toContain('적용 이미지')
    await field(wrapper, 'application.title').setValue('적용 예시')
    await field(wrapper, 'application.image.url').setValue('/application.webp')
    await field(wrapper, 'application.image.alt').setValue('공간 예시')
    await save(wrapper)
    expect(boundary.update.mock.calls[0]![1].detailContent.application).toEqual({
      title: '적용 예시',
      image: { url: '/application.webp', alt: '공간 예시' },
    })
    boundary.update.mockClear()
    await wrapper.get('[data-detail-application-enabled]').setValue(false)
    await save(wrapper)
    expect(boundary.update.mock.calls[0]![1].detailContent).not.toHaveProperty('application')
  })

  it('limits feature and structure collections to six and allows removal', async () => {
    const wrapper = await renderProduct(fixture(null))
    await customize(wrapper)
    for (let index = 0; index < 6; index++) {
      await wrapper.get('[data-detail-add="feature"]').trigger('click')
      await wrapper.get('[data-detail-add="structure"]').trigger('click')
    }
    expect(wrapper.get('[data-detail-add="feature"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-detail-add="structure"]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-detail-remove="feature-0"]').trigger('click')
    await wrapper.get('[data-detail-remove="structure-0"]').trigger('click')
    expect(wrapper.get('[data-detail-add="feature"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('[data-detail-add="structure"]').attributes('disabled')).toBeUndefined()
  })

  it('removes an uploaded image block through the common image remove button', async () => {
    const wrapper = await renderProduct()
    await wrapper.get('[data-detail-image="heroImage"] .relative > button').trigger('click')
    await save(wrapper)
    expect(boundary.update).toHaveBeenCalledOnce()
    expect(boundary.update.mock.calls[0]![1].detailContent).not.toHaveProperty('heroImage')
  })

  it('updates control and dimensions visibility independently of product options and size', async () => {
    const wrapper = await renderProduct()
    await wrapper.get('[data-detail-show-control]').setValue(true)
    await wrapper.get('[data-detail-show-dimensions]').setValue(true)
    await save(wrapper)
    expect(boundary.update.mock.calls[0]![1]).toMatchObject({
      detailContent: { showControl: true, showDimensions: true },
      options: ['센서'],
      dimensions: '100 x 200 x 30',
    })
  })

  it('previews unsaved edits with the public renderer at PC and mobile widths without navigation or quote actions', async () => {
    const wrapper = await renderProduct()
    await field(wrapper, 'heroTitle').setValue('저장 전 미리보기')
    await wrapper.get('[data-detail-preview]').trigger('click')
    await flushPromises()
    const dialog = document.querySelector('[role="dialog"]')!
    expect(dialog).not.toBeNull()
    expect(dialog.querySelector('.product-detail-template.is-preview h1')?.textContent).toContain(
      '저장 전 미리보기',
    )
    expect(dialog.querySelectorAll('a[href]').length).toBe(0)
    expect(dialog.querySelectorAll('[data-quote]:not([disabled])').length).toBe(0)
    const mobile = dialog.querySelector<HTMLButtonElement>('[data-detail-preview-size="mobile"]')!
    mobile.click()
    await flushPromises()
    expect(dialog.querySelector<HTMLElement>('[data-detail-preview-canvas]')!.style.width).toBe(
      '375px',
    )
    expect(boundary.update).not.toHaveBeenCalled()
    expect(boundary.create).not.toHaveBeenCalled()
    expect(boundary.push).not.toHaveBeenCalled()
  })

  it('resolves registered preview photos against the API while retaining editorial paths and saved source values', async () => {
    const product = fixture({
      version: 1,
      storyImage: { url: '/images/product-detail/editorial.webp', alt: '직접 작성한 소개 사진' },
    })
    product.images = [{ image: '/uploads/legacy.webp', description: '기존 등록 사진' }]
    const original = structuredClone(product)
    const wrapper = await renderProduct(product)
    await wrapper.get('[data-detail-preview]').trigger('click')
    await flushPromises()

    const dialog = document.querySelector('[role="dialog"]')!
    const registered = dialog.querySelector<HTMLImageElement>('.detail-hero-art')!
    expect(registered.src).toBe('https://api.example.test/uploads/legacy.webp')
    const editorial = dialog.querySelector<HTMLImageElement>('[data-section="story"] img')!
    expect(editorial.getAttribute('src')).toBe('/images/product-detail/editorial.webp')
    expect(editorial.src).toBe(`${window.location.origin}/images/product-detail/editorial.webp`)

    await save(wrapper)
    expect(boundary.update).toHaveBeenCalledOnce()
    expect(boundary.update.mock.calls[0]![1]).toMatchObject({
      images: [{ image: '/uploads/legacy.webp', description: '기존 등록 사진' }],
      detailContent: original.detailContent,
    })
    expect(product).toEqual(original)
  })
})
