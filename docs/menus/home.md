# 홈

## 구현 완료

- Hero는 기존 제목·부제·CTA props, `primaryClick`/`secondaryClick` 이벤트 계약, 콘텐츠 패럴랙스·페이드, 오버레이·하단 그라데이션과 스크롤 이동 동작을 유지한다.
- Hero 배경은 25초마다 반복되는 주차장 카메라 경로와 몰드바·벽부등으로 구성된 WebGL 장면을 표시한다.
- 포인터가 가리키거나 터치로 누른 개별 조명은 기본 50%에서 100% 밝기로 전환되며, 배경 Canvas는 CTA 클릭과 세로 스크롤을 막지 않는다.
- 768 CSS px 미만에서는 픽셀 비율 1, 그림자 비활성화, 축소된 조명 수를 사용하는 모바일 품질 모드를 적용한다.
- `prefers-reduced-motion: reduce`에서는 대표 시점에 카메라를 고정하고 조명 상호작용과 렌더링은 유지한다. 실행 중 설정이 바뀌면 해당 모션 설정으로 장면을 다시 시작하되, 이미 정적 폴백으로 전환된 세션은 다시 시작하지 않는다.
- Hero가 화면 밖으로 벗어나면 WebGL 렌더링을 일시 중지하고, 다시 보이면 중단된 시점부터 재개한다. 모션 설정이 화면 밖에서 변경되면 새 controller는 Hero가 다시 보일 때까지 시작하지 않는다.
- 첫 WebGL 프레임 전과 렌더러 생성·컨텍스트·실행·초기 성능 실패 시 `parking-garage-fallback.webp` 정적 이미지를 유지한다.
- 기존 `public/videos/HeroSection.mp4` 파일은 복구 가능성을 위해 남겨 두지만 Hero 요청 경로에서는 제거했다.

## 미구현

- 실제 주차장 BIM/CAD 데이터 또는 제품별 광학 시뮬레이션과 연동하지 않는다.
- 관리 화면에서 장면 배치·카메라 경로·조명 모델을 편집하는 기능은 제공하지 않는다.

## 부족하거나 개선이 필요한 기능

- 주차장은 제품 표현과 상호작용 검증을 위한 단순화된 절차형 모델이다. 실제 시공 구조, 배광, 조도와 색 정확도를 보증하지 않는다.
- WebGL과 시작 성능 상태는 브라우저·GPU별 편차가 있으므로 배포 후 실제 대상 기기에서 정적 폴백 전환 비율을 관찰해야 한다.
- 정적 폴백은 1440 × 900 대표 시점의 장면 캡처다. 향후 모델·재질·카메라 경로가 바뀌면 같은 장면에서 다시 생성해야 한다.

## 관련 파일

- `led-lighting-website/src/components/home/HeroSection.vue`
- `led-lighting-website/src/components/home/ParkingGarageScene.vue`
- `led-lighting-website/src/components/home/parking-garage/`
- `led-lighting-website/public/images/home/parking-garage-fallback.webp`
- `led-lighting-website/public/videos/HeroSection.mp4`

## 갱신 규칙

- 홈 Hero의 콘텐츠, CTA, 스크롤, 배경 장면, 품질 정책 또는 폴백 동작을 변경할 때 이 문서를 같은 변경에서 갱신한다.
- 장면 모델이나 대표 카메라 시점을 변경하면 정적 폴백 이미지와 해당 한계 설명을 함께 갱신한다.
- 실제 하드웨어·제품 데이터 연동 범위가 바뀌면 `구현 완료`, `미구현`, `부족하거나 개선이 필요한 기능`을 함께 조정한다.
