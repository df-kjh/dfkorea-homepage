# 자동 초기화 가이드

## 개요

이제 애플리케이션이 시작될 때 **자동으로** 필요한 작업을 수행합니다:

1. ✅ **데이터베이스 테이블 자동 생성** (`synchronize: true`)
2. ✅ **Admin 계정 자동 생성** (`DatabaseInitService`)

**마이그레이션 명령어를 실행할 필요가 없습니다!**

---

## 어떻게 작동하나요?

### 1. 데이터베이스 테이블 자동 생성

**설정 위치**: `src/app.module.ts`

```typescript
TypeOrmModule.forRootAsync({
  // ...
  synchronize: true, // 자동으로 테이블 생성 (개발/프로덕션 모두)
})
```

- 애플리케이션이 시작되면 TypeORM이 Entity 정의를 읽고 자동으로 테이블을 생성/수정합니다
- `Product`, `Post`, `Admin` 테이블이 자동으로 생성됩니다

### 2. Admin 계정 자동 생성

**파일**: `src/database/database-init.service.ts`

```typescript
@Injectable()
export class DatabaseInitService implements OnModuleInit {
  async onModuleInit() {
    // 애플리케이션 시작 시 자동 실행
    await this.initializeAdmin();
  }
  
  private async initializeAdmin() {
    // Admin 계정이 없으면 자동 생성
    // Username: admin
    // Password: admin123
  }
}
```

- 애플리케이션이 시작될 때 `onModuleInit()` 훅이 자동으로 실행됩니다
- Admin 계정이 이미 있는지 확인하고, 없으면 생성합니다
- 이미 있으면 "✅ Admin account already exists" 메시지만 출력합니다

---

## 로컬에서 테스트

### 1. 데이터베이스 초기화 (선택 사항)

처음부터 다시 시작하려면:

```bash
cd /workspaces/dfkorea/dfkorea-backend

# Docker 컨테이너 삭제하고 다시 시작
docker-compose down -v
docker-compose up -d postgres
```

### 2. 백엔드 실행

```bash
npm run start:dev
```

### 3. 로그 확인

터미널에서 다음과 같은 메시지가 보여야 합니다:

```
✅ Admin account created successfully
   Username: admin
   Password: admin123
```

또는 이미 Admin 계정이 있다면:

```
✅ Admin account already exists
```

### 4. 로그인 테스트

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

성공하면 JWT 토큰이 반환됩니다.

---

## Railway 배포

### 이전 방식 (복잡함) ❌

```bash
# 1. 앱 배포
railway up

# 2. Railway 대시보드에서 마이그레이션 수동 실행
# Service > Variables > Run Command
npm run migration:run
```

### 새로운 방식 (간단함) ✅

```bash
# 1. 코드 푸시
git add .
git commit -m "Enable auto-initialization"
git push

# 2. Railway가 자동으로 배포
# 끝! 테이블과 Admin 계정이 자동으로 생성됩니다
```

---

## Railway 배포 확인

### 1. 배포 로그 확인

Railway Dashboard > Service > Deployments > Latest Deployment > Logs

다음 메시지를 찾으세요:

```
✅ Admin account created successfully
   Username: admin
   Password: admin123
```

### 2. API 테스트

Railway에서 제공하는 도메인으로 테스트:

```bash
curl -X POST https://your-app.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

---

## 주의사항

### `synchronize: true` 프로덕션 사용

⚠️ **중요**: `synchronize: true`는 프로덕션에서 사용 시 주의가 필요합니다.

**장점**:
- 자동으로 테이블 생성/수정
- 마이그레이션 불필요
- 배포가 매우 간단함

**단점**:
- Entity 변경 시 데이터 손실 가능성
- 컬럼 삭제/타입 변경 시 자동으로 적용됨

**권장사항**:
- 초기 개발 단계: `synchronize: true` 사용 ✅
- 프로덕션에 실제 고객 데이터가 있을 때: 마이그레이션 사용 고려

### Admin 계정 보안

현재 기본 비밀번호는 `admin123`입니다.

**프로덕션 배포 후 반드시 비밀번호를 변경하세요!**

---

## 문제 해결

### 테이블이 생성되지 않음

**증상**: 애플리케이션이 시작되지만 테이블이 없음

**해결**:
1. `src/app.module.ts`에서 `synchronize: true` 확인
2. Entity 파일이 `entities` 배열에 포함되었는지 확인
3. 데이터베이스 연결 로그 확인

### Admin 계정이 생성되지 않음

**증상**: 로그인 시 401 에러

**해결**:
1. 애플리케이션 시작 로그에서 "Admin account created" 메시지 확인
2. 데이터베이스에서 직접 확인:
   ```bash
   railway run psql $DATABASE_URL -c "SELECT * FROM admin;"
   ```
3. `DatabaseInitService`가 `AppModule` providers에 포함되었는지 확인

### Railway 환경변수 확인

```bash
railway run env | grep -E "PGHOST|PGPORT|PGUSER|PGPASSWORD|PGDATABASE"
```

---

## 다음 단계

1. ✅ 로컬에서 테스트
2. ✅ Railway에 배포
3. ✅ 프론트엔드에서 로그인 테스트
4. 🔒 Admin 비밀번호 변경
5. 📊 실제 제품/게시물 데이터 추가

---

## 관련 문서

- [RAILWAY_QUICKSTART.md](./RAILWAY_QUICKSTART.md) - Railway 배포 전체 가이드
- [POSTGRESQL_MIGRATION_GUIDE.md](./POSTGRESQL_MIGRATION_GUIDE.md) - 마이그레이션 참고 (필요 시)
- [CORS_SETUP.md](./CORS_SETUP.md) - CORS 설정 가이드
