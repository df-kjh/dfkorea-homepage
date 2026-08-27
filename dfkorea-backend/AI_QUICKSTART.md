# 🤖 AI 자동 블로그 생성 - 빠른 시작 가이드

운영 배포의 단일 기준은 루트 [DEPLOYMENT.md](../DEPLOYMENT.md)다. PostgreSQL을 먼저 프로비저닝하고 compiled migration이 실패하면 애플리케이션도 시작되지 않게 한다.

## 1️⃣ API 키 발급 (2분)

1. **Google AI Studio** 접속: https://aistudio.google.com/app/apikey
2. **"Create API Key"** 버튼 클릭
3. API 키 복사 (예: `AIzaSyC-xxxxx...`)

## 2️⃣ 환경 변수 설정 (1분)

### 로컬 개발

```bash
# dfkorea-backend/.env.development 파일 열기
nano .env.development

# 맨 아래에 추가
GEMINI_API_KEY=AIzaSyC-your-actual-api-key-here

# 저장: Ctrl+O, Enter, Ctrl+X
```

### 프로덕션 (Railway/Render)

1. Railway/Render 대시보드 접속
2. 프로젝트 선택 → Variables/Environment 탭
3. 새 변수 추가:
   - **Name**: `GEMINI_API_KEY`
   - **Value**: `AIzaSyC-your-actual-api-key-here`
4. 저장 → 자동 재배포

## 3️⃣ 서버 실행 (1분)

```bash
cd dfkorea-backend

# 개발 환경
npm run start:dev

# 프로덕션 환경
npm run build
npm run migration:run:prod && npm run start:prod
```

로그에서 확인:

```
✅ Google Gemini AI initialized
📅 Scheduled weekly post generation: Every Monday at 8:00 AM
✅ Scheduler initialized
```

## 4️⃣ 테스트 (즉시)

### 방법 1: 관리자 대시보드 (추천)

1. 프론트엔드 실행: `cd led-lighting-website && npm run dev`
2. 관리자 로그인
3. **소식 관리** 섹션 → **"AI 자동생성"** 버튼 (보라색) 클릭
4. 3초 후 새 게시글 확인

### 방법 2: API 직접 호출

```bash
# 1. 로그인하여 토큰 받기
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'

# 응답에서 token 복사

# 2. AI 생성 트리거
curl -X POST http://localhost:3000/api/scheduler/trigger \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 5️⃣ 자동 실행 확인

**매주 월요일 오전 8시**에 자동으로 실행됩니다.

스케줄 변경하려면:

```typescript
// src/scheduler/scheduler.service.ts
const cronExpression = "0 8 * * 1"; // 매주 월요일 8시

// 예시:
// 매일 9시: '0 9 * * *'
// 매주 금요일 3시: '0 15 * * 5'
```

---

## ⚠️ 문제 해결

### "GEMINI_API_KEY not found"

```bash
# 환경 변수 확인
cat .env.development | grep GEMINI

# 서버 재시작
npm run start:dev
```

### API 키 에러

- [Google AI Studio](https://aistudio.google.com/app/apikey)에서 API 키 재발급
- 환경 변수에 올바르게 입력했는지 확인
- 따옴표 없이 입력: `GEMINI_API_KEY=AIzaSyC...` (O)
- 틀린 예시: `GEMINI_API_KEY="AIzaSyC..."` (X)

### 생성 안 됨

- 백엔드 로그 확인
- 네트워크 연결 확인
- Gemini API 무료 제한 확인 (분당 60 요청)

---

## 📚 상세 가이드

전체 문서: [`AI_AUTO_BLOG_GUIDE.md`](./AI_AUTO_BLOG_GUIDE.md)

---

**소요 시간**: 총 5분 ⏱️
**무료 사용**: 월 1,500 요청까지 무료 ✅
