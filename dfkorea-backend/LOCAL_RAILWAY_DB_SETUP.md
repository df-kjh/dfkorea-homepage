# DEPRECATED — 로컬 Railway DB 연결 가이드

이 문서의 원격 운영 데이터베이스 연결 절차는 안전한 개발·검증 경로가 아니므로 사용하지 않는다. 로컬 개발은 별도 PostgreSQL을 사용하고, 테스트는 명시적으로 허용된 disposable test DB에서만 수행한다. 환경 변수와 운영 절차는 루트 [DEPLOYMENT.md](../DEPLOYMENT.md)를 따른다.

운영 서버는 compiled migration이 성공한 뒤에만 시작한다.

```bash
npm run migration:run:prod && npm run start:prod
```
