# PostgreSQL 빠른 시작

운영 배포, 백업, 환경 변수, 검증 및 롤백의 단일 기준은 루트 [DEPLOYMENT.md](../DEPLOYMENT.md)다. 개발과 운영 모두 PostgreSQL 및 TypeORM migration을 사용하며 schema 자동 동기화는 사용하지 않는다.

## 로컬 실행

1. PostgreSQL 16을 시작한다.

   ```bash
   docker run --name dfkorea-postgres \
     -e POSTGRES_USER=postgres \
     -e POSTGRES_PASSWORD=postgres \
     -e POSTGRES_DB=dfkorea \
     -p 5432:5432 \
     -d postgres:16-alpine
   ```

2. 환경 변수와 의존성을 준비한다.

   ```bash
   cp .env.example .env.development
   npm ci
   ```

3. 코드를 컴파일하고 migration을 적용한 뒤 개발 서버를 시작한다. migration이 실패하면 서버를 시작하지 않는다.

   ```bash
   npm run build
   npm run migration:run:prod && npm run start:dev
   ```

4. `GET /health`와 필요한 API를 확인한다. 초기 관리자 생성은 승인된 운영 절차와 강한 임시 비밀번호를 사용하고, 저장소에 자격 증명을 기록하지 않는다.

## 운영 실행

PostgreSQL을 먼저 프로비저닝하고 `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`, `TYPEORM_SYNCHRONIZE=false`를 설정한다. 배포 이미지를 빌드한 뒤 아래 명령을 하나의 fail-fast 시작 명령으로 사용한다.

```bash
npm run migration:run:prod && npm run start:prod
```

배포가 시작된 뒤 수동으로 schema를 맞추거나 migration 오류를 무시하지 않는다. 상세 Railway 설정과 롤백 절차도 [DEPLOYMENT.md](../DEPLOYMENT.md)를 따른다.
