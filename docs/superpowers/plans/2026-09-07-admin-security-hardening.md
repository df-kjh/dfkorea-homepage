# Admin Security Hardening Implementation Plan

> **For agentic workers:** Use independent scoped agents for auth, upload authorization, and web boundaries. Steps use checkbox tracking; main integrates and verifies all changes.

**Goal:** Close confirmed admin authentication, authorization, upload and browser security gaps while preserving public and admin workflows.
**Architecture:** Nest guards and validated storage boundaries protect the API. A Nuxt same-origin BFF keeps admin JWTs in HttpOnly cookies and verifies unsafe request origins. Exact CORS, compatible response headers, escaped rendering and patched dependencies harden adjacent boundaries.
**Tech Stack:** NestJS 10, Nuxt 4, Vue 3, TypeScript, Jest/Supertest, Vitest, PostgreSQL, R2, Railway, Vercel.
**Spec:** `docs/security/2026-09-07-admin-hardening-spec.md`

## Global Constraints

- Worktree `.worktrees/admin-security`, branch `codex/admin-security-hardening`.
- Preserve unrelated photo/research work in the main checkout.
- No destructive production tests, credential resets or real message sends.
- No schema change; document the 1h stolen-token and per-process throttle limitations.

## Task 1: Authentication and browser session

**Files:** `dfkorea-backend/src/auth/**`, frontend `src/api/client.ts`, authAPI in `src/api/index.ts`, `src/middleware/auth.ts`, admin login/dashboard, new `src/server/api/admin/**` and shared tested relay policy.
**Interface:** browser `/api/admin/auth/login`, `/session`, `/logout`; protected same-origin API relay forwards a server-only Bearer to the fixed API. Public client remains direct.
- [x] Inspect current JWT24h/localStorage flow and establish backend baseline (67 suites,900 tests pass;107 integration tests skipped).
- [x] Add failing tests: missing/forged/expired/stale-credential token, login input/failure/rate limit, forged CSRF origin, forbidden upstream path/header, session/login/logout state.
- [x] Implement cookie relay, backend session check, credential-bound 1h JWT and bounded login limits.
- [x] Run auth/backend and browser session/relay tests, including multipart and binary attachment compatibility.

## Task 2: Upload and API authorization

**Files:** `dfkorea-backend/src/upload/**`, controller authorization contract tests.
**Interface:** existing `/upload/image`, `/upload/file`, DELETE `/upload/image` signatures remain; JWT required before multipart parsing; only managed upload keys accepted for deletion.
- [x] Audit all controllers; public upload/delete confirmed; other known admin routes guarded.
- [x] Add local HTTP regression tests for unauthenticated multipart/delete and guarded admin routes/public reads.
- [x] Implement folder allowlist, trusted format/signature/size limits and exact storage-origin/key deletion validation.
- [x] Test authorized uploads, PDFs and rejects for traversal/foreign keys/oversized or disguised files.

## Task 3: Browser and server boundaries

**Files:** backend `main.ts`, security policy helpers/specs; frontend `nuxt.config.ts`, `ProductInfo.vue`/spec; package.json/lockfiles.
**Interface:** CORS_ORIGIN is an exact origin list; no wildcard hosting-provider trust; public SSR with absent Origin still works. Cookie BFF does not rely on cross-site cookies.
- [x] Audit CORS broad provider trust, response headers, v-html sink and production dependency advisory reports.
- [x] Test exact CORS acceptance, hostile suffix rejection, HTTPS HSTS/admin no-store and escaped product name.
- [x] Implement compatible security headers (frame-ancestors CSP only), local PDF attachment responses and text-only product names.
- [x] Patch verified runtime vulnerable packages without destructive major auto-upgrade; rerun package audits.

## Task 4: Integration and release

**Files:** `docs/menus/admin.md`, `docs/menus/README.md`, this plan, security report and deployment docs.
- [x] Review scoped changes and run complete frontend/backend test suites, contract checks, type checks and production builds.
- [x] Verify local authenticated and unauthenticated flows with mocked backend services; confirm no live-data mutation in tests.
- [x] Record findings, fixes, remaining limits and operating instructions; update affected menu docs.
- [ ] Integrate only security changes, deploy backend/front safely, and verify live unauthorized routes/headers/public pages without destructive probes.

### Verification record

- Backend canonical CI: 72 suites/1,015 unit tests + 35 contract tests passed; 107 disposable-DB integration tests skipped. Lint, tsc, fresh build, compiled startup and TypeORM discovery passed.
- Frontend: 52 suites/420 tests, typecheck and production build passed; G2B route, about metadata, search indexing artifact checks passed.
- Node22.23.2: compiled backend startup/TypeORM discovery and 59 HTTP/upload tests passed.
- Browser built SSR `/admin/dashboard` redirects unauthenticated visitor to rendered login form.
- Upload commit `56fc6e9`, auth `28a1c52`, boundary/dependency `33fe67e`; independent cross-review found OAuth cookie and long-operation timeout regressions; OAuth fixed in `58a7272`, timeout adaptation in progress.
