# PostgreSQL migration 운영 가이드

이 문서는 백엔드 migration 운용 요약이다. 배포 환경 변수, 백업, 스테이징 검증, 장애 대응과 롤백의 단일 기준은 루트 [DEPLOYMENT.md](../DEPLOYMENT.md)다.

## 원칙

- 모든 환경에서 PostgreSQL을 사용한다.
- entity 변경에는 순서가 보장되는 TypeORM migration과 `database-schema.md` 갱신을 함께 포함한다.
- 운영에서는 `TYPEORM_SYNCHRONIZE=false`를 유지한다.
- 운영 migration은 컴파일된 `dist/migrations/*.js`만 실행한다.
- migration 실패를 무시하거나 애플리케이션을 먼저 시작하지 않는다.

## 로컬 준비

```bash
docker run --name dfkorea-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=dfkorea \
  -p 5432:5432 \
  -d postgres:16-alpine

cp .env.example .env.development
npm ci
npm run build
npm run migration:run:prod && npm run start:dev
```

migration 파일을 추가했다면 entity metadata, migration 순서, 컴파일 결과의 discovery를 테스트한다. 파괴적인 통합 테스트는 명시적으로 허용된 일회용 테스트 데이터베이스에서만 실행한다.

## Railway와 기타 운영 환경

1. PostgreSQL 서비스를 먼저 프로비저닝한다.
2. 비밀 저장소에서 `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`을 주입한다.
3. `NODE_ENV=production`과 `TYPEORM_SYNCHRONIZE=false`를 설정한다.
4. Build Command로 `npm ci && npm run build`를 실행한다.
5. Start Command는 다음 한 줄로 고정한다.

   ```bash
   npm run migration:run:prod && npm run start:prod
   ```

`&&` 때문에 compiled migration이 하나라도 실패하면 Nest 애플리케이션은 시작되지 않는다. deploy log에서 migration 성공이 startup보다 앞서는지 확인하고 `/health`를 검증한다.

## 변경 배포와 롤백

1. 변경 전 PostgreSQL 백업을 만들고 복구 가능성을 확인한다.
2. 같은 빌드 산출물을 스테이징에서 적용해 migration과 애플리케이션을 검증한다.
3. 운영 배포에서도 동일한 migration-first 시작 명령을 사용한다.
4. 실패하면 새 애플리케이션을 시작하지 않고 원인을 수정한다. 데이터 롤백이 필요하면 [DEPLOYMENT.md](../DEPLOYMENT.md)의 승인된 복구 절차를 따른다.

운영 데이터베이스에서 임의 DDL을 실행하거나 migration 기록을 수동 편집하지 않는다.

## 점검 목록

- [ ] PostgreSQL 접속 변수와 TLS 정책 확인
- [ ] `TYPEORM_SYNCHRONIZE=false` 확인
- [ ] 백업 및 복구 절차 확인
- [ ] `npm run build` 성공
- [ ] compiled migration discovery 테스트 성공
- [ ] `npm run migration:run:prod && npm run start:prod` 설정
- [ ] migration 실패 시 startup이 중단되는지 확인
- [ ] `/health`, 로그인, 핵심 API smoke test
