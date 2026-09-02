# Parking Garage 3D Hero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Replace the homepage Hero MP4 with an interactive, looping Three.js parking-garage scene whose individual mold-bar and wall lights brighten from 50% to 100% on hover or press.

**Architecture:** Keep Hero DOM content and scrolling behavior in HeroSection.vue, and mount a browser-only ParkingGarageScene.vue behind it. Separate pure camera, quality, and fixture-state functions from procedural Three.js models and the renderer controller so deterministic behavior can be unit-tested without GPU pixel snapshots.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript 5.9, Three.js, Vitest, Vue Test Utils, Tailwind CSS

**Spec:** docs/superpowers/specs/2026-09-02-parking-garage-hero-design.md

## Global Constraints

- Use Three.js directly; do not add TresJS or external 3D model loaders.
- Generate the garage, mold bars, and wall lights procedurally as simplified low-poly geometry.
- The camera loop duration is exactly 25,000 milliseconds and the reset occurs only in the occluded final segment.
- Each fixture uses normalized intensity 0.5 at rest and 1.0 while it alone is hovered or pressed, interpolated over approximately 180 milliseconds.
- Preserve the existing Hero title, subtitle, product CTA event, scroll-down action, and content parallax/fade behavior.
- Desktop pixel ratio is capped at 1.5; mobile pixel ratio is capped at 1.0 with reduced shadows and fixture count.
- Reduced-motion mode freezes camera movement at a representative frame but preserves fixture interaction.
- WebGL failure, context loss, or sustained poor startup performance must retain a static image fallback without blocking Hero content.
- Keep public/videos/HeroSection.mp4 in the repository, but remove it from the Hero request path.
- Update docs/menus/home.md in the same implementation.

---

### Task 1: Deterministic camera path and quality policy

**Files:**
- Create: led-lighting-website/src/components/home/parking-garage/parkingGaragePath.ts
- Create: led-lighting-website/src/components/home/parking-garage/parkingGaragePath.spec.ts
- Create: led-lighting-website/src/components/home/parking-garage/parkingGarageQuality.ts
- Create: led-lighting-website/src/components/home/parking-garage/parkingGarageQuality.spec.ts

**Interfaces:**
- Produces: PARKING_GARAGE_LOOP_MS and sampleParkingGaragePath(elapsedMs: number): CameraPose
- Produces: selectParkingGarageQuality(input: QualityInput): QualityProfile
- Produces: shouldUseReducedMotion(matches: boolean): boolean

- [ ] **Step 1: Write the failing camera-path tests**

~~~ts
expect(PARKING_GARAGE_LOOP_MS).toBe(25_000)
expect(sampleParkingGaragePath(25_000)).toEqual(sampleParkingGaragePath(0))
expect(sampleParkingGaragePath(2_000).stage).toBe('aisle')
expect(sampleParkingGaragePath(12_500).stage).toBe('ramp')
expect(sampleParkingGaragePath(18_500).stage).toBe('wall-lights')
expect(sampleParkingGaragePath(24_000).stage).toBe('occlusion')
~~~

- [ ] **Step 2: Run the path test and verify it fails**

Run: cd led-lighting-website && npm test -- src/components/home/parking-garage/parkingGaragePath.spec.ts

Expected: FAIL because parkingGaragePath.ts does not exist.

- [ ] **Step 3: Implement the pure camera sampler**

Define Vec3 as plain x, y, z numbers and CameraPose as position, target, and stage. Wrap elapsed values into 0..25,000, sample fixed Catmull-Rom control points, and keep this module independent from Three.js.

- [ ] **Step 4: Write failing quality-policy tests**

~~~ts
expect(selectParkingGarageQuality({
  webglAvailable: true,
  viewportWidth: 1440,
  devicePixelRatio: 3,
})).toMatchObject({ mode: 'desktop', pixelRatio: 1.5, shadows: true })

expect(selectParkingGarageQuality({
  webglAvailable: true,
  viewportWidth: 390,
  devicePixelRatio: 3,
})).toMatchObject({ mode: 'mobile', pixelRatio: 1, shadows: false })

expect(selectParkingGarageQuality({
  webglAvailable: false,
  viewportWidth: 1440,
  devicePixelRatio: 2,
}).mode).toBe('fallback')
~~~

- [ ] **Step 5: Implement and verify the quality policy**

Define QualityProfile fields mode, pixelRatio, shadows, moldBarCount, wallLightCount, and shadowMapSize. Use 768 CSS pixels as the mobile breakpoint.

Run: cd led-lighting-website && npm test -- src/components/home/parking-garage/parkingGaragePath.spec.ts src/components/home/parking-garage/parkingGarageQuality.spec.ts

Expected: both spec files PASS.

- [ ] **Step 6: Commit the deterministic foundation**

~~~bash
git add led-lighting-website/src/components/home/parking-garage
git commit -m "feat: define parking hero path and quality policy"
~~~

---

### Task 2: Procedural fixtures and garage models

**Files:**
- Modify: led-lighting-website/package.json
- Modify: led-lighting-website/package-lock.json
- Create: led-lighting-website/src/components/home/parking-garage/parkingGarageModels.ts
- Create: led-lighting-website/src/components/home/parking-garage/parkingGarageModels.spec.ts

**Interfaces:**
- Consumes: QualityProfile from parkingGarageQuality.ts
- Produces: Fixture, FixtureKind, GarageModel
- Produces: createParkingGarageModel(profile: QualityProfile): GarageModel
- Produces: setFixtureActive(fixtures: Fixture[], activeId: string | null): void
- Produces: updateFixtureIntensity(fixture: Fixture, deltaSeconds: number): void
- Produces: disposeGarageModel(model: GarageModel): void

- [ ] **Step 1: Install Three.js**

Run: cd led-lighting-website && npm install three

Expected: three appears in dependencies and the lockfile changes without unrelated package upgrades.

- [ ] **Step 2: Write failing fixture-state and model tests**

~~~ts
const model = createParkingGarageModel(desktopProfile)
const [first, second] = model.fixtures
expect(first.currentIntensity).toBe(0.5)
setFixtureActive(model.fixtures, first.id)
expect(first.targetIntensity).toBe(1)
expect(second.targetIntensity).toBe(0.5)
updateFixtureIntensity(first, 0.18)
expect(first.currentIntensity).toBeCloseTo(1, 2)
~~~

Also assert that desktop and mobile fixture totals match the profile counts and each fixture exposes a hit target with userData.fixtureId.

- [ ] **Step 3: Run the model test and verify it fails**

Run: cd led-lighting-website && npm test -- src/components/home/parking-garage/parkingGarageModels.spec.ts

Expected: FAIL because parkingGarageModels.ts does not exist.

- [ ] **Step 4: Implement low-poly garage and fixtures**

Create one Three.js group containing floor, ceiling, walls, pillars, aisle markings, parking bays, ramp, and directional signs. Model mold bars as a slim housing, emissive diffuser, and bounded light; model wall lights as a shallow housing, diffuser, and bounded light. Share immutable geometry and clone only independently animated emissive materials. Build the final pillar and wall so the path reset is fully occluded.

- [ ] **Step 5: Implement fixture interpolation and disposal**

Interpolate normalized intensity from 0.5 to 1.0 in about 0.18 seconds, updating emissive intensity and physical light power together. Dispose every unique geometry and material exactly once and clear fixture references.

- [ ] **Step 6: Run all model and foundation tests**

Run: cd led-lighting-website && npm test -- src/components/home/parking-garage

Expected: camera, quality, model, activation, and disposal tests PASS.

- [ ] **Step 7: Commit the procedural scene**

~~~bash
git add led-lighting-website/package.json led-lighting-website/package-lock.json led-lighting-website/src/components/home/parking-garage
git commit -m "feat: build procedural parking garage models"
~~~

---

### Task 3: Browser-only scene controller and interaction lifecycle

**Files:**
- Create: led-lighting-website/src/components/home/parking-garage/parkingGarageScene.ts
- Create: led-lighting-website/src/components/home/parking-garage/parkingGarageScene.spec.ts

**Interfaces:**
- Consumes: path, quality, model, fixture activation, fixture update, and disposal interfaces from Tasks 1-2
- Produces: createParkingGarageController(options: ControllerOptions): ParkingGarageController
- ControllerOptions: container, reducedMotion, onReady, and onFallback
- ParkingGarageController: start(), pause(), and dispose()
- FallbackReason: renderer, context-lost, performance, or runtime

- [ ] **Step 1: Write failing lifecycle tests with injected browser adapters**

Inject requestAnimationFrame, cancelAnimationFrame, renderer creation, and time adapters. Assert that start schedules one frame, hidden-document handling pauses, visible-document handling resumes, and dispose cancels the frame and removes resize, visibility, pointer, and context listeners.

Assert renderer creation failure calls onFallback('renderer'), context loss calls onFallback('context-lost'), and no frame is scheduled after fallback.

- [ ] **Step 2: Run the controller test and verify it fails**

Run: cd led-lighting-website && npm test -- src/components/home/parking-garage/parkingGarageScene.spec.ts

Expected: FAIL because the controller does not exist.

- [ ] **Step 3: Implement renderer, camera, lighting, and frame loop**

Create a WebGLRenderer with desktop-only antialiasing, sRGB output, and profile-controlled shadows. Mount its canvas and create a perspective camera. On each frame, sample the 25-second path unless reduced motion is active, update camera position and target, interpolate fixtures, render, and schedule one next frame. Use the 7,000ms pose for reduced motion.

- [ ] **Step 4: Implement raycasting and touch semantics**

Convert Hero pointer coordinates through the Canvas rectangle and raycast only fixture hit targets. Hover-capable pointers activate the nearest fixture on move. Coarse pointers activate between pointer down and pointer up or cancel; movement beyond a small threshold clears activation so vertical scrolling wins. Do not call preventDefault for ordinary vertical gestures.

- [ ] **Step 5: Implement startup performance fallback**

Ignore 30 warm-up frames, then collect 60 frame durations. If average FPS is below 24, stop and call onFallback('performance'). Make every fallback callback idempotent. Call onReady after the first successful frame so the Canvas can fade in while monitoring continues.

- [ ] **Step 6: Run all parking-garage tests and commit**

~~~bash
cd led-lighting-website
npm test -- src/components/home/parking-garage
git add src/components/home/parking-garage
git commit -m "feat: add interactive parking garage renderer"
~~~

Expected: all parking-garage specs PASS.

---

### Task 4: Vue Hero integration and static fallback

**Files:**
- Create: led-lighting-website/src/components/home/ParkingGarageScene.vue
- Create: led-lighting-website/src/components/home/ParkingGarageScene.spec.ts
- Create: led-lighting-website/src/components/home/HeroSection.spec.ts
- Modify: led-lighting-website/src/components/home/HeroSection.vue
- Create: led-lighting-website/public/images/home/parking-garage-fallback.webp

**Interfaces:**
- Consumes: createParkingGarageController from parkingGarageScene.ts
- Produces: decorative ParkingGarageScene component with no public props or emits
- Preserves: Hero props and primaryClick / secondaryClick emits

- [ ] **Step 1: Write failing Vue integration tests**

Mock createParkingGarageController. Assert ParkingGarageScene creates and starts it only after mount, passes the container and reduced-motion value, and disposes it on unmount. Assert the fallback image is present before onReady, the renderer layer fades in after onReady, and onFallback leaves the fallback visible.

Mount HeroSection with ParkingGarageScene stubbed. Assert no video or HeroSection.mp4 source exists, the primary button still emits primaryClick, and the scroll arrow calls window.scrollTo with smooth behavior.

- [ ] **Step 2: Run the Vue tests and verify they fail**

Run: cd led-lighting-website && npm test -- src/components/home/ParkingGarageScene.spec.ts src/components/home/HeroSection.spec.ts

Expected: FAIL because the scene component and revised Hero do not exist.

- [ ] **Step 3: Implement ParkingGarageScene.vue**

Render an absolute container with aria-hidden, an eager fallback picture using parking-garage-fallback.webp and main-hero.jpg, and a renderer mount layer. On mount, read reduced motion with matchMedia, create and start the controller, and fade the renderer layer to opacity 1 after onReady. Dispose the controller and media query listener on unmount.

- [ ] **Step 4: Replace the Hero video layer**

Remove LoadingSpinner, videoLoading, video callbacks, video element, and MP4 source. Mount ParkingGarageScene as the background. Retain overlays, gradient, content transform, CTA, scroll arrow, and scroll listener cleanup.

- [ ] **Step 5: Generate the static fallback from the scene**

Run the development server, open the homepage at 1440 by 900, pause at the representative aisle frame, and capture the Hero background without DOM text. Crop to 16:10 and encode WebP near quality 80 at public/images/home/parking-garage-fallback.webp. Inspect it to confirm the aisle, mold bars, and ramp entrance remain visible.

- [ ] **Step 6: Run Vue and parking-garage tests**

Run: cd led-lighting-website && npm test -- src/components/home/ParkingGarageScene.spec.ts src/components/home/HeroSection.spec.ts src/components/home/parking-garage

Expected: all related specs PASS.

- [ ] **Step 7: Commit the Hero integration**

~~~bash
git add led-lighting-website/src/components/home led-lighting-website/public/images/home/parking-garage-fallback.webp
git commit -m "feat: replace hero video with interactive 3d garage"
~~~

---

### Task 5: Homepage documentation and full verification

**Files:**
- Create: docs/menus/home.md
- Modify only if verification exposes a feature defect: files introduced in Tasks 1-4

**Interfaces:**
- Documents finished behavior and known limitations; introduces no runtime interface

- [ ] **Step 1: Create the homepage status document**

Use the required sections 구현 완료, 미구현, 부족하거나 개선이 필요한 기능, 관련 파일, and 갱신 규칙. Record the 25-second loop, individual 50%/100% interaction, mobile quality mode, reduced-motion behavior, static fallback, simplified-model limitation, and retained but unused MP4.

- [ ] **Step 2: Run focused lint**

~~~bash
cd led-lighting-website
npx eslint src/components/home/HeroSection.vue src/components/home/ParkingGarageScene.vue src/components/home/HeroSection.spec.ts src/components/home/ParkingGarageScene.spec.ts 'src/components/home/parking-garage/*.ts'
~~~

Expected: exit 0. Fix only violations in feature-owned files.

- [ ] **Step 3: Run complete automated verification**

~~~bash
cd led-lighting-website
npm test
npm run type-check
VITE_API_BASE_URL=http://localhost:3000 npm run build
~~~

Expected: all Vitest suites pass, Nuxt typecheck exits 0, and the production build plus G2B relay artifact verification exits 0.

- [ ] **Step 4: Perform browser checks**

At 1440 by 900 and 390 by 844 verify camera movement, occluded reset, text contrast, CTA, scroll arrow, individual hover or press, page scrolling, and absence of a request for /videos/HeroSection.mp4. Emulate reduced motion and WebGL failure to verify the frozen-camera and static-fallback paths.

- [ ] **Step 5: Review final state**

~~~bash
git diff --check
git status --short
~~~

Confirm there are no unrelated changes, generated Nuxt output, missing documentation, or missing fallback assets.

- [ ] **Step 6: Commit documentation and verification fixes**

~~~bash
git add docs/menus/home.md led-lighting-website/src/components/home led-lighting-website/public/images/home/parking-garage-fallback.webp
git commit -m "docs: record interactive homepage hero status"
~~~

