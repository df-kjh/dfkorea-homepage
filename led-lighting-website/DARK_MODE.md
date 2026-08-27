# 다크모드 사용 가이드

## 개요

이 웹사이트는 사용자 경험을 향상시키기 위해 라이트 모드와 다크 모드를 지원합니다.

## 기능

### 자동 감지

- 웹사이트를 처음 방문하면 시스템 설정을 자동으로 감지합니다
- macOS, Windows, Linux 등 모든 운영체제의 다크모드 설정을 인식합니다

### 수동 전환

- **데스크톱**: 헤더 우측의 해/달 아이콘 버튼을 클릭하여 전환
- **모바일**: 햄버거 메뉴를 열고 하단의 다크모드 스위치를 사용

### 설정 저장

- 사용자가 선택한 테마 설정은 브라우저의 로컬 저장소에 저장됩니다
- 다음 방문 시 마지막으로 선택한 테마가 자동으로 적용됩니다

## 기술적 구현

### 상태 관리

- Pinia 스토어를 사용하여 전역 테마 상태 관리
- `stores/theme.ts`에서 테마 로직 관리

### CSS 변수

- Element Plus 다크 테마 CSS 변수 사용
- 커스텀 다크모드 스타일은 `assets/dark-mode.css`에 정의

### 실시간 감지

- `window.matchMedia('(prefers-color-scheme: dark)')` API 사용
- 시스템 테마 변경 시 실시간으로 반영 (auto 모드 선택 시)

## 사용자 인터페이스

### 라이트 모드

- 밝은 배경색 (#ffffff)
- 어두운 텍스트 (#303133)
- 부드러운 그림자 효과

### 다크 모드

- 어두운 배경색 (#1a1a1a)
- 밝은 텍스트 (#e5eaf3)
- 강조된 경계선과 구분선
- 눈의 피로를 줄이는 색상 팔레트

## 호환성

- 모든 Element Plus 컴포넌트 완벽 지원
- 모든 페이지에서 일관된 테마 적용
- 부드러운 전환 애니메이션 (0.3초)

## 코드 예제

### 테마 스토어 사용

```typescript
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()

// 테마 토글
themeStore.toggleTheme()

// 특정 테마 설정
themeStore.setTheme('dark') // 'light', 'dark', 'auto'

// 현재 다크모드 여부 확인
console.log(themeStore.isDark)
```

### 컴포넌트에서 사용

```vue
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()
const { isDark } = storeToRefs(themeStore)
</script>

<template>
  <div :class="{ 'dark-content': isDark }">
    <!-- 내용 -->
  </div>
</template>
```

## 문제 해결

### 테마가 적용되지 않는 경우

1. 브라우저 캐시를 지워보세요
2. 로컬 저장소를 확인하세요 (`localStorage.getItem('theme')`)
3. 개발자 도구에서 `html` 태그에 `dark` 클래스가 적용되었는지 확인하세요

### 시스템 테마 감지가 작동하지 않는 경우

- 브라우저가 `prefers-color-scheme` 미디어 쿼리를 지원하는지 확인하세요
- 최신 브라우저 버전으로 업데이트하세요
