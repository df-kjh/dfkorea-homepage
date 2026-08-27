# DEPRECATED — AI 구현 요약

이 파일은 과거 구현 시점의 요약이며 현재 서버 실행 또는 배포 절차가 아니다. 운영 기준은 루트 [DEPLOYMENT.md](../DEPLOYMENT.md)다.

PostgreSQL compiled migration과 애플리케이션은 다음 fail-fast 순서로 실행한다.

```bash
npm run migration:run:prod && npm run start:prod
```
