# 컴포넌트화 가이드

## 프로젝트 컴포넌트 구조

### 디렉토리 구조

```
src/
├── components/
│   ├── common/           # 공통 컴포넌트
│   │   ├── BaseButton.vue
│   │   ├── BaseCard.vue
│   │   └── BaseSection.vue
│   └── home/            # 홈 페이지 전용 컴포넌트
│       ├── HeroSection.vue
│       ├── FeatureItem.vue
│       ├── ProductCard.vue
│       └── CtaSection.vue
└── views/
    ├── HomeView.vue
    ├── AboutView.vue
    ├── ProductsView.vue
    └── BlogView.vue
```

## 공통 컴포넌트 (components/common)

### 1. BaseButton.vue

재사용 가능한 버튼 컴포넌트

**Props:**

- `type`: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'text' | 'default'
- `size`: 'large' | 'default' | 'small'
- `round`: boolean (둥근 모서리)
- `circle`: boolean (원형)
- `disabled`: boolean
- `loading`: boolean
- `iconLeft`: Component (왼쪽 아이콘)
- `iconRight`: Component (오른쪽 아이콘)
- `customClass`: string

**Events:**

- `click`: 클릭 이벤트

**사용 예시:**

```vue
<BaseButton type="primary" size="large" :round="true" :icon-left="ArrowRight" @click="handleClick">
  제품 보기
</BaseButton>
```

### 2. BaseCard.vue

재사용 가능한 카드 컴포넌트

**Props:**

- `shadow`: 'always' | 'hover' | 'never'
- `hoverable`: boolean (호버 효과)
- `clickable`: boolean (클릭 가능)
- `bodyStyle`: Record<string, string> (body 스타일)
- `customClass`: string

**Slots:**

- `header`: 헤더 영역
- `default`: 본문 영역
- `footer`: 푸터 영역

**Events:**

- `click`: 클릭 이벤트

**사용 예시:**

```vue
<BaseCard :hoverable="true" :clickable="true" @click="handleClick">
  <template #header>
    <h3>제목</h3>
  </template>
  <p>내용</p>
  <template #footer>
    <button>더보기</button>
  </template>
</BaseCard>
```

### 3. BaseSection.vue

재사용 가능한 섹션 컴포넌트

**Props:**

- `title`: string (섹션 제목)
- `subtitle`: string (섹션 부제목)
- `bgColor`: 'white' | 'gray' | 'transparent'
- `maxWidth`: string (최대 너비, 기본: '1200px')
- `customClass`: string
- `customStyle`: Record<string, string>

**Slots:**

- `header`: 헤더 영역 (title, subtitle 대신 사용 가능)
- `default`: 본문 영역
- `footer`: 푸터 영역

**사용 예시:**

```vue
<BaseSection title="주요 제품" subtitle="다양한 LED 조명 솔루션" bg-color="gray">
  <div>콘텐츠</div>
  <template #footer>
    <BaseButton>더보기</BaseButton>
  </template>
</BaseSection>
```

## 페이지별 컴포넌트 (components/home)

### 1. HeroSection.vue

메인 히어로 섹션 컴포넌트

**Events:**

- `productsClick`: 제품 보기 버튼 클릭

**사용 예시:**

```vue
<HeroSection @products-click="navigateTo('/products')" />
```

### 2. FeatureItem.vue

특징 아이템 컴포넌트

**Props:**

- `icon`: Component (아이콘 컴포넌트)
- `title`: string (제목)
- `description`: string (설명)
- `reverse`: boolean (좌우 반전 레이아웃)
- `iconGradient`: string (아이콘 배경 그라디언트)

**사용 예시:**

```vue
<FeatureItem
  :icon="Lightning"
  title="에너지 효율"
  description="최대 80% 전력 절감"
  icon-gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
/>
```

### 3. ProductCard.vue

제품 카드 컴포넌트

**Props:**

- `id`: number
- `name`: string (제품명)
- `description`: string (설명)
- `image`: string (이미지 URL)

**Events:**

- `click`: 카드 클릭 (제품 ID 전달)

**사용 예시:**

```vue
<ProductCard
  :id="1"
  name="LED 천장 조명"
  description="고효율 실내 조명"
  image="/images/product1.jpg"
  @click="handleProductClick"
/>
```

### 4. CtaSection.vue

CTA(Call To Action) 섹션 컴포넌트

**Props:**

- `title`: string (기본값: '프로젝트 상담이\n필요하신가요?')
- `description`: string
- `buttonText`: string (기본값: '상담 문의하기')

**Events:**

- `ctaClick`: CTA 버튼 클릭

**사용 예시:**

```vue
<CtaSection @cta-click="handleConsultation" />
```

## 컴포넌트화 원칙

### 1. 재사용성

- 공통으로 사용되는 UI 요소는 `components/common`에 위치
- 특정 페이지에서만 사용되는 컴포넌트는 해당 페이지 폴더에 위치

### 2. Props와 Events

- Props로 데이터 전달
- Events로 상위 컴포넌트와 통신
- TypeScript 인터페이스로 타입 정의

### 3. 스타일링

- Scoped CSS 사용
- CSS 변수로 테마 관리
- 반응형 디자인 적용

### 4. 네이밍 컨벤션

- 공통 컴포넌트: `Base` 접두사 (BaseButton, BaseCard)
- 페이지 컴포넌트: 명확한 역할 표시 (HeroSection, ProductCard)
- PascalCase 사용

## HomeView 리팩토링 예시

### Before (비컴포넌트화)

```vue
<template>
  <div class="home">
    <section class="hero">
      <div class="hero-content">
        <h1>미래를 밝히는 LED 조명</h1>
        <p>혁신적인 기술로...</p>
        <el-button>제품 보기</el-button>
      </div>
    </section>

    <section class="features">
      <div class="feature-item">
        <div class="feature-icon">...</div>
        <h2>에너지 효율</h2>
        <p>최대 80%...</p>
      </div>
      <!-- 반복되는 코드 -->
    </section>
  </div>
</template>
```

### After (컴포넌트화)

```vue
<template>
  <div class="home">
    <HeroSection @products-click="navigateTo('/products')" />

    <BaseSection bg-color="white">
      <FeatureItem :icon="Lightning" title="에너지 효율" description="최대 80% 전력 절감" />
      <FeatureItem :icon="Clock" title="긴 수명" description="50,000시간 이상" :reverse="true" />
    </BaseSection>
  </div>
</template>

<script setup lang="ts">
import HeroSection from '@/components/home/HeroSection.vue'
import FeatureItem from '@/components/home/FeatureItem.vue'
import BaseSection from '@/components/common/BaseSection.vue'
</script>
```

## 장점

### 1. 코드 재사용성

- 동일한 UI 요소를 여러 곳에서 일관되게 사용
- 중복 코드 제거

### 2. 유지보수성

- 컴포넌트별로 독립적인 수정 가능
- 버그 수정이 용이

### 3. 테스트 용이성

- 각 컴포넌트를 독립적으로 테스트
- 단위 테스트 작성 간편

### 4. 확장성

- 새로운 기능 추가 시 기존 코드 영향 최소화
- 컴포넌트 조합으로 새로운 UI 구성

### 5. 협업 효율성

- 역할 분담이 명확
- 컴포넌트 단위로 작업 가능

## 다음 단계

### 1. 나머지 페이지 컴포넌트화

- AboutView.vue → `components/about/`
- ProductsView.vue → `components/products/`
- BlogView.vue → `components/blog/`

### 2. 추가 공통 컴포넌트

- BaseInput.vue (입력 필드)
- BaseModal.vue (모달/다이얼로그)
- BasePagination.vue (페이지네이션)
- BaseLoading.vue (로딩 스피너)

### 3. Composables 확장

- useAnimation.ts (애니메이션 로직)
- useForm.ts (폼 검증)
- useFetch.ts (API 호출)

## 참고사항

- 모든 컴포넌트는 TypeScript로 작성
- Props와 Events는 명확한 타입 정의
- 스크롤 애니메이션은 Intersection Observer API 사용
- 다크모드와 반응형 디자인 지원
- Element Plus 컴포넌트와의 호환성 유지
