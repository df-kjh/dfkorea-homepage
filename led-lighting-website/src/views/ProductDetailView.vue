<template>
  <div class="product-detail bg-background font-inter min-h-screen">
    <!-- Loading State -->
    <LoadingSpinner v-if="loading" message="제품 정보를 불러오는 중..." class="py-32" />

    <!-- Error State -->
    <div v-else-if="error" class="py-32 px-6 text-center">
      <div class="max-w-md mx-auto">
        <span class="material-symbols-outlined text-red-500 text-6xl mb-4">error</span>
        <h2 class="text-2xl font-bold text-text-main mb-4">제품 정보를 불러올 수 없습니다</h2>
        <p class="text-text-sub mb-8">{{ error }}</p>
        <button
          @click="router.push('/products')"
          class="bg-primary text-white px-8 py-4 rounded-2xl font-semibold hover:bg-primary/90 transition-all"
        >
          목록으로 돌아가기
        </button>
      </div>
    </div>

    <!-- Product Content -->
    <main v-else-if="product" class="pt-20">
      <!-- Product Overview Section -->
      <section class="max-w-[1400px] mx-auto px-10 py-12 lg:py-20">
        <div class="grid lg:grid-cols-12 gap-16 items-start">
          <!-- Image Gallery -->
          <ProductImageGallery
            :main-image="product.images?.[0]?.image ?? ''"
            :thumbnails="productThumbnails"
            :product-name="product.name"
            @image-click="handleImageClick"
          />

          <!-- Product Info -->
          <ProductInfo
            :series="product.modelName || 'LED Series'"
            :product-name="product.name"
            :price="0"
            :specs="productSpecs"
            :is-new="product.isNew"
            :is-featured="product.isFeatured"
            @add-to-cart="handleAddToCart"
            @add-to-wishlist="handleAddToWishlist"
          />
        </div>
      </section>

      <!-- Product Description -->
      <ProductDescription
        v-if="product.description"
        :title="descriptionTitle"
        :subtitle="product.ledChipManufacturer || descriptionSubtitle"
        :description="product.description"
        :feature-image="product.images?.[0]?.image ?? ''"
      />

      <!-- Technical Specifications -->
      <TechnicalSpecs :specs="technicalSpecs" />

      <!-- Mobile Cart Button (가격 기능 제거됨) -->
      <!-- <MobileCartButton
        :product-name="product.name"
        :price="0"
        @add-to-cart="handleAddToCart"
      /> -->
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { useSEO } from '@/composables/useSEO'
import { productsAPI } from '@/api'
import type { Product } from '@/types'
import ProductImageGallery from '@/components/products/ProductImageGallery.vue'
import ProductInfo from '@/components/products/ProductInfo.vue'
import ProductDescription from '@/components/products/ProductDescription.vue'
import TechnicalSpecs from '@/components/products/TechnicalSpecs.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import { formatWithUnit } from '@/constants/units'
import { getImageUrl } from '@/utils/image'
import { stripMarkdown } from '@/utils/seo'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const { setMeta } = useSEO()

const loading = ref(false)
const error = ref('')
const product = ref<Product | null>(null)

// Computed properties
const productThumbnails = computed(() => {
  if (!product.value?.images || product.value.images.length === 0) return []
  // 모든 이미지를 썸네일로 사용
  return product.value.images
    .filter((img) => img.image.trim() !== '')
    .map((img, index) => ({
      url: img.image,
      alt: `Product view ${index + 1}`,
      description: img.description,
    }))
})

const productSpecs = computed(() => {
  if (!product.value) return []
  return [
    {
      icon: 'bolt',
      label: '전력',
      value: formatWithUnit(product.value.power, 'power'),
    },
    {
      icon: 'straighten',
      label: '사이즈',
      value: formatWithUnit(product.value.dimensions, 'dimensions'),
    },
    {
      icon: 'verified',
      label: '인증',
      value: product.value.certifications?.join(', ') || 'N/A',
    },
    {
      icon: 'palette',
      label: '색 온도',
      value: formatWithUnit(product.value.colorTemp, 'colorTemp'),
    },
  ]
})

const technicalSpecs = computed(() => {
  if (!product.value) return []

  const specs = [
    {
      label: '모델명',
      value: product.value.modelName || 'N/A',
    },
    {
      label: '사이즈',
      value: formatWithUnit(product.value.dimensions, 'dimensions'),
    },
    {
      label: '전력',
      value: formatWithUnit(product.value.power, 'power'),
    },
    {
      label: '색 온도',
      value: formatWithUnit(product.value.colorTemp, 'colorTemp'),
    },
    {
      label: '수명',
      value: formatWithUnit(product.value.lifespan, 'lifespan'),
    },
    {
      label: 'LED 칩 제조사',
      value: product.value.ledChipManufacturer || 'N/A',
    },
  ]

  // 추가 필드 (값이 있을 때만 표시)
  if (product.value.powerFactor) {
    specs.push({
      label: '역률',
      value: formatWithUnit(product.value.powerFactor, 'powerFactor'),
    })
  }

  if (product.value.luminanceEfficiency) {
    specs.push({
      label: '광효율',
      value: formatWithUnit(product.value.luminanceEfficiency, 'luminanceEfficiency'),
    })
  }

  if (product.value.colorRendering) {
    specs.push({
      label: '연색성',
      value: product.value.colorRendering,
    })
  }

  specs.push({
    label: '인증',
    value: product.value.certifications?.join(', ') || 'N/A',
  })

  if (product.value.options && product.value.options.length > 0) {
    specs.push({
      label: '옵션',
      value: product.value.options.join(', '),
    })
  }

  return specs
})

const descriptionTitle = computed(() => {
  return product.value?.name ?? ''
})

const descriptionSubtitle = computed(() => {
  return "This isn't just a light fixture; it's a precision instrument. Crafted from aircraft-grade aluminum, it delivers a flicker-free, edge-to-edge illumination that mimics the natural properties of morning sunlight."
})

// Methods
const fetchProduct = async () => {
  try {
    loading.value = true
    error.value = ''

    const productId = route.params.id as string
    const { data } = await productsAPI.getOne(productId)

    product.value = data
    setProductSeo(data)
  } catch (err) {
    console.error('Failed to fetch product:', err)
    const axiosError = err as { response?: { data?: { message?: string } } }
    error.value = axiosError.response?.data?.message || '제품 정보를 불러오는데 실패했습니다.'
  } finally {
    loading.value = false
  }
}

const setProductSeo = (productData: Product): void => {
  const canonicalUrl = `${window.location.origin}/products/${productData.id}`
  const mainImage = productData.images?.find((image) => image.image)?.image
  const imageUrl = mainImage ? getImageUrl(mainImage) : `${window.location.origin}/images/og-image.jpg`
  const description =
    stripMarkdown(productData.description).slice(0, 155) ||
    `${productData.name} 제품의 주요 사양과 특징을 확인하세요.`

  setMeta({
    title: `${productData.name} | 제품 정보 | (주)디에프코리아`,
    description,
    keywords: `${productData.name}, ${productData.category}, ${productData.modelName}, LED 조명, 디에프코리아`,
    ogImage: imageUrl,
    ogType: 'product',
    canonicalUrl,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: productData.name,
      description,
      image: productData.images?.map((image) => getImageUrl(image.image)).filter(Boolean),
      sku: productData.modelName,
      category: productData.category,
      brand: {
        '@type': 'Brand',
        name: '(주)디에프코리아',
      },
      manufacturer: {
        '@type': 'Organization',
        name: '(주)디에프코리아',
      },
      url: canonicalUrl,
    },
  })
}

const handleImageClick = (url: string) => {
  console.log('Image clicked:', url)
  // TODO: Open image in lightbox/modal
}

const handleAddToCart = () => {
  if (product.value) {
    toast.success(`${product.value.name}이(가) 장바구니에 추가되었습니다`)
    console.log('Add to cart:', product.value)
    // TODO: Add to cart logic
  }
}

const handleAddToWishlist = () => {
  if (product.value) {
    toast.success(`${product.value.name}이(가) 위시리스트에 추가되었습니다`)
    console.log('Add to wishlist:', product.value)
    // TODO: Add to wishlist logic
  }
}

onMounted(() => {
  fetchProduct()
})
</script>

<style scoped>
.product-detail {
  width: 100%;
}

.material-symbols-outlined {
  font-variation-settings:
    'FILL' 0,
    'wght' 300,
    'GRAD' 0,
    'opsz' 24;
}
</style>
