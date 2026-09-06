import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { describe, expect, it, vi } from 'vitest'
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

const mountBlogGrid = () => {
  const navigate = vi.fn()
  const NuxtLink = defineComponent({
    props: {
      to: { type: String, required: true },
      custom: Boolean,
    },
    setup(props, { attrs, slots }) {
      return () => {
        if (props.custom) return slots.default?.({ href: props.to, navigate })

        const { onClick, ...linkAttributes } = attrs
        return h(
          'a',
          {
            ...linkAttributes,
            href: props.to,
            onClick: (event: MouseEvent) => {
              navigate()
              if (typeof onClick === 'function') onClick(event)
              if (Array.isArray(onClick)) onClick.forEach((listener) => listener(event))
            },
          },
          slots.default?.(),
        )
      }
    },
  })

  return {
    wrapper: mount(BlogGrid, {
      props: { posts: [post] },
      global: { stubs: { NuxtLink } },
    }),
    navigate,
  }
}

describe('BlogGrid', () => {
  it('renders a crawlable link to the post detail page', () => {
    const { wrapper } = mountBlogGrid()

    expect(wrapper.find('a[href="/blog/post-1"]').exists()).toBe(true)

    wrapper.unmount()
  })

  it('emits the selected post when its link is clicked', async () => {
    const { navigate, wrapper } = mountBlogGrid()

    await wrapper.get('a[href="/blog/post-1"]').trigger('click')

    expect(navigate).not.toHaveBeenCalled()
    expect(wrapper.emitted('postClick')).toEqual([[post]])
    wrapper.unmount()
  })
})
