import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { Post } from '@/types'
import BlogGrid from './BlogGrid.vue'

const post: Post = {
  id: 'post-1',
  title: 'DF Korea 소식',
  excerpt: '새로운 제품과 소식',
  content: '본문',
  category: 'product',
  image: '/images/post-1.jpg',
  views: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const mountBlogGrid = () =>
  mount(BlogGrid, {
    props: { posts: [post] },
    global: {
      stubs: {
        NuxtLink: {
          props: ['to'],
          emits: ['click'],
          template: '<a :href="to" @click="$emit(\'click\', $event)"><slot /></a>',
        },
      },
    },
  })

describe('BlogGrid', () => {
  it('renders a crawlable link to the post detail page', () => {
    const wrapper = mountBlogGrid()

    expect(wrapper.find('a[href="/blog/post-1"]').exists()).toBe(true)

    wrapper.unmount()
  })

  it('emits the selected post when its link is clicked', async () => {
    const wrapper = mountBlogGrid()

    await wrapper.get('a[href="/blog/post-1"]').trigger('click')

    expect(wrapper.emitted('postClick')).toEqual([[post]])
    wrapper.unmount()
  })
})
