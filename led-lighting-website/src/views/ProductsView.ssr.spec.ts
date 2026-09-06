import { vi } from 'vitest'
import type { Product } from '@/types'
import ProductsView from './ProductsView.vue'
import { testSeededListRefresh } from './test-utils/seeded-list-refresh'

const api = vi.hoisted(() => ({ getPaginated: vi.fn(), getFilterOptions: vi.fn() }))
vi.mock('@/api', () => ({ productsAPI: api }))
vi.mock('@/composables/useToast', () => ({ useToast: () => ({ error: vi.fn() }) }))
api.getFilterOptions.mockResolvedValue({
  data: { categories: [], power: [], colorTemp: [], certifications: [], options: [] },
})

testSeededListRefresh<Product>({
  view: ProductsView,
  path: '/products',
  getPaginated: api.getPaginated,
  item: (id) => ({
    id,
    name: `제품 ${id}`,
    category: '주차장조명',
    images: [],
    modelName: 'DF-1',
    dimensions: '100 mm',
    power: [40],
    lifespan: 50000,
    colorTemp: [5700],
    ledChipManufacturer: 'DF Korea',
    certifications: [],
    description: '제품 설명',
    createdAt: '2026-09-01',
    updatedAt: '2026-09-01',
  }),
})
