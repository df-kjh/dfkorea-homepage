# 제품 콘텐츠 운영 기록

2026-09-06 제품 사진 40장을 Cloudflare R2에 업로드하고 운영 제품 25개에 연결했습니다. 새 소개글 25개도 관리자 화면에서 저장했습니다.

사용자 요청으로 로컬 검수·원본 복사본·보정본 이미지 171개(109,418,598바이트)를 삭제했습니다. 운영 R2 사진은 삭제하지 않았으며, 삭제 전에 새 사진 40개의 R2 URL이 운영 제품에 연결된 것을 확인했습니다.

- `product-copy/copy-map.json`: 운영에 반영한 소개글 최종본
- `product-copy/products-before.json`, `product-copy/products-after.json`: 소개글 적용 전후 공개 데이터. 이미지 URL을 포함하며 로컬 사진 파일이 필요하지 않습니다.
- `product-copy/verification.json`: 25개 설명·사양·이미지 보존 및 공개 상세 표 검증
- `product-copy/operational-ui-verification.json`: PC·모바일 화면 검증
- `product-copy/apply-ledger.json`: 소개글 적용 완료 기록
- `product-imagery/local-cleanup.json`: 삭제한 로컬 사진의 경로·크기·해시

과거 검수 기록에 남은 로컬 이미지 경로는 이력입니다. 운영 사진 변경은 관리자 제품 수정 화면에서 진행하며 새 파일은 R2에 저장됩니다.
