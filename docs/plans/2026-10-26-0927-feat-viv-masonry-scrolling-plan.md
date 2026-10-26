---
title: ViV Masonry Scrolling - Plan
type: feat
date: 2026-10-26
topic: viv-masonry-scrolling
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
execution: code
---

# ViV Masonry Scrolling - Plan

## Goal Capsule

- **Objective:** Desktop visitors experience the homepage gallery with ViV's layered scrolling, trailing columns, and image-only top-edge reveal.
- **Means:** Homepage-scoped native-window smoothing and independently retargeted column transforms (KTD1–KTD5).
- **Authority:** The Product Contract owns behavior and scope; the Planning Contract owns implementation choices within those constraints.
- **Open blockers:** None.
- **Stop conditions:** Stop on evidence invalidating a settled decision or requiring a Product Contract change.
- **Execution profile:** Implement U1–U4 with browser integration proof. The authorized downstream pipeline owns implementation, verification, review, and PR delivery; this artifact does not assert those actions have happened.

---

## Product Contract

### Summary

Recreate the desktop scrolling experience of https://vivmgmt.com/ on the homepage, including page inertia, independently eased image columns, and clipping at the title's top edge.
Tighten desktop image gutters while retaining the existing cursor movement and image swaps.

### Problem Frame

The homepage already has a staggered gallery, horizontal cursor movement, and media swaps, but lacks the reference's page inertia, trailing columns, and title-aligned upper crop.
The existing desktop gutters also make the composition less dense than the user wants.

### Key Decisions

- **Full scrolling recreation.** Governs R1–R5. (session-settled: user-directed — chosen over gallery-local motion with native page scrolling: the user wants the complete reference scrolling experience.)
- **Desktop first.** Governs R8. (session-settled: user-directed — chosen over adapting the effect to desktop and touch together: touch adaptation is deferred.)
- **Tighter gutters.** Governs R6. (session-settled: user-approved — chosen over the existing 12–24px range: a denser desktop gallery is desired.)

### Requirements

**Scrolling and clipping**

- R1. Desktop wheel and trackpad scrolling moves the homepage with the reference's page inertia and eased settling after input stops.
- R2. While the gallery is visible, wheel input adds a shared vertical movement target for its image columns relative to the title, including reverse movement when scrolling upward.
- R3. Columns ease toward that shared target over 0.5s, 0.8s, 0.2s, 0.3s, and 0.6s from left to right in the five-column desktop layout.
- R4. Column motion continues after input stops until each column reaches its target, preserving visibly different catch-up times without bounce or an abrupt reset.
- R5. Images crossing the gallery's upper clipping boundary at the title's top edge disappear through a hard crop and reappear when scrolling back; the title remains outside the image clipping layer.

The title and clipped gallery share the homepage composition, but only the gallery's images move behind the clipping edge.
The clip boundary moves with its page region rather than remaining pinned to the browser's top edge.

**Spacing and compatibility**

- R6. Desktop horizontal and vertical image gutters scale within 8–16px, replacing the existing 12–24px range.
- R7. Horizontal cursor movement, skyline-based pointer activation, media links, and image-swap animations continue to work alongside the added scrolling effects.
- R8. Touch devices retain ordinary scrolling and their existing gallery spacing.
- R9. Reduced-motion mode disables the added page inertia and column parallax, leaving the gallery usable with ordinary scrolling.
- R10. Navigation, homepage anchor destinations, and the footer remain reachable and behave correctly with smooth scrolling enabled.

### Key Flows

- F1. **Scroll and settle.** Covers R1–R5. A desktop visitor scrolls down through the gallery; the page glides, columns move relative to the title, and images crossing the clip edge disappear. When input stops, columns finish catching up at their individual rates. Scrolling upward reverses their movement and reveals images again.
- F2. **Use the moving gallery.** Covers R7, R10. A visitor moves the cursor through the gallery and opens a media link while scrolling effects are active, then returns or continues to the footer without losing navigation access.

### Acceptance Examples

- AE1. **Covers R1–R4.** After a short desktop wheel burst, the page eases to rest and the slower columns visibly continue catching up after the faster ones have settled; all columns converge on the same extra offset rather than retaining different speed-derived offsets.
- AE2. **Covers R2, R5.** Scroll down while the title and gallery top are visible: images crop at the title-aligned gallery boundary without fading, and scrolling back reveals them again without clipping the title.
- AE3. **Covers R6.** At narrow and wide desktop widths, both horizontal and vertical gutters are visibly tighter than before and stay within the required range.
- AE4. **Covers R7.** Move the cursor above a short column's skyline while columns are settling: the existing horizontal return-to-center behavior still works, and image swaps do not cancel the scroll effect.
- AE5. **Covers R8, R9.** On touch devices or with reduced motion enabled, visitors can scroll and use media links without acquiring the added inertial column movement.
- AE6. **Covers R10.** Follow a homepage anchor, open and return from a media link, and scroll to the footer with page smoothing enabled; destinations remain accessible and scrolling remains functional.

### Scope Boundaries

- This work targets the homepage's desktop scrolling experience, including its interaction with the footer and navigation.
- Touch-specific parallax and changes to mobile image spacing are deferred per R8.
- Reference branding, typography, content, and unrelated page redesigns are outside this work.

### Outstanding Questions

- **Resolved:** Smooth-scrolling mechanism, footer integration, navigation, and restoration are covered by KTD1 and KTD7.
- **Resolved:** Reference easing, scroll gain, offset bounds, and page smoothing settings are covered by KTD1–KTD3.
- **Resolved:** Fewer-column desktop layouts retain their original left-to-right duration positions under KTD3.

### Sources / Research

- https://vivmgmt.com/ — browser inspection on 2026-10-26 found page smoothing and an overflow-hidden gallery wrapper separate from the title. Wheel input updates a shared extra column offset by negative half the wheel delta and clamps it between a content-derived negative bound and zero.
- The reference's served `Layout.astro` script uses individual eased column responses with durations recorded in R3. Browser sampling confirmed that response times differ during catch-up while final extra offsets converge.
- The reference's page-scrolling instance reported wheel smoothing enabled and a smoothing interpolation factor of 0.1. These are research observations, not a commitment to a particular library.
- `src/components/HomepageMasonry.tsx` — existing horizontal cursor motion, rendered skyline hit testing, responsive column topology, and media-swap scheduling are integration constraints.
- `src/app/(frontend)/styles.css` — existing title placement, staggered column spacing, and column-swap transforms establish the current composition.
- `docs/plans/2026-10-25-1932-feat-masonry-skyline-boundary-plan.md` — documents the existing pointer activation behavior covered by R7.

---

## Planning Contract

**Product Contract preservation:** Product Contract unchanged in meaning; R1–R10, F1–F2, AE1–AE6, scope boundaries, and settled annotations preserved. Added problem framing and resolved planning-owned questions in place.

### Key Technical Decisions

- KTD1. **Use Lenis core on the native window, scoped to the homepage.** Covers R1, R8–R10. Add `lenis` and `gsap` to `package.json` and the existing `pnpm-lock.yaml`; choose stable releases and lock their resolved versions during implementation. A client boundary mounted only by `src/app/(frontend)/page.tsx` owns one Lenis instance. Use vertical window scrolling, `lerp: 0.1`, wheel smoothing, wheel multiplier 1, no touch synchronization, automatic dimension updates, and automatic RAF. Do not also drive Lenis from the GSAP ticker. Native window positions keep `FooterReveal` and the existing scroll listeners in the same coordinate system. Include the recommended Lenis stylesheet and disable CSS smooth scrolling while its instance owns the page. (session-settled: user-directed — chosen over gallery-local motion with native page scrolling: the user wants the complete reference scrolling experience.)
- KTD2. **Accumulate one bounded extra offset from raw wheel input.** Covers R2, R4. Observe window wheel events while the non-transformed gallery viewport intersects the browser viewport; do not require the pointer to be over a card. Update the shared target by subtracting raw `deltaY / 2`, then clamp to `[-max(visible nonempty column.clientHeight / 2), 0]`. Use untransformed layout heights, including column stagger padding, not transformed card bounds or total page height. Hidden/empty columns do not contribute; no contributing columns means a zero bound. Preserve the source's raw delta handling rather than feeding Lenis-normalized deltas into this accumulator. Ignore zoom gestures and touch input. This observer never cancels page scrolling and must not reject a wheel merely because Lenis already prevented its native default. Stop accepting new targets outside the gallery, but allow existing tweens to finish and retain the last target for re-entry. No reset on intersection exit.
- KTD3. **Use GSAP `quickTo` with explicit `power3.out`.** Covers R3, R4. Create one reusable y tween per rendered column, mapping the duration array `[0.5, 0.8, 0.2, 0.3, 0.6]` seconds by original zero-based position. The three-column desktop layout therefore uses the first three durations, not a redistributed pattern. Retarget only when the shared target changes; restarting it every frame would change the reference response. GSAP power3 out is the quartic-out curve, not cubic-out. Keep offsets in refs/animation objects rather than React state. Kill each owned tween during cleanup.
- KTD4. **Keep transform ownership separate.** Covers R5, R7. The rail retains horizontal cursor translation; `.cursor-masonry__column` owns the new vertical scroll transform; its existing `.cursor-masonry__column-motion` child retains swap animation ownership and its animation-end handler. No whole-page transform or additional scroller is introduced. While vertical tweens update, re-evaluate the latest stationary pointer against rendered first-card bounds, using the existing gutter-bridging and return-to-center latch. Perform that check even after the horizontal RAF or page inertia has stopped. Pointer departure must still clear the stored pointer. Reuse the pointer controller rather than duplicating its skyline algorithm.
- KTD5. **Clip only the gallery at the shared stage origin.** Covers R5. Make the existing `.cursor-masonry` viewport an image-only overflow-hidden layer on desktop; `.masonry-name` stays its sibling at the stage's top origin. Retain the viewport's natural layout height so transforms do not pull the profile/footer upward. Preserve each column's stagger padding. The crop is hard, page-relative, and never fixed to the screen. Check focus visibility for links near the crop as part of browser integration.
- KTD6. **Scope spacing and animation eligibility independently.** Covers R6, R8, R9. Use `clamp(8px, 1vw, 16px)` for both rail and column-motion gaps only at widths above 700px with hover and fine-pointer capability. Match the `homepageCardSizes` branches to those same gaps, keeping coarse-pointer and mobile sizes consistent with their existing spacing. Motion requires that desktop predicate plus no reduced-motion preference. Listen for live preference/capability changes, destroy the page smoother and column tweens when ineligible, and clear only owned styles. Re-enabling begins at zero extra offset at the current native page position. The smaller gutters still apply on reduced-motion desktop. (session-settled: user-approved — chosen over the existing 12–24px desktop gutters: a denser desktop gallery is desired.) Desktop-only eligibility implements the settled desktop-first scope in R8 (session-settled: user-directed — chosen over adapting desktop and touch together: touch adaptation is deferred).
- KTD7. **Let browser/Next.js own URLs and restoration; synchronize motion around them.** Covers R10. Keep real links and their default Next.js scroll behavior; do not set `scroll={false}`, replace history restoration, or reset native scroll to zero on mount. Initialize Lenis from actual window scroll. Leave Lenis anchor handling disabled: native anchors and Next.js own destination positioning, with no second animated anchor controller. Capture ordinary same-tab navigation before its default/router handling to cancel stale inertia through public Lenis methods, without canceling the click. Preserve normal hash/history updates and modified/external link behavior. Verify this with both `#top` and the existing `/#work` and `/#about` Next links.
  - Before native page-scroll keys outside editable controls or scrollbar dragging take control, cancel the stale smoothing target without preventing browser defaults. New wheel input may then resume smoothing from the actual position.
  - Resynchronize dimensions and position after the browser/router applies a native destination, including `pageshow` and history/hash restoration. Do not replay an old wheel target or force a hash target during history traversal that restored a different native position.
  - A fresh homepage mount resets only the extra column offset; a BFCache return retains its DOM offset. `FooterReveal` continues consuming native scroll and layout bounds with its existing focus/readability behavior.

### High-Level Technical Design

**Ownership sketch:** The homepage client boundary surrounds the existing homepage content without replacing its server data fetching. It owns window smoothing; `HomepageMasonry` owns the wheel accumulator and column/pointer interaction; `FooterReveal` remains a native-scroll consumer. The title and gallery share the stage origin, but only the gallery is clipped (KTD1, KTD4, KTD5).

**Input/data-flow sketch (KTD1–KTD4):**

1. A desktop wheel event reaches Lenis and the independent gallery observer.
2. Lenis eases the native window position; native scroll listeners update footer and gallery geometry.
3. The gallery observer checks intersection and updates the clamped shared target.
4. Each column's reusable tween converges to that target at its assigned duration.
5. Column updates invalidate rendered skyline hit testing, including when page scrolling has stopped.

**Transform/layout sketch:**

| Layer | Owner | Coordinate or effect |
|---|---|---|
| Window | Homepage smoother | Native page y |
| Stage/title sibling | Existing layout | Page-relative title and clip origin |
| Gallery viewport | Styles | Hard image crop; natural height retained |
| Rail | Existing pointer controller | Horizontal x only |
| Outer column | Column scroll controller | Extra y plus existing layout padding |
| Inner column-motion | Existing swap scheduler | Temporary swap y; animation completion |

**Lifecycle sketch:** Ineligible/native → eligible at current native position → active wheel/glide → settling → idle. Idle or settling can return to active on new input. Gallery exit blocks new target updates but does not dispose motion. Preference loss or unmount disposes owned work; restoration resynchronizes the native coordinate before accepting new input (KTD2, KTD6, KTD7).

**Mode/decision sketch:**

| Homepage/device state | Page inertia | Column motion | Gap policy |
|---|---|---|---|
| Fine hover, width above 1100px, normal motion | Enabled | Five positional durations | KTD6 desktop |
| Fine hover, width 701–1100px, normal motion | Enabled | First three positional durations | KTD6 desktop |
| Fine hover desktop, reduced motion | Native | None | KTD6 desktop |
| Coarse/touch or width up to 700px | Native | None | Existing spacing |
| Non-homepage route | Existing behavior | Not mounted | Existing spacing |

### Assumptions

- **Unvalidated device interpretation:** The repo's existing hover/fine-pointer predicate plus width above 700px defines desktop eligibility. Touch gestures remain native even on hybrid hardware; no touch-driven column accumulator is added.
- **Unvalidated restoration detail:** R10 requires usable native-position restoration, not persistence of historical wheel-derived column offsets across a new route mount. KTD7 specifies the distinction from BFCache.
- **Unvalidated visual calibration:** Reference constants are the starting and intended final settings. Browser comparison may reveal integration defects in this site's geometry, but changing R3's durations or the settled desktop scope requires explicit upstream treatment rather than silent tuning.

### Existing Behavior Trace and Integration Constraints

- `HomepageMasonry` writes rail x from a demand-driven RAF. `isBelowSkyline` reads first-card rendered rectangles by iterating rail children. It already rechecks on window scroll/resize and during horizontal tracking; it has no independent vertical-tween update path. KTD4 closes that concrete gap.
- The media-swap scheduler writes the inner motion layer through CSS and commits on its own `gallery-column-move` animation end. Retaining that layer prevents vertical scroll animation from canceling swap completion.
- `.cursor-masonry` and the absolutely positioned title both begin at `.masonry-stage` top. Current desktop overflow leaves images vertically visible, so the crop can use the existing boundary without moving the heading.
- `FooterReveal` schedules updates from native window scroll, resize, pageshow, and element-size changes. It derives progress from its own bounding rect, suspends under a photoshoot dialog, and removes its callbacks on unmount. KTD1 avoids changing that coordinate model.
- `PublicMediaReadiness` delays swap eligibility, not native scrolling. The smoother must not wait for that readiness state or lock the page while images decode.
- `vitest.browser.config.ts` aliases `next/link` and `next/image` to local shims. Component tests prove geometry and lifecycle, but cannot establish App Router restoration behavior.

### Alternatives and Risks

- **Custom inertia/RAF implementation:** Rejected because matching Lenis and GSAP retarget behavior would duplicate maintained mechanisms without improving reference fidelity. No bake-off is needed: public documentation and the inspected reference settle the mechanism; remaining geometry adjustments are cheap to reverse.
- **Transforming the swap layer or page root:** Rejected because it would compete with CSS swap transforms or invalidate native footer/navigation coordinates.
- **Dual CSS/library smoothing:** Existing global CSS smooth scrolling must yield while Lenis owns the homepage. Restore the prior behavior on disposal; keep the layout's scroll-behavior metadata consistent with the CSS it describes.
- **Resize/topology changes:** Measure rendered columns after topology commits and observe untransformed sizes. Recompute the bound and retarget the retained target into its new range without clearing it on every resize. Rebuild tween ownership when columns change, initializing retained columns from their current offset and new columns from the shared target. Avoid a height-observer loop driven by transforms.
- **Restoration during inertia:** Lenis source only adopts native scroll events freely when not actively smoothing. KTD7 therefore requires explicit interruption/synchronization at navigation boundaries, rather than assuming any window scroll event cancels inertia.
- **Considered, not built:** No new persisted scroll store, custom scrollbar, generalized smooth-scroll service, ScrollTrigger integration, or offscreen animation scheduler. Current native layout, route ownership, and bounded gallery motion cover this request; evidence of a concrete failure in those paths would justify the smallest targeted change.

### Sources and Dependencies

- `package.json`: Next.js 16.4.0, React 19.2.6, pnpm 10.34.6; no existing animation dependency. Lenis core and GSAP core are planned additions, not prerequisites assumed to exist.
- [Lenis official documentation](https://github.com/darkroomengineering/lenis/blob/main/README.md), consulted through Context7 on 2026-10-26: window wrapper, lerp, optional anchor handling, recommended CSS, automatic RAF, native touch behavior, resize, and disposal inform KTD1, KTD6, KTD7. The native anchor route in KTD7 cancels inertia before browser/router positioning instead of enabling Lenis's separate anchor animation.
- [Lenis core source](https://github.com/darkroomengineering/lenis/blob/main/packages/core/src/lenis.ts): constructor initializes from actual scroll; active inertia does not freely adopt native scroll events; public stop/start, resize, and immediate scroll provide synchronization points for KTD7. Recheck against the release installed during implementation, since these links track main.
- [GSAP quickTo documentation](https://gsap.com/docs/v3/GSAP/gsap.quickTo/) and [easing reference](https://gsap.com/docs/v3/Eases/), consulted through Context7: reusable property tween retargeting and explicit ease selection inform KTD3.
- [Next.js Link documentation](https://nextjs.org/docs/app/api-reference/components/link), consulted through Context7: preserve default route/hash scrolling and browser back/forward semantics. Retrieved source examples include canary code, so the real-app check against installed 16.4.0 is authoritative for integration.
- `PRODUCT.md`: image-first editorial presentation, fast browsing, contact access, reduced motion, and performance constrain dependency use and verification.

---

## Implementation Units

### U1. Add homepage-scoped page inertia and navigation lifecycle

**Goal:** Smooth eligible desktop homepage scrolling without changing the native page coordinate system.

**Requirements:** R1, R8–R10; F2; KTD1, KTD6, KTD7.

**Dependencies:** None.

**Files:** Create `src/components/HomepageScroll.tsx` and `src/components/HomepageScroll.browser.test.tsx`; modify `src/app/(frontend)/page.tsx`, `src/app/(frontend)/styles.css`, `package.json`, and `pnpm-lock.yaml`. Modify `src/app/(frontend)/layout.tsx` and its existing `layout.test.ts` only if scroll-behavior metadata needs adjustment.

**Approach:**

1. Install the two core dependencies and mount the client lifecycle owner around homepage content, preserving server rendering and readiness ownership.
2. Apply KTD1/KTD6 eligibility, stylesheet, and cleanup semantics with current native position as the initial coordinate.
3. Implement KTD7 link/native-input interruption and restoration synchronization through public APIs, leaving URL/history changes and anchor positioning to existing links and the router.

**Patterns to follow:** `FooterReveal` live media-query cleanup and pageshow handling; `PublicMediaReadiness` cancellation of stale asynchronous work.

**Test scenarios:**

1. Covers AE1. A real pixel-wheel burst on an eligible desktop changes native scroll progressively and settles after input stops; only one Lenis RAF owner is active.
2. Covers AE5. Coarse pointer, a 700px viewport, and reduced motion each leave native scrolling usable without a smoother; changing preferences live disposes the old instance without changing current scrollY.
3. Mount under React StrictMode, unmount during inertia, then dispatch wheel/resize/pageshow: no stale controller mutates scroll or leaves Lenis root classes/styles behind.
4. Covers AE6. Activate a same-document hash during inertia: one activation produces one native/router destination, the hash is retained, and subsequent wheel scrolling works without a second Lenis anchor animation.
5. Initialize at a nonzero native position and emit restoration events: the controller adopts that position rather than animating toward zero or a stale target.
6. Ordinary modified clicks, external links, and mail links retain browser behavior; touch input never starts column motion or synthetic touch inertia.

**Verification:** Browser tests establish lifecycle and native coordinate behavior. Real App Router navigation is verified in U4, not inferred from the link shim.

### U2. Add shared wheel offset and independent column catch-up

**Goal:** Reproduce bounded, reversible column movement without overwriting image swaps or pointer behavior.

**Requirements:** R2–R5, R7–R9; F1–F2; KTD2–KTD4, KTD6.

**Dependencies:** U1 for animation dependencies and eligibility alignment.

**Files:** Modify `src/components/HomepageMasonry.tsx`; create `src/components/useHomepageColumnScroll.ts` and `src/components/HomepageMasonryScroll.browser.test.tsx`; extend `src/components/HomepageMasonryPointer.browser.test.tsx` and the existing `src/components/HomepageMasonry.browser.test.tsx` where combined swap coverage belongs.

**Approach:**

1. Put the wheel target, column measurements, tween handles, and cleanup in a focused hook rather than the swap scheduler.
2. Apply KTD2/KTD3 to the outer columns, preserving their identity and data-column positions.
3. Expose a local motion-update invalidation path to the existing pointer controller per KTD4; retain its return latch and rendered-card lookup.
4. Handle resize, topology, preference, and unmount transitions without scheduling React renders per frame.

**Execution note:** Preserve the existing pointer and swap characterization while adding motion integration cases; a mocked tween call alone does not prove catch-up or transform composition.

**Patterns to follow:** Existing ref-owned pointer RAF and effect cleanup; existing column/inner-motion nesting and filtered animation-end handling.

**Test scenarios:**

1. Covers AE1. From target zero with a sufficiently tall visible gallery, raw deltaY 120 targets -60 for all columns. At an intermediate time their y values differ by the positional response pattern; after the last input plus the slowest duration they converge within 1px.
2. Repeated down input reaches the measured lower bound, repeated up input reaches zero, and reversing during a tween converges without overshoot or a reset. Test raw delta modes without applying Lenis normalization a second time.
3. Wheel while the gallery is outside the viewport does not change the target; exiting during settlement does not cancel it, and re-entry/upward input reverses the retained offset.
4. Resize from five to three rendered columns: positional duration mapping remains correct, the bound uses current layout heights, and surviving columns do not jump to zero. Empty galleries yield finite zero bounds and no tweens on missing columns.
5. Covers AE4. A stationary pointer crosses a moving skyline after page and horizontal motion have stopped: horizontal tracking recenters and remains latched until a valid activation; a departed cursor is not reused.
6. Covers AE4. Trigger a prepared media swap during vertical catch-up: the outer y and rail x remain active, the inner swap finishes, and exactly the intended incoming media commits.
7. Covers AE5. Toggle reduced motion or pointer capability during settling: new y motion stops, owned offsets clear, links remain usable, and disposal leaves no observers, wheel callbacks, or active tweens.

**Verification:** Actual browser transforms show different transient offsets and equal settled offsets; pointer and swap regression cases remain valid.

### U3. Apply title-aligned crop and tighter desktop spacing

**Goal:** Crop moving gallery images at the title origin while preserving the responsive composition.

**Requirements:** R5–R9; F1; KTD5, KTD6.

**Dependencies:** U2.

**Files:** Modify `src/app/(frontend)/styles.css`, `src/components/HomepageMasonry.tsx`, and `src/components/HomepageMasonryScroll.browser.test.tsx`.

**Approach:**

1. Apply KTD5 at the existing gallery viewport, retaining natural page height and existing stagger padding.
2. Apply KTD6 to both gap axes and synchronize the responsive image sizes string, including the wide coarse-pointer branch.
3. Verify title visibility, card link hit testing, and footer document placement under the combined transforms.

**Patterns to follow:** Existing 700px/1100px breakpoints, hover/fine-pointer rules, stage/title sibling composition, and reduced-motion styles.

**Test scenarios:**

1. Covers AE2. Scroll an image above the stage origin: the part above the boundary is cropped, the title remains visible outside the clipping subtree, and upward input reveals the image again.
2. Covers AE2. Move the page while a card is cropped: the clip boundary moves with the stage, rather than staying pinned at browser y=0.
3. Covers AE3. At 701px, 1000px, 1440px, and 1920px fine-pointer widths, computed horizontal and vertical gaps match KTD6 and remain within R6's bounds; image-size estimates agree with the rendered rail widths.
4. Covers AE5. At mobile and coarse-pointer widths, existing gaps and title composition remain unchanged; reduced-motion desktop retains its tighter gaps with zero added y offset.
5. At maximum negative offset, the profile/footer retain their layout position, horizontal page overflow is absent, and clicking/tabbing to visible media links remains possible near the crop.

**Verification:** Geometry assertions plus narrow/wide desktop screenshots prove crop and spacing; touch/reduced-motion screenshots confirm compatibility.

### U4. Verify the complete scrolling and navigation experience

**Goal:** Prove the combined motion remains usable through gallery interactions, anchors, route returns, and footer access.

**Requirements:** R1–R10; F1–F2; AE1–AE6; KTD7.

**Dependencies:** U1–U3.

**Files:** Extend `src/components/HomepageScroll.browser.test.tsx`, `src/components/HomepageMasonryScroll.browser.test.tsx`, and `src/components/PortfolioFooter.browser.test.tsx`; change `src/components/FooterReveal.tsx` or `src/components/PortfolioFooter.tsx` only for defects demonstrated by this integration.

**Approach:**

1. Exercise a combined homepage-like browser fixture with real Lenis/GSAP and footer motion, alongside focused deterministic animation assertions.
2. Use the running Next.js app for route/history proof because the component harness substitutes links.
3. Compare the reference's motion shape with the implemented desktop behavior using the constants already recorded; treat geometry failures as integration defects, not permission to substitute another product effect.

**Test scenarios:**

1. Covers F1 / AE1–AE2. Down burst, stop, reverse: page glide, bounded column catch-up, hard crop, and reversible reveal coexist without bounce.
2. Covers F2 / AE4. During active scrolling, move through skyline headroom and open a real work link; swaps and pointer behavior do not prevent navigation.
3. Covers AE6. In the actual app, enter `/#work` and `/#about` directly, activate footer links during an unfinished glide, use Back to top, and confirm the requested targets remain reachable with correct URLs.
4. Covers F2 / AE6. Navigate from a scrolled homepage to a work route and back/forward while inertia was active: browser/Next restoration retains a usable native position, old homepage motion is disposed, and the next wheel does not jump to a stale destination. Include BFCache pageshow and a fresh route mount.
5. Covers AE6. During an active glide, use keyboard PageDown/End and scrollbar dragging: each native action wins over the stale inertia target and the footer remains reachable. Links work on the first click and keyboard focus makes footer navigation readable. Page-scroll keys inside editable controls retain their default editing behavior.
6. Covers AE5. Repeat essential navigation on coarse/touch and reduced-motion modes, including preference changes while the gallery is moving.

**Verification:** Chromium and WebKit component suites pass, and real-app browser evidence covers the router-specific cases component mocks cannot establish.

---

## Verification Contract

Verification is future implementation work; no tests or builds are prerequisites to writing this plan.

| Check | Existing entry point | Required evidence |
|---|---|---|
| Type safety | `pnpm typecheck` | New library and hook integration type-checks |
| Unit regression | `pnpm test` | Existing homepage/domain tests still pass |
| Chromium browser behavior | `pnpm test:browser` | New scroll cases plus existing masonry, pointer, readiness, and footer cases pass |
| WebKit browser behavior | `pnpm test:browser:webkit` | Geometry, cleanup, and motion compatibility pass in WebKit |
| Production integration | `pnpm build` | Next.js client/server boundaries and dependency packaging build successfully |
| Actual App Router flows | Running application, real browser | U4 route/hash/history scenarios succeed without the NextLink shim |
| Reference comparison | Desktop browser recording/screenshots | AE1–AE4 show correct motion shape at 1000px and 1440px or wider |

Use controlled GSAP time advancement or polling with explicit tolerances for catch-up assertions; avoid fixed sleeps and GSAP-private internals.
Synthetic wheel events can test the accumulator, but page inertia needs trusted browser wheel input because default prevention/native scrolling differ for untrusted events.
There is no `release:validate` script in this repository; no skill/agent behavioral evaluation applies to this UI-only change.
Preserve existing user-owned `.vitest-attachments/` and `src/components/__screenshots__/` contents when collecting evidence.

---

## Definition of Done

- U1: Eligible desktop page inertia uses native window scroll, starts from actual scrollY, and cleans up across mode changes and navigation.
- U2: All rendered columns share a bounded final target while retaining positional catch-up timing; skyline and media-swap behavior remain correct.
- U3: Crop follows the title-aligned page region, title is unaffected, desktop gaps meet R6, and touch spacing is preserved.
- U4: AE1–AE6 have browser evidence, including actual Next.js navigation/restoration and footer access.
- Every Verification Contract gate applicable to implementation has passed; failures are resolved or reported rather than represented as successful checks.
- No Product Contract scope or settled decision changes are introduced silently.
- Remove abandoned implementation experiments and stale animation work from the intended diff; preserve unrelated user files and existing screenshot/attachment artifacts.
