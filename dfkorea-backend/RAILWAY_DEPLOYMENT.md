# Railway 백엔드 배포 체크리스트

이 파일은 백엔드 디렉터리에서 찾기 쉬운 요약이다. 전체 환경 변수, 백업, 입찰 스케줄·SMTP, 스테이징 검증과 롤백의 단일 기준은 루트 [DEPLOYMENT.md](../DEPLOYMENT.md)다.

## 1. 서비스 준비

- Railway 프로젝트에 backend service와 PostgreSQL service를 만든다.
- backend Root Directory는 `dfkorea-backend`다.
- 두 service는 같은 Railway project/environment에 둔다.

## 2. 환경 변수

```bash
NODE_ENV=production
PORT=3000
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_USERNAME=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
DB_NAME=${{Postgres.PGDATABASE}}
TYPEORM_SYNCHRONIZE=false
JWT_SECRET=<secret-store-value>
JWT_EXPIRES_IN=24h
CORS_ORIGIN=https://your-frontend.example.com
```

공식 입찰 API와 NAVER WORKS SMTP를 사용하는 환경은 루트 `DEPLOYMENT.md`의 필수 변수를 추가한다. 운영 비밀값을 저장소나 deploy log에 출력하지 않는다.

## 3. migration-first 명령

Build Command:

```bash
npm ci && npm run build
```

Start Command:

```bash
npm run migration:run:prod && npm run start:prod
```

이 명령은 `dist/database/typeorm.config.js`와 compiled migration을 사용한다. `&&`를 유지해 migration 실패 시 새 애플리케이션 프로세스가 시작되지 않게 한다. `railway.json`과 Dockerfile도 같은 fail-fast 순서를 유지한다.

## 4. 검증

- deploy log: compiled migration 성공 후 Nest startup
- database: 예상 migration과 테이블 존재, 운영 자동 동기화 비활성
- API: health endpoint, 관리자 JWT, CORS origin
- frontend: `VITE_API_BASE_URL`이 실제 HTTPS backend URL을 가리킴
- uploads: 승인된 Railway Volume 또는 object storage 사용

입찰 기능의 destructive integration runner는 원격 Railway DB에 실행하지 않는다. 별도 허용된 로컬 disposable PostgreSQL에서만 실행하며, 실제 배포 전 확인 항목과 롤백은 [DEPLOYMENT.md](../DEPLOYMENT.md)를 따른다.
