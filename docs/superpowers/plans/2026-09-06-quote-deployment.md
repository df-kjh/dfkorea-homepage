# 온라인 견적 운영 배포 계획

**목표:** 현재 운영3b332da에 견적 기능만 더해 Railway/Vercel 배포. 사용자가 명시적으로 배포를 승인했다.
**범위:** 기존 배포 제품 프레임/표/설명 보존. 미배포 AI/관리자 변경 제외. 별도 견적 환경변수 없이 기존 JWT/CORS/NAVER/NTS 활용. 실제 외부 메일 테스트는 별도 명시 승인 없이 보내지 않는다.

- [x] 현재 운영 배포와 환경변수 존재 확인: Railway6e954d60, Verceldpl_HWuPt4YdJuVhdhnq1G8PeNupC9FY, source3b332da.
- [x] origin/main3b332da 기준격리 quote-release 생성. 견적기능diff d304130..770515a만 적용.
- [x] 프론트 운영변경 보존 병합: 241개 테스트, 타입 검사, production build/API URL 검사 통과. 운영 이미지·표·관리자 파일 동일 확인.
- [x] 운영 DB readonly preflight와 전체 custom-format 백업 완료. PostgreSQL17 pg_dump 성공, archive 76 entries, checksum 재검증 완료. 미적용 migration은 quote 2개만 확인.
- [x] 백엔드 CI·배포·2개 migration 성공. 운영 DB20개 migration/quote8개 tables/products25/admins1/OAuth 연결 확인.
- [x] Vercel dpl_AqKxWb4gdDvz3kB3f5zzEpGzBobh READY, dfkorealed.com 적용. PC1440x1000에서440px 창, 모바일390x844에서 화면 넘침 없음 확인.
- [x] 세션201, invalid Origin403, 익명 admin401, 국세청 mismatch422 확인. 제품 검색 몰드바+40W 결과1개 확인. 실제 사업자 확인 성공·견적 접수·메일 첨부 수신은 미수행.
- [x] 메뉴·설정·배포기록 갱신. 기존 원본 작업은 유지하고 견적 관련 문서만 동기화.

운영기반: Railwayproject0a0e02e4-18e8-4cf2-a75b-38d5a68a8440/envbec21bcb-ddbe-43a4-a8b7-ba7f2299a842/service d5bdca6a-9279-41fe-844f-4e7e9ec1dc3c. Vercelprj_vU2Ttnwwv57ERvLYQag3sYpgY9pe. 비밀값/업무원문은 문서·로그에 남기지 않는다.

사전 검증: backend CI 43 suites/418 tests + production contract 4 suites/32 tests 통과. 운영 DB PostgreSQL17, 기존18 migrations 완료, products25/admins1, NAVER WORKS OAuth 연결 확인. 신규 migrations는 CreateQuoteTables1788652800000, AddQuoteAttachmentPayloads1788652900000 두 개다.

배포 전 백업: `/Users/kim-jh/.codex/backups/dfkorea/20260906T042730Z-before-online-quote.dump` (권한0600, 337285 bytes). SHA-256: `3b1b039fece86c601c546ac81a8ea18e6191d9f76500435aa3d0fad31be12794`. 운영 TYPEORM_SYNCHRONIZE는 false로 정리하며 애플리케이션의 기존 production 강제 false와 일치시킨다.

최종 독립 검토: 수동 병합 및 기존 운영 API/제품 화면 보존 확인, 신규 배포 차단 사항 없음. Railway 프록시 hop 수는 검증되지 않아 TRUST_PROXY_HOPS를 추가하지 않는다. 기본 req.ip 기준으로 방문자들이 시간당120회 견적 API 한도를 공유할 수 있으며, 방문자별 제한이 운영에서 검증된 것으로 표시하지 않는다.

운영 기능 source: e95fe73, main 반영1667404. 인증키 수정 후 Railway7cba79e9-d850-401f-9faf-797815efe9ff SUCCESS. NTS Encoding 키(401)를 Decoding 원문으로 수정한 뒤 공식 API200/OK와 배포 서버422/BUSINESS_MISMATCH를 확인했다. 원문 키는 출력·파일 저장하지 않았다. 최초502검사는 GitHub 재배포 전환과 겹쳤으며 안정된 배포에서 재검증했다. 미인증 세션의 합성 JPEG 업로드는422로 차단되어 실제 사진 저장·발송은 수행하지 않았다. 메일발송0건/견적접수0건이며 세션 검사용 레코드는24시간 만료 정책으로 정리된다.
