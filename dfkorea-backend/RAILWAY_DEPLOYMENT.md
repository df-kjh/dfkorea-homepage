# Railway 배포 체크리스트

## 📋 배포 전 준비사항

### ✅ 1단계: Railway 프로젝트 생성

1. [Railway.app](https://railway.app) 접속 및 로그인
2. **"New Project"** 클릭
3. **"Deploy from GitHub repo"** 선택
4. `Moomi98/dfkorea` 저장소 선택
5. **Root Directory**: `dfkorea-backend` 입력

---

### ✅ 2단계: PostgreSQL 데이터베이스 추가

1. Railway 프로젝트 대시보드에서 **"+ New"** 클릭
2. **"Database"** → **"Add PostgreSQL"** 선택
3. PostgreSQL 서비스가 자동으로 생성됨

**자동 생성되는 환경 변수:**
- `PGHOST`
- `PGPORT`
- `PGUSER`
- `PGPASSWORD`
- `PGDATABASE`
- `DATABASE_URL`

---

### ✅ 3단계: 백엔드 서비스 환경 변수 설정

Railway 백엔드 서비스 → **"Variables"** 탭에서 다음 환경 변수 추가:

#### 필수 환경 변수

```bash
# Node 환경
NODE_ENV=production
PORT=3000

# PostgreSQL (Railway가 자동 설정하지만 명시적으로 참조)
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_USERNAME=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
DB_NAME=${{Postgres.PGDATABASE}}

# JWT Secret (강력한 비밀키로 변경!)
JWT_SECRET=your-super-secret-jwt-key-change-this-to-random-string

# JWT 만료 시간
JWT_EXPIRES_IN=24h

# CORS (프론트엔드 도메인 - 나중에 Vercel 배포 후 추가)
CORS_ORIGIN=https://your-frontend-domain.vercel.app

# Gemini AI (선택사항)
GEMINI_API_KEY=your-gemini-api-key-if-you-have
```

#### 🔐 JWT_SECRET 생성 방법

터미널에서 랜덤 문자열 생성:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

또는 온라인 생성기:
- https://www.uuidgenerator.net/
- 64자 이상의 랜덤 문자열 사용

---

### ✅ 4단계: 배포 및 Migration 실행

#### 4-1. 첫 배포
환경 변수 설정 후 자동으로 배포가 시작됩니다.

**배포 로그 확인:**
```
Building...
✓ Docker build completed
✓ Deploying...
✓ Service is live!
```

#### 4-2. Railway CLI 설치 (Migration 실행용)

```bash
# npm으로 설치
npm install -g @railway/cli

# 또는 brew로 설치 (Mac)
brew install railway
```

#### 4-3. Railway 프로젝트 연결

```bash
# Railway 로그인
railway login

# 프로젝트 연결
cd /workspaces/dfkorea/dfkorea-backend
railway link
```

**프롬프트가 나타나면:**
1. **프로젝트 선택**: dfkorea 프로젝트 선택
2. **서비스 선택**: ⚠️ **백엔드 서비스** 선택 (PostgreSQL 서비스 ❌)
   - 예: "dfkorea-backend" 또는 "backend"
   - PostgreSQL을 선택하면 migration 실행 불가!

#### 4-4. Migration 실행 (Admin 계정 생성)

**⚠️ 중요: `railway run`은 Railway 내부 네트워크 DNS(`postgres.railway.internal`)에 접근할 수 없으므로 실패합니다.**

**방법 1: Railway 대시보드에서 실행 (권장)**

1. Railway 대시보드 → 백엔드 서비스 클릭
2. "Settings" 탭 → "Deploy" 섹션
3. "Custom Start Command" 또는 배포 후 한 번만:
   - 상단 "..." 메뉴 → "Run a command"
   - 명령어 입력: `npm run migration:run`
   - 실행

또는:

1. Railway 대시보드 → 백엔드 서비스
2. "Deployments" 탭 → 최신 배포 클릭
3. "View Logs" 에서 로그 확인
4. 우측 상단 "Run Command" 버튼 클릭
5. 명령어 입력: `npm run migration:run`

**방법 2: 일회성 배포 스크립트 추가**

`package.json`에 postdeploy 스크립트 추가:

```json
{
  "scripts": {
    "start:prod": "node dist/main",
    "migration:run:prod": "typeorm-ts-node-commonjs migration:run -d dist/database/typeorm.config.js"
  }
}
```

그리고 Railway에서 환경 변수 추가:
```
RAILWAY_RUN_BUILD_COMMAND=npm run build && npm run migration:run:prod
```

> **왜 `railway run`이 안 되나요?**
> - `railway run`은 로컬에서 실행됩니다
> - Railway PostgreSQL의 내부 DNS(`postgres.railway.internal`)는 Railway 네트워크 내부에서만 접근 가능
> - 로컬에서는 이 DNS를 resolve할 수 없음

**예상 출력:**
```
query: CREATE TABLE "products" (...)
query: CREATE TABLE "posts" (...)
query: CREATE TABLE "admins" (...)
query: INSERT INTO "admins" (...)
✓ Migration InitialSchema1706200000000 has been executed successfully.
```

**또는 Railway 대시보드에서 직접 실행:**
1. 백엔드 서비스 → "Deploy Logs" 탭
2. "Run Command" 입력란에: `npm run migration:run`
3. 실행

---

### ✅ 5단계: 배포 확인

#### 5-1. 서비스 URL 확인
Railway 대시보드 → 백엔드 서비스 → "Settings" → "Domains"에서 생성된 URL 확인

예: `https://dfkorea-backend-production.up.railway.app`

#### 5-2. API Health Check

```bash
curl https://your-backend-url.up.railway.app
```

응답:
```json
{"message":"LED Lighting API Server is running"}
```

#### 5-3. Admin 로그인 테스트

```bash
curl -X POST https://your-backend-url.up.railway.app/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

성공 시 JWT 토큰 반환:
```json
{
  "access_token": "eyJhbGc...",
  "user": {
    "username": "admin"
  }
}
```

---

### ✅ 6단계: 프론트엔드 연동

#### 6-1. 백엔드 URL 기록
Railway에서 생성된 백엔드 URL을 복사해둡니다.

예: `https://dfkorea-backend-production.up.railway.app`

#### 6-2. 프론트엔드 환경 변수 업데이트

**로컬 개발:**
```bash
# led-lighting-website/.env.development
VITE_API_BASE_URL=https://dfkorea-backend-production.up.railway.app
```

**Vercel 배포:**
Vercel 대시보드 → Settings → Environment Variables
```
VITE_API_BASE_URL=https://dfkorea-backend-production.up.railway.app
```

#### 6-3. 백엔드 CORS 업데이트

Railway 백엔드 → Variables → `CORS_ORIGIN` 수정:
```bash
CORS_ORIGIN=https://your-frontend.vercel.app,https://your-custom-domain.com
```

재배포 후 적용됩니다.

---

## 🔧 추가 설정 (선택사항)

### Custom Domain 연결

1. Railway 대시보드 → 백엔드 서비스 → "Settings" → "Domains"
2. "Custom Domain" 클릭
3. 도메인 입력 (예: `api.dfkorea.com`)
4. DNS 설정에서 CNAME 레코드 추가:
   ```
   api.dfkorea.com → your-service.up.railway.app
   ```

### 이미지 저장 (Volume 또는 S3)

Railway의 ephemeral 스토리지는 재배포 시 초기화됩니다.

**Option 1: Railway Volumes (유료)**
- 영구 저장소
- `/uploads` 마운트

**Option 2: AWS S3 / Cloudinary (권장)**
- 클라우드 스토리지 사용
- CDN 자동 적용
- 스케일링 용이

---

## 🐛 문제 해결

### 1. "Unable to connect to database" 오류

**원인:** PostgreSQL과 백엔드 서비스가 연결되지 않음

**해결:**
1. PostgreSQL 서비스가 실행 중인지 확인
2. 백엔드 서비스의 환경 변수 확인:
   ```
   DB_HOST=${{Postgres.PGHOST}}
   ```
3. Railway 대시보드에서 두 서비스가 같은 프로젝트에 있는지 확인

### 2. Migration이 실행되지 않음

**원인:** CLI가 프로젝트에 연결되지 않음

**해결:**
```bash
railway logout
railway login
railway link
railway run npm run migration:run
```

### 3. CORS 오류

**원인:** 프론트엔드 도메인이 CORS에 추가되지 않음

**해결:**
Railway → Variables → `CORS_ORIGIN`에 프론트엔드 URL 추가
```bash
CORS_ORIGIN=https://your-frontend.vercel.app
```

### 4. 이미지가 사라짐

**원인:** Railway는 ephemeral storage 사용

**해결:**
- Railway Volumes 사용 (유료)
- AWS S3, Cloudinary 등 클라우드 스토리지로 전환

---

## 📊 Railway 리소스 모니터링

### 사용량 확인
Railway 대시보드 → "Metrics" 탭
- CPU 사용량
- 메모리 사용량
- 네트워크 트래픽
- 요청 수

### 로그 확인
Railway 대시보드 → "Deploy Logs" 탭
- 애플리케이션 로그
- 에러 로그
- 배포 히스토리

---

## 🎉 완료 체크리스트

배포가 완료되었다면 다음을 확인하세요:

- [ ] PostgreSQL 데이터베이스 생성됨
- [ ] 백엔드 서비스 배포 성공
- [ ] 환경 변수 모두 설정됨
- [ ] Migration 실행 완료 (Admin 계정 생성)
- [ ] API Health Check 성공
- [ ] Admin 로그인 테스트 성공
- [ ] 프론트엔드에서 API 연결 성공
- [ ] CORS 설정 완료

---

## 📚 참고 자료

- [Railway 공식 문서](https://docs.railway.app)
- [Railway PostgreSQL 가이드](https://docs.railway.app/databases/postgresql)
- [Railway CLI 문서](https://docs.railway.app/develop/cli)
- [POSTGRESQL_MIGRATION_GUIDE.md](./POSTGRESQL_MIGRATION_GUIDE.md)
- [CORS_SETUP.md](./CORS_SETUP.md)

---

## 💡 팁

1. **환경 변수는 재배포 후 적용**
   - 환경 변수 변경 후 자동 재배포됨
   - 또는 수동으로 "Redeploy" 클릭

2. **로그를 자주 확인**
   - 문제 발생 시 "Deploy Logs"에서 원인 파악

3. **무료 티어 제한**
   - Railway 무료 티어: $5 크레딧/월
   - PostgreSQL 포함 시 약 1-2주 사용 가능
   - 프로덕션은 유료 플랜 권장

4. **백업 설정**
   - Railway는 자동 백업 제공
   - 중요 데이터는 별도 백업 권장
