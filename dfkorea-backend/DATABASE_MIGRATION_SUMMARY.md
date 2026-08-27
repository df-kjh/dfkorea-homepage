# DEPRECATED — 과거 데이터베이스 전환 요약

이 파일은 과거 전환 작업의 요약이며 현재 migration 또는 배포 절차가 아니다. 현재 PostgreSQL schema, 백업, 검증 및 롤백의 기준은 루트 [DEPLOYMENT.md](../DEPLOYMENT.md)와 [database-schema.md](../database-schema.md)다.

운영 애플리케이션은 compiled migration 성공 후에만 시작한다.

```bash
npm run migration:run:prod && npm run start:prod
```
