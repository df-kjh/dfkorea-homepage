# AI 자동 블로그 기능 가이드

이 문서는 현재 저장소에 구현된 AI 게시글 기능의 API, 스케줄, 결과와 문제 확인 방법을 설명한다. 배포 authority가 아니며, 환경 변수·PostgreSQL·백업·배포·롤백은 루트 [DEPLOYMENT.md](../DEPLOYMENT.md)를 단일 기준으로 사용한다.

> 검증 범위: 코드 경로와 로컬 테스트 계약을 기준으로 작성했다. 이번 입찰 기능 작업에서는 실제 Gemini 호출, 현재 모델 제공 여부, 생성 품질, 요금 또는 quota를 검증하지 않았다. 외부 API 동작은 승인된 별도 환경에서 확인해야 한다.

## 구현된 기능

- LED 산업동향 게시글을 매주 월요일 08:00에 생성한다.
- 저장된 제품을 날짜 기준으로 순환 선택해 제품소식 게시글을 매일 08:00에 생성한다.
- 두 작업은 `CRON_TIMEZONE`을 사용하며 값이 없으면 `Asia/Seoul`을 사용한다.
- `node-cron`의 process-local `noOverlap`을 사용해 같은 프로세스 안의 중첩 실행을 막는다.
- 생성 결과는 기존 게시글 서비스로 PostgreSQL에 저장한다.
- 관리자 JWT가 있는 수동 trigger API와 관리자 화면 버튼을 제공한다.

현재 스케줄러는 replica 간 영속 lock을 사용하지 않는다. 백엔드 replica가 여러 개면 각 replica에서 같은 AI 작업이 실행될 수 있으므로, 운영에서 이 기능을 활성화하기 전 단일 scheduler replica 또는 별도 cross-replica 조정이 필요하다.

## 설정 계약

| 변수 | 동작 |
| --- | --- |
| `GEMINI_API_KEY` | 없으면 AI 서비스가 비활성화되고 예약·수동 생성은 게시글을 만들지 않는다. |
| `GEMINI_MODEL` | 선택 사항. 코드 기본값은 `gemini-3.5-flash`이며 실제 계정에서의 제공 여부는 별도 검증이 필요하다. |
| `CRON_TIMEZONE` | 선택 사항. 기본값은 `Asia/Seoul`이다. |

비밀값은 `.env` 파일 예시, 문서, 로그, API 응답 또는 Git에 기록하지 않는다. 승인된 비밀 저장소와 루트 배포 문서를 따른다.

## 수동 API

두 endpoint 모두 `JwtAuthGuard`로 보호된다.

### 산업동향 생성

```http
POST /api/scheduler/trigger
Authorization: Bearer <admin-jwt>
```

### 제품소식 생성

```http
POST /api/scheduler/trigger/product-company-news
Authorization: Bearer <admin-jwt>
```

제품소식은 제품이 하나 이상 저장되어 있어야 한다. 같은 KST 날짜에는 정렬된 제품 목록에서 같은 제품을 선택하며 날짜가 바뀌면 다음 제품으로 순환한다.

## 생성 결과

산업동향 생성기는 제목, 발췌문, Markdown 본문, `산업동향` 카테고리와 기본 이미지를 만든다. 제품소식 생성기는 선택한 제품의 기존 명칭, 사양, 인증, 이미지와 설명을 prompt 입력으로 사용하고 `제품소식` 카테고리 게시글을 만든다.

AI 응답은 parsing과 필드 정규화를 거쳐 게시글 서비스에 저장되지만, 생성 콘텐츠의 사실성이나 최신 외부 시장 데이터는 보장하지 않는다. 게시 전 관리자 검토 절차가 필요하다.

## 관리자 화면

소식 관리 화면의 다음 버튼이 수동 API를 호출한다.

- `산업동향 AI 자동생성`
- `제품소식 AI 자동생성`

현재 화면은 API 응답 뒤 3초 후 성공 알림을 표시한다. 스케줄러가 내부 생성 오류를 로그로 처리하므로 HTTP 성공이나 화면 알림만으로 게시글 저장 성공을 판단하면 안 된다. 백엔드 오류 로그와 실제 게시글 목록을 함께 확인한다.

## 문제 확인

### AI 기능이 비활성화됨

백엔드 로그에서 `GEMINI_API_KEY not found`를 확인한다. 키가 없으면 서버 자체는 실행되지만 AI 생성만 건너뛴다. 키 값은 출력하지 않는다.

### 모델 또는 응답 오류

`GEMINI_MODEL`이 실제 계정에서 제공되는지 확인하고, 응답 parsing·validation 오류를 백엔드 로그에서 확인한다. 모델명, quota, 가격은 외부에서 바뀔 수 있으므로 이 문서의 고정 주장으로 취급하지 않는다.

### 예약 작업이 예상 시각에 실행되지 않음

startup 로그의 timezone과 next-run 기록을 확인한다. `CRON_TIMEZONE`과 컨테이너 환경을 확인하고, replica 수에 따른 중복 가능성도 점검한다.

### 제품소식이 생성되지 않음

제품 데이터가 있는지, 제품 이미지·설명·사양이 현재 entity 형태와 맞는지, AI 오류 로그가 있는지 확인한다.

## 관련 파일

- `src/ai/ai.service.ts`: Gemini 호출, 응답 검증, 콘텐츠 생성
- `src/scheduler/scheduler.service.ts`: 주간·일일 schedule과 수동 실행
- `src/scheduler/scheduler.controller.ts`: JWT 보호 trigger API
- `../led-lighting-website/src/components/admin/AiPostGeneratorButton.vue`: 관리자 수동 trigger UI

## 운영 경계

배포 이미지에는 compiled TypeORM 설정과 migration이 포함되어야 한다. 백엔드 디렉터리에서 사용하는 canonical 시작 순서는 다음과 같으며, 상세 절차는 [DEPLOYMENT.md](../DEPLOYMENT.md)를 따른다.

```bash
npm run migration:run:prod && npm run start:prod
```
