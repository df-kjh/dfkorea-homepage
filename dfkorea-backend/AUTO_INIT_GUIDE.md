# DEPRECATED — 자동 초기화 가이드

이 문서의 과거 자동 초기화 절차는 더 이상 지원하지 않으며 따라서는 안 된다. schema는 TypeORM migration으로만 관리하고, 환경 변수·백업·검증·롤백은 루트 [DEPLOYMENT.md](../DEPLOYMENT.md)를 따른다.

운영에서는 compiled migration이 실패하면 서버도 시작하지 않는다.

```bash
npm run migration:run:prod && npm run start:prod
```
