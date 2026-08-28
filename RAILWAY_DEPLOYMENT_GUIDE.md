# Railway 배포 가이드

이 문서는 Railway 배포의 간단한 진입점이다. 환경 변수 전체 목록, 백업, 입찰 수집·메일 운영, 검증 및 롤백 절차는 루트 [DEPLOYMENT.md](./DEPLOYMENT.md)를 단일 기준으로 사용한다.

## 필수 구성

1. Railway 프로젝트에 백엔드 서비스를 추가하고 Root Directory를 `dfkorea-backend`로 지정한다.
2. 같은 프로젝트에 PostgreSQL 서비스를 provision한다.
3. 백엔드 Variables에 다음 값을 연결한다.

```bash
NODE_ENV=production
PORT=3000
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_USERNAME=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
DB_NAME=${{Postgres.PGDATABASE}}
TYPEORM_SYNCHRONIZE=false
JWT_SECRET=<32-plus-random-secret-with-3-character-classes>
JWT_EXPIRES_IN=24h
CORS_ORIGIN=https://your-frontend.example.com
```

입찰 기능을 운영하면 `DEPLOYMENT.md`에 정의된 공식 API와 NAVER WORKS SMTP 환경 변수도 비밀 저장소에서 주입한다. 비밀값은 문서, 로그, 이미지 또는 저장소에 기록하지 않는다.

## 빌드와 시작

Production build는 다음 명령을 사용한다.

```bash
npm ci && npm run build
```

Start Command는 반드시 compiled migration과 애플리케이션 시작을 하나의 fail-fast 체인으로 실행한다.

```bash
npm run migration:run:prod && npm run start:prod
```

현재 `dfkorea-backend/railway.json`과 Dockerfile이 같은 순서를 사용한다. migration이 실패하면 새 프로세스를 시작하지 않는다. 서비스가 먼저 live가 된 뒤 migration을 수동 실행하는 절차는 사용하지 않는다.

## 배포 확인

- Deploy log에서 모든 compiled migration 성공 뒤 Nest 애플리케이션이 시작됐는지 확인한다.
- 백엔드 health endpoint와 관리자 JWT 로그인을 스테이징 계정으로 확인한다.
- 프론트엔드에는 실제 백엔드 HTTPS 주소를 `VITE_API_BASE_URL`로 설정한다.
- 업로드 파일은 Railway Volume 또는 승인된 object storage에 보관한다. PostgreSQL 데이터와 업로드 파일의 백업·롤백은 [DEPLOYMENT.md](./DEPLOYMENT.md)의 절차를 따른다.
