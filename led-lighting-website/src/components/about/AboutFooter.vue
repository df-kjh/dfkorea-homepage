<script setup lang="ts">
interface FooterColumn {
  title: string
  links: { text: string; href: string }[]
}

interface Props {
  logo?: string
  copyrightText?: string
  shopLinks?: FooterColumn
  supportLinks?: FooterColumn
  legalLinks?: { text: string; href: string }[]
}

withDefaults(defineProps<Props>(), {
  logo: 'Lumina',
  copyrightText: '© 2024 Lumina. All rights reserved.',
  shopLinks: () => ({
    title: 'Shop',
    links: [
      { text: 'All Products', href: '/products' },
      { text: 'Smart Series', href: '/products?series=smart' },
      { text: 'Classic Series', href: '/products?series=classic' },
    ],
  }),
  supportLinks: () => ({
    title: 'Support',
    links: [
      { text: 'Contact', href: '/contact' },
      { text: 'Documentation', href: '/docs' },
      { text: 'FAQ', href: '/faq' },
    ],
  }),
  legalLinks: () => [
    { text: 'Privacy Policy', href: '/privacy' },
    { text: 'Terms of Service', href: '/terms' },
  ],
})
</script>

<template>
  <footer class="bg-surface py-16 px-8">
    <div class="max-w-md mx-auto md:max-w-5xl">
      <!-- Main Footer Content -->
      <div class="grid md:grid-cols-2 gap-12 mb-12">
        <!-- Logo & Copyright -->
        <div>
          <h2 class="text-text-main text-2xl font-bold mb-4">{{ logo }}</h2>
          <p class="text-text-sub text-sm">{{ copyrightText }}</p>
        </div>

        <!-- Shop & Support Links -->
        <div class="grid grid-cols-2 gap-8">
          <!-- Shop Column -->
          <div>
            <h3 class="text-text-main text-sm font-bold mb-4">{{ shopLinks.title }}</h3>
            <ul class="space-y-3">
              <li v-for="(link, index) in shopLinks.links" :key="index">
                <a
                  :href="link.href"
                  class="text-text-sub text-sm hover:text-primary transition-colors"
                >
                  {{ link.text }}
                </a>
              </li>
            </ul>
          </div>

          <!-- Support Column -->
          <div>
            <h3 class="text-text-main text-sm font-bold mb-4">{{ supportLinks.title }}</h3>
            <ul class="space-y-3">
              <li v-for="(link, index) in supportLinks.links" :key="index">
                <a
                  :href="link.href"
                  class="text-text-sub text-sm hover:text-primary transition-colors"
                >
                  {{ link.text }}
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Legal Links -->
      <div class="pt-8 border-t border-gray-200">
        <div class="flex flex-wrap gap-6 justify-center md:justify-start">
          <a
            v-for="(link, index) in legalLinks"
            :key="index"
            :href="link.href"
            class="text-text-desc text-xs hover:text-primary transition-colors"
          >
            {{ link.text }}
          </a>
        </div>
      </div>
    </div>
  </footer>
</template>
