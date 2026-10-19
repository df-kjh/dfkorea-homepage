import type { Product } from '@/types'
import { toAbsoluteAssetUrl, type AbsoluteUrlOptions } from './seo'

export const withRegisteredImageUrls = (
  product: Product,
  options: AbsoluteUrlOptions,
): Product => ({
  ...product,
  // Legacy registered photos resolve from the API. Editorial detailContent can
  // reference Nuxt static /images assets, so only copy/normalize Product.images
  // for display and leave both the original product and saved content untouched.
  images: (product.images || []).map((image) => ({
    ...image,
    image: image.image ? toAbsoluteAssetUrl(image.image, options) : '',
  })),
})
