# 🚀 Railway 빠른 배포 (5분)

## 1️⃣ Railway 프로젝트 생성
1. https://railway.app 접속
2. "New Project" → "Deploy from GitHub repo"
3. `dfkorea` 저장소 선택
4. Root Directory: `dfkorea-backend`

## 2️⃣ PostgreSQL 추가
1. "+ New" → "Database" → "Add PostgreSQL"

## 3️⃣ 환경 변수 설정
백엔드 서비스 → Variables 탭:

```bash
NODE_ENV=production
PORT=3000
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_USERNAME=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
DB_NAME=${{Postgres.PGDATABASE}}
JWT_SECRET=your-super-secret-key-change-this
JWT_EXPIRES_IN=24h
CORS_ORIGIN=https://your-frontend.vercel.app
```

## 4️⃣ Migration 실행

**⚠️ `railway run`은 작동하지 않습니다** (내부 DNS 접근 불가)

**방법: Railway 대시보드에서 실행**

1. Railway 대시보드 → 백엔드 서비스 클릭
2. 배포 완료 후:
   - 상단 "..." 메뉴 → "Run a command"
   - 명령어 입력: `npm run migration:run:prod`
   - 실행 클릭

또는 프로덕션 환경에서 자동 실행되도록 설정됨 (synchronize: false이므로 수동 실행 필요)

## 5️⃣ 확인
```bash
# Health Check
curl https://your-backend-url.up.railway.app

# 로그인 테스트 (비밀번호: admin123)
curl -X POST https://your-backend-url.up.railway.app/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

## ✅ 완료!
백엔드 URL을 프론트엔드 환경 변수에 설정하세요:
```
VITE_API_BASE_URL=https://your-backend-url.up.railway.app
```

---

상세 가이드: [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md)
