# Search Indexing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every public DF Korea page discoverable and server-render its preferred `https://dfkorealed.com` search metadata.

**Architecture:** Nuxt page wrappers own server-rendered metadata and canonical URLs, while NestJS continues to generate the live sitemap and RSS from database content. Crawlable NuxtLink cards and explicit noindex rules separate public content from administrative and development routes.

**Tech Stack:** Nuxt 4, Vue 3, Nitro/Vercel, NestJS 10, Jest, Vitest

**Spec:** `docs/superpowers/specs/2026-09-06-search-indexing-design.md`

## Global Constraints

- The canonical origin is exactly `https://dfkorealed.com`.
- Public pages use `index, follow`; `/admin/**` and `/tailwind-test` use `noindex, nofollow`.
- Sitemap URLs must be absolute canonical URLs and include every product, post, and certificate category.
- SEO metadata needed by crawlers must be present in server-rendered HTML.
- Existing user changes in the main worktree must remain untouched.

---

### Task 1: Canonical origin and server-rendered public metadata

**Files:**
- Modify: `led-lighting-website/nuxt.config.ts`
- Modify: `led-lighting-website/vercel.json`
- Modify: `led-lighting-website/public/robots.txt`
- Modify: `led-lighting-website/src/pages/index.vue`
- Modify: `led-lighting-website/src/pages/about.vue`
- Modify: `led-lighting-website/src/pages/certificates/index.vue`
- Modify: `led-lighting-website/src/pages/certificates/[id].vue`
- Modify: `led-lighting-website/src/pages/products/index.vue`
- Modify: `led-lighting-website/src/pages/blog/index.vue`
- Modify: `led-lighting-website/src/pages/tailwind-test.vue`
- Create: `led-lighting-website/scripts/verify-search-indexing.mjs`
- Modify: `led-lighting-website/package.json`

**Interfaces:**
- Consumes: `runtimeConfig.public.siteUrl: string`
- Produces: server-rendered `<title>`, description, robots and canonical tags for each public static route

- [ ] **Step 1: Write the failing build verifier**

Create a script that reads generated `/`, `/about`, `/products`, `/blog`, and `/certificates` HTML and asserts that every canonical starts with `https://dfkorealed.com`, no `www.dfkorealed.com` remains, and each page has its own expected title and description.

- [ ] **Step 2: Run the verifier against the current build**

Run: `node scripts/verify-search-indexing.mjs`
Expected: FAIL because current generated files contain `https://www.dfkorealed.com` canonical URLs and shared metadata.

- [ ] **Step 3: Implement one canonical source and SSR metadata**

Set `NUXT_PUBLIC_SITE_URL` and all default absolute URLs to `https://dfkorealed.com`. Add `useSeoMeta` and `useHead` to page wrappers, with route-derived metadata for `/certificates/[id]`. Add route headers for `/admin/**` and `/tailwind-test`, and add those paths to robots.txt disallow rules.

- [ ] **Step 4: Build and verify**

Run: `VITE_API_BASE_URL=https://dfkorea-production.up.railway.app npm run build`
Expected: PASS including `Verified search indexing metadata.`

- [ ] **Step 5: Commit**

Run: `git commit -m "fix: canonicalize public search metadata"`

### Task 2: Crawlable product and post links

**Files:**
- Modify: `led-lighting-website/src/components/products/ProductCard.vue`
- Create: `led-lighting-website/src/components/products/ProductCard.spec.ts`
- Modify: `led-lighting-website/src/components/blog/BlogGrid.vue`
- Create: `led-lighting-website/src/components/blog/BlogGrid.spec.ts`

**Interfaces:**
- Produces: rendered anchors with `/products/:id` and `/blog/:id` href values while preserving existing click events

- [ ] **Step 1: Write failing component tests**

Assert that a rendered product card contains `a[href="/products/product-1"]` and a blog grid item contains `a[href="/blog/post-1"]`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- ProductCard.spec.ts BlogGrid.spec.ts`
Expected: FAIL because current cards render clickable divs without anchors.

- [ ] **Step 3: Wrap each card in NuxtLink**

Use `NuxtLink` with the canonical route path and `@click.prevent` to preserve the existing parent event behavior.

- [ ] **Step 4: Run component and full frontend tests**

Run: `npm test`
Expected: all frontend tests pass.

- [ ] **Step 5: Commit**

Run: `git commit -m "fix: expose detail links to crawlers"`

### Task 3: Complete dynamic sitemap coverage

**Files:**
- Create: `dfkorea-backend/src/seo/seo.controller.spec.ts`
- Modify: `dfkorea-backend/src/seo/seo.controller.ts`
- Modify: `dfkorea-backend/src/seo/seo.module.ts`

**Interfaces:**
- Consumes: `CertificatesService.findAll(): Promise<Certificate[]>`
- Produces: one encoded `/certificates/:category` sitemap URL per unique certificate category

- [ ] **Step 1: Write a failing sitemap test**

Construct `SeoController` with posts, products, certificates and config stubs. Assert the XML contains `https://dfkorealed.com/certificates/%EA%B3%A0%ED%9A%A8%EC%9C%A8` once and contains no `www.dfkorealed.com`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- seo/seo.controller.spec.ts --runInBand`
Expected: FAIL because the controller does not consume certificates or emit category URLs.

- [ ] **Step 3: Add certificate categories to the sitemap**

Import `CertificatesModule`, inject `CertificatesService`, fetch its data with posts and products, normalize blank categories to `기타`, encode each unique category, and use the latest category update time for `<lastmod>`.

- [ ] **Step 4: Run backend tests, typecheck, and build**

Run: `npm test -- --runInBand && npx tsc --noEmit && npm run build`
Expected: all backend checks pass.

- [ ] **Step 5: Commit**

Run: `git commit -m "feat: add certificate pages to sitemap"`

### Task 4: Documentation, deployment, and production verification

**Files:**
- Modify: `docs/menus/home.md`
- Modify: `docs/menus/about.md`
- Modify: `docs/menus/products.md`
- Create: `docs/menus/blog.md`
- Create: `docs/menus/certificates.md`
- Modify: `docs/menus/README.md`

**Interfaces:**
- Produces: current SEO behavior, limitations, affected files, and monthly monitoring procedure

- [ ] **Step 1: Update menu documentation**

Record canonical URLs, server-rendered metadata, sitemap coverage, crawlable links, noindex exclusions, and the remaining Search Console/Search Advisor submission step.

- [ ] **Step 2: Run final verification**

Run frontend tests, frontend typecheck, Vercel production build, backend tests, backend typecheck, backend build, and `git diff --check`.

- [ ] **Step 3: Merge and deploy**

Fast-forward the approved commits to `main`, push `origin/main`, deploy the frontend to Vercel production, and confirm the Railway backend deployment reaches a healthy state.

- [ ] **Step 4: Verify production**

Check `robots.txt`, sitemap status and counts, five static page heads, one product, one post, one certificate category, crawlable detail anchors, and noindex headers for admin and test routes.

- [ ] **Step 5: Commit documentation**

Run: `git commit -m "docs: record search indexing strategy"`

