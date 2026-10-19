# 제품 상세페이지 공통 템플릿

## 목적과 승인 범위

사용자가 검토한 몰드바 상세 시안의 디자인을 실제 제품 상세와 관리자 등록·수정에 적용한다. 2026-10-19 사용자가 지시한 여덟 삭제 사항을 반영하고 다른 제품도 같은 양식을 사용한다. 새 제품을 뜻하는 것으로 해석하며 제품 개수를 세 개로 제한하지 않는다. 사용자가 작업 진행을 직접 지시했으므로 추가적인 일반 구현 승인을 요청하지 않는다. 제품 통합 여부가 불분명한 경우는 사용자의 판단을 받는다.

## 표시

- 실제 Nuxt `/products/[id]`에 공통 상세 컴포넌트를 사용한다. 기존 Markdown 설명·기술 자료·SEO·사진 확대·견적 담기 기능을 유지한다.
- 히어로, 핵심 사양, 제품 소개와 사진, 구조 사진, 선택적 적용 이미지, 제어 옵션, 규격, 상세 사양, 문의 순으로 배치한다. 사진이나 옵션이 없는 섹션은 숨긴다.
- 전체 제품의 기존 등록 정보로 기본 화면을 구성하고 새 상세 콘텐츠는 선택적으로 덮어쓴다. 몰드바의 승인된 문구·이미지는 해당 제품 ID에만 적용한다. 다른 제품에 몰드바 수치·사진·선형 형태·센서 성능을 재사용하지 않는다.
- 삭제 대상: 히어로 연출 안내, 섹션 내비게이션, 소개 우측 설명, 소개 사진 하단 양쪽 문구, 구조 우측 설명, 제어 우측 설명 및 하단 안내, 규격 요약 아래 안내. 사용자가 표시하지 않은 적용 이미지 출처와 규격 도식 출처는 유지한다.
- 반응형 320px 이상, 키보드 접근, 기존 전역 Pretendard와 색상 체계를 유지한다.

## 콘텐츠 계약

`Product.detailContent?: ProductDetailContent | null`을 추가한다. 누락/null이면 등록 정보와 승인된 기본 프리셋을 사용한다. `version: 1`을 갖는 JSONB이며 사양 데이터는 기존 Product 필드가 유일한 원천이다.

```ts
interface ProductDetailImage { url: string; alt: string; caption?: string }
interface ProductDetailFeature { title: string; body: string }
interface ProductDetailContent {
  version: 1
  heroTitle?: string
  heroDescription?: string
  heroImage?: ProductDetailImage
  storyTitle?: string
  storyImage?: ProductDetailImage
  features?: ProductDetailFeature[]
  structureTitle?: string
  structureImages?: ProductDetailImage[]
  application?: { title: string; description?: string; image: ProductDetailImage; caption?: string }
  controlTitle?: string
  showControl?: boolean
  dimensionsTitle?: string
  showDimensions?: boolean
  dimensionImage?: ProductDetailImage
}
```

필드 제한: 제목 160자, 설명/특징 본문 2000자, 이미지 URL 2048자(HTTP(S) 또는 `/`로 시작하는 단일 루트 상대 경로), 대체텍스트 300자, 캡션 500자, 특징 최대 6개, 구조 이미지 최대 6개. 허용하지 않은 필드와 버전은 API에서 거부한다. 임의 HTML은 새 템플릿 필드에서 실행하지 않는다.

## 관리자

기존 제품 등록·수정에 재사용 가능한 상세 편집기를 추가한다. 공통 기본값 사용/직접 편집, 이미지 업로드 및 대체텍스트, 섹션 제목·특징·적용 이미지, 제어/규격 표시 설정을 제공한다. 저장 전 같은 공개 컴포넌트로 미리 본다. 기존 제품의 콘텐츠를 불러와 수정할 때 잃지 않으며 생성/수정 API 모두 새 필드를 저장한다. 기존 인증된 업로드와 관리자 중계만 사용한다.

## 제품 통합 조사

읽기 전용 공개 카탈로그 스냅샷을 보존한다. 치수·색온도·칩·수명·역률·광효율·연색성·인증·사진·설명을 비교한다. 이름이나 전력만으로 합치지 않는다. 미확인 제품은 구체적인 차이와 함께 질문한다. 통합 결정 전 레코드를 삭제하거나 옵션 배열을 무조건 합치지 않는다. 통합 구현 시 과거 주소와 견적 스냅샷을 보존하고 서로 다른 구성의 조합을 실제 공급 사양처럼 만들지 않는다.

### 확정 제품군 (2026-10-19 답변 반영)

25개 원 SKU를 보존하고 공개 제품 목록을 23개 제품군으로 표시한다. 원형직부/센서는 감사에서 기본 광원 사양 일치를 확인했고, 주차장 상시/디밍은 인증·50W 차이를 고지한 후 사용자가 통합 및 구성별 사양 보존을 승인했다. 칠판등은 사용자 답변대로 별도 유지한다.

- `round-ceiling`, 표시명 `원형 조명`: 대표/일반형 `d4705d1d-7dab-4381-b83c-9c9026efa896`, 센서형 `bc46e6f3-2dd0-4c17-bf5b-0ee5b681b538`.
- `parking-linear`, 표시명 `주차장 조명`: 대표/상시형 `492784ba-6318-4687-b877-9edde0b96b32`, 디밍형 `f6bfbddf-a3b8-4127-b352-6ba9c703e252`.

통합은 삭제/합산 갱신 대신 API 읽기 시 명시적인 검토 완료 그룹 정의로 구성한다. 새로운 미검토 제품을 이름 유사성으로 자동 병합하지 않는다. 그룹 구성원이 사라지거나 공통 치수·칩·색온도·수명·역률·광효율·연색성이 달라지면 해당 그룹 묶음을 중단한다. 원형은 인증도 공통 확인 대상이다. 주차장은 인증/전력이 구성별로 다르도록 승인되었다.

응답용 선택 필드 `Product.variantGroup?: { id: string; name: string; primaryProductId: string; variants: Array<{ label: string; product: Product }> }`. variants 안 product에는 variantGroup을 넣지 않아 재귀 직렬화를 피한다. 이 필드는 저장 DTO에 포함하지 않는다.

- 일반 GET 목록은 기존 25개 원본을 유지해 관리자와 견적 선택기 호환을 보존한다. 공개 목록만 `groupVariants=true`를 요청한다. 그룹 처리 후 페이지 수·결과 수를 계산하고, 필터는 개별 구성의 전력/인증/옵션이 함께 맞는 경우만 일치시킨다.
- 공개 단건은 해당 원본과 그룹 구성들을 반환한다. 상세에서 일반형/센서형 또는 상시형/디밍형을 선택하면 사진·모델·사양·인증·견적 ID가 모두 선택 SKU를 따른다. 기존 개별 URL에서도 선택한 구성이 열린다.
- 배열을 합쳐 모든 옵션 조합을 실제 사양으로 제시하지 않는다. 기존 제출 견적과 열린 초안의 원 ID를 삭제하지 않는다.
- 그룹 명세는 backend의 한 파일에서 관리한다. 미래 신규 그룹 자동 추론·관리자 제품군 편집은 이번 범위 밖이며 추가 검토가 필요하다.

## 검증과 문서

API DTO/저장 왕복·마이그레이션, 프런트 기본값/표시/편집 저장·사진 확대·견적 이벤트·안전한 이미지 주소·누락 사양 회귀를 검사한다. 타입 검사와 양쪽 빌드 및 공개 SEO 검사, PC/모바일 실제 브라우저로 검수한다. products/admin/quote 문서와 database-schema.md를 갱신한다. 운영 제품/운영 DB를 테스트 저장 대상으로 사용하지 않는다. 이번 요청에 배포 지시가 없으므로 별도 브랜치에서 완성하고 운영 반영 상태를 명시한다.
