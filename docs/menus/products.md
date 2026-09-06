# 제품 메뉴 기능 현황

## 구현 완료

- 2026-09-06 견적 위젯 후속 개선을 `7a7d7d3`으로 운영 반영했다. Railway SUCCESS·Vercel READY 및 실제 홈페이지의 PC 기본 확대/축소, 모바일 아이콘 전용 런처와 페이지 위로 버튼에 따른 위치를 확인했다.

- 2026-09-06 온라인 견적 관련 변경을 운영 배포하고 실제 도메인에서 확인했다. 홈의 PC·모바일 견적 창과 제품명/소비전력 필터를 검증했다.

- 제품 목록에서 제품명·모델명 검색과 실제 카탈로그 기반 카테고리·소비전력·인증·색온도·옵션 필터를 제공한다. 같은 필터 안은 OR, 필터 사이는 AND로 전체 데이터를 필터링한 후 페이지를 나눈다.
- 제품 목록의 사양 필터는 검색창 오른쪽 필터 버튼에서 연다. PC에서는 버튼 아래 팝오버, 모바일에서는 하단 플로팅 패널로 표시하며 소비전력·인증·색온도·옵션을 임시 선택한 뒤 `필터 적용`을 눌러 한 번에 반영한다. 적용 전에는 현재 목록을 유지하고, 적용된 조건 수 배지·조건 칩·초기화·바깥 클릭·ESC 닫기와 포커스 복귀를 제공한다.
- 모바일 필터 패널은 온라인 견적 및 페이지 위로 플로팅 버튼 전체 높이를 비워 주요 동작 버튼이 겹치지 않게 한다.
- 제품 목록과 견적 선택기는 공통 사양 필터를 사용한다. 선택 조건 제거, 검색 조건 초기화, 결과 수, 검색 실패 재시도를 지원하며 오래된 응답은 현재 검색 결과를 덮어쓰지 않는다.
- 견적 선택기의 ‘사양 선택’을 누르면 희망 사양 제목에 포커스를 주고 견적 본문 내부에서 즉시 보이게 한다. 취소는 선택한 제품 버튼으로 돌아가며 사양 입력 중에는 요청 확인 단계로 넘어가지 않는다. 담기 완료 후 품목 요약으로 이동하고 제품 검색 영역에서 계속 제품을 추가할 수 있다. 직접 입력 내용도 검색 복귀 시 유지한다.
- 견적 ‘제품 더 보기’와 제품 페이지 무한 스크롤은 추가 요청 중 기존 결과 DOM을 유지한다. 하단에 로딩·오류·재시도만 표시하고 중복 추가 요청을 막는다. 실패 재시도는 다음 페이지를 다시 받아 기존 결과에 이어 붙이며, 필터 변경 전 응답은 무시한다. 견적 본문 및 제품 페이지의 자동 스크롤 앵커를 끄고 사용자 스크롤을 요청 시작 위치로 되돌리지 않는다.
- 제품 상세의 `견적에 담기`는 PC 우측 제품 요약 사양 바로 아래에 장바구니 아이콘과 함께 표시하고, 모바일에서는 제품 정보 다음에 이어서 표시한다. 해당 제품을 상담 후 결정 사양·수량 1개로 담고 기업 정보 단계에서 전역 견적 창을 연다. 같은 사양은 합산되며 견적 선택기에서는 소비전력·색온도·희망 옵션·필요한 인증을 선택해 별도 품목으로 담을 수 있다.

- 2026-09-06 사용자 요청으로 로컬 검수 사진 171개(약 104.3MiB)를 삭제했다. 운영 R2 사진은 유지하며, 최종 소개글·공개 제품 데이터·검증·삭제 기록을 `output/PRODUCT-CONTENT-README.md`에 정리했다. 과거 검수 파일 경로는 이력으로만 남는다.

- 2026-09-06 운영 제품 25개의 소개글을 제품별 쓰임새·선택 포인트·사양표·문의 안내로 다시 작성했다. 과장·미확인 성능 및 보증 표현을 제거했으며, 제품 사양과 사진 46개·기존 상세 기술 이미지 URL 8개는 보존했다.
- 소개글과 표 수정은 운영에 반영했다. 25개 공개 상세 페이지 모두 새 제목과 실제 표를 확인했고, API 설명도 확정본과 25/25 일치한다. 운영 1280px·390px에서 표와 새 소개글을 확인했으며 긴 모델명 표도 페이지 가로 넘침이 없다. COB 상세 자료 이미지 5개의 로딩을 확인했다. 배포 ID: `dpl_F93JpL7M912DNNKdE2C5oueeUusA`, 코드 커밋: `ac23993`.

- 2026-09-06 제품 소개의 Markdown 표를 실제 `table`·`thead`·`tbody`·열 제목으로 렌더링한다. 외곽 파이프 생략, 열 정렬, 이스케이프 파이프와 인라인 코드를 지원하며, 좁은 화면에서는 표 영역만 가로로 스크롤할 수 있다.
- 제품 소개에 저장된 기술 자료 이미지와 참조 링크를 표시한다. HTTP(S) 및 루트 상대 경로만 허용하고, 원시 HTML과 속성 문자는 이스케이프하여 기존 보안 경계를 유지한다.
- 실제 PIPE 소개 표의 첫 구간으로 문제를 재현한 뒤 회귀 테스트를 추가했다. 표·일반 문장 구분, 셀 수 보정, 정렬, HTML 이스케이프, 안전한 이미지·링크에 대한 17개 테스트와 타입 검사를 통과했다. 표 다음의 제목·목록에 파이프가 포함된 경우에도 별도 문단 구조를 유지한다.
- 위 표 렌더링 변경의 운영 빌드와 G2B 릴레이 아티팩트 검사도 통과했다. 운영 적용 및 실제 화면 검수를 완료했다.

- 2026-09-06 프레임 수정을 운영 도메인 `dfkorealed.com`에 배포했다. 운영 1440px·390px에서 사진·도면의 프레임 추가 높이 0px, 원래 비율 유지와 모바일 확대 보기 열기·닫기를 검증했다. 배포 ID: `dpl_4peeNws9QgQkVZwyj2MuLxu2Sb3P`.

- 제품 목록에서 제품 사진과 사양을 확인하고 상세 페이지로 이동할 수 있다.
- 상세 대표 사진과 보조 사진의 프레임 높이는 각 이미지의 원래 비율에 맞춰 자동으로 결정된다. 고정 4:5·정사각형 프레임 때문에 생기던 흰 여백을 제거하며, 원본 사진과 도면 전체를 표시한다.
- 사진 설명과 이미지 클릭 시 확대 보기 기능을 유지한다.
- 타입 검사와 운영 빌드를 통과했다. 1440px·390px에서 대표·보조 사진 프레임의 추가 높이가 0px이며 원본 비율이 유지되는 것을 확인했다. 1856×809 도면도 고정 비율 없이 표시되고 모바일 확대 보기 열기·닫기가 정상 동작한다.

## 미구현

- 사진 자체에 포함된 배경을 자동으로 잘라내는 기능은 제공하지 않는다.

## 부족하거나 개선이 필요한 기능

- 사양 전환 및 추가 로딩 개선은 회귀 테스트·타입 검사와 로컬 PC·모바일 브라우저 검수를 통과했다. 운영 반영 여부는 별도 확인한다. 네트워크 실패 테스트는 모의 응답으로 검증하며 실제 국세청·메일 검증과 구분한다.

- 제품의 전력·색온도·인증 배열은 실제 판매 가능한 모든 조합을 보증하지 않는다. 견적 선택 사양과 필요한 인증의 공급 가능 여부는 담당자 검토 대상이다.
- 온라인 견적의 실제 사업자 확인·메일 첨부 수신 운영 검증은 설정과 승인된 검증 정보가 필요하며 [온라인 견적 문서](quote.md)에 한계를 기록한다.

- Markdown 표는 제목 행과 구분 행의 열 수가 같아야 하며, 빈 줄에서 표가 끝난다. 잘못된 구분 행과 일반 파이프 문장은 그대로 텍스트로 표시한다. 병합 셀·여러 줄 셀·중첩 Markdown을 포함하는 전체 Markdown 문법을 지원하는 편집기는 아니다.
- 빈 주소나 허용하지 않은 프로토콜의 이미지·링크 문법은 실행하지 않고 텍스트로 남긴다.
- 비율이 다른 보조 사진은 표시 높이가 서로 다를 수 있다.
- 이미지가 로딩되기 전에는 고유 비율을 알 수 없어 로딩 후 프레임 높이가 정해진다.

## 관련 파일

- `led-lighting-website/src/views/ProductsView.vue`
- `led-lighting-website/src/components/products/ProductsHeader.vue`
- `led-lighting-website/src/components/products/ProductFilterPopover.vue`
- `led-lighting-website/src/components/products/ProductFilterPopover.spec.ts`
- `led-lighting-website/src/components/common/quote/ProductFilters.vue`
- `led-lighting-website/src/components/quote/ProductPicker.vue`
- `led-lighting-website/src/components/quote/CatalogSpecification.vue`
- `led-lighting-website/src/components/quote/ProductStep.vue`
- `led-lighting-website/src/components/quote/quote-focus.ts`
- `led-lighting-website/src/components/quote/ProductPicker.spec.ts`
- `led-lighting-website/src/views/ProductsView.spec.ts`
- `led-lighting-website/src/views/ProductsView.infinite.spec.ts`
- `led-lighting-website/src/composables/useQuoteDraft.ts`
- `dfkorea-backend/src/products/products.controller.ts`
- `dfkorea-backend/src/products/products.service.ts`
- `docs/menus/quote.md`

- `output/product-copy/copy-map.json`
- `output/product-copy/products-before.json`
- `output/product-copy/products-after.json`
- `output/product-copy/verification.json`
- `output/product-copy/operational-ui-verification.json`

- `led-lighting-website/src/components/products/ProductImageGallery.vue`
- `led-lighting-website/src/components/products/ProductImageLightbox.vue`
- `led-lighting-website/src/components/products/ProductInfo.vue`
- `led-lighting-website/src/components/products/ProductInfo.spec.ts`
- `led-lighting-website/src/pages/products/[id].vue`
- `led-lighting-website/src/utils/seo.ts`
- `led-lighting-website/src/utils/seo.spec.ts`
- `led-lighting-website/src/assets/styles/product-markdown.css`
- `led-lighting-website/src/components/products/ProductDescription.vue`

## 갱신 규칙

- 검색 필터·페이지 처리·견적 담기 진입점 또는 선택 사양이 바뀌면 온라인 견적 문서와 함께 갱신한다.

- 제품 목록·상세·갤러리 동작을 변경할 때 기능 현황과 실제 검증 결과를 함께 갱신한다.
