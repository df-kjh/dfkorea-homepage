# 로컬에서 Railway DB 접근 가이드

## Railway 데이터베이스 연결 정보 확인

1. **Railway Dashboard 접속**: https://railway.app
2. **PostgreSQL 서비스** 클릭
3. **Connect** 탭 선택
4. **Database Credentials** 섹션에서 정보 확인:
   ```
   Host: your-project.railway.app
   Port: 5432
   Username: postgres
   Password: ************************
   Database: railway
   ```

---

## 설정 방법

### 옵션 1: .env.development 파일 수정 (권장)

`dfkorea-backend/.env.development`:

```bash
# Database Configuration
# Railway PostgreSQL (Railway Dashboard > PostgreSQL > Connect에서 복사)
DB_HOST=monorail.proxy.rlwy.net
DB_PORT=12345
DB_USERNAME=postgres
DB_PASSWORD=abcdefghijklmnopqrstuvwxyz123456
DB_NAME=railway

# 나머지 설정은 동일...
```

**장점**:
- 간단하고 직관적
- 팀원과 공유 가능 (비밀번호는 제외)

**단점**:
- 연결 정보를 직접 입력해야 함
- .gitignore에 .env.development 추가 필수

### 옵션 2: Railway CLI 사용

Railway CLI로 자동으로 환경변수 주입:

```bash
# Railway CLI 설치 (아직 없다면)
npm install -g railway

# Railway 로그인
railway login

# 프로젝트 연결
cd /workspaces/dfkorea/dfkorea-backend
railway link

# Railway 환경변수로 실행
railway run npm run start:dev
```

**장점**:
- 연결 정보 수동 입력 불필요
- 항상 최신 환경변수 사용

**단점**:
- 매번 `railway run` 명령어 사용 필요

---

## 단계별 설정 (옵션 1)

### 1. Railway 연결 정보 복사

Railway Dashboard에서 다음 정보 복사:

```
Host: monorail.proxy.rlwy.net
Port: 12345
Database: railway
Username: postgres
Password: ************************
```

### 2. .env.development 업데이트

```bash
cd /workspaces/dfkorea/dfkorea-backend
nano .env.development
```

다음 내용으로 수정:

```bash
# Database Configuration
DB_HOST=monorail.proxy.rlwy.net
DB_PORT=12345
DB_USERNAME=postgres
DB_PASSWORD=your-copied-password-here
DB_NAME=railway

# TypeORM 자동 테이블 생성
TYPEORM_SYNCHRONIZE=false  # 프로덕션 DB라면 false 권장

# 애플리케이션 Base URL
BASE_URL=http://localhost:3000

# JWT Configuration
JWT_SECRET=your-secret-key-change-this-in-production
JWT_EXPIRES_IN=24h

# Gemini AI
GEMINI_API_KEY=your-gemini-api-key

# App Configuration
NODE_ENV=development
PORT=3000

# CORS Configuration
CORS_ORIGIN=http://localhost:5173,http://localhost:5174
```

### 3. 백엔드 실행

```bash
cd /workspaces/dfkorea/dfkorea-backend
npm run start:dev
```

콘솔에서 연결 확인:
```
[Nest] LOG [TypeOrmModule] Connected to database
✅ Admin account already exists
🌐 CORS enabled for: ...
Nest application successfully started
```

### 4. 프론트엔드 실행

```bash
cd /workspaces/dfkorea/led-lighting-website
npm run dev
```

---

## 프론트엔드 설정

프론트엔드는 로컬 백엔드를 사용하므로 별도 설정 불필요:

`led-lighting-website/.env.development`:

```bash
# 로컬 백엔드 사용
VITE_API_BASE_URL=http://localhost:3000
```

또는 Railway 백엔드 직접 사용:

```bash
# Railway 백엔드 사용
VITE_API_BASE_URL=https://dfkorea-production.up.railway.app
```

---

## 연결 테스트

### 1. 데이터베이스 연결 확인

```bash
# 백엔드 로그에서 확인
# "Connected to database" 메시지

# 또는 PostgreSQL 클라이언트로 직접 연결
psql -h monorail.proxy.rlwy.net -p 12345 -U postgres -d railway
```

### 2. API 테스트

```bash
# 제품 목록 조회
curl http://localhost:3000/api/products

# Admin 로그인
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

### 3. 프론트엔드에서 확인

http://localhost:5173 접속 후:
- 메인 페이지에서 제품 목록 표시 확인
- 어드민 로그인 테스트

---

## 보안 주의사항

### .gitignore 확인

`.env.development`에 실제 비밀번호가 있다면 반드시 .gitignore에 추가:

```bash
# .gitignore
.env.development
.env.production
.env*.local
```

### 환경별 파일 분리

```bash
# .env.development.example (Git에 커밋)
DB_HOST=your-railway-host
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your-password-here
DB_NAME=railway

# .env.development (Git에 제외)
DB_HOST=monorail.proxy.rlwy.net
DB_PORT=12345
DB_USERNAME=postgres
DB_PASSWORD=actual-password-12345
DB_NAME=railway
```

---

## 문제 해결

### 연결 실패: ECONNREFUSED

**증상**:
```
Error: connect ECONNREFUSED
```

**원인**: 잘못된 호스트/포트

**해결**:
1. Railway Dashboard에서 연결 정보 재확인
2. 방화벽 확인 (포트 5432 또는 Railway 포트)
3. Railway 서비스 상태 확인

### 인증 실패: password authentication failed

**증상**:
```
Error: password authentication failed for user "postgres"
```

**원인**: 잘못된 비밀번호

**해결**:
1. Railway Dashboard에서 비밀번호 복사 (공백 주의)
2. .env.development에 정확히 붙여넣기
3. 환경변수 다시 로드 (서버 재시작)

### 데이터베이스 없음: database "railway" does not exist

**증상**:
```
Error: database "railway" does not exist
```

**원인**: 잘못된 데이터베이스 이름

**해결**:
```bash
# Railway Dashboard > PostgreSQL > Connect에서 확인
DB_NAME=railway  # 또는 다른 이름
```

### SSL 연결 오류

Railway는 SSL 필요할 수 있음:

`src/app.module.ts`:

```typescript
TypeOrmModule.forRootAsync({
  useFactory: (configService: ConfigService) => ({
    // ...기존 설정
    ssl: configService.get('NODE_ENV') === 'production' 
      ? { rejectUnauthorized: false }
      : false,
  }),
})
```

---

## Railway CLI 사용법 (옵션 2)

### 설치 및 설정

```bash
# Railway CLI 설치
npm install -g railway

# 로그인
railway login

# 프로젝트 연결
cd /workspaces/dfkorea/dfkorea-backend
railway link
# → 프로젝트 선택
# → Environment 선택 (production)
```

### 사용

```bash
# Railway 환경변수로 백엔드 실행
railway run npm run start:dev

# 환경변수 확인
railway run env

# PostgreSQL 직접 접속
railway run psql $DATABASE_URL
```

**장점**: 환경변수 자동 주입
**단점**: 항상 `railway run` 명령어 필요

---

## 권장 워크플로우

### 개발 시나리오별 설정

#### 1. 완전 로컬 개발 (빠른 개발/테스트)

```bash
# .env.development
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=dfkorea

# Docker로 로컬 PostgreSQL 실행
docker-compose up -d postgres
```

**사용 시기**: 새 기능 개발, 빠른 테스트

#### 2. Railway DB 사용 (실제 데이터 테스트)

```bash
# .env.development
DB_HOST=monorail.proxy.rlwy.net
DB_PORT=12345
DB_USERNAME=postgres
DB_PASSWORD=actual-password
DB_NAME=railway
```

**사용 시기**: 프로덕션 데이터로 테스트, 버그 재현

#### 3. 하이브리드 (로컬 백엔드 + Railway DB)

```bash
# 백엔드: Railway DB 사용
cd dfkorea-backend
npm run start:dev

# 프론트엔드: 로컬 백엔드 사용
cd led-lighting-website
# .env.development: VITE_API_BASE_URL=http://localhost:3000
npm run dev
```

**사용 시기**: UI 개발하면서 실제 데이터 확인

---

## 체크리스트

- [ ] Railway Dashboard에서 DB 연결 정보 확인
- [ ] `.env.development`에 Railway DB 정보 입력
- [ ] `.gitignore`에 `.env.development` 추가
- [ ] 백엔드 실행하여 DB 연결 확인
- [ ] 프론트엔드 실행하여 데이터 조회 확인
- [ ] Admin 로그인 테스트
- [ ] 제품 등록/수정/삭제 테스트

---

## 다음 단계

로컬에서 Railway DB에 연결한 후:

1. **데이터 확인**: Railway DB의 실제 데이터 조회
2. **동기화 주의**: `TYPEORM_SYNCHRONIZE=false` 설정 (데이터 손실 방지)
3. **백업 권장**: 중요 데이터 변경 전 DB 백업
4. **팀 협업**: 팀원과 동일한 DB 사용 시 충돌 주의

Railway Dashboard > PostgreSQL > Backups에서 자동 백업 설정 확인!
