# 백엔드 배포 가이드 (CORS 설정)

이 문서는 CORS 설정만 보충한다. 전체 환경 변수, PostgreSQL, 백업, 배포 및 롤백은 루트 [DEPLOYMENT.md](../DEPLOYMENT.md)를 단일 기준으로 사용한다. 운영 Start Command는 compiled migration이 실패하면 시작도 중단한다.

```bash
npm run migration:run:prod && npm run start:prod
```

## ✅ GitHub Codespaces CORS 문제 해결 완료!

### 🔍 문제
프론트엔드에서 백엔드 API 요청 시:
```
ERR_CONNECTION_REFUSED
AxiosError: Network Error
```

### 💡 해결
GitHub Codespaces 환경을 자동으로 감지하여 `*.github.dev` 도메인을 허용하도록 설정했습니다.

### 🚀 적용 방법
**백엔드 서버를 재시작하세요:**
```bash
cd /workspaces/dfkorea/dfkorea-backend
npm run start:dev
```

서버 로그에서 확인:
```
🌐 Detected GitHub Codespaces environment
🌐 CORS enabled for: GitHub Codespaces (*.github.dev)
```

---

## 🚨 중요: CORS 설정

프론트엔드가 Vercel에 배포되면, 백엔드에서도 해당 도메인을 허용해야 합니다.

### 환경별 CORS 설정

#### 1. GitHub Codespaces (개발) - 자동 설정됨 ✅
- `*.github.dev` 도메인 자동 허용
- `localhost:5173`, `localhost:5174` 허용

#### 2. 로컬 개발 (.env.development)
```bash
CORS_ORIGIN=http://localhost:5173,http://localhost:5174
```

#### 3. 프로덕션 (.env.production 또는 배포 플랫폼)
```bash
CORS_ORIGIN=https://your-vercel-app.vercel.app,https://your-custom-domain.com
```

### Railway/Render/Heroku 등에서 환경 변수 설정

백엔드가 배포된 플랫폼에서 다음 환경 변수를 설정하세요:

#### 필수 환경 변수

```bash
# CORS - 프론트엔드 도메인 (쉼표로 여러 도메인 구분 가능)
CORS_ORIGIN=https://your-vercel-app.vercel.app,https://your-custom-domain.com

# 예시:
CORS_ORIGIN=https://dfkorea-frontend.vercel.app,https://dfkorea.com,https://www.dfkorea.com
```

### 플랫폼별 설정 방법

#### Railway

1. 프로젝트 대시보드 → Variables
2. `CORS_ORIGIN` 추가
3. 값: `https://your-vercel-app.vercel.app`
4. Deploy

#### Render

1. 서비스 대시보드 → Environment
2. `CORS_ORIGIN` 추가
3. 값: `https://your-vercel-app.vercel.app`
4. Deploy

#### Heroku

```bash
heroku config:set CORS_ORIGIN=https://your-vercel-app.vercel.app
```

### 로컬 테스트

개발 환경에서는 `.env.development` 파일을 사용:

```bash
CORS_ORIGIN=http://localhost:5173,http://localhost:5174
```

### Vercel 도메인 확인

1. Vercel 프로젝트 대시보드
2. Domains 섹션에서 할당된 도메인 확인
3. 예: `dfkorea-frontend-xxx.vercel.app`
4. 이 도메인을 백엔드 `CORS_ORIGIN`에 추가

### 주의사항

⚠️ **중요**:

- Vercel 프리뷰 배포마다 새로운 도메인이 생성됩니다
- Production 도메인만 CORS에 추가하는 것을 권장
- 커스텀 도메인을 사용하면 고정된 URL로 관리 가능

### 확인 방법

1. 프론트엔드 배포 후 브라우저 콘솔 확인
2. Network 탭에서 API 요청 확인:
   - ✅ 성공: 200 OK
   - ❌ 실패: CORS error 또는 Network error

3. 백엔드 로그 확인:
   ```
   🌐 CORS enabled for: [ 'https://your-domain.com' ]
   ```

### 트러블슈팅

#### "Network Error" 또는 "CORS Error"

→ `CORS_ORIGIN`에 프론트엔드 도메인 추가 필요

#### "500 Internal Server Error"

→ 백엔드 로그 확인 필요

#### Preflight 요청 실패

→ CORS 설정에 OPTIONS 메서드 포함 확인 (이미 적용됨)

### 완전한 설정 예시

**프론트엔드 (Vercel)**:

```env
VITE_API_BASE_URL=https://dfkorea-backend.railway.app
```

**백엔드 (Railway/Render/Heroku)**:

```env
CORS_ORIGIN=https://dfkorea-frontend.vercel.app,https://dfkorea.com
PORT=3000
NODE_ENV=production
# production: 32+ chars, 3+ of lower/upper/number/symbol; secret store only
JWT_SECRET=
```

## 재배포

환경 변수 변경 후 백엔드를 재배포해야 적용됩니다.
