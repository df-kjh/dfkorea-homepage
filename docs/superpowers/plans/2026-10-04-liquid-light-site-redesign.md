# Liquid Light Routed Site Implementation Plan
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox syntax.
**Goal:** Preserve real company/product/certificate/news pages while implementing the praised Liquid Light design across actual Nuxt public UI.
**Architecture:** Public visual foundation and shared page/action components; source-integrated single home shader; retain live data and routed flows.
**Tech Stack:** Existing Nuxt4/Vue3/TS/Tailwind/WebGL2/Vitest.
**Spec:** docs/superpowers/specs/2026-10-04-liquid-light-site-redesign-design.md
## Global Constraints
- Exact routes/data/functions from spec; no API/backend/admin/schema/record changes, no dependency installation, no old prototype mutation.
- Workers disjoint ownership; main orchestrator; current codex branch preserves dirty work; no commit/deploy/messages.
- Public-only ink/paper/champagne, common reusable components, content visible/reduced/mobile accessibility; keep quote/SEO.
## Review Focus
- Route navigation/disposal/reenter Hero must not leak engines or stale root states.
- Mobile menu/quote/PDF/detail coexist without fixed-header obstruction or overflow320.
- Reskin must preserve server filters/stale refresh/SSR seed/append/real hrefs.
- No fabricated timeline/stats/current certification validity/sentinel electrical specifications.
- Static fallback/reduced and nonadmin theme must leave real functionality readable.
### Task1: Source Hero and complete routed home
Owner hero_liquid. Modify src/views/HomeView.vue, components/home/HeroSection.vue(+spec), StatsSection.vue, ClientsSection.vue, FeatureSection.vue, ProductCarousel.vue, CtaSection.vue. Create typed components/home/liquid-light/{light-field.ts,pointer-field.ts,light-shader.ts} and focused tests. Leave pages/index.vue SEO and public prototypes.
Interfaces: preserve Hero title/subtitle+primaryClick/secondaryClick/scrollDown emits; home uses real router/productsAPI; common PublicAction from Task2; Hero data-light-hero/canvas/control/hint DOM as approved. Controller dispose once, late import/mount safe.
- [x] Port exact approved appearance/interaction with mounted/disposed Vue lifecycle; meaningful mouse/reduced/pause/unmount tests.
- [x] Reskin full home retaining sections/live products/contact/quote; neutralize unsupported facts and correct company email.
- [x] Scoped tests/types/source ready callback; no browser or unrelated edits.
### Task2: Foundation/shell/company/certificates
Owner hero_signal. Modify src/app.vue, layout/TheNavigation.vue/TheFooter.vue, views/AboutView.vue/CertificatesView.vue/CertificateDetailView.vue, about/AboutHero.vue/CompanyTimeline.vue. Create assets/styles/public-site.css, common/site/PublicPageHeader.vue/PublicAction.vue and navigation-focused tests. Own any expressly needed public quote appearance-only CSS; no quote state/controller edits. Leave about/certificates pages SSR wrappers and admin/global css/Tailwind.
Interfaces: .public-site(.is-home) root class; PublicPageHeader/PublicAction exactspecprops; header80px/data-site-header, real4routes/aria-current/mobile disclosure; quote Launcher ClientOnly unchanged. Certificate category real encoded link and PDF/select/download continue.
- [x] Create reusable primitives+public foundation, actual navigation/mobile semantics/footer/contact and quote/backtop coexistence.
- [x] Reskin company with preserved15timeline/historyanchor and cert category/document detail; truthful errors/accessibility.
- [x] Scoped existing indexing+new navigation tests/source ready callback.
### Task3: Products and real news flows
Owner catalog. Modify views/ProductsView.vue/BlogView.vue; active pages/products/[id].vue and pages/blog/[id].vue; components/products/{ProductsHeader,ProductGrid,ProductCard,ProductInfo,TechnicalSpecs,ProductImageGallery,ProductImageLightbox,ProductFilterPopover}.vue; blog/{CategoryFilter,BlogHeader,BlogGrid,BlogCard,BlogDetailHero,BlogDetailHeader,BlogDetailTags,RelatedArticles}.vue and presentation-only common/quote/ProductFilters.vue if needed. Tests adjacent existing files; no legacy BlogDetailView/API/types/source snapshots. Task2 primitives common.
Interfaces: live existing events/props/API/SSR/quote/SEO unchanged; PublicPageHeader/PublicAction exactspec. ProductCard shared home consumer; category filter shared products/news stays compatible.
- [x] Reskin list/detail/search/filters/cards/photos/technicalinfo preserving real actions and servercontracts; handle PIPE/unknown summary truthfully.
- [x] Reskin list and active news detail, retain dates/categories/share/markdown/related/data/infinite.
- [x] Run focused source regressions and notify source ready.
### Task4: Cross-review, actual QA, documentation and delivery
Owner main orchestrator; workers independent review/fix and docs updated by assigned owners after actualevidence.
- [x] Review three source outcomes and resolve material findings through owners.
- [x] Actual Chrome real4pages/detail/mobile/quote/PDF/Hero dynamics+return/fallback/reduced; screenshots/evidence.
- [x] All src tests in isolated testenv, typecheck and production build/SEO guards; meaningful limits reported.
- [x] Update home/about/products/certificates/blog/quote five-section docs and design README with actualverification.
- [x] Present live Nuxt preview and real screenshots; reset viewport/keep only finaloutputtab.

## Integration ruling
User explicitly requested separate branch then merge. Source work is on codex/liquid-light-site from local main978abf4. Commit only task-owned source/docs; prior uncommitted prototypes/doc records remain local. Main merge verification and final preview handoff pending; no remote push/deployment.
