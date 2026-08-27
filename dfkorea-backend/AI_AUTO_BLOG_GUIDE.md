# DEPRECATED — AI 자동 블로그 운영 가이드

이 문서는 과거 구현과 운영 절차를 설명하므로 실행 지침으로 사용하지 않는다. 현재 환경 변수, PostgreSQL, 백업, 배포 및 롤백 절차는 루트 [DEPLOYMENT.md](../DEPLOYMENT.md)를 따른다.

운영 백엔드는 compiled migration이 성공한 뒤에만 시작한다.

```bash
npm run migration:run:prod && npm run start:prod
```
