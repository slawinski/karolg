---
title: Public Mobile Cold Load - Plan
type: fix
date: 2026-10-18
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Public Mobile Cold Load - Plan

## Goal Capsule

- **Objective:** Mobile visitors can see Carla's work promptly when opening either the homepage or a project directly.
- **Means:** Give initial photography priority over automatic motion, and reduce unnecessary public-request work (KTD1-KTD5).
- **Authority:** Product behavior is governed by R1-R8. Technical decisions govern mechanisms within those requirements. Unit instructions do not override either. Report evidence that a settled decision cannot work.
- **Execution profile:** Measure a production build before changing behavior, make bounded changes, then compare equivalent runs. This document authorizes implementation planning, not a claim that performance has already improved.
- **Stop conditions:** A design, freshness, media-publication, or zero-shift regression prevents completion. Missing production evidence is reported explicitly rather than replaced by an infrastructure diagnosis.
- **Completion owner:** The invoking LFG workflow owns implementation, verification, review, and shipping after this planning handoff.

---

## Product Contract

### Summary

Improve cold loading on the homepage and every public project page by prioritizing initial images and posters, deferring automatic video and homepage swaps, and removing redundant server/data-transfer work. Keep the editorial composition and published media intact.

### Problem Frame

Bookers need immediate visual evidence, while collaborators need rich galleries they can explore. The reported mobile Lighthouse run scored 64 and timed out before completing all audits. Long visual completion and early media traffic undermine both uses of the portfolio. `PRODUCT.md` makes fast scanning and photography central to the experience and treats performance as part of its aesthetic.

The available measurements disagree enough that a single bottleneck is not established. Neither a document-latency audit estimate nor a robots timeout identifies a hosting fault.

### Requirements

**Coverage and presentation**

- R1. Improve mobile cold-load performance across `/` and all `/work/[slug]` pages, including direct entry and client navigation.
- R2. Preserve editorial layout, crops, photography quality, responsive compositions, and published content, with measured CLS remaining zero and no new visible layout shift.
- R3. Preserve CMS freshness: the next public request after a settings/content edit or worker publication must use the current data and revision URLs, without reinstating a time-based page cache.

**Automatic motion**

- R4. Preserve homepage autoplay and automatic swaps, but start their acquisition/preparation and playback after initial visible content has priority.
- R5. Project-gallery videos automatically play muted and inline, with no visible native or custom manual playback controls, and start later than initial content.
- R6. Respect reduced motion and document visibility for both acquisition and playback, pause offscreen media, and retain a poster when autoplay is rejected without unhandled errors.

**Evidence and diagnosis**

- R7. Investigate document latency and the robots fetch timeout using request evidence, and distinguish observed timings from audit estimates and unconfirmed causes.
- R8. Verify performance under varied opening media, cold browsers and warm caches, and verify galleries on mobile and desktop without audit-specific behavior or removal of rich media.

### Key Decisions

- **All public pages** (session-settled: user-directed — chosen over homepage-only scope: the user explicitly selected all public pages). Governs R1.
- **Defer then preserve automatic motion** (session-settled: user-approved — chosen over preserving current start timing or removing motion: initial visible content takes priority while the editorial experience remains). Governs R4, R5.
- **Control-free silent project videos** (session-settled: user-directed — chosen over preserving manual gallery controls: the user wants automatic silent videos and accepted delayed start). Governs R5, R6.

### Acceptance Examples

- AE1. **Covers R4-R6.** A direct project visit containing a first-viewport video shows its responsive poster before downloading playback bytes. Once initial content is ready and motion is eligible, the video starts silently without interaction or controls.
- AE2. **Covers R6.** A rejected play promise leaves the poster visible. A hidden document or reduced-motion preference does not start acquiring an unacquired video; changing eligibility pauses existing playback and does not reveal controls.
- AE3. **Covers R3.** A worker publishes a new derivative revision between two requests. The second request emits the new poster/playback identity even if the older optimized image remains cached.
- AE4. **Covers R2, R8.** Repeated opening selections containing stills and videos retain their reserved geometry through hydration, poster load, video start, and homepage swap.

### Scope Boundaries

Public route delivery, image/poster scheduling, client media lifecycle, public data loading, and document/robots diagnosis are in scope. Admin behavior and media processing/publication contracts remain compatibility boundaries.

Considered and not built:

- Hosting replacement, CDN migration, storage redesign, and new adaptive-video renditions: no evidence currently requires them. Reconsider only if attributed production measurements show the bounded changes cannot meet the outcome.
- Persistent page/data caching with new invalidation machinery: unnecessary for the known redundant reads and would reopen the freshness problem in R3.
- New manual playback UI, autoplay retry loops, or gesture-based source acquisition: they are unnecessary for R5-R6; the poster is the failure result.
- A generic global media scheduler, new telemetry platform, or arbitrary gallery truncation: the existing media boundary can enforce initial-load priority without these additions.

---

## Planning Contract

### Assumptions

These are unconfirmed agent bets, not user-settled product criteria:

- Mobile Lighthouse at least 90, LCP at most 2.5 seconds, TBT at most 200 milliseconds, and complete audits without timeout are aspirational targets until a comparable baseline exists. They are not a production-score promise. R2 separately owns the user-required zero-shift constraint.
- A small route-scoped readiness boundary is sufficient; a separate deferred-pool endpoint and associated loading/error UI are not needed initially.
- Begin with a 1.5-second minimum foreground delay plus initial critical-image readiness (KTD1); tune that delay from waterfalls and visual review rather than from the Lighthouse collection window.
- Use existing image quality and optimizer formats first. Do not trade visible photographic detail for a score.

### Evidence and Single-Pass Behavior Trace

Baseline revision supplied by the caller is `6944671`. Earlier plans under `docs/plans/` describe completed narrower work; they are historical context, not the source contract for this feature.

| Evidence | Consequence for this plan |
|---|---|
| User report: Lighthouse 13.4.1, Chromium 155, emulated Moto G Power, Slow 4G; score 64, FCP 3.8s, LCP 4.8s, TBT 150ms, CLS 0, Speed Index 25.5s, 5590 KiB total | Reproduce conditions and retain full reports before asserting gains. No expanded JSON/HAR exists for that run. |
| Reported document-latency estimated saving 9560ms; robots fetch timed out; unused JS 573 KiB, minify 94 KiB, legacy 13 KiB | These are audit outputs, not measured TTFB or attributed bundles. Diagnose in U1/U5. |
| Prior isolated desktop visit transferred 5,269,068 bytes from `/api/media/61/playback?v=1`; some optimized images took 4-5.5s | Prevent early video acquisition and separately measure cold optimizer work. |
| Prior mobile trace: 390x844, DPR 2, Slow 4G, 4x CPU; LCP 1461ms, TTFB 237ms, CLS 0 | A useful independent observation, not a comparable full Lighthouse result or CrUX evidence. Intermittent causes remain unknown. |
| `src/app/(frontend)/page.tsx` waits for `awaitPublicRequest`, then `getPortfolioData`; `src/lib/portfolio.ts` loads settings, every project, and all media with populated relationships | Keep request-time freshness and reduce query shape/serialization rather than hide work behind a stale page. |
| `src/app/(frontend)/work/[slug]/page.tsx` calls `getPortfolioData` for site settings; metadata and page both look up the slug | Split settings-only access and request-scoped slug reuse. Keep slug-not-found and error semantics. |
| `src/components/useDeferredVideoSource.ts` attaches for eager, latched 200%-margin intersection, or explicit request | Playback delay alone cannot stop browser transfer. The acquisition gate must precede source attachment. |
| `src/components/HomepageMasonry.tsx` already has responsive optimized posters, first-two eager images, 6000ms initial scheduling, 7000ms cycles, and 5000ms preparation timeout | Reuse poster and cancellation paths; gate incoming preparation as well as current video sources. |
| `src/components/PhotoshootVideo.tsx` has native controls and pointer/focus acquisition; `Visual.tsx` does not forward eager/sizes to its video branch | Replace the manual behavior and propagate responsive poster priority. Existing tests expecting controls must change. |
| `src/lib/photoshoot-candidates.ts` selects up to four image identities across responsive geometry, excluding videos | Extend selection to visible video posters while retaining one bounded candidate set. |
| Homepage column state starts at five, then changes after hydration; current reported CLS is zero | This is a risk to characterize, not proof of a shift. Do not redesign masonry speculatively. |
| `src/app/(frontend)/robots.ts` is force-static and does not query Payload | Check delivered status, redirects, timing, and contention before changing the handler. |

Trigger and ownership trace: route rendering owns data freshness; normalization in `src/lib/media.ts` and revision handling own public identities; components own source attachment; the browser owns autoplay permission. Intersection currently latches acquisition, whereas actual visibility/reduced motion govern homepage playback. Unmount releases the resource. Project videos currently require manual playback. Neither browser production timing nor deployment/proxy behavior was traced in this planning run.

### Key Technical Decisions

- KTD1. **Gate acquisition on route-local initial-image readiness.** Add `src/components/PublicMediaReadiness.tsx` as a small client boundary around server-rendered public content. It tracks explicitly marked initial eager images/posters, including cached completion and load errors, then allows two animation frames and the minimum delay from Assumptions before becoming ready. Do not wait for whole-window load, all lazy images, network idle, or an observed LCP event. Zero candidates resolve after the same frame/delay rule. A failed image counts as settled; an in-flight critical image keeps priority. Reset by route identity on client navigation and cancel pending work on unmount. This instantiates R4-R6 (session-settled: user-approved — chosen over preserving current start timing or removing motion: initial visible content takes priority while the editorial experience remains).
- KTD2. **Separate source acquisition from current playback eligibility.** Extend `useDeferredVideoSource` so initial unacquired media cannot attach until KTD1 is ready, the document is visible, reduced motion is off, and the video actually intersects the viewport. Remove the latched 200% margin as an initial-acquisition bypass. Homepage incoming preparation may attach offscreen only after readiness and the existing eligible scheduler requests it. Playback uses current intersection, page visibility, reduced motion, and active/preparing state; it never relies on a latched acquisition flag. Pause on ineligibility and release sources on identity change/unmount, preserving existing preparation cancellation. Recheck eligibility after asynchronous play resolution and ignore obsolete promises. Only a current-source autoplay-policy rejection or media failure latches poster-only fallback, with no automatic retry loop. Expected cancellation caused by pause, visibility change, source replacement, or unmount does not latch failure; a later eligible transition may start playback normally. Implements R4-R6 (session-settled: user-approved — chosen over preserving current start timing or removing motion: initial visible content takes priority while the editorial experience remains).
- KTD3. **Use an optimized poster layer on project videos.** Forward `Visual` eager/sizes to the gallery video branch and use the same fill/crop and revision-aware optimizer policy as homepage posters. The poster remains above the video until a successful visible playing state, and returns on a failed initial start. Use muted, inline programmatic autoplay with handled play promises; omit native controls and custom replacements. Retain a meaningful accessible label without a fake button/tab stop. Do not also point a native poster at an unoptimized original that causes a duplicate download. Implements R5-R6 (session-settled: user-directed — chosen over preserving manual gallery controls: the user wants control-free silent videos and accepted delayed start).
- KTD4. **Reduce request work without cross-request caching.** Add a settings-only public loader, a projects-only listing for static-parameter generation, and request-scoped slug deduplication shared by metadata and page. Preserve `awaitPublicRequest`. Keep pagination and public media access enforcement. For homepage queries use explicit selection/population of the fields needed by normalization and composition, then serialize a compact presentation projection after normalization. Preserve every eligible pool member and random selection, dimensions, transition color, revision-aware identities, links and attribution. Do not truncate pools or strip fields before revision normalization. This serves R1-R3; request-local reuse is chosen over persistent caching because it cannot hide a newly published revision.
- KTD5. **Attribute slow paths before changing delivery configuration.** U1 records document phases and cold/warm asset behavior; U5 makes only the smallest source/config correction supported by those measurements. Keep robots static unless the delivered route proves defective. Inspect production asset ownership for unused/minification/legacy findings before proposing import or bundling changes. No dependencies or framework upgrades are part of the default fix. Serves R1, R7-R8.

The nearby architectural fork was persistent invalidation versus request-local query reduction. It does not need a bake-off: request-local work is reversible, uses the existing boundary, and avoids the known freshness regression. The compact presentation projection does not introduce a public endpoint or stored format.

### High-Level Technical Design

The following sketches describe the boundaries and lifecycle; they are not implementation code.

**Public data path (KTD4):**

1. Home request: request-time boundary -> selected settings/projects/public-media reads -> revision normalization -> homepage composition -> compact client pools and reserved frames.
2. Project request: request-time boundary -> settings-only read and shared slug lookup -> project-only public-media read -> revision normalization -> gallery/candidate selection -> reserved frames and optimized stills/posters.
3. Static-parameter generation: projects-only listing -> slug list. No portfolio-wide media query.

**Readiness and video lifecycle (KTD1-KTD3):**

| State | Entry condition | Permitted work | Exit |
|---|---|---|---|
| Poster-only initial | SSR/hydration or new route | Critical still/poster requests, no playback source | Critical image set settled, minimum delay and paint opportunity passed |
| Ready but ineligible | Readiness reached, but hidden/reduced/offscreen | Keep poster; no new video acquisition | Eligible current viewport or eligible homepage preparation |
| Acquiring | Readiness and acquisition predicates hold | Attach published source; prepare without starting hidden incoming video | Current visible active video may request play |
| Playing | Play accepted and eligibility still holds | Show video over the retained poster | Ineligible -> pause; identity/unmount -> release |
| Poster fallback | Current-source policy rejection or media failure per KTD2 | Keep optimized poster and no controls | New source identity resets failed-start state |

**Scheduling protocol (KTD1-KTD2):** initial critical images settle -> readiness opens -> existing homepage initial-delay timer starts -> eligible mounted candidate preparation -> bounded existing readiness/deadline logic -> wave/commit. Hidden/reduced motion cancels queued/preparing work through existing generation checks; restoration restarts the established initial-delay path. Timers and a resolved play promise cannot bypass current eligibility.

### System-Wide Impact and Risks

- The public-data boundary also serves metadata and static-parameter generation. Keep page content/metadata consistent within a request and freshly read on later requests. Existing `portfolio.test.ts` protects attribution and retained derivatives; optimization must preserve those behaviors.
- The readiness boundary must keep server-rendered imagery discoverable. Do not move the gallery behind a client-only render or delay the actual LCP image to start motion later.
- A native video may buffer beyond `preload` hints. KTD2 prevents the initial source request; pausing an acquired video is not a claim that transfer stops immediately.
- CSS multicolumn galleries can put later source-order media above the fold. Keep the content-derived candidate strategy and extend it to posters, rather than eagerly loading the first N DOM children.
- If runtime traces show homepage hydration shifts, stabilize its first-painted topology in the existing masonry boundary while preserving responsive composition. Choose the smallest evidenced correction; a wholesale layout rewrite is not preapproved.
- Current dependency pins are Next 16.4.0, React 19.2.6, Payload 3.90.2. Context7 returned current main/canary documentation, not exact matching tags; verify selected API behavior against installed types/source during implementation.

### Deferred Execution Checkpoints

- U1 establishes comparable local-production and, when reachable, live timing distributions. Production access and intermittent reproduction are not prerequisites for implementing KTD1-KTD4.
- U5 attributes robots/document timeouts and optimizer/bundle costs. If production access is unavailable, record the unverified deployment checkpoint and do not claim that the live issue is resolved.
- The exact minimum delay and responsive candidate success rates are tuned in U6. Keep Assumptions distinct from confirmed numerical acceptance gates.

---

## Implementation Units

### U1. Establish comparable cold-load evidence

**Goal:** Separate document, image optimization, video acquisition, and JavaScript costs before editing them.

**Requirements:** R1, R7, R8. **Dependencies:** None.

**Files:** Create `docs/verification/public-mobile-cold-load.md` and store referenced full audit/network artifacts under `docs/verification/` where practical. Read the public routes, `src/app/(frontend)/robots.ts`, `next.config.ts`, and `README.md` for the deployed request path.

**Approach:**
1. Capture a production-build homepage baseline with recorded opening identities, plus representative still-heavy, mixed, video-first, and larger project pages where those exist.
2. Record document DNS/connect/TLS/redirect/TTFB/download phases separately, critical image request/discovery/decode timing, playback bytes before initial content, and client bundles actually loaded.
3. Request robots independently and during an audit, compare status/redirects/content/timing with the static route, and compare public origin with a reachable application endpoint only when available. Distinguish application-start, query, optimizer, network, and proxy evidence.

**Patterns to follow:** Existing evidence under `docs/verification/`; keep results tied to build, browser, viewport, throttle, cache state, and CMS selection.

**Test expectation:** None -- this unit captures measurements, not executable behavior.

**Verification:** A comparable baseline and attribution table exists. Unreproduced production causes remain labeled unknown, with the next observable check named.

### U2. Reduce redundant public data reads and transfer

**Goal:** Avoid loading unrelated portfolio data for project pages and avoid carrying unused CMS fields into homepage hydration.

**Requirements:** R1-R3, AE3. **Dependencies:** U1.

**Files:** `src/lib/portfolio.ts`, `src/lib/portfolio.test.ts`, `src/lib/homepage.ts`, `src/lib/homepage.test.ts`, `src/app/(frontend)/page.tsx`, `src/app/(frontend)/work/[slug]/page.tsx`, existing `src/lib/public-rendering.test.ts` and `src/lib/media-replacement.integration.test.ts` for compatibility proof.

**Approach:**
1. Apply KTD4 at existing loader boundaries, retaining normalized public identities and request-time rendering.
2. Replace the project page's portfolio read and static-parameter portfolio read with purpose-specific reads. Deduplicate the slug lookup within a render request.
3. Project the homepage client payload from normalized media, retaining every field actually consumed by composition, video eligibility, posters, swaps, dimensions, and links.

**Patterns to follow:** `loadAllDocuments` pagination, current loader error propagation, normalized attribution and revision tests.

**Test scenarios:**
1. A project request uses settings plus its slug/media and does not load unrelated media; a missing slug still yields not-found and a failed read still propagates the existing failure.
2. Paginated homepage pools retain every eligible member, ordering/links/attribution, and valid presentation identities after projection, including retained published derivatives during a failed replacement.
3. Separate requests around a settings edit and worker revision publication return the new data under AE3. Verify actual render-request reuse of metadata/page slug lookup in a production integration check, not a mock of the cache helper.

**Verification:** Query scope and serialized bytes shrink relative to U1; content, access enforcement, freshness, and random selection remain equivalent.

### U3. Delay media acquisition and homepage preparation

**Goal:** Keep playback traffic behind initial content without removing automatic homepage behavior.

**Requirements:** R4, R6, AE2, AE4. **Dependencies:** U1.

**Files:** Create `src/components/PublicMediaReadiness.tsx` and `src/components/PublicMediaReadiness.browser.test.tsx`; modify `src/components/useDeferredVideoSource.ts`, `src/components/HomepageMasonry.tsx`, `src/components/HomepageMasonry.browser.test.tsx`, `src/app/(frontend)/page.tsx`, `src/app/(frontend)/work/[slug]/page.tsx`.

**Approach:**
1. Introduce KTD1 with explicit initial-image markers, preserving server-rendered children and route identity.
2. Apply KTD2 to current homepage videos and incoming swap preparation. Mark existing first-two eager homepage stills/posters as critical readiness inputs.
3. Start the existing scheduler from readiness and retain its cancellation, mounted preparation, bounded deadlines, and failed-candidate handling.

**Patterns to follow:** Current generation cancellation, real mounted preparation elements, revision/identity cleanup, and homepage poster composition.

**Test scenarios:**
1. With a pending critical image and intersecting video, neither playback source nor incoming preparation requests start. Cached completion, image error, and a route with no candidates each let readiness resolve under KTD1.
2. After readiness, a visible active video starts silently while an offscreen video stays unacquired; eligible incoming preparation can load but cannot play before commit.
3. Hidden/reduced states before readiness and changes during preparation cancel pending starts. Restoration resumes the existing scheduler without catch-up bursts.
4. A rejected or late-resolving play promise cannot leave hidden/unmounted media playing or create an unhandled rejection. Cancel a pending play through a visibility change, then restore eligibility and verify that cancellation has not permanently disabled playback. A source revision change releases the old resource.
5. A client navigation resets readiness, and existing swap completion, breakpoint cancellation, and failure paths still work.

**Verification:** Network evidence shows zero playback requests before KTD1 readiness in controlled cold-load fixtures; real homepage motion still starts and cycles after initial content.

### U4. Deliver optimized posters and silent automatic project videos

**Goal:** Make project motion meet the requested control-free behavior while retaining a fast, stable first image.

**Requirements:** R2, R5, R6, AE1-AE2, AE4. **Dependencies:** U3.

**Files:** `src/components/PhotoshootVideo.tsx`, `src/components/PhotoshootVideo.browser.test.tsx`, `src/components/Visual.tsx`, `src/components/Visual.test.tsx`, `src/lib/photoshoot-candidates.ts`, `src/lib/photoshoot-candidates.test.ts`, `src/components/PhotoshootGallery.browser.test.tsx`, `src/app/(frontend)/work/[slug]/page.tsx`, `src/app/(frontend)/styles.css`.

**Approach:**
1. Apply KTD3 and remove the existing controls and pointer/focus acquisition behavior, including tests that assert them as preservation requirements.
2. Extend candidate identity selection to the actual presentation image: still URL or video-poster URL. Use that same identity in the page and retain the global four-identity budget and deduplication.
3. Mark selected stills/posters for KTD1. Keep poster/video layers within existing reserved figure geometry and preserve all crop/sizes behavior.

**Patterns to follow:** Homepage optimized poster policy, project gallery geometry characterization, immutable revision URLs.

**Test scenarios:**
1. Covers AE1. A first-viewport video requests its responsive poster eagerly and has no playback source before readiness; eligible playback starts muted/inline without pointer or keyboard input and exposes no controls.
2. Covers AE2. Play rejection or initial media error leaves the poster visible and produces no unhandled errors or new manual UI. Reduced motion and background visibility suppress initial acquisition and pause existing playback.
3. Mixed image/video galleries select posters within the same four-identity budget, including a later source-order video visible in a CSS column. Duplicate identities do not cause extra eager candidates.
4. Covers AE4. At mobile and desktop widths, reserved figure rectangles do not change when the poster loads or the video begins; still-image quality, crops, and labels remain correct.

**Verification:** Browser and real-network checks establish poster-only first paint, delayed automatic silent playback, no visible controls, and no raw-poster duplicate download.

### U5. Resolve only attributed delivery and bundle issues

**Goal:** Address the remaining latency/timeout or shipped-JavaScript cause supported by U1 evidence.

**Requirements:** R1-R3, R7-R8. **Dependencies:** U1, U2, U4.

**Files:** Update `docs/verification/public-mobile-cold-load.md`; inspect `src/app/(frontend)/robots.ts`, `src/app/(frontend)/layout.tsx`, `next.config.ts`, `README.md`, and measured public-client import owners. Add tests beside any behavior-bearing owner changed; add `src/app/(frontend)/robots.test.ts` only if the robots handler changes.

**Approach:**
1. Recheck the attributed slow path after U2-U4. If image transforms dominate, verify production optimizer caching/persistence and format timings before a minimal config correction; keep revision identity and image quality constraints.
2. For bundle findings, inspect production chunk/import ownership and remove or split only an identified unnecessary public dependency. Do not infer an admin-bundle leak from an unused-JS total alone.
3. Correct a demonstrated application/config defect behind robots/document latency. If it is not reproduced or needs deployment-only evidence, record the observation and checkpoint rather than inventing a source change or hosting project.

**Patterns to follow:** Existing server deployment and persistent-volume model in `README.md`; static robots metadata route.

**Test scenarios:**
1. Delivered robots returns valid expected directives and sitemap without a CMS dependency; repeated independent and audit-time requests record their actual outcome.
2. Any evidence-backed public bundle split preserves direct navigation and delayed motion in a production build; compare affected chunk bytes rather than testing a bundler implementation detail.
3. Any optimizer/config change preserves a new revision's immediate identity and existing visual detail across cold and warm requests.

**Verification:** Each change has a before/after causal observation. No code change is required when evidence does not justify one; unverified production outcomes remain explicitly unverified.

### U6. Prove the all-page result and close regressions

**Goal:** Demonstrate faster initial public content with retained design, freshness, and motion.

**Requirements:** R1-R8, AE1-AE4. **Dependencies:** U2-U5.

**Files:** `docs/verification/public-mobile-cold-load.md`, relevant full audit/network artifacts under `docs/verification/`, and only the regression-test files from U2-U4 implicated by failures.

**Approach:** Apply the Verification Contract, tune the Assumptions delay only from actual contention and experience, and close demonstrated regressions in their owning units. If topology shifts are measured, characterize first paint before fixing the existing masonry rather than masking it with hidden content.

**Patterns to follow:** Existing browser gallery and homepage motion tests, with updated project-video requirements.

**Test scenarios:**
1. All real project URLs render usable content; representative page classes complete matched cold/warm measurements and preserve direct and client-navigation behavior.
2. Repeated homepage openings sample both still and video selections without forcing a favorable production selection; a controlled fixture provides comparable media across revisions.
3. Mobile and desktop galleries satisfy AE1-AE4 through scroll, visibility changes, reduced motion, revision changes, and rejected playback.

**Verification:** The evidence report meets the exit rules below and distinguishes local proof from live observations. Experimental/dead-end changes are absent from the final diff.

---

## Verification Contract

All checks in this section are execution work, not work performed while writing this plan.

- **Repository gates:** `pnpm typecheck`, `pnpm test`, `pnpm test:browser`, and `pnpm build` are the existing commands. Run relevant browser tests in Chromium and the affected video/gallery cases with `pnpm test:browser:webkit`. There is no `release:validate` script in `package.json`.
- **Test economy:** Extend the named behavioral tests rather than add per-branch implementation mirrors. Mocks prove lifecycle/cancellation; real production browser/network checks prove discovery, actual transfers, visual stability, cache behavior, and request-scoped freshness.
- **Measurement protocol:** Use a production server, record exact dependency/build/browser versions, and match the reported Moto G Power/Slow 4G Lighthouse configuration as closely as the installed tooling allows. Label any mismatch. Keep the prior 390x844/DPR2/4x CPU trace as a separate experiment, not a replacement baseline.
- **Coverage:** Smoke every current public project URL. Measure the homepage plus still-heavy, video-first/mixed, long-title, and larger-gallery project classes if present. Include a short/empty usable gallery case through a fixture when absent from production.
- **Repeatability:** Collect at least three matched cold-browser runs per measured class before and after, record media identities, and report median and range. Pair those with warm-browser repeats and separately label optimizer/server-cache state. Do not purge live caches to manufacture cold results.
- **Performance exit:** On matched controlled fixtures, median cold LCP and bytes transferred before initial critical content must decrease from U1, TBT must not regress beyond observed baseline variability, and measured CLS must remain zero. Each real-page class must show no repeatable initial-render regression outside its baseline range; investigate contrary results rather than average them away. Report score/FCP/Speed Index and aspirational target attainment from Assumptions separately. If a metric is already negligible, record that limit and demonstrate the acquisition/query reduction instead of manufacturing a gain.
- **Motion proof:** Observe beyond the entire initial delay, preparation deadline, and multiple swap cycles. Network silence limited to the audit window is insufficient. Show posters first, then actual autoplay/swaps, including mobile WebKit when available; a browser policy rejection is a valid poster fallback, not proof autoplay succeeded.
- **Visual proof:** Compare first-paint/hydration, loaded poster, playing video, and completed swap at the five existing responsive tiers, checking crops and figure rectangles. Include real photographs at sufficient DPR; reserve layout before media arrives.
- **Freshness proof:** Edit settings/content and publish a media replacement between requests to a production build. Confirm fresh metadata/content/revision identities without waiting for a TTL; retain valid older published derivatives during processing/failure.
- **Diagnostic proof:** Save complete Lighthouse JSON and network/trace evidence where supported, including failed attempts. Report document phases and robots outcomes without equating the 9560ms estimate with TTFB. No CrUX claim is justified by the supplied evidence.
- **Integrity:** No Lighthouse user-agent branches, hidden media removal, reduced-quality audit mode, postponed-forever animation, or production random-selection bias.

---

## Definition of Done

- U1 has a comparable baseline; U2 has reduced scoped reads/serialization with freshness intact; U3 and U4 satisfy their lifecycle and presentation checks; U5 records attributed corrections or bounded unresolved deployment observations; U6 completes the Verification Contract.
- Every R-ID has implementation/verification evidence, with failures and environment limitations stated explicitly. Aspirational numerical targets are reported as attained or unattained, never promoted to guarantees.
- The public design, all eligible media, original photography detail, metadata, navigation, attribution, and current revision publication remain correct.
- Abandoned attempts and unused experimental code are removed from the implementation diff. Preserve pre-existing user artifacts in `.vitest-attachments/` and `src/components/__screenshots__/`.
- Review and shipping include the measured result, the changed media behavior, and any production-only checkpoint still open. Do not describe an unverified live timeout as fixed.

---

## Sources and Research

- Repository behavior anchors are in the evidence table and per-unit file lists. `PRODUCT.md` supplies editorial/performance constraints; `README.md` supplies the server-only deployment boundary.
- [Next Image reference](https://nextjs.org/docs/app/api-reference/components/image), consulted through Context7: responsive sizes and eager/fetch priority guide KTD3; do not preload every gallery candidate or duplicate optimized posters with raw URLs.
- [Next metadata and database request reuse](https://nextjs.org/docs/app/getting-started/metadata-and-og-images) and [data fetching](https://nextjs.org/docs/app/getting-started/fetching-data), consulted through Context7: request-scoped React cache supports KTD4 without a persistent freshness window.
- [Payload select/populate](https://payloadcms.com/docs/queries/select) and [depth](https://payloadcms.com/docs/queries/depth), consulted through Context7: narrow local-API projections while preserving the normalization inputs and access semantics in KTD4.
- [MDN autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay): browser policy may reject script-initiated playback. KTD2-KTD3 handle rejection with the requested poster result rather than adopting the guide's optional manual-control UI.
