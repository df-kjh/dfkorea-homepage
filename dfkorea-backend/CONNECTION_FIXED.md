# ✅ PostgreSQL 연결 문제 해결 완료!

## 🎯 문제
```
ERROR [TypeOrmModule] Unable to connect to the database. Retrying (6)...
```

## 💡 원인
PostgreSQL 서버가 실행되지 않았습니다.

## ✅ 해결 완료

PostgreSQL 컨테이너가 성공적으로 실행되었고, Migration도 완료되었습니다!

### 실행된 작업:
1. ✅ PostgreSQL 컨테이너 시작
2. ✅ 데이터베이스 연결 성공
3. ✅ Migration 실행 (테이블 생성)
4. ✅ Admin 계정 생성 (username: admin, password: admin123)

---

## 🚀 백엔드 서버 시작

새 터미널에서 실행하세요:

```bash
cd /workspaces/dfkorea/dfkorea-backend
npm run start:dev
```

서버가 시작되면 다음과 같은 로그가 표시됩니다:
```
[Nest] LOG [NestFactory] Starting Nest application...
[Nest] LOG [InstanceLoader] TypeOrmModule dependencies initialized
[Nest] LOG [NestApplication] Nest application successfully started
```

---

## 🧪 API 테스트

### 1. Admin 로그인
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

성공 시 JWT 토큰이 반환됩니다:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "username": "admin"
  }
}
```

### 2. 제품 목록 조회
```bash
curl http://localhost:3000/products
```

### 3. 포스트 목록 조회
```bash
curl http://localhost:3000/posts
```

---

## 📊 데이터베이스 상태 확인

### PostgreSQL 컨테이너 상태
```bash
docker ps | grep postgres
```

출력:
```
cf32f1318262   postgres:16-alpine   Up XX minutes   0.0.0.0:5432->5432/tcp   dfkorea-postgres
```

### 데이터베이스 접속
```bash
docker exec -it dfkorea-postgres psql -U postgres -d dfkorea
```

데이터베이스 명령어:
```sql
-- 테이블 목록
\dt

-- Admin 계정 확인
SELECT * FROM admins;

-- 제품 목록
SELECT id, name, category FROM products;

-- 포스트 목록
SELECT id, title, category FROM posts;

-- 종료
\q
```

---

## 🔄 기존 JSON 데이터 마이그레이션 (선택사항)

`data/database.json`에 기존 데이터가 있다면:

```bash
cd /workspaces/dfkorea/dfkorea-backend
npm run migrate:json
```

출력 예시:
```
🚀 Starting JSON to PostgreSQL migration...
📊 Found data:
   - 1 products
   - 2 posts

📦 Migrating products...
   ✓ 엣지 평판

📝 Migrating posts...
   ✓ 회사 소식 글 입니다.
   ✓ 2026 LED: AI와 친환경이 여는 조명의 미래

✅ Migration completed successfully!
```

---

## 🛠️ 유용한 명령어

### PostgreSQL 관리
```bash
# 컨테이너 중지
docker stop dfkorea-postgres

# 컨테이너 시작
docker start dfkorea-postgres

# 컨테이너 재시작
docker restart dfkorea-postgres

# 컨테이너 삭제 (주의: 데이터도 삭제됨!)
docker rm -f dfkorea-postgres
```

### 백엔드 서버
```bash
# 개발 모드 (자동 재시작)
npm run start:dev

# 프로덕션 빌드
npm run build

# 프로덕션 실행
npm run start:prod
```

### Migration
```bash
# Migration 실행
npm run migration:run

# Migration 롤백
npm run migration:revert

# 새 Migration 생성
npm run migration:generate -- src/migrations/MigrationName
```

---

## 🎉 완료!

이제 다음 작업을 할 수 있습니다:

1. ✅ 백엔드 API 사용
2. ✅ Admin 로그인
3. ✅ 제품/포스트 CRUD
4. ✅ 프론트엔드 연결

문제가 발생하면:
- [QUICKSTART.md](./QUICKSTART.md)
- [POSTGRESQL_MIGRATION_GUIDE.md](./POSTGRESQL_MIGRATION_GUIDE.md)

참고하세요!
