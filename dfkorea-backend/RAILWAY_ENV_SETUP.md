# DEPRECATED — Railway 환경 변수 메모

이 문서는 과거 환경 변수 메모이며 현재 운영 목록으로 사용하지 않는다. 승인된 변수, 비밀 관리, PostgreSQL, 배포 및 롤백의 단일 기준은 루트 [DEPLOYMENT.md](../DEPLOYMENT.md)와 `.env.example`이다.

Railway Start Command는 compiled migration 실패 시 애플리케이션 시작도 중단하는 다음 명령이다.

```bash
npm run migration:run:prod && npm run start:prod
```
