# 온라인 견적 운영 배포 계획

**목표:** 현재 운영3b332da에 견적 기능만 더해 Railway/Vercel 배포. 사용자가 명시적으로 배포를 승인했다.
**범위:** 기존 배포 제품 프레임/표/설명 보존. 미배포 AI/관리자 변경 제외. 별도 견적 환경변수 없이 기존 JWT/CORS/NAVER/NTS 활용. 실제 외부 메일 테스트는 별도 명시 승인 없이 보내지 않는다.

- [x] 현재 운영 배포와 환경변수 존재 확인: Railway6e954d60, Verceldpl_HWuPt4YdJuVhdhnq1G8PeNupC9FY, source3b332da.
- [x] origin/main3b332da 기준격리 quote-release 생성. 견적기능diff d304130..770515a만 적용.
- [x] 프론트 운영변경 보존 병합: 241개 테스트, 타입 검사, production build/API URL 검사 통과. 운영 이미지·표·관리자 파일 동일 확인.
- [x] 운영 DB readonly preflight와 전체 custom-format 백업 완료. PostgreSQL17 pg_dump 성공, archive 76 entries, checksum 재검증 완료. 미적용 migration은 quote 2개만 확인.
- [ ] 백엔드 release CI 통과. Railway 5cf554e2-2486-4402-98b5-4b0e74f1a529 SUCCESS, quote 2개 migration 성공 및 Nest 시작 확인. 기존 데이터·메일 연결 사후 확인 진행 중.
- [ ] Vercelproduction배포/도메인/PC모바일견적UI 확인.
- [ ] 운영 접수세션/필터 API 스모크,국세청 키존재/미등록검증응답,실메일테스트미수행한계기록.
- [ ] 메뉴/배포기록갱신, 원래사용자작업보존,결과안내.

운영기반: Railwayproject0a0e02e4-18e8-4cf2-a75b-38d5a68a8440/envbec21bcb-ddbe-43a4-a8b7-ba7f2299a842/service d5bdca6a-9279-41fe-844f-4e7e9ec1dc3c. Vercelprj_vU2Ttnwwv57ERvLYQag3sYpgY9pe. 비밀값/업무원문은 문서·로그에 남기지 않는다.

사전 검증: backend CI 43 suites/418 tests + production contract 4 suites/32 tests 통과. 운영 DB PostgreSQL17, 기존18 migrations 완료, products25/admins1, NAVER WORKS OAuth 연결 확인. 신규 migrations는 CreateQuoteTables1788652800000, AddQuoteAttachmentPayloads1788652900000 두 개다.

배포 전 백업: `/Users/kim-jh/.codex/backups/dfkorea/20260906T042730Z-before-online-quote.dump` (권한0600, 337285 bytes). SHA-256: `3b1b039fece86c601c546ac81a8ea18e6191d9f76500435aa3d0fad31be12794`. 운영 TYPEORM_SYNCHRONIZE는 false로 정리하며 애플리케이션의 기존 production 강제 false와 일치시킨다.

최종 독립 검토: 수동 병합 및 기존 운영 API/제품 화면 보존 확인, 신규 배포 차단 사항 없음. Railway 프록시 hop 수는 검증되지 않아 TRUST_PROXY_HOPS를 추가하지 않는다. 기본 req.ip 기준으로 방문자들이 시간당120회 견적 API 한도를 공유할 수 있으며, 방문자별 제한이 운영에서 검증된 것으로 표시하지 않는다.
