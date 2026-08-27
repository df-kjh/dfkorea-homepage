# AI 자동 블로그 기능 빠른 확인

이 문서는 기능 확인용 요약이다. 상세 API·스케줄·제약은 [AI 자동 블로그 기능 가이드](./AI_AUTO_BLOG_GUIDE.md), 운영 배포는 루트 [DEPLOYMENT.md](../DEPLOYMENT.md)를 각각 따른다. 기능 가이드는 배포 authority가 아니다.

실제 Gemini 모델 제공 여부, quota, 가격과 생성 품질은 이번 작업에서 검증하지 않았다.

## 필수 설정

승인된 개발 또는 비밀 저장소에 `GEMINI_API_KEY`를 설정한다. 선택적으로 `GEMINI_MODEL`, `CRON_TIMEZONE`을 설정할 수 있다. 키 값을 문서나 로그에 출력하지 않는다.

## 로컬 기능 확인

개발 서버에서 관리자 JWT로 다음 endpoint 중 하나를 호출하거나 소식 관리 화면의 AI 자동생성 버튼을 사용한다.

```http
POST /api/scheduler/trigger
POST /api/scheduler/trigger/product-company-news
```

HTTP 응답이나 화면 알림만 신뢰하지 말고 백엔드 오류 로그와 실제 게시글 생성을 함께 확인한다. 제품소식에는 저장된 제품이 하나 이상 필요하다.

## 운영 시작

PostgreSQL을 먼저 provision하고 build를 완료한 뒤, backend 디렉터리에서 compiled migration-first 명령을 사용한다.

```bash
npm run migration:run:prod && npm run start:prod
```

환경 변수, replica, 백업, 검증 및 롤백은 [DEPLOYMENT.md](../DEPLOYMENT.md)의 절차를 따른다.
