# 모바일 반응형 최적화 가이드

## 개요

이 웹사이트는 모바일 퍼스트(Mobile First) 접근 방식으로 설계되어 모든 디바이스에서 완벽하게 작동합니다.

## 브레이크포인트

### 정의된 브레이크포인트

```typescript
{
  xs: 480px,   // 매우 작은 모바일
  sm: 768px,   // 모바일
  md: 992px,   // 태블릿
  lg: 1200px,  // 데스크톱
  xl: 1920px   // 대형 데스크톱
}
```

### 디바이스 분류

- **모바일**: < 768px
- **태블릿**: 768px ~ 991px
- **데스크톱**: ≥ 992px

## 주요 최적화 사항

### 1. 헤더 (Header)

#### 모바일 (< 768px)

- 높이: 56px (데스크톱: 70px)
- 패딩: 12px (데스크톱: 20px)
- 로고 크기: 24px (데스크톱: 30px)
- 햄버거 메뉴 표시
- 다크모드 토글 버튼 크기 축소

#### 기능

- 992px 이하에서 데스크톱 메뉴 숨김
- 모바일 드로어 메뉴 표시
- 반응형 아이콘 크기

### 2. 메인 페이지 (HomeView)

#### Hero 섹션

- **모바일**:
  - 패딩: 40px 15px
  - 제목: 1.5rem
  - 버튼: 100% 너비
- **태블릿**:
  - 패딩: 80px 20px
  - 제목: 2.5rem
- **데스크톱**:
  - 패딩: 120px 20px
  - 제목: 3.5rem

#### 특징 카드

- **모바일**: 1열 (24/24)
- **태블릿**: 2열 (12/24)
- **데스크톱**: 3열 (8/24)

#### 제품 미리보기

- **모바일**: 1열 (24/24)
- **태블릿**: 2열 (12/24)
- **데스크톱**: 4열 (6/24)

### 3. 회사 소개 (AboutView)

#### 통계 정보

- **모바일**: 세로 정렬 (flex-direction: column)
- **데스크톱**: 가로 정렬 (flex-direction: row)

#### 핵심 가치 카드

- **모바일**: 1열
- **태블릿**: 2열
- **데스크톱**: 4열

#### 인증 배지

- **모바일**: 2열 (12/24)
- **태블릿**: 3열 (8/24)
- **데스크톱**: 6열 (4/24)

### 4. 제품 소개 (ProductsView)

#### 필터 섹션

- **모바일**:
  - flex-wrap 활성화
  - 버튼 패딩 축소
  - 가로 스크롤 방지

#### 제품 그리드

- **모바일**: 1열 (24/24)
- **태블릿**: 2열 (12/24)
- **데스크톱**: 4열 (6/24)

#### 제품 상세 다이얼로그

- **모바일**: 95% 너비
- **480px 이하**: 98% 너비
- 버튼 100% 너비 (세로 정렬)

### 5. 회사 소식 (BlogView)

#### 검색 필터

- **모바일**:
  - 각 항목 100% 너비
  - 세로 정렬

#### 블로그 그리드

- **모바일**: 1열 (24/24)
- **태블릿**: 2열 (12/24)
- **데스크톱**: 3열 (8/24)

#### 페이지네이션

- **모바일**:
  - flex-wrap 활성화
  - 중앙 정렬

## useResponsive Composable

### 사용 방법

```typescript
import { useResponsive } from '@/composables/useResponsive'

const { isMobile, isTablet, isDesktop, windowWidth, currentBreakpoint } = useResponsive()
```

### 제공되는 기능

#### 반응형 플래그

- `isMobile`: < 768px
- `isTablet`: 768px ~ 991px
- `isDesktop`: ≥ 992px
- `isLargeDesktop`: ≥ 1200px
- `isExtraLarge`: ≥ 1920px

#### 윈도우 정보

- `windowWidth`: 현재 윈도우 너비
- `windowHeight`: 현재 윈도우 높이

#### 디바이스 정보

- `isTouchDevice`: 터치 디바이스 여부
- `isPortrait`: 세로 모드 여부
- `isLandscape`: 가로 모드 여부

#### 유틸리티 함수

- `isSmallerThan(breakpoint)`: 특정 브레이크포인트보다 작은지
- `isLargerThan(breakpoint)`: 특정 브레이크포인트보다 큰지

## 모바일 최적화 체크리스트

### ✅ 완료된 항목

- [x] Viewport 메타 태그 설정
- [x] 터치 친화적 버튼 크기 (최소 44x44px)
- [x] 반응형 이미지
- [x] 모바일 네비게이션 (햄버거 메뉴)
- [x] 반응형 타이포그래피
- [x] 반응형 그리드 레이아웃
- [x] 터치 스크롤 최적화
- [x] iOS zoom 방지 (input font-size 16px)
- [x] 가로 스크롤 방지
- [x] 다크모드 모바일 지원
- [x] Element Plus 컴포넌트 반응형 설정

### 🎯 모바일 UX 개선 사항

1. **터치 타겟**
   - 최소 크기: 44x44px
   - 충분한 간격: 8px 이상

2. **입력 필드**
   - font-size: 16px (iOS zoom 방지)
   - 자동 완성 지원

3. **네비게이션**
   - 햄버거 메뉴
   - 드로어 형식
   - 쉬운 닫기

4. **콘텐츠**
   - 적절한 줄 간격
   - 읽기 쉬운 폰트 크기
   - 스크롤 최적화

5. **성능**
   - 디바운스된 resize 이벤트
   - 최적화된 이미지
   - 레이지 로딩 준비

## 테스트 가이드

### 테스트해야 할 디바이스

1. **모바일**
   - iPhone SE (375px)
   - iPhone 12/13/14 (390px)
   - iPhone 14 Pro Max (430px)
   - Samsung Galaxy S21 (360px)

2. **태블릿**
   - iPad Mini (768px)
   - iPad Air (820px)
   - iPad Pro 11" (834px)
   - iPad Pro 12.9" (1024px)

3. **데스크톱**
   - MacBook Air (1280px)
   - MacBook Pro 16" (1728px)
   - iMac 27" (2560px)

### Chrome DevTools 테스트

1. 개발자 도구 열기 (F12)
2. 디바이스 툴바 토글 (Ctrl+Shift+M)
3. 다양한 디바이스로 테스트
4. 가로/세로 모드 전환 테스트
5. 터치 시뮬레이션 활성화

### 테스트 체크리스트

- [ ] 모든 페이지가 가로 스크롤 없이 표시됨
- [ ] 버튼과 링크가 쉽게 클릭 가능
- [ ] 텍스트가 읽기 쉬움
- [ ] 이미지가 적절히 리사이즈됨
- [ ] 네비게이션이 직관적임
- [ ] 폼 입력이 편리함
- [ ] 다크모드가 정상 작동함

## 성능 최적화

### 이미지 최적화

```html
<!-- 반응형 이미지 예시 -->
<img
  src="image-small.jpg"
  srcset="image-small.jpg 480w, image-medium.jpg 768w, image-large.jpg 1200w"
  sizes="(max-width: 480px) 100vw,
         (max-width: 768px) 80vw,
         1200px"
  alt="설명"
/>
```

### CSS 최적화

- transform 사용으로 GPU 가속
- will-change 신중하게 사용
- 불필요한 transition 제거

### JavaScript 최적화

- 디바운스/쓰로틀 사용
- 이벤트 리스너 정리
- 메모리 누수 방지

## 문제 해결

### 가로 스크롤 발생 시

```css
* {
  max-width: 100%;
  overflow-x: hidden;
}
```

### iOS 입력 필드 줌 발생 시

```css
input,
textarea,
select {
  font-size: 16px;
}
```

### 터치 스크롤 버벅임

```css
* {
  -webkit-overflow-scrolling: touch;
}
```

## 추가 개선 계획

- [ ] PWA 지원
- [ ] 오프라인 모드
- [ ] 푸시 알림
- [ ] 앱 설치 배너
- [ ] 스켈레톤 스크린
- [ ] 무한 스크롤
- [ ] 풀 스크린 API
