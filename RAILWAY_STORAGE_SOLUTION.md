# DEPRECATED — Railway storage notes

이 문서는 과거 storage 실험 기록이며 현재 운영 절차가 아니다. 업로드 저장소 선택, 백업, 배포 및 롤백은 루트 [DEPLOYMENT.md](./DEPLOYMENT.md)를 단일 기준으로 따른다.

백엔드는 PostgreSQL을 먼저 provision하고 compiled migration이 성공한 뒤에만 시작한다.

```bash
npm run migration:run:prod && npm run start:prod
```
