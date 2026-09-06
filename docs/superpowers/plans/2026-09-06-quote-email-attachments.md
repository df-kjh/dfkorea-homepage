# 견적 사진 메일 첨부 전용 변경 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox syntax for tracking.

**Goal:** R2설정 없이 사진을 메일 첨부로 보내고 발송 수락 후 서버 bytes를 삭제한다.
**Architecture:** PostgreSQL 임시 payload + 기존 메일 outbox. 공개 multipart/API 계약 유지.
**Tech Stack:** NestJS/TypeORM/PostgreSQL/Sharp/NAVER WORKS, Vue/Nuxt.
**Spec:** docs/superpowers/specs/2026-09-06-quote-email-attachments-design.md

## Global Constraints

- 작업폴더 .worktrees/online-quote, 기준6738d0a. 원래 작업복사본의 기존변경을 보존하고 이번diff만 적용한다.
- production/실제NTS/NAVER/R2 호출 없이 테스트DB에서 검증한다.
- 기존migration 수정금지, 사진bytes 목록/상세/log 노출금지, payload 누락시 사진없이 발송금지.
- 사진3장/원본5MiB/변환2MiB/전체6MiB. 미제출24시간, 제출후최대7일,202수락즉시삭제.
- 에이전트는 할당파일만 수정하고 커밋하지 않는다. 메인은계획/검증/통합 담당.

## Task 1 — backend temporary payload / delivery lifecycle

Owner quote_backend. Files src/quotes/**, new migration, .env.example, database-schema.md, required discovery probes only. Existing mail transport not changed.
Interface: preserve POST attachments(file,clientAttachmentId), DELETE id, POST quote. privacy.version gains new policy identifier; privacy.retentionDays remains request retention. Photo max7day constant described frontend, no extra setting needed.

- [x] RED: PostgreSQL upload/read in production with no R2/local vars; duplicate upload sameid/content samebytes; crosssession denied.
- [x] GREEN: separate bytea payload schema and storage class, immutable migration upgrade, no files/S3 imports for quote storage.
- [x] RED/GREEN:202 acceptance+payload purge atomic;429 keeps payload;ambiguous keeps untilexpiry;7dayexpired/missing never sends stripped email;adminread410/retryrejected;cleanup skips in-flight;requestreplay intact.
```ts
expect(delivery.status).toBe('PROVIDER_ACCEPTED');
expect(await payloadCount(requestId)).toBe(0);
expect(sentMail.attachments).toHaveLength(3);
```
- [x] Update schema/env/docs and affected existing test fixtures; realPG up/down+unit+lint+tsc pass.

## Task 2 — frontend/privacy/docs

Owner quote_frontend. Files frontend quote PrivacyDisclosure etc ONLY needed copy and meaningful tests, docs/menus/quote.md, existing online-quote design supersession note. No backend edits.
- [x] Explain quote/company retention separately from photos: DB temp24h or submitted<=7days;mail provideraccepted purge;mail attachment remains in recipientmail.
- [x] UI upload/select/photo3limits remain. Test privacy disclosure actual wording and no existing365day photo claim.
- [x] Remove obsolete R2requirement from current menu docs/design; mark new spec authoritative for superseded storage sections. Provide concise operator setup note.
- [x] Relevant Vitest/types pass; report changedfiles.

## Task 3 — independent review / validation / integrate

Owner main+quote_integrations reviewer (read-only review afterTask1).
- [x] Review missingpayload/acceptancecommitfailure/races/cleanup/privacy/migration together; fixes delegated to owners.
- [x] Backend fulltest:ci and isolatedPG; frontend relevant suite/types/build as changesjustify.
- [x] Feature-only diff6738d0a check/apply original folder, preserve preexisting changes, diffcheck and documentation verification.
- [x] Report R2removed, temporaryDB exactmeaning, test evidence and outstandingNTS/NAVER/DB/worker configuration.

## 검증 결과

- Task1: 실제 PostgreSQL을 연결한 견적10개 suite·81개 테스트 통과. 신규 임시첨부12개 테스트에 무R2 production,3장메일첨부,202+삭제원자성/강제rollback,429/불명결과보존,7일/1일보유상한,legacy미존재,staleclaim,관리자bytes미노출,새migrationdown/up을 포함한다. 대상ESLint/타입검사통과.
- Task2: 새개인정보문구2개 RED→GREEN, 관련5개 suite·37개 테스트/타입검사/ESLint통과. 독립리뷰지적없음.

- 최종 독립리뷰: 남은 P0/P1/P2 없음. 전체 백엔드CI(43suite411tests+계약4suite32tests),전체린트/타입검사/빌드/컴파일부트스트랩/엔티티검색통과. 실제DB39개 테스트는 기본CI생략과별도로 위81개 견적테스트에 포함해실행했다.
- 이번 변경파일22개를 원래 작업복사본에 기능diff만 적용했으며 검증된worktree와 내용동일을 확인했다. 기존 다른 작업은 보존했다. 외부실메일/NTS/운영DB마이그레이션/배포는 수행하지 않았다.
