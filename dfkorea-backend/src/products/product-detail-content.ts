export interface ProductDetailImage {
  url: string;
  alt: string;
  caption?: string;
}

export interface ProductDetailFeature {
  title: string;
  body: string;
}

export interface ProductDetailContent {
  version: 1;
  heroTitle?: string;
  heroDescription?: string;
  heroImage?: ProductDetailImage;
  storyTitle?: string;
  storyImage?: ProductDetailImage;
  features?: ProductDetailFeature[];
  structureTitle?: string;
  structureImages?: ProductDetailImage[];
  application?: {
    title: string;
    description?: string;
    image: ProductDetailImage;
    caption?: string;
  };
  controlTitle?: string;
  showControl?: boolean;
  dimensionsTitle?: string;
  showDimensions?: boolean;
  dimensionImage?: ProductDetailImage;
}
