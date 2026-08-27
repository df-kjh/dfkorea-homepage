# PostgreSQL 데이터베이스 마이그레이션 가이드

## 📋 변경 사항 요약

기존 JSON 파일 기반 데이터베이스에서 **PostgreSQL + TypeORM**으로 전환했습니다.

### 선택 이유: PostgreSQL
- ✅ 명확한 스키마 구조 (Product, Post, Admin)
- ✅ Railway에서 PostgreSQL 플러그인 쉽게 추가 가능
- ✅ NestJS + TypeORM 완벽한 통합
- ✅ 트랜잭션 지원 및 데이터 무결성
- ✅ 배열 타입 네이티브 지원 (images[], certifications[])
- ✅ 영구 데이터 저장 및 확장성

---

## 🏗️ 구조 변경

### 추가된 파일
```
dfkorea-backend/
├── src/
│   ├── entities/                    # TypeORM Entity 클래스
│   │   ├── product.entity.ts
│   │   ├── post.entity.ts
│   │   ├── admin.entity.ts
│   │   └── index.ts
│   ├── migrations/                  # 데이터베이스 마이그레이션
│   │   └── 1706200000000-InitialSchema.ts
│   └── database/
│       ├── typeorm.config.ts        # TypeORM 설정
│       ├── database.service.ts      # 새로운 Repository 기반 서비스
│       └── database.service.ts.backup  # 백업 (기존 JSON 버전)
├── .env.development                 # 개발 환경 변수
└── .env.production                  # 프로덕션 환경 변수
```

### 설치된 패키지
```bash
npm install --save @nestjs/typeorm typeorm pg
```

---

## 🚀 로컬 개발 환경 설정

### 1. PostgreSQL 설치 (Docker 사용)

```bash
# PostgreSQL 컨테이너 실행
docker run --name dfkorea-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=dfkorea \
  -p 5432:5432 \
  -d postgres:16-alpine
```

### 2. 환경 변수 설정

`.env.development` 파일이 이미 생성되어 있습니다:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=dfkorea

JWT_SECRET=your-secret-key-change-this-in-production
JWT_EXPIRES_IN=24h
```

### 3. 데이터베이스 초기화

애플리케이션 실행 시 `synchronize: true` 옵션으로 자동으로 테이블이 생성됩니다.

```bash
cd /workspaces/dfkorea/dfkorea-backend
npm run start:dev
```

### 4. 초기 Admin 계정 생성

첫 실행 시 admin 계정이 없으므로 수동으로 생성이 필요합니다.

**방법 1: Migration 사용 (권장)**
```bash
npm run migration:run
```

**방법 2: API 호출**
```bash
# 또는 데이터베이스에 직접 삽입
docker exec -it dfkorea-postgres psql -U postgres -d dfkorea

INSERT INTO admins (username, password) 
VALUES ('admin', '$2b$10$MJ6iQs3bPFWq9ctZ8CVyaO2ExzMrUSlZEMd.xw01ga4t00v9pKlVi');
-- 비밀번호: admin123 (bcrypt 해시)
```

---

## 📦 Railway 배포 설정

### 1. PostgreSQL 플러그인 추가

Railway 대시보드에서:
1. 프로젝트 선택
2. **"+ New"** → **"Database"** → **"PostgreSQL"** 선택
3. 자동으로 다음 환경 변수가 설정됩니다:
   - `PGHOST`
   - `PGPORT`
   - `PGUSER`
   - `PGPASSWORD`
   - `PGDATABASE`
   - `DATABASE_URL`

### 2. 백엔드 환경 변수 설정

Railway 백엔드 서비스에서 다음 환경 변수를 추가하세요:

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=your-strong-secret-key-here-change-this

# PostgreSQL (Railway가 자동 설정하지만 명시적으로 설정 가능)
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_USERNAME=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
DB_NAME=${{Postgres.PGDATABASE}}

# Gemini AI (선택사항)
GEMINI_API_KEY=your-gemini-api-key
```

### 3. 데이터베이스 초기화

Railway에서 첫 배포 후:

**방법 1: Railway CLI 사용**
```bash
# Railway CLI 설치
npm i -g @railway/cli

# 로그인
railway login

# 프로젝트 연결
railway link

# Migration 실행
railway run npm run migration:run
```

**방법 2: PostgreSQL 직접 접근**
```bash
# Railway 대시보드에서 PostgreSQL 서비스 → "Connect" 탭
# 제공된 연결 정보로 접속

psql postgresql://user:pass@host:port/dbname

# Admin 계정 생성
INSERT INTO admins (username, password) 
VALUES ('admin', '$2b$10$MJ6iQs3bPFWq9ctZ8CVyaO2ExzMrUSlZEMd.xw01ga4t00v9pKlVi');
```

### 4. Dockerfile 확인

Dockerfile은 이미 올바르게 설정되어 있습니다:
```dockerfile
# data 폴더는 더 이상 필요하지 않음 (PostgreSQL 사용)
# 단, uploads 폴더는 여전히 필요
RUN mkdir -p uploads
```

---

## 🔄 기존 JSON 데이터 마이그레이션

기존 `data/database.json`의 데이터를 PostgreSQL로 이전하려면:

### 마이그레이션 스크립트 생성

```typescript
// src/scripts/migrate-json-to-postgres.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DatabaseService } from '../database/database.service';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dbService = app.get(DatabaseService);

  // 기존 JSON 데이터 읽기
  const jsonPath = path.join(process.cwd(), 'data', 'database.json');
  const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  // Admin 생성 (이미 migration에서 생성됨)
  console.log('Admin already created via migration');

  // Products 마이그레이션
  for (const product of jsonData.products) {
    const { id, createdAt, updatedAt, ...productData } = product;
    await dbService.createProduct(productData);
    console.log(`Migrated product: ${product.name}`);
  }

  // Posts 마이그레이션
  for (const post of jsonData.posts) {
    const { id, createdAt, updatedAt, ...postData } = post;
    await dbService.createPost(postData);
    console.log(`Migrated post: ${post.title}`);
  }

  console.log('Migration completed!');
  await app.close();
}

bootstrap();
```

### 실행
```bash
# TypeScript 직접 실행
npx ts-node src/scripts/migrate-json-to-postgres.ts
```

---

## 🔧 주요 변경 사항

### 1. Entity 클래스 (TypeORM)

**Product Entity**
- UUID 자동 생성
- PostgreSQL 배열 타입 사용 (images, certifications)
- 자동 타임스탬프 (@CreateDateColumn, @UpdateDateColumn)

**Post Entity**
- UUID 자동 생성
- views 기본값 0
- nullable 이미지 필드

**Admin Entity**
- SERIAL ID (자동 증가)
- unique username

### 2. DatabaseService 변경

**Before (JSON)**
```typescript
async getProducts(): Promise<Product[]> {
  const db = await this.readDatabase();
  return db.products;
}
```

**After (TypeORM)**
```typescript
async getProducts(): Promise<Product[]> {
  return this.productRepository.find({
    order: { createdAt: 'DESC' },
  });
}
```

### 3. 모듈 설정

모든 모듈에 `TypeOrmModule.forFeature([Product, Post, Admin])` 추가:
- ProductsModule
- PostsModule
- AuthModule

---

## 🧪 테스트

### API 테스트
```bash
# Admin 로그인
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 제품 목록 조회
curl http://localhost:3000/products

# 포스트 목록 조회
curl http://localhost:3000/posts
```

### 데이터베이스 확인
```bash
# Docker 컨테이너 접속
docker exec -it dfkorea-postgres psql -U postgres -d dfkorea

# 테이블 확인
\dt

# 데이터 확인
SELECT * FROM products;
SELECT * FROM posts;
SELECT * FROM admins;
```

---

## 🚨 주의사항

### 1. synchronize 옵션
- **개발 환경**: `true` (자동 스키마 동기화)
- **프로덕션**: `false` (migration 사용 권장)

현재 설정:
```typescript
synchronize: configService.get('NODE_ENV') !== 'production'
```

### 2. 데이터 백업
Railway PostgreSQL은 자동 백업을 제공하지만, 중요한 데이터는 별도로 백업하세요.

```bash
# 백업
pg_dump -h host -U user -d dbname > backup.sql

# 복원
psql -h host -U user -d dbname < backup.sql
```

### 3. 이미지 파일
`uploads/` 폴더의 이미지는 여전히 로컬 파일 시스템에 저장됩니다.
프로덕션에서는 S3, Cloudinary 등 클라우드 스토리지 사용을 권장합니다.

---

## 🎯 다음 단계 (선택사항)

### 1. 이미지를 클라우드로 이전
- AWS S3
- Cloudinary
- Railway Volumes (유료)

### 2. 연결 풀 최적화
```typescript
TypeOrmModule.forRootAsync({
  useFactory: (configService: ConfigService) => ({
    // ...
    extra: {
      max: 10, // 최대 연결 수
      idleTimeoutMillis: 30000,
    },
  }),
}),
```

### 3. 쿼리 최적화
- 인덱스 추가
- 페이지네이션 구현
- 캐싱 (Redis)

---

## 📚 참고 자료

- [TypeORM 공식 문서](https://typeorm.io/)
- [NestJS TypeORM 가이드](https://docs.nestjs.com/techniques/database)
- [Railway PostgreSQL 문서](https://docs.railway.app/databases/postgresql)
- [PostgreSQL 공식 문서](https://www.postgresql.org/docs/)

---

## 🆘 문제 해결

### "relation does not exist" 오류
```bash
# Migration 실행
npm run migration:run

# 또는 synchronize: true로 자동 생성
```

### "password authentication failed" 오류
- 환경 변수 확인
- PostgreSQL 연결 정보 확인

### Railway 배포 후 데이터베이스 연결 실패
- PostgreSQL 플러그인이 같은 프로젝트에 있는지 확인
- 환경 변수가 올바르게 참조되는지 확인 (`${{Postgres.PGHOST}}`)

---

## ✅ 체크리스트

- [ ] PostgreSQL Docker 컨테이너 실행
- [ ] `.env.development` 설정 확인
- [ ] 로컬에서 애플리케이션 실행 성공
- [ ] Admin 계정 생성 및 로그인 테스트
- [ ] Railway PostgreSQL 플러그인 추가
- [ ] Railway 환경 변수 설정
- [ ] Railway 배포 성공
- [ ] 프로덕션 API 테스트
- [ ] 기존 JSON 데이터 마이그레이션 (필요 시)
