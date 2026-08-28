# LED 조명 회사 웹사이트

Vue 3 + TypeScript + Tailwind CSS로 제작된 모던한 LED 조명 회사 웹사이트입니다.

## 📚 배포 가이드

- [Vercel 배포 설정](./VERCEL_SETUP.md) - Vercel 환경 변수 설정 방법
- [전체 배포 가이드](../DEPLOYMENT.md) - Docker, 수동 배포 등 전체 가이드

전체 서비스를 배포할 때 백엔드는 PostgreSQL을 먼저 프로비저닝하고 compiled migration 실패 시 시작을 중단하는 `npm run migration:run:prod && npm run start:prod`를 사용합니다.

## 🌟 주요 기능

### 페이지 구성

1. **메인 페이지** - 회사 소개 및 주요 기능 강조
2. **회사 소개 및 연혁** - 회사 비전, 핵심 가치, 연혁 타임라인
3. **제품 소개** - 카테고리별 제품 필터링 및 상세 정보
4. **회사 소식** - 블로그 형식의 게시판 (검색 및 카테고리 필터)

### 특별 기능

- **🌓 다크모드**: 라이트/다크 모드 지원
  - 헤더 우측 토글 버튼으로 전환
  - 시스템 설정에 따라 자동 감지
  - 사용자 설정 로컬 저장소에 저장
  - Element Plus 다크 테마 완벽 연동

## 🛠 기술 스택

- **프론트엔드**: Vue 3 (Composition API)
- **언어**: TypeScript
- **UI 라이브러리**: Element Plus
- **라우팅**: Vue Router
- **상태 관리**: Pinia
- **빌드 도구**: Vite
- **코드 품질**: ESLint + Prettier

## 📦 설치 및 실행

### 필수 요구사항

- Node.js 22.12.0 이상
- npm 또는 yarn

### 설치

```sh
npm install
```

### 개발 서버 실행

```sh
npm run dev
```

개발 서버는 [http://localhost:5173](http://localhost:5173)에서 실행됩니다.

### 프로덕션 빌드

```sh
npm run build
```

### 빌드 미리보기

```sh
npm run preview
```

### 코드 린팅

```sh
npm run lint
```

### 코드 포맷팅

```sh
npm run format
```

## 📁 프로젝트 구조

```
led-lighting-website/
├── public/              # 정적 파일
├── src/
│   ├── assets/         # 이미지, 스타일 등
│   ├── components/     # 재사용 가능한 컴포넌트
│   ├── router/         # 라우팅 설정
│   ├── stores/         # Pinia 스토어
│   ├── views/          # 페이지 컴포넌트
│   │   ├── HomeView.vue        # 메인 페이지
│   │   ├── AboutView.vue       # 회사 소개
│   │   ├── ProductsView.vue    # 제품 소개
│   │   └── BlogView.vue        # 회사 소식
│   ├── App.vue         # 루트 컴포넌트
│   └── main.ts         # 앱 진입점
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 🎨 디자인 특징

- **모던 UI**: Element Plus의 세련된 컴포넌트 활용
- **반응형 디자인**: 모바일, 태블릿, 데스크톱 모두 지원
- **그라데이션 효과**: 현대적인 색상 그라데이션 적용
- **부드러운 애니메이션**: Hover 효과 및 페이지 전환 애니메이션
- **직관적인 네비게이션**: 고정 헤더 및 모바일 드로어 메뉴

## 📄 페이지 설명

### 메인 페이지 (/)

- Hero 섹션: 강력한 첫인상과 CTA 버튼
- 주요 특징: 에너지 효율, 긴 수명, 고품질 강조
- 제품 미리보기: 주요 제품 4개 카드 형식으로 표시
- CTA 섹션: 상담 문의 유도

### 회사 소개 (/about)

- 회사 비전 및 소개
- 통계 정보: 경험, 프로젝트 수, 고객 만족도
- 핵심 가치: 혁신, 품질, 고객 중심, 지속가능성
- 연혁 타임라인: 2010년부터 현재까지
- 인증 및 수상

### 제품 소개 (/products)

- 카테고리 필터: 전체, 실내용, 실외용, 산업용, 스마트 조명
- 제품 그리드: 반응형 카드 레이아웃
- 제품 상세 다이얼로그: 제품 사양 및 이미지
- 견적 문의 기능

### 회사 소식 (/blog)

- 카테고리 필터: 제품 소식, 프로젝트, 기술 & 혁신, 이벤트
- 검색 기능: 제목 및 내용 검색
- 블로그 그리드: 카드 형식의 게시글
- 게시글 상세 다이얼로그: 전체 내용 및 공유 기능
- 페이지네이션

## 🚀 향후 개발 계획

- [ ] 백엔드 API 연동
- [ ] 관리자 페이지 개발
- [ ] 다국어 지원 (i18n)
- [ ] 견적 문의 폼 기능
- [ ] 제품 장바구니 기능
- [ ] 사용자 인증 시스템
- [ ] 실제 제품 이미지 및 콘텐츠 업데이트

## 📝 개발 환경 설정

### VS Code 추천 확장

- [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (Vetur는 비활성화)

### 브라우저 개발자 도구

- Chromium 기반 브라우저 (Chrome, Edge, Brave 등):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)

## 👥 개발자

개발 시작일: 2024년 1월
