# 제품 상세 설치 연출 이미지

2026-10-19에 built-in `image_gen`으로 생성한 제품 유형별 설치 연출 이미지 14개다. 각 이미지는 실제 등록 원본 사진을 외형 참고로 사용한 독립 생성물이다. 기존 몰드바 이미지는 변경하지 않았다.

실제 시공 현장, 인증, 안전성, 조도, 광효율 또는 하드웨어 성능의 증거로 사용하지 않는다. 제품 외형·장착·축척은 이미지의 시각적 개연성을 검토했지만 기술 도면이나 설치 지침을 대신하지 않는다. 웹 페이지에는 다음 공통 캡션을 항상 노출한다.

> AI로 생성한 설치 연출 예시이며, 실제 시공 사진이나 성능을 증명하는 자료가 아닙니다.

| 유형 키 | 이미지 | 참고 원본 |
| --- | --- | --- |
| `pipe-pendant` | [pipe-pendant-v1.png](./pipe-pendant-v1.png) | `p01-gallery-01.webp` |
| `classroom` | [classroom-v1.png](./classroom-v1.png) | `p02-gallery-01.webp` |
| `street` | [street-v1.png](./street-v1.png) | `p03-gallery-01.webp` |
| `moisture-proof` | [moisture-proof-v1.png](./moisture-proof-v1.png) | `p04-gallery-01.webp` |
| `cob-retail` | [cob-retail-v1.png](./cob-retail-v1.png) | `p05-gallery-01.webp` |
| `round-ceiling` | [round-ceiling-v1.png](./round-ceiling-v1.png) | `p06-gallery-01.webp` |
| `downlight` | [downlight-v1.png](./downlight-v1.png) | `p08-gallery-01.webp` |
| `stair-sign` | [stair-sign-v1.png](./stair-sign-v1.png) | `p09-gallery-01.webp` |
| `parking-guidance` | [parking-guidance-v1.png](./parking-guidance-v1.png) | `p10-gallery-01.webp` |
| `wall-light` | [wall-light-v1.png](./wall-light-v1.png) | `p11-gallery-02.webp` |
| `cleanroom` | [cleanroom-v1.png](./cleanroom-v1.png) | `p12-gallery-01.webp` |
| `parking-linear` | [parking-linear-v1.png](./parking-linear-v1.png) | `p14-gallery-01.webp` |
| `panel-square` | [panel-square-v1.png](./panel-square-v1.png) | `p17-gallery-01.webp` |
| `panel-linear` | [panel-linear-v1.png](./panel-linear-v1.png) | `p18-gallery-01.webp` |

참고 원본 위치: `output/product-catalog-audit-20261019/images/`.
모든 참고 원본은 생성 전에 `view_image`로 확인했다. 제품의 보이는 하우징·확산판·프레임과 설치 방식을 바탕으로 새 환경을 구성했다. 계단/주차 유도등은 원본의 브랜드/문자 대신 중립적인 화살표를 사용한다. COB는 등록 사진 중 흰색 2구 매입형을 대표로, 일반/광폭 주차장 선형은 광폭 제품을 대표로 사용한다.

공개 `manifest.json`에는 유형 키·웹 경로·참고 파일명·생성 표기·PNG 크기·SHA256만 기록한다. 전체 생성 프롬프트와 원본 경로·도구 출력 이력은 `output/product-detail-consistency-20261019/asset-prompts.json`, 검증 결과와 외형 검토 보고서는 같은 폴더의 `asset-verification.json`, `asset-report.md`에 보존한다.

모든 파일은 built-in 기본 저장 위치에서 workspace로 바이트 그대로 복사했다. 기존 파일은 덮어쓰지 않았다. PNG 14개는 약 16:9, 너비 1672px, 높이 940–941px이다.
