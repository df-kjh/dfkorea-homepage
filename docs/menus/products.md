# 제품 메뉴 기능 현황

## 구현 완료

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

- Markdown 표는 제목 행과 구분 행의 열 수가 같아야 하며, 빈 줄에서 표가 끝난다. 잘못된 구분 행과 일반 파이프 문장은 그대로 텍스트로 표시한다. 병합 셀·여러 줄 셀·중첩 Markdown을 포함하는 전체 Markdown 문법을 지원하는 편집기는 아니다.
- 빈 주소나 허용하지 않은 프로토콜의 이미지·링크 문법은 실행하지 않고 텍스트로 남긴다.
- 비율이 다른 보조 사진은 표시 높이가 서로 다를 수 있다.
- 이미지가 로딩되기 전에는 고유 비율을 알 수 없어 로딩 후 프레임 높이가 정해진다.

## 관련 파일

- `output/product-copy/copy-map.json`
- `output/product-copy/products-before.json`
- `output/product-copy/products-after.json`
- `output/product-copy/verification.json`
- `output/product-copy/operational-ui-verification.json`

- `led-lighting-website/src/components/products/ProductImageGallery.vue`
- `led-lighting-website/src/components/products/ProductImageLightbox.vue`
- `led-lighting-website/src/pages/products/[id].vue`
- `led-lighting-website/src/utils/seo.ts`
- `led-lighting-website/src/utils/seo.spec.ts`
- `led-lighting-website/src/assets/styles/product-markdown.css`
- `led-lighting-website/src/components/products/ProductDescription.vue`

## 갱신 규칙

- 제품 목록·상세·갤러리 동작을 변경할 때 기능 현황과 실제 검증 결과를 함께 갱신한다.
