export interface Product {
  id: string;
  name: string; // 제목
  category: string; // 카테고리
  images: string[]; // 제품 썸네일 이미지 (3장)
  modelName: string; // 모델명
  dimensions: string; // 크기
  power: number[]; // 전력(W) - 여러 개 가능
  lifespan: number; // 수명
  colorTemp: number[]; // 색 온도 - 여러 개 가능
  ledChipManufacturer: string; // LED 칩 제조 회사
  certifications: string[]; // 인증 (KS, 고효율 등)
  powerFactor?: string; // 역률
  luminanceEfficiency?: number; // 광효율
  colorRendering?: string; // 연색성
  options?: string[]; // 옵션 (개별디밍, 그룹디밍, 센서)
  description: string; // 기타 사항 (마크다운)
  isNew?: boolean; // 신제품 여부
  isFeatured?: boolean; // 메인 제품 여부
  createdAt: string;
  updatedAt: string;
}

export interface Post {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  image: string;
  views: number;
  createdAt: string;
  updatedAt: string;
}

export interface Admin {
  username: string;
  password: string;
}

export interface Database {
  admin: Admin;
  products: Product[];
  posts: Post[];
}
