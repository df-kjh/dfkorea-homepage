# Railway 빠른 배포

상세 절차와 운영 체크리스트의 단일 기준은 [DEPLOYMENT.md](./DEPLOYMENT.md)다.

1. Railway 백엔드 서비스 Root Directory를 `dfkorea-backend`로 설정한다.
2. PostgreSQL 서비스를 추가하고 `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`을 Railway reference 변수로 연결한다.
3. `NODE_ENV=production`, `TYPEORM_SYNCHRONIZE=false`, `JWT_SECRET`, `CORS_ORIGIN`과 필요한 API/SMTP 비밀값을 설정한다.
4. Build Command를 다음과 같이 설정한다.

```bash
npm ci && npm run build
```

5. Start Command는 compiled migration이 실패하면 시작도 실패하도록 다음 한 줄을 사용한다.

```bash
npm run migration:run:prod && npm run start:prod
```

6. deploy log에서 migration 완료가 애플리케이션 시작보다 앞서는지 확인한 뒤 health endpoint와 프론트엔드 연결을 검증한다.

배포 후 수동 migration, 자동 schema 동기화, migration 오류 무시는 허용하지 않는다. 스테이징 검증과 롤백은 [DEPLOYMENT.md](./DEPLOYMENT.md)를 따른다.
