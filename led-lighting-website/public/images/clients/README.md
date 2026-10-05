# 파트너 로고

홈의 `src/components/home/ClientsSection.vue`에서 사용하는 정적 에셋이다.
기존 경찰청·농협·서울시설관리공단·셀트리온·인천공항·인하대·한솥·CGV 로고를 유지하고,
2026-10-05 사용자 요청에 따라 삼성바이오로직스·앰코코리아·LH를 추가했다.

## 신규 에셋 출처

공식 사이트가 직접 사용하는 SVG를 2026-10-05에 확보했다. 상표의 권리는 각 회사에 있다.
컬러 원본을 파일로 보관하고 화면에서는 기존 파트너와 동일한 CSS 흑백 톤을 적용한다.

| 파일 | 원본 출처 | 표시 처리 |
| --- | --- | --- |
| `samsung-biologics.svg` | [삼성바이오로직스 공식 로고](https://samsungbiologics.com/resources/front/en/images/logo.svg) | 공식 SVG는 흰색/컬러 버전이 세로로 붙은 스프라이트다. 경로와 색상을 유지하고 viewBox를 `0 44 122 44`로 한정해 아래 컬러 로고만 표시한다. |
| `amkor-korea.svg` | [앰코 공식 한국 사이트의 로고](https://amkormarcomexternal.blob.core.windows.net/amkordotcom/theme-assets/Amkor-blue.svg) | 공식 컬러 SVG 그대로. 업체 이름/대체 텍스트는 앰코코리아. |
| `lh.svg` | [LH 공식 사이트의 로고](https://www.lh.or.kr/main/img/layout/logo_main_ov.svg) | 메인 헤더의 컬러 CI 그대로. 슬로건 전용 `logo_sub_ov.svg`와 구별한다. |

## 목록 갱신

1. 투명 SVG/PNG를 이 폴더에 추가한다. 파일명은 영문 소문자와 하이픈을 사용한다.
2. `ClientsSection.vue`의 기본 `clients` 목록을 갱신한다.
3. 이 출처 기록과 `docs/menus/home.md`를 함께 갱신한다.
4. 데스크톱/모바일에서 로고 로딩, 순환 경계, 정지/재생과 가로 넘침을 확인한다.

목록은 두 그룹으로 렌더링하며 두 번째는 화면의 순환 연결용이다. 보조기술에서는 원본 목록만 읽는다.
로고 로딩 실패 시 회사명을 표시하고, 동작 줄이기 설정에서는 복제본과 재생 제어를 숨기고 원본 전체를 정적인 목록으로 표시한다.
