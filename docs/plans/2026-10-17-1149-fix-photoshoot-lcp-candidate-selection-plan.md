---
title: Photoshoot LCP Candidate Selection - Plan
type: fix
date: 2026-10-17
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Photoshoot LCP Candidate Selection - Plan

## Goal Capsule

- **Objective:** Visitors opening a photoshoot see its largest initial-view photographs promptly.
- **Means:** Layout-aware, server-selected candidate delivery through the existing image component (KTD1–KTD4).
- **Authority:** The Product Contract below records the agreed candidate policy. Issue #29 supplies broader context; it does not reopen that policy. Requirements govern behavior, KTDs govern mechanisms, and units implement both.
- **Execution profile:** Characterize the existing browser layout before changing selection, then prove initial-document delivery in a production build. Component mocks cannot establish request priority or actual LCP.
- **Stop conditions:** Stop if the required cases cannot be covered within R3, if preserving R4–R6 becomes impossible, or if evidence invalidates a settled decision. Report `settled-decision-invalidated` with the decision and evidence rather than relaxing it.
- **Completion owner:** The implementing workflow completes the verification and shipping steps under its own authority. This document specifies implementation work, not evidence that it has already passed.

---

## Product Contract

### Summary

Replace the first-still loading proxy with a small set of likely initial-viewport LCP candidates derived from the photoshoot's balanced-column geometry. Select the set before HTML delivery and keep it stable through hydration.

### Problem Frame

At baseline `1e844dccb989182efb5b0034abb1fee0f461425e`, only the first serialized still receives eager/high delivery. CSS multicolumn flow places later photographs near the top of other columns, and the repeating aspect ratios can make a later photograph larger than a column starter.

The supplied production measurement for `/work/A`, 390×844 at DPR 2, identifies `IMG_3912.JPG`, zero-based gallery index 5, as LCP. Its reported rectangle is x=199, y=377.0390625, width=191, height=318.328125; it is lazy/auto and uses the optimized 384px candidate. Image 0 is eager/high but has a smaller 191×254.6640625 rectangle. Making image 0 urgent therefore misses the demonstrated performance problem.

### Requirements

**Candidate behavior**

- R1. Select still photographs most likely to occupy the largest painted area in the initial viewport using the actual gallery layout, including later cards within a column.
- R2. Deliver selected photographs as discoverable, non-lazy, high-priority resources in the initial document, without waiting for client measurement; a small bounded amount of loading beyond the exact fold is allowed.
- R3. Limit urgency to FOUR total unique still-image identities per initial navigation, counting the responsive candidate union, preload hints, eager/high images, and any hydration-time promotions together.

**Preservation**

- R4. Preserve filename source order, gallery DOM composition, column flow, repeating aspect ratios, and zero gallery-induced layout shifts.
- R5. Preserve the existing responsive `sizes`, optimized candidate selection, quality, and lazy delivery for all stills outside the selected set.
- R6. Preserve manual video playback, controls, poster handling, `playsInline`, and metadata-only preload behavior; videos participate in gallery geometry but cannot consume still-candidate slots.

**Proof**

- R7. At exactly 390×844 DPR 2 on the baseline `/work/A` content, `IMG_3912.JPG` at index 5 must receive initial-document non-lazy/high delivery, and the measured actual image LCP must belong to the selected set.
- R8. Verify actual initial-view candidate coverage, responsive delivery, and preservation across short/tall mobile, 900px tablet, 1440px desktop, and 1920px wide layouts, with varied title lengths, gallery lengths, and mixed video.

### Key Decisions

- **Permit bounded early loading.** Governs R2, R5. (session-settled: user-directed — chosen over strictly visible-only loading: viewport height and title wrapping vary, and initial urgency matters.)
- **Select by likely visible area.** Governs R1, R7. (session-settled: user-directed — chosen over column starters or the first two items per column: the measured mobile LCP is a later taller still.)
- **Use a four-image total budget.** Governs R3. (session-settled: user-directed — chosen over budgets of three or six: cover two/three-column layouts plus an alternate without making most of a long gallery urgent.)

### Acceptance Examples

- AE1. Covers R1, R2, R7. With unchanged `/work/A` content at the exact mobile reproduction dimensions, the document marks index 5 eager/high and the browser discovers its responsive resource before hydration.
- AE2. Covers R3, R5. When different representative widths nominate different images, their final combined urgent identity set still respects R3; separate breakpoint allowances cannot be added together.
- AE3. Covers R4, R6. When a ready video precedes the first still, it retains its original slot and behavior; selection accounts for its occupied card height without reindexing the aspect-ratio cycle over stills only.
- AE4. Covers R1, R8. When a long title moves the gallery down, evaluate clipped visible image area rather than full card area; if the initial viewport contains no image, do not assert that an image must be the page's LCP.

### Scope Boundaries

This work completes the photoshoot candidate-selection portion of [issue #29](https://github.com/slawinski/karolg/issues/29). Homepage loading and its existing masonry behavior are regression boundaries, not a source plan for this work.

Considered and not built:

- Client measurement, viewport-cookie cache variation, request-header viewport inference, and a new layout engine in the browser: they would delay early selection or change the cached-document contract.
- Manual media-qualified preloads and `picture` wrappers: unnecessary for the single bounded identity set in KTD1, and they introduce another delivery path to reconcile.
- A general-purpose CSS layout emulator, new CMS fields, persisted per-device selections, or a headless browser in request handling: disproportionate to this localized loading change. Browser characterization belongs in verification.
- Loading every visible image: R1 targets the largest likely candidates, not a promise that every initial-view card is urgent.

---

## Planning Contract

### Current Behavior and Evidence

The behavior trace follows the initial route through its owners:

1. `src/app/(frontend)/work/[slug]/page.tsx` obtains public photoshoot media and renders it without reordering. The route uses static params with `revalidate = 60`; it does not have reliable per-visitor viewport information.
2. `src/lib/portfolio.ts`, `getPhotoshootMedia`, loads all public documents sorted by `filename`, normalizes them, and removes unusable media. Query failures are logged and rethrown; this change does not replace that failure path.
3. The page computes `firstImageIndex` and passes the corresponding eager flag to `src/components/Visual.tsx`. `Visual` gives stills to Next Image with fill, explicit eager/lazy loading, high priority only for eager images, and caller-supplied sizes. Missing/unusable sources use the existing accessible placeholder. Ready videos take a separate semantic video branch.
4. `src/app/(frontend)/styles.css` supplies two columns through 1100px and three above it. Up to 700px, gallery horizontal padding is zero and the gap/margin is 8px. Larger layouts use clamped padding and gaps. The seven card ratios repeat by full gallery index, independently of intrinsic media dimensions.
5. React's installed server renderer automatically emits image preload hints for eligible eager images and excludes lazy/low-priority images. With responsive `srcSet`, it emits matching image source-set and sizes metadata. Thus component props alone are not a complete preload audit.

The trace establishes ownership and delivery, not an exact JavaScript reproduction of browser column breaking. CSS `column-fill` defaults to balance. Inline-block line boxes, margins at fragmentation boundaries, subpixel rounding, native serif fonts, and title wrapping all affect painted rectangles.

The existing generated document `.next/server/app/work/A.html` supplies the missing regression inputs: title `A` and nine stills, in order `IMG_3814.JPG`, `IMG_3815.JPG`, `IMG_3831.JPG`, `IMG_3834.JPG`, `IMG_3906.JPG`, `IMG_3912.JPG`, `IMG_3916.JPG`, `IMG_3926.JPG`, `IMG_3988.JPG`. Their presentation URLs use `/api/media/file/` with those filenames. Its image-0 eager/high and other-image lazy markup agrees with the baseline source and supplied observation. This generated file is evidence to extract, not a durable dependency; U1 must retain this sequence in the proposed fixture before any build can replace it. Intrinsic dimensions can be retained from public CMS metadata when available, but card geometry uses the fixed slot ratios rather than those dimensions.

### Key Technical Decisions

- KTD1. **Use one immutable server-side identity set for all widths.** Apply the selector once to the ordered, usable gallery and feed its result into the existing eager flag. Every selected still uses eager/high at every width; every other still stays lazy/auto. Do not add manual preloads, client reselection, hidden duplicate images, or breakpoint-specific eager sets. This instantiates the Product Contract's settled budget and bounded-loading choices under R2, R3, R5. React's automatic preload union is then a subset of the same identity set, so it cannot introduce a fifth identity by itself. This avoids the trap where media-qualified preload hints are bounded but eager image elements preload a larger union.
- KTD2. **Model contiguous balanced columns, then rank clipped visible area.** Introduce one photoshoot-specific pure selector, using the rendered seven-ratio cycle and every gallery slot, rather than shortest-column masonry, round-robin assignment, equal item counts, or still-only indexing. The proposed numerical scheme is specified below. Its output is a heuristic for R1, not an exact browser-layout guarantee; U1 characterizes discrepancies before integration.
- KTD3. **Allocate the budget after combining responsive scenarios.** Deduplicate by the existing presentation source URL from `mediaUrl`, retaining gallery indices for geometry. Choose identities using marginal visible-area coverage across scenarios; do not truncate each breakpoint independently. No filename, slug, CMS ID, or fixed index exception may force the `/work/A` result. U2 must derive the R7 candidate from geometry.
- KTD4. **Reuse `Visual` and Next Image unchanged.** The route owns selection and keeps its current `sizes` string. No new delivery component, React state, or optimization URL generator is needed. The browser continues selecting one width variant from a selected still's existing source set at a fixed viewport/DPR. Multiple width variants refer to one identity for R3, but duplicate full-resolution/optimized requests are still a delivery regression to investigate.
- KTD5. **Treat browser evidence as the coverage gate.** Only the cap and stable server membership follow structurally from KTD1/KTD3. Neither CSS balancing nor largest painted area proves which element will become actual LCP under network timing. U3 must establish R7/R8 using the installed production framework. If the finite required cases need more identities than R3 permits for a gallery, stop with the conflicting cases and identities; do not quietly weaken coverage or the budget.

### High-Level Technical Design

**Data flow**

| Stage | Input | Output and owner |
|---|---|---|
| Public data | Filename-sorted, normalized usable media | Ordered gallery from `getPhotoshootMedia` |
| Geometry | Full slot sequence, existing CSS dimensions | Predicted card rectangles for representative scenarios |
| Scoring | Rectangles clipped to scenario viewport | Area coverage per still identity |
| Allocation | Combined scenario scores | At most R3 identities from the pure selector |
| Delivery | Identity membership | Existing `Visual` eager flag and Next Image responsive markup |
| Browser | Initial HTML, matching source set, unchanged CSS | Resource discovery, hydrated DOM, actual LCP and layout-shift evidence |

**Selection algorithm: directional numerical design**

The constants in this paragraph are unvalidated technical defaults under Assumptions A1–A3. They are starting points for implementation, not newly agreed product thresholds.

1. Evaluate representative viewport widths 390, 700, 701, 900, 1100, 1101, 1440, and 1920. Pair each with heights 600, 844, 900, 1000, and 1080. Sample title heights of one through four rendered line heights using that width's actual head padding, font-size clamp, and `.76` line-height. This includes uncertainty in title wrapping without claiming server-side font measurement. Do not add the sticky header's height twice: its negative bottom margin cancels its normal-flow height.
2. Derive column width from viewport width minus horizontal padding and inter-column gaps. Slot height comes from that width and the slot's existing aspect ratio. Include videos and any rendered placeholders in height accumulation, but assign no still score to them. Include the item bottom margin and characterize the inline formatting contribution in U1.
3. Find the minimum feasible maximum column height for a source-order contiguous partition into at most the CSS column count. A greedy fill feasibility pass over slot extents supports a bounded binary search; use CSS-pixel precision sufficient to distinguish adjacent card boundaries. Reconstruct the source-order partition and card top positions. This models balanced unbreakable items; it is deliberately not advertised as the browser's balancing algorithm.
4. For each scenario, calculate each still's predicted rectangle intersection with the viewport. The area proxy is column width multiplied by vertically visible card height, with zero for no intersection. For repeated source identities, use the largest visible occurrence. Normalize by that scenario's largest still area; omit scenarios with no visible still from scoring.
5. Starting with an empty set, add the identity with the greatest increase in the sum of best-covered normalized areas across scenarios. Break equal gains by the number of scenarios in which that identity is an area winner, then by earliest gallery index. Stop when adding an identity has no positive gain or R3 is reached. Do not fill unused slots with arbitrary earlier images. Return membership without mutating the gallery.
6. Keep diagnostics in tests: scenario winners, selected identities, uncovered winners, and predicted positions. An uncovered required browser case fails KTD5 even if this numerical score is high. The score is a deterministic allocation rule, not a probability or an acceptance threshold.

**Initial-navigation lifecycle**

The server computes membership from one content version, renders eager/high attributes for members, and lets React emit its responsive hints. The browser parses that document, selects responsive resources, lays out the unchanged columns, and hydrates the same image props. No later lifecycle step expands membership. Resizing is not a new selection event; it can change width variants, not urgent source identities. A later navigation receives its own budget.

### Assumptions

These are unvalidated agent choices, not user-confirmed product decisions.

- A1. The representative widths, heights, and title-line envelope above provide a useful initial model of likely layouts. They are not a claim to cover every device, font fallback, title, or arbitrarily tall viewport.
- A2. Minimum-maximum contiguous partitioning approximates this gallery's browser balancing closely enough to nominate useful candidates. U1 must compare predictions with Chromium and WebKit using the unchanged CSS, including inline-block line-box and fragmentation effects.
- A3. Equal scenario weighting and marginal normalized-area coverage are a reasonable deterministic default in the absence of viewport analytics. They may be tuned from U1/U3 evidence within R1–R8; they may not be tuned by special-casing `/work/A`.

### Alternatives and Risk Decisions

Media-qualified preload links can select hints by viewport, but image `loading` and `fetchPriority` do not accept media queries. Leaving fallback images lazy would fail the requested non-lazy behavior; making a larger fallback union eager could violate R3 through React's automatic hints. A bounded unconditional set avoids both delivery uncertainties at the accepted cost of some beyond-fold loading.

No bake-off is needed: repository and framework evidence eliminate client-only selection and independent breakpoint allowances under the agreed constraints. The remaining numerical calibration is cheaply reversible inside one pure helper and is subject to the same production coverage gate.

Exact universal LCP prediction is not promised. Cached SSR lacks viewport height, client font metrics, browser column-breaking details, and resource completion order. A four-image set cannot guarantee coverage for arbitrary content and unbounded viewport heights. The agreed task is a largest-likely policy with the required finite validation matrix, not a universal guarantee. No evidence currently proves that finite matrix impossible under R3; its actual coverage remains an execution-time proof obligation.

### Sources and Research

- `src/app/(frontend)/work/[slug]/page.tsx`, `src/components/Visual.tsx`, `src/lib/portfolio.ts`, and `src/app/(frontend)/styles.css` establish the current route, delivery, order, and geometry contracts.
- `src/app/(frontend)/work/[slug]/page.test.tsx` currently asserts first-still eagerness and exactly one preload. Those are intentionally superseded policy assertions, not invariants to preserve.
- `package.json` pins Next.js 16.4.0 and React/React DOM 19.2.6. The installed Next server renderer's image branch confirms the automatic-preload behavior described above; React's default preload limits are not this feature's budget enforcement.
- [React image SSR preload controls](https://react.dev/reference/react-dom/components/img#controlling-image-preloading-during-server-rendering) and [Next Image documentation](https://nextjs.org/docs/app/api-reference/components/image) support KTD1/KTD4. Context7's Next documentation tracks canary rather than an exact 16.4.0 release, so installed source plus production output are the final compatibility evidence.
- [CSS Multicolumn Layout, column balancing](https://www.w3.org/TR/css-multicol-1/#cf) supports the distinction between contiguous balanced flow and masonry assignment; it does not supply an exact portable card-break implementation.
- `vitest.browser.config.ts` aliases Next Image to `src/test/NextImage.tsx`, a plain image shim. Its tests can establish CSS geometry, not production optimization, generated preloads, or initial request priority.
- `next.config.ts` supports optimized normal deployment and unoptimized static export. The loading policy must work for both without adding another URL path.
- The supplied grounding dossier and adversarial review dated 2026-10-17, review run `20261017-112603`, establish the baseline mobile LCP observation reproduced in Problem Frame. The durable fixture and verification receipt must retain the content identity needed to reproduce it.

---

## Implementation Units

### U1. Characterize the gallery geometry and retain the failing case

**Goal:** Establish trustworthy selector inputs and a browser oracle for the current composition.

**Requirements:** R1, R4, R6–R8; AE1, AE3, AE4.

**Dependencies:** None.

**Files:** Add `src/components/PhotoshootGallery.browser.test.tsx` and `src/test/fixtures/photoshoot-candidates.ts`. Read `src/app/(frontend)/styles.css`, `src/app/(frontend)/work/[slug]/page.tsx`, and the actual `/work/A` content. No layout change belongs in this unit.

**Approach:**

1. Retain the public title and complete nine-still sequence recorded in Current Behavior and Evidence. Capture intrinsic dimensions from public metadata if available, without substituting intrinsic ratios for the CSS slot ratios. Keep only public presentation metadata in the fixture; use controlled image resources for repeatable geometry.
2. Render the same section/figure markup and production stylesheet in a browser fixture, including header/head spacing. Preserve CSS ordering and inline-block behavior.
3. Record actual column starts and card rectangles across the matrix. Compare the partition model from KTD2 with those rectangles and record any needed line-box/fragmentation adjustments before relying on predicted candidates.

**Patterns to follow:** Existing `HomepageMasonry.browser.test.tsx` imports the real stylesheet and uses browser rendering. The page test already mocks public portfolio data. Geometry is based on figure slots, not intrinsic image ratios.

**Test scenarios:**

1. Covers AE1. The retained `/work/A` fixture at 390×844 has index 5 in its original position and taller visible area than image 0; title text and full media count are taken from the retained content, not guessed.
2. Covers AE3. A video at the beginning and a video at a predicted column boundary retain their slots and affect subsequent still positions.
3. Covers AE4. One-line, wrapping two/four-line, and gallery-below-viewport titles demonstrate actual clipping rather than full-card scoring.
4. Empty, one-item, two-item, six-item, seven-item, and fourteen-item galleries retain order and the repeating full-slot ratio cycle.
5. At 700/701 and 1100/1101, actual column count, gaps, padding, and card widths match the current CSS.

**Execution note:** Obtain browser characterization before using a simulated partition as a selection oracle. Missing exact baseline content blocks R7 proof and must be reported.

**Verification:** The fixture reproduces the supplied mobile geometric relationship, and Chromium/WebKit differences relevant to selection are explicit. No production code or stylesheet change is needed to characterize the baseline.

### U2. Select the bounded set and integrate server delivery

**Goal:** Replace the source-order proxy with deterministic layout-aware membership.

**Requirements:** R1–R7; AE1–AE3; KTD1–KTD4.

**Dependencies:** U1.

**Files:** Add `src/lib/photoshoot-candidates.ts` and `src/lib/photoshoot-candidates.test.ts`. Modify `src/app/(frontend)/work/[slug]/page.tsx` and `src/app/(frontend)/work/[slug]/page.test.tsx`. Reuse the fixture from U1. Read `Visual.tsx`; changing its shared delivery API is unnecessary.

**Approach:**

1. Implement the KTD2/KTD3 numerical design with U1's characterized geometry corrections. Keep CSS-derived constants explicit in the helper and covered by browser parity tests, without moving layout into JavaScript.
2. Allocate identities before rendering and replace `firstImageIndex` with identity membership. Keep the existing map, keys, variant index, figure classes, alt fallback, and sizes string.
3. Replace first-still/exactly-one-preload expectations with assertions about selected membership, the combined urgent identity budget, and unselected lazy delivery. Parse image preload hints separately from ordinary markup and non-image resources.

**Patterns to follow:** Pure media helpers in `src/lib`; actual `renderToStaticMarkup` with the real Next Image in the node page test; existing `inferMediaKind`, `mediaUrl`, and usability semantics.

**Test scenarios:**

1. Covers AE1. Geometry-derived membership includes `IMG_3912.JPG` from the retained fixture without any slug/index/filename exception; markup gives it eager/high and the unchanged responsive sizes.
2. Covers AE2. Responsive scenarios nominate more than one distinct candidate; the final identity union satisfies R3 in selector output, eager/high image markup, and generated responsive preload hints.
3. A larger second card in a later column outranks a smaller starter where clipped area warrants it, disproving both rejected shortcuts.
4. Duplicate presentation URLs in different slots count once while their positions remain distinct; equal scores resolve deterministically without reordering input.
5. Empty and video-only input select no stills; a short gallery does not receive arbitrary selections just to exhaust the budget.
6. Covers AE3. Videos at leading/interleaved positions influence geometry but never become eager image candidates or change playback attributes.
7. Repeated rendering of identical public input returns identical membership and markup. Nonmembers have lazy loading and no high-priority hints.
8. The existing two-column mobile sizes remain literal-equivalent, and page-level invalid/unusable-media handling still follows the current normalization/rendering contract.

**Verification:** Focused selector/page tests pass against the actual framework renderer, and browser characterization shows that selected identities track the largest likely visible cards. A score alone cannot waive KTD5.

### U3. Prove production discovery, hydration stability, and actual coverage

**Goal:** Establish that the selected policy fixes the measured request and remains bounded in the real application.

**Requirements:** R2–R8; KTD5.

**Dependencies:** U2.

**Files:** Extend `src/components/PhotoshootGallery.browser.test.tsx` for selection/geometry parity. Add `scripts/verify-photoshoot-candidates.mjs` as a small Playwright-based production-navigation check using the existing Playwright dependency. Write a dated verification receipt under `docs/verification/` with public content fingerprints and observations.

**Approach:**

1. Use fresh browser contexts and fixed viewport/DPR before each navigation. Capture the document response, response/early Link hints where exposed, image requests, and preload metadata before relying on the hydrated DOM.
2. Install buffered LCP and layout-shift observers before navigation. Retain all candidate entries and the last settled entry before scrolling or user input. Record source identity, currentSrc, loading/priority, rectangle, and selected membership.
3. Compare JavaScript-disabled initial-document delivery with normal hydrated navigation on the same content. Hydration must neither add a new urgent identity nor change membership. Observe automatic lazy requests separately: browser lazy-loading proximity does not make them application-selected urgent images.
4. Record resource initiators and request priority from Chromium network tooling, not just the `fetchPriority` attribute. Check that a responsive hint and its image reuse the selected optimized resource without an unnecessary fallback download.
5. Execute the matrix below and stop on uncovered required LCP cases under KTD5. If selection tuning is necessary, update the pure helper and its regression fixtures, then repeat only affected checks before the final matrix.

**Patterns to follow:** The repository's browser-test conventions for fixtures, cleanup, and real styles; direct Playwright for a built application where the component image alias would invalidate delivery evidence. This is a targeted verifier, not a new general E2E framework.

**Test scenarios:**

1. Covers AE1. Production `/work/A` at exactly 390×844 DPR 2 exposes the correct resource before hydration, keeps index 5 eager/high, and reports its actual image LCP within membership.
2. Covers AE2. At every matrix size, all application-directed urgent still identities across document, preload, and hydration evidence obey R3, even if multiple link/image references point to the same still.
3. At 390×844 DPR 2, the expected source-size width is 191 CSS px; candidate boundaries should retain the appropriate approximately 384px response rather than the former 828px response. A different width is accepted only with an explained framework/browser candidate-boundary reason and correct preserved sizes.
4. With short/tall mobile and wrapping titles, the observed largest initial-view still is selected. If title/video is the final page LCP, report that honestly and separately inspect the largest visible still's delivery.
5. Mixed videos retain metadata-only preload, poster, manual controls, and no autoplay. Leading/interleaved videos do not cause still-index drift.
6. Before/after load and hydration, card rectangles retain their reserved dimensions and the gallery contributes zero layout-shift entries.
7. Cached repeat navigation and unoptimized static-export rendering use the same content-derived policy. No runtime viewport dependency or optimized-only assumption is introduced.

**Verification:** Preserve the production receipt with actual results for every row, including failures. Do not label all of issue #29 complete without checking its broader homepage regression criteria as well.

---

## Verification Contract

### Required Matrix

Each row is a fresh initial navigation, without scroll. Test the retained `/work/A` content and controlled short/long galleries; vary one-line, wrapping, and gallery-below-viewport titles, with leading/interleaved ready videos. Boundary checks supplement these rows.

| Viewport | DPR | Specific purpose |
|---|---|---|
| 390×844 | 2 | Exact supplied regression; mandatory index-5 delivery and actual LCP proof |
| 390×600 | 2 | Short-mobile clipping |
| 390×1000 | 2 | Tall-mobile later-card exposure |
| 900×900 | 2 | Two-column padded tablet |
| 1440×900 | 1 | Three-column desktop |
| 1920×1080 | 1 | Wide layout and clamped gaps/padding |

Chromium proves production LCP and request priority. WebKit proves layout and loading-markup parity; where an engine lacks the required LCP API, use visible-still rectangles plus delivery checks and state that limitation instead of claiming equivalent LCP telemetry.

### Repository Checks

- `pnpm test` covers the pure selector, real SSR page rendering, and existing media/portfolio regressions.
- `pnpm typecheck` checks route/helper integration.
- `pnpm test:browser` and `pnpm test:browser:webkit` cover gallery geometry and unchanged homepage/browser behavior.
- `pnpm build` followed by the targeted production verifier proves generated HTML, requests, hydration, and LCP against the actual installed Next/React versions.
- Static export needs its existing build path's unoptimized rendering smoke check. Do not use the plain-image test alias to claim optimized request coverage.

### Failure Interpretation

A prediction mismatch is evidence to correct the model, not permission to change the composition. More than four required distinct urgent identities for the same gallery across the required initial-navigation cases is an explicit conflict with the chosen single-set mechanism; first assess whether the numerical model is wrong. If no compliant layout-aware policy can meet the required cases, return the conflicting content/scenarios and `settled-decision-invalidated` rather than adding a fifth image or accepting a missed mandatory LCP.

The cap measures application-directed urgency, not total browser requests: native lazy loading can fetch nearby unselected images. Count original still identity after normalizing optimizer URLs; also retain actual URLs to detect duplicate or oversized transfers. At fixed viewport/DPR, initial hints and images should agree on the responsive resource.

---

## Definition of Done

- U1 retains the real failing content metadata and explains browser geometry well enough to support selection.
- U2 implements R1–R6 through the selected KTDs, with no hardcoded `/work/A` exception and no shared `Visual` behavior regression.
- U3 supplies production evidence for R7/R8 and the verification matrix; all required cases satisfy the budget and preservation requirements.
- The intentional first-still test evolution is explicit, and nonselected images remain lazy in server output.
- The final diff contains no abandoned selector experiments, duplicate delivery paths, debug-only client logic, or accidental gallery/style changes.
- Any unresolved failure is reported with its content, viewport, selected identities, actual LCP, and recovery requirement; an incomplete receipt is not a passing result.
