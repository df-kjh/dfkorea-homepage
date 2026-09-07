# 관리자 보안 점검 및 보완 — 2026-09-07

## 범위와 결론

회사 홈페이지/Nest API의 관리자 로그인, 세션, 제품·게시글·인증서 변경, 입찰·견적 관리, 스케줄러, 파일 업로드/삭제와 웹 보안 경계를 점검했다. 인증 없는 업로드/삭제, 브라우저 토큰 노출, 광범위한 CORS 신뢰, 제품명 HTML 주입 및 주요 공개 취약 의존성을 보완했다. 계정·비밀번호·DB 구조는 변경하지 않았다. 운영 데이터의 생성·수정·삭제나 메일 발송을 시험하지 않았다.

## 확인된 문제와 조치

| 문제 | 근거 | 조치 |
| --- | --- | --- |
| 인증 없는 업로드·삭제 API | UploadController에 JWT guard가 없었으며 로컬 HTTP 재현에서 서비스 진입 | multipart 처리 전 guard; 모든 관리자 쓰기·민감 조회의 401 회귀 검사 |
| JavaScript에 노출되는 관리자 토큰 | localStorage 저장, 토큰 존재만 확인하는 화면 접근 | HttpOnly·Secure·SameSite=Lax·__Host 쿠키, 고정 upstream BFF, 매 요청 현재 계정/자격 상태 확인 |
| 긴/재사용 가능한 세션 및 무제한 로그인 시도 | 기존 24시간 토큰 및 부재한 로그인 제한 | 1시간 토큰, HS256/만료/계정/자격 검증, 계정·원천별 제한 및 입력 크기 제한 |
| 외부 사이트 요청/임의 중계 위험 | 쿠키 전환에 필요한 새 경계 | 변경 요청의 정확한 Origin 검사, 허용 메서드/경로만 중계, 본문 상한, 임의 Authorization/XFF/redirect 차단 |
| 업로드 형식·폴더/삭제 URL 신뢰 | 타입 선언뿐인 folder, MIME-only PDF와 광범위한 URL pathname 처리 | 런타임 폴더 allowlist, 래스터 시그니처/재인코딩/40MP 제한, PDF 형식+첨부 다운로드, 정확한 공개 base의 관리 키만 삭제 |
| 광범위한 CORS | 운영 API가 임의 `*.vercel.app` Origin을 그대로 허용한 읽기 전용 증거 | 정확한 origin만 허용; 운영 허용 목록은 대표 도메인으로 정리 |
| 제품명 저장 HTML 주입 | ProductInfo의 입력값 v-html 렌더링 재현 | Vue 텍스트 렌더링으로 전환 |
| 보안 응답 헤더 부족 | 운영 관리자 페이지의 nosniff/frame/CSP 부재 | 관리자 no-store/noindex, nosniff, frame-ancestors/DENY, referrer-policy, HTTPS HSTS |
| 취약 의존성/런타임 | npm audit 및 공식 advisory | Nuxt4.5.1, Axios1.20, Sharp0.35.4, Multer2.3.0 등 패치; Node22 지원 버전으로 Docker/engine 갱신 |

SameSite=Lax는 NAVER WORKS OAuth에서 홈페이지로 돌아오는 최상위 GET 이동을 지원한다. 상태를 변경하는 요청은 별도로 정확한 Origin 및 cross-site 검증을 거친다. 공개 카탈로그/소식/인증 조회와 고객 견적의 별도 인증 경계는 유지한다.

## 검증

- Backend canonical CI: 73 suites/1,017 unit tests, 35 contract tests 통과. 린트·타입 검사·새 빌드·compiled startup/TypeORM discovery 통과.
- 실제 disposable PostgreSQL이 필요한 115개 테스트는 실행하지 않았다. 운영 DB를 테스트 DB로 사용하지 않았다.
- Frontend: 55 suites/449 tests, 타입 검사, 운영 빌드 및 G2B route·회사 소개/검색 메타데이터 검증 통과. OAuth 왕복·긴 작업 타임아웃·관리자 업로드 한도·첨부 스트리밍 회귀 검사를 포함한다.
- Node22.23.2에서 backend compiled startup/discovery와 HTTP/upload 59개 테스트 통과.
- 빌드된 SSR 관리자 대시보드에 익명 접근하면 로그인 화면으로 이동함을 브라우저에서 확인했다. 로컬 4180은 운영 CORS 허용 대상이 아니므로 공개 API의 브라우저 호출은 운영 도메인에서 별도 확인한다.
- 로컬 이중 기반 HTTP 테스트로 로그인 성공/실패·만료·위조·자격 변경, CSRF, multipart, JSON 삭제/본문 없는 관리자 동작, 비공개 첨부 바이너리를 검증했다.
- 원본/검사 로그: `output/security-audit/`. 로그인 토큰·비밀번호 등 비밀값은 기록하지 않았다.

## 남은 한계와 후속 우선순위

1. MFA/패스키, 개인별 관리자 계정·역할과 보안 감사 이력은 후속 기능이다.
2. 로그아웃은 쿠키 삭제다. 이미 복사된 bearer는 최대 1시간 유효하다. 개별 서버 세션 폐기 기능이 없으므로 긴급 전체 무효화에는 JWT_SECRET 회전 또는 관리자 자격 변경을 사용한다.
3. 로그인 제한은 프로세스별 메모리로 재시작 시 초기화되고 replica 간 공유되지 않는다. BFF/프록시 원천 IP가 함께 집계될 수 있다. 공유 제한 저장소/플랫폼 방화벽을 후속 적용할 수 있다.
4. PDF 형식 검증은 악성코드 검사가 아니며 기존 공개 R2 자료의 헤더·내용을 일괄 재작성하지 않았다. CSP도 frame-ancestors만 적용했으며 script-src 확대는 별도 검증이 필요하다.
5. 패키지 감사 `--omit=dev`: backend Critical/High 0, Moderate11/Low1; frontend Critical/High0, Moderate1. 이는 의존 경로를 포함한 package 개수이며 독립적인 취약점 개수가 아니다. Nest/Express major 업그레이드, 문서 파서 fflate/file-type, TypeORM 등의 추가 패치 검토가 남는다. frontend 잔여 항목은 Nuxt build checker→ESLint→@humanfs의 빌드 도구 경로다. 모든 취약점이 제거됐다는 의미가 아니다.
6. Vercel 호스팅의 4.5MB 요청 제한 때문에 관리자 업로드는 4MiB로 명시적으로 제한한다. 이미지/PDF의 기존 표시 한도보다 작으며, 대용량 파일 지원은 서명 업로드 기능이 필요하다. 수집/AI 동기 작업은 240초 이후 결과가 불확실할 수 있어 상태 확인 안내를 제공한다.
7. bcrypt 기존 72바이트 처리 특성을 유지했고 로그인 입력만 1,024바이트로 제한했다. 기존 비밀번호를 임의로 변경하지 않았다.

- [Vercel Functions 제한](https://vercel.com/docs/functions/limitations), [실행 시간 설정](https://vercel.com/docs/functions/configuring-functions/duration)

## 참고한 공식 자료

- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html), [HTML5 Security](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html)
- [Nuxt 보안 공지](https://github.com/nuxt/nuxt/security/advisories/GHSA-wm8w-6qjm-cv43), [Multer 공지](https://github.com/expressjs/multer/security/advisories/GHSA-72gw-mp4g-v24j), [Sharp 공지](https://github.com/lovell/sharp/security/advisories/GHSA-f88m-g3jw-g9cj)
- [fast-xml-parser 공지](https://github.com/NaturalIntelligence/fast-xml-parser/security/advisories/GHSA-m7jm-9gc2-mpf2), [Axios1.20 release](https://github.com/axios/axios/releases/tag/v1.20.0), [Node 릴리스 지원](https://nodejs.org/en/about/previous-releases)

## 운영 반영 기록

- 메인 통합 코드: `e797040ee062050226b09a86be8ef05b47ec9267`. 동시 진행된 입찰 변경과 견적 문구 변경도 보존했다.
- Vercel: `dpl_HU4JyE1uvitaN2KMpTrGEzCPuh8s` READY, `dfkorealed.com` alias 연결 확인.
- Railway: `1c83a6c9-fd95-45e0-9d19-492d2148ff15` SUCCESS, 동일 코드 revision 확인.
- 운영 HTTP 15개 검사 통과: 관리자 익명 이동 302, 세션/입찰/견적/업로드/삭제 401, 외부 Origin 변경 요청 403, 정상 홈페이지/API 200, 임의 Vercel origin CORS 미허용과 대표 도메인 허용 확인.
- 관리자 no-store/noindex, nosniff/DENY/CSP와 홈페이지 HSTS를 확인했다. Railway API는 TLS 종단 프록시를 신뢰하도록 설정하지 않아 app의 HSTS가 나오지 않는다. 임의 XFF 신뢰를 열지 않았으며 프록시 경로를 확인한 운영 HSTS 설정은 후속 검토 대상이다.
- 운영 브라우저에서 제품 25개/필터 표시와 대시보드 익명 접근 시 새 로그인 화면 이동을 확인했다. 실제 관리자 자격으로 저장·삭제·메일을 수행하지 않았으며 인증 후 기능은 로컬 HTTP 이중으로 검증했다.
- 운영 CORS_ORIGIN은 `https://dfkorealed.com`으로 좁혔다. 계정·비밀번호/DB 데이터/R2 제품 이미지는 이 점검에서 변경하지 않았다. 기존 세션은 다시 로그인해야 한다.
- 증거: `output/security-audit/production-after.json`, `verification.json`.
