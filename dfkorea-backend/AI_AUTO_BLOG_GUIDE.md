# AI 자동 블로그 생성 기능 가이드

## 📋 개요

매주 **월요일 오전 8시**에 AI가 자동으로 **LED 산업 동향** 블로그 글을 생성하여 업로드하는 기능입니다.

- **AI 엔진**: Google Gemini Pro (무료 티어 사용 가능)
- **스케줄러**: node-cron
- **카테고리**: "산업동향"
- **자동 생성 주기**: 매주 월요일 오전 8시

---

## 🔧 설정 방법

### 1. Google Gemini API 키 발급

1. [Google AI Studio](https://aistudio.google.com/app/apikey) 접속
2. Google 계정으로 로그인
3. **"Create API Key"** 클릭
4. API 키 복사 (예: `AIzaSyC-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`)

> ⚠️ **무료 티어 제한**:
>
> - 분당 60 요청
> - 일일 1,500 요청
> - 월별 무료 (일반적인 사용에 충분)

### 2. 환경 변수 설정

#### 개발 환경 (`.env.development`)

```bash
# Google Gemini AI
GEMINI_API_KEY=AIzaSyC-your-actual-api-key-here
```

#### 프로덕션 환경 (`.env.production`)

```bash
# Google Gemini AI
GEMINI_API_KEY=AIzaSyC-your-actual-api-key-here
```

#### Railway/Render 배포 시

Railway 또는 Render 대시보드에서 환경 변수 추가:

- **Key**: `GEMINI_API_KEY`
- **Value**: `AIzaSyC-your-actual-api-key-here`

---

## 🚀 사용 방법

### 자동 실행 (스케줄러)

서버가 실행되면 자동으로 스케줄러가 활성화됩니다:

- **매주 월요일 오전 8시**에 자동으로 블로그 글 생성
- 백엔드 로그에서 확인 가능:
  ```
  📅 Scheduled weekly post generation: Every Monday at 8:00 AM
  ⏰ Weekly post generation triggered
  🤖 Generating LED industry trend post...
  ✅ Post published successfully: "제목" (ID: xxx)
  ```

### 수동 실행 (관리자 대시보드)

1. 관리자 페이지 로그인
2. **소식 관리** 섹션
3. **"AI 자동생성"** 버튼 클릭 (보라색 그라데이션 버튼)
4. 확인 대화상자에서 **"확인"** 클릭
5. 3초 후 자동으로 목록 새로고침

### API 직접 호출

```bash
# 인증 토큰 필요
curl -X POST http://localhost:3000/api/scheduler/trigger \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 📝 생성되는 블로그 글 예시

AI가 다음과 같은 구조로 글을 생성합니다:

```markdown
# 2026년 1월 LED 조명 산업의 최신 동향

## 주요 동향

최근 LED 산업에서는 마이크로 LED 기술의 발전과 함께...

## 기술 혁신

고효율 LED 칩의 광효율이 200lm/W를 넘어서면서...

## 시장 전망

글로벌 LED 시장은 2026년 $XX billion 규모로 성장할 것으로...

## 결론

LED 조명 산업은 지속적인 기술 혁신과 함께...
```

**자동 생성 필드**:

- ✅ 제목 (30자 이내)
- ✅ 발췌문 (100자 이내, 2-3문장)
- ✅ 본문 (마크다운, 1000-1500자)
- ✅ 카테고리: "산업동향" 고정
- ✅ 썸네일 이미지: Unsplash LED 이미지 (기본값)

---

## ⚙️ 스케줄 변경 방법

스케줄을 변경하려면 `src/scheduler/scheduler.service.ts` 파일 수정:

```typescript
// 현재: 매주 월요일 오전 8시
const cronExpression = "0 8 * * 1";

// 예시 변경:
// 매일 오전 9시: '0 9 * * *'
// 매주 금요일 오후 3시: '0 15 * * 5'
// 매월 1일 오전 10시: '0 10 1 * *'
```

**Cron 표현식 형식**: `분 시 일 월 요일`

- 분: 0-59
- 시: 0-23
- 일: 1-31
- 월: 1-12
- 요일: 0-6 (0=일요일, 1=월요일)

**참고 사이트**: [Crontab Guru](https://crontab.guru/)

---

## 🔍 트러블슈팅

### 1. AI 생성 실패: "GEMINI_API_KEY not found"

**원인**: 환경 변수에 API 키가 설정되지 않음

**해결**:

```bash
# .env.development 또는 .env.production 파일 확인
GEMINI_API_KEY=AIzaSyC-your-api-key-here

# 서버 재시작
npm run start:dev  # 개발 환경
npm run start:prod # 프로덕션
```

### 2. AI 생성 실패: "Gemini API is not configured"

**원인**: API 키가 없거나 잘못됨

**해결**:

1. [Google AI Studio](https://aistudio.google.com/app/apikey)에서 API 키 재발급
2. 환경 변수에 올바른 키 입력
3. 서버 재시작

### 3. 스케줄러가 동작하지 않음

**확인 사항**:

- 서버가 계속 실행 중인지 확인 (Railway/Render는 24시간 실행)
- 서버 로그에서 다음 메시지 확인:
  ```
  📅 Scheduled weekly post generation: Every Monday at 8:00 AM
  ✅ Scheduler initialized
  ```

### 4. 생성된 글이 이상함

**원인**: AI 모델이 한국어로 답변하지 않거나 형식이 맞지 않음

**해결**:

- `src/ai/ai.service.ts`에서 프롬프트 수정
- 더 구체적인 지시 추가
- 예시 추가

### 5. 시간대 문제 (UTC vs KST)

**문제**: 서버가 UTC 시간대를 사용하면 한국 시간과 9시간 차이

**해결**:

```typescript
// 한국 시간 오전 8시 = UTC 전날 23시 (일요일 밤 11시)
const cronExpression = "0 23 * * 0"; // 일요일 밤 11시 (UTC)

// 또는 서버 시간대를 KST로 설정
cron.schedule("0 8 * * 1", callback, {
  timezone: "Asia/Seoul",
});
```

---

## 📊 모니터링

### 서버 로그 확인

**성공 시**:

```
[SchedulerService] ⏰ Weekly post generation triggered
[AiService] 🤖 Generating LED industry trend post...
[AiService] ✅ Post generated: "2026년 1월 LED 산업 동향"
[SchedulerService] ✅ Post published successfully: "2026년 1월 LED 산업 동향" (ID: 1737612000000)
```

**실패 시**:

```
[SchedulerService] ❌ Failed to generate and publish post: Error: ...
```

### 생성된 글 확인

1. 관리자 대시보드 → 소식 관리
2. 블로그 페이지 → 카테고리: "산업동향" 필터
3. 데이터베이스 직접 확인: `database.json`

---

## 🎯 고급 설정

### 1. 다른 AI 모델 사용

#### OpenAI GPT-4o 사용

```bash
npm install openai
```

```typescript
// src/ai/ai.service.ts
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const completion = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: prompt }],
});
```

#### Anthropic Claude 사용

```bash
npm install @anthropic-ai/sdk
```

```typescript
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const message = await anthropic.messages.create({
  model: "claude-3-5-sonnet-20241022",
  messages: [{ role: "user", content: prompt }],
});
```

### 2. 이미지 자동 생성

Unsplash API를 사용하여 관련 이미지 자동 검색:

```typescript
// src/ai/ai.service.ts
const searchUnsplashImage = async (query: string): Promise<string> => {
  const response = await fetch(
    `https://api.unsplash.com/search/photos?query=${query}&client_id=${process.env.UNSPLASH_ACCESS_KEY}`
  );
  const data = await response.json();
  return data.results[0]?.urls?.regular || defaultImage;
};
```

### 3. 여러 카테고리 지원

```typescript
// 매주 월요일: 산업동향
cron.schedule("0 8 * * 1", () => generatePost("산업동향"));

// 매주 수요일: 제품소식
cron.schedule("0 8 * * 3", () => generatePost("제품소식"));
```

---

## 📚 참고 자료

- [Google Gemini API 문서](https://ai.google.dev/docs)
- [node-cron GitHub](https://github.com/node-cron/node-cron)
- [Cron 표현식 생성기](https://crontab.guru/)
- [Unsplash API](https://unsplash.com/developers)

---

## 💡 팁

1. **무료 API 활용**: Gemini는 월 무료 제한이 높아 소규모 블로그에 적합
2. **스케줄 테스트**: 개발 중에는 수동 트리거로 테스트
3. **로그 모니터링**: Railway/Render 대시보드에서 로그 확인
4. **콘텐츠 검토**: 자동 생성 후 관리자가 검토 및 수정 권장
5. **백업**: database.json 정기적으로 백업

---

## 📞 문제 해결

문제가 지속되면:

1. 백엔드 로그 전체 확인
2. API 키 유효성 확인
3. 네트워크 연결 확인
4. Gemini API 상태 페이지 확인: [Google Cloud Status](https://status.cloud.google.com/)

---

**구현 완료 날짜**: 2026년 1월 23일
