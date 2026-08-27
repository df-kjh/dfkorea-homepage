# DEPRECATED — 과거 연결 장애 기록

이 파일은 특정 개발 환경의 과거 장애 기록이며 재현 가능한 데이터베이스 또는 서버 실행 가이드가 아니다. 현재 PostgreSQL 연결, migration, 배포 및 복구 절차는 루트 [DEPLOYMENT.md](../DEPLOYMENT.md)를 따른다.

운영 시작 명령은 compiled migration을 먼저 실행하는 다음 순서다.

```bash
npm run migration:run:prod && npm run start:prod
```
