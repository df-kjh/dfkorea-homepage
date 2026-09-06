import { vi } from 'vitest'
import type { Post } from '@/types'
import BlogView from './BlogView.vue'
import { testSeededListRefresh } from './test-utils/seeded-list-refresh'

const api = vi.hoisted(() => ({ getPaginated: vi.fn(), incrementView: vi.fn() }))
vi.mock('@/api', () => ({ postsAPI: api }))
vi.mock('@/composables/useToast', () => ({ useToast: () => ({ error: vi.fn() }) }))

testSeededListRefresh<Post>({
  view: BlogView,
  path: '/blog',
  getPaginated: api.getPaginated,
  item: (id) => ({
    id,
    title: `소식 ${id}`,
    excerpt: '최신 소식',
    content: '본문',
    category: '회사소식',
    image: '',
    views: 0,
    createdAt: '2026-09-01',
    updatedAt: '2026-09-01',
  }),
})
