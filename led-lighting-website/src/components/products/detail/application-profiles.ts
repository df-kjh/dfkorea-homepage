import type { Product, ProductDetailImage } from '@/types'

export type ProductApplicationKey =
  | 'pipe-pendant'
  | 'classroom'
  | 'street'
  | 'moisture-proof'
  | 'cob-retail'
  | 'round-ceiling'
  | 'downlight'
  | 'stair-sign'
  | 'parking-guidance'
  | 'wall-light'
  | 'cleanroom'
  | 'parking-linear'
  | 'panel-square'
  | 'panel-linear'

export interface ProductApplicationProfile {
  key: ProductApplicationKey
  productIds: readonly string[]
  image: ProductDetailImage
  description: string
}

export const GENERATED_APPLICATION_CAPTION =
  'AI로 제작한 적용 공간 예시입니다. 실제 시공 사례·조도 측정 결과가 아닙니다.'

const APPLICATION_IMAGE_VERSIONS: Partial<Record<ProductApplicationKey, 2>> = {
  'pipe-pendant': 2,
  classroom: 2,
  street: 2,
  'parking-guidance': 2,
  'wall-light': 2,
  cleanroom: 2,
}

const profile = (
  key: ProductApplicationKey,
  productIds: string[],
  space: string,
  description: string,
  alt?: string,
): ProductApplicationProfile => ({
  key,
  productIds,
  image: {
    url: `/images/product-detail/applications/${key}-v${APPLICATION_IMAGE_VERSIONS[key] ?? 1}.png`,
    alt: alt || `${space}에 제품 유형의 형태를 참고해 배치한 AI 설치 연출 예시`,
  },
  description,
})

// Exact catalog IDs preserve the reviewed image mapping. New records may use only
// explicit categories and unambiguous panel dimensions; model names are not geometry.
export const PRODUCT_APPLICATION_PROFILES: readonly ProductApplicationProfile[] = [
  profile(
    'pipe-pendant',
    ['30b50b2a-cd91-46bd-960e-9860f6c72de6'],
    '주차장',
    '주차장 천장의 고정 위치와 높이를 확인하고, 파이프 길이와 연결할 조명의 배치를 함께 계획합니다.',
  ),
  profile(
    'classroom',
    ['5b42165c-7186-4e6e-b2e8-b67223633468'],
    '칠판이 있는 교실',
    '칠판 위 벽면의 고정 위치와 조사 방향을 살펴보고, 제품 규격과 필요한 수량을 함께 확인합니다.',
  ),
  profile(
    'street',
    ['91302d00-bf8b-4669-b3ca-08c5c3cbfa41'],
    '도로와 보행로 주변 외부 공간',
    '설치 위치와 지지 구조를 확인하고, 등록된 가로등 사양을 바탕으로 배치를 상담합니다.',
  ),
  profile(
    'moisture-proof',
    ['e91f1694-61ec-4aa2-a5ae-cf141da9675f'],
    '설비 공간',
    '설비 공간의 설치 조건과 기구 위치를 확인합니다. 현장 환경에 필요한 보호 조건은 별도로 상담합니다.',
  ),
  profile(
    'cob-retail',
    ['84c6bf7f-5039-4e73-b4f0-e2185d02c8a5'],
    '상품 진열 공간',
    '진열 위치와 천장 구성을 살펴보고, 등록 규격에 맞는 설치 자리와 배치를 계획합니다.',
  ),
  profile(
    'round-ceiling',
    ['d4705d1d-7dab-4381-b83c-9c9026efa896', 'bc46e6f3-2dd0-4c17-bf5b-0ee5b681b538'],
    '실내 출입 공간',
    '출입 공간의 천장과 고정 위치를 확인하고, 제품에 등록된 사양과 제어 옵션을 살펴봅니다.',
  ),
  profile(
    'downlight',
    ['68638535-116f-4737-a5ed-ec6af24e3e71'],
    '다운라이트를 배치한 실내 공간',
    '천장 마감과 타공 조건을 확인하고, 등록 규격에 맞는 제품 위치와 간격을 계획합니다.',
  ),
  profile(
    'stair-sign',
    ['09b2b075-526e-405d-8baf-cfae9265b5b3'],
    '계단 출입 공간',
    '계단 출입 위치와 표시 내용을 확인하고, 현장에 필요한 표기와 설치 방향을 상담합니다.',
  ),
  profile(
    'parking-guidance',
    ['67d187d8-c5a8-467b-b5df-9d6bc8eb4c43'],
    '주차장 차량 이동 구간',
    '차량 이동 방향과 표시 위치를 살펴보고, 등록된 크기별 설치 조건을 함께 확인합니다.',
    '주차장·PARKING 글씨와 우측 화살표를 표시한 차량유도등의 AI 설치 연출 예시',
  ),
  profile(
    'wall-light',
    ['a3516220-2b98-4bfa-87ad-0db77b572aac'],
    '주차장 램프',
    '주차장 차량 램프의 벽면 고정 위치와 경사 구간을 확인하고, 제품 크기에 맞는 설치 자리를 계획합니다.',
  ),
  profile(
    'cleanroom',
    ['40fb2fa3-c344-4547-9071-30d0905f64b9'],
    '클린룸 형태의 작업 공간',
    '작업 공간의 천장 구조와 설치 위치를 살펴봅니다. 현장에 필요한 청정도와 적용 조건은 별도로 확인합니다.',
  ),
  profile(
    'parking-linear',
    [
      'f57d4c52-bae5-4f96-90e6-51300de6ec15',
      'f6bfbddf-a3b8-4127-b352-6ba9c703e252',
      '492784ba-6318-4687-b877-9edde0b96b32',
    ],
    '주차장 선형 조명 구간',
    '주차 구역과 이동 통로의 설치 위치를 확인하고, 제품 규격과 등록된 옵션으로 구성을 계획합니다.',
  ),
  profile(
    'panel-square',
    [
      '6bcb142f-ec93-4250-a408-124aae95dc18',
      'bdf827df-b0b8-457b-bfa3-3b5983de998b',
      'eb1fc8bf-c065-4ac0-babf-4ebdd5d26190',
    ],
    '정사각 평판을 배치한 실내 공간',
    '천장의 가로·세로 치수와 고정 조건을 확인하고, 정사각 평판의 크기와 배치 간격을 계획합니다.',
  ),
  profile(
    'panel-linear',
    [
      'b8f1f680-d324-46c4-a691-14bebd1959a4',
      '3ed45855-3616-47ea-8b2a-a64e38109b89',
      '446291b5-3244-4915-89a4-d424961942f3',
      'e752d849-9d6b-45b1-97ff-f7a3816b63be',
      '535f7211-2d04-4d3b-9516-489efc0c1c86',
      '89baa914-fb46-4546-bf2a-2579b303e403',
    ],
    '직사각 평판을 배치한 실내 공간',
    '설치 구간의 길이와 폭을 확인하고, 직사각 평판의 규격에 맞는 방향과 수량을 계획합니다.',
  ),
]

const categoryKeys: Record<string, ProductApplicationKey> = {
  파이프팬던트: 'pipe-pendant',
  파이프펜던트: 'pipe-pendant',
  칠판등: 'classroom',
  가로등: 'street',
  방습등: 'moisture-proof',
  COB조명: 'cob-retail',
  원형직부: 'round-ceiling',
  원형센서: 'round-ceiling',
  다운라이트: 'downlight',
  계단표시등: 'stair-sign',
  차량유도등: 'parking-guidance',
  벽부등: 'wall-light',
  크린룸조명: 'cleanroom',
  주차장조명: 'parking-linear',
}

export function resolveApplicationProfile(product: Product): ProductApplicationProfile | undefined {
  const exact = PRODUCT_APPLICATION_PROFILES.find((entry) => entry.productIds.includes(product.id))
  if (exact) return exact
  const category = product.category.replace(/\s/g, '')
  let key = categoryKeys[category]
  if (category === '엣지평판') {
    const dimensions = product.dimensions.match(
      /^\s*(\d+(?:\.\d+)?)\s*[*xX×]\s*(\d+(?:\.\d+)?)\s*[*xX×]\s*(\d+(?:\.\d+)?)\s*(?:mm)?\s*$/i,
    )
    if (!dimensions || dimensions.slice(1).some((value) => !(Number(value) > 0))) return
    key = Number(dimensions[1]) === Number(dimensions[2]) ? 'panel-square' : 'panel-linear'
  }
  return PRODUCT_APPLICATION_PROFILES.find((entry) => entry.key === key)
}
