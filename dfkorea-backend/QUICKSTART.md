# PostgreSQL 빠른 시작 가이드

## 🚀 빠른 시작 (5분 안에 실행)

### 1. PostgreSQL 실행 (Docker)
```bash
docker run --name dfkorea-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=dfkorea \
  -p 5432:5432 \
  -d postgres:16-alpine
```

### 2. 환경 변수 복사
```bash
cd dfkorea-backend
cp .env.example .env.development
```

### 3. 애플리케이션 실행
```bash
npm install
npm run start:dev
```

데이터베이스 테이블이 자동으로 생성됩니다! (synchronize: true)

### 4. Admin 계정 생성
```bash
# 방법 1: PostgreSQL에 직접 삽입
docker exec -it dfkorea-postgres psql -U postgres -d dfkorea

INSERT INTO admins (username, password) 
VALUES ('admin', '$2b$10$MJ6iQs3bPFWq9ctZ8CVyaO2ExzMrUSlZEMd.xw01ga4t00v9pKlVi');
\q

# 방법 2: Migration 실행
npm run migration:run
```

### 5. 기존 JSON 데이터 마이그레이션 (선택사항)
```bash
npm run migrate:json
```

### 6. API 테스트
```bash
# 로그인 (비밀번호: admin123)
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 제품 목록 조회
curl http://localhost:3000/products
```

## 🎯 다음 단계

자세한 내용은 [POSTGRESQL_MIGRATION_GUIDE.md](./POSTGRESQL_MIGRATION_GUIDE.md)를 참고하세요.

## 📋 체크리스트

- [x] PostgreSQL 설치 및 실행
- [x] 환경 변수 설정
- [x] 애플리케이션 실행
- [ ] Admin 계정 생성
- [ ] API 테스트
- [ ] 기존 데이터 마이그레이션 (필요시)

## Railway 배포

Railway 배포 가이드는 [POSTGRESQL_MIGRATION_GUIDE.md](./POSTGRESQL_MIGRATION_GUIDE.md#-railway-배포-설정)를 참고하세요.
