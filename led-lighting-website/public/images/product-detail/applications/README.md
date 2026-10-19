# 제품 상세 설치 연출 이미지

2026-10-19에 built-in `image_gen`으로 생성한 제품 유형별 설치 연출 이미지다. 현재 공통 상세는 수정본 v2 6개와 기존 v1 8개를 사용한다. 실제 등록 원본 사진을 외형 참고로 사용했으며 이전 v1 파일 14개와 기존 몰드바 이미지는 보존했다.

실제 시공 현장, 인증, 안전성, 조도, 광효율 또는 하드웨어 성능의 증거로 사용하지 않는다. 제품 외형·장착·축척은 이미지의 시각적 개연성을 검토했지만 기술 도면이나 설치 지침을 대신하지 않는다. 사용자 주석에 따라 웹 페이지의 자동 안내 문구는 표시하지 않으며 이미지 대체텍스트와 이 출처 기록은 보존한다. 관리자가 명시적으로 작성한 별도 캡션은 기존 동작을 유지한다.

| 유형 키 | 이미지 | 참고 원본 |
| --- | --- | --- |
| `pipe-pendant` | [pipe-pendant-v2.png](./pipe-pendant-v2.png) | `p01-gallery-01.webp` |
| `classroom` | [classroom-v2.png](./classroom-v2.png) | `p02-gallery-01.webp` |
| `street` | [street-v2.png](./street-v2.png) | `p03-gallery-01.webp` |
| `moisture-proof` | [moisture-proof-v1.png](./moisture-proof-v1.png) | `p04-gallery-01.webp` |
| `cob-retail` | [cob-retail-v1.png](./cob-retail-v1.png) | `p05-gallery-01.webp` |
| `round-ceiling` | [round-ceiling-v1.png](./round-ceiling-v1.png) | `p06-gallery-01.webp` |
| `downlight` | [downlight-v1.png](./downlight-v1.png) | `p08-gallery-01.webp` |
| `stair-sign` | [stair-sign-v1.png](./stair-sign-v1.png) | `p09-gallery-01.webp` |
| `parking-guidance` | [parking-guidance-v2.png](./parking-guidance-v2.png) | `p10-gallery-01.webp` |
| `wall-light` | [wall-light-v2.png](./wall-light-v2.png) | `p11-gallery-02.webp` |
| `cleanroom` | [cleanroom-v2.png](./cleanroom-v2.png) | `p12-gallery-01.webp` |
| `parking-linear` | [parking-linear-v1.png](./parking-linear-v1.png) | `p14-gallery-01.webp` |
| `panel-square` | [panel-square-v1.png](./panel-square-v1.png) | `p17-gallery-01.webp` |
| `panel-linear` | [panel-linear-v1.png](./panel-linear-v1.png) | `p18-gallery-01.webp` |

참고 원본 위치: `output/product-catalog-audit-20261019/images/`.
모든 참고 원본은 생성 전에 `view_image`로 확인했다. 제품의 보이는 하우징·확산판·프레임과 설치 방식을 바탕으로 새 환경을 구성했다. 계단표시등은 중립적인 화살표를 사용하고, 차량유도등 v2에는 `주차장`, `PARKING`, 우측 방향 화살표를 표시한다. 이 표기는 이미지 속 연출이며 현장에 필요한 표기와 설치 방향은 별도로 확인한다. COB는 등록 사진 중 흰색 2구 매입형을 대표로, 일반/광폭 주차장 선형은 광폭 제품을 대표로 사용한다.

공개 `manifest.json`에는 현재 사용하는 14개 파일의 유형 키·웹 경로·참고 파일명·생성 표기·PNG 크기·SHA256만 기록한다. 전체 생성 프롬프트와 원본 경로·도구 출력 이력은 공개 정적 파일 밖의 작업 기록인 `output/product-detail-consistency-20261019/`와 `output/product-detail-feedback-20261019/{images-a,images-b}/`에 보존한다. 공개 메타데이터에는 개인 경로나 전체 프롬프트를 포함하지 않는다.

v2 수정 범위는 칠판등의 벽 밀착 고정판·하향 조사 연출, 파이프 펜던트의 주차장 환경, 가로등의 수직 기둥·수평 등기구와 주변 대비 비율, 차량유도등의 글씨, 벽부등의 차량 램프 환경, 크린룸 조명의 매끈한 엔드캡 표현이다. 그림에 나타난 고정·비율·엔드캡은 실제 시공 규격이나 제품 성능을 증명하지 않는다.

모든 파일은 built-in 기본 저장 위치에서 workspace로 바이트 그대로 복사했다. 기존 파일은 덮어쓰지 않았다. 현재 사용하는 PNG 14개는 약 16:9, 너비 1672px, 높이 940–941px이다.
