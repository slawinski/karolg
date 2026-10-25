---
title: Masonry Skyline Boundary - Plan
type: feat
date: 2026-10-25
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Masonry Skyline Boundary - Plan

## Goal Capsule

- **Objective:** The homepage gallery responds to the cursor inside its jagged silhouette and recenters when the cursor moves above it.
- **Means:** Rendered column-top geometry within the existing motion effect (KTD1).
- **Authority:** Product requirements govern behavior; technical decisions govern mechanism; implementation units govern scope.
- **Execution profile:** Localized pointer interaction change with real-browser regression coverage.
- **Stop conditions:** A confirmed requirement proves infeasible or required verification cannot run.
- **Delivery:** LFG implements, reviews, and opens a pull request; merging belongs to the user.

## Product Contract

### Summary

Replace the rectangular upper hover boundary with a continuous stepped skyline following the masonry column tops.

### Problem Frame

The wrapper currently keeps driving horizontal motion while the cursor is in the empty space above shorter columns, so leaving the visible gallery does not recenter it.

### Requirements

- R1. Above each visible column's first card, the cursor is outside the active gallery and triggers the existing return to center.
- R2. Below the skyline, horizontal and vertical gaps remain active; horizontal gutters bridge at the lower neighboring top.
- R3. Re-entering the active area resumes cursor-driven motion with the existing strength and easing.
- R4. Hit testing uses the gallery's current rendered horizontal position, including while it is animating.
- R5. Preserve outer-wrapper leave behavior and existing fine-pointer and reduced-motion restrictions.

### Key Decisions

- **Continuous skyline.** Governs R1, R2. (session-settled: user-directed — chosen over individual-card hit areas: crossing internal gaps should not repeatedly reset the swing.)

### Acceptance Examples

- AE1. Covers R1, R3. Move right below a short column's top, then move upward into its empty headroom: the rail returns smoothly to center; moving down resumes tracking.
- AE2. Covers R2. Move across a gutter below both neighboring tops or through a vertical gap: tracking continues.
- AE3. Covers R4. A stationary cursor can become outside as the animated skyline moves underneath it; the return then completes without repeatedly reactivating itself.

## Planning Contract

### Key Technical Decisions

- KTD1. **Measure first-card rectangles.** In `src/components/HomepageMasonry.tsx`, derive horizontal spans and top edges from nonempty visible columns' first cards. The existing CSS in `src/app/(frontend)/styles.css` supplies staggered padding, responsive column counts, and column animation transforms; rendered rectangles include these without duplicating CSS constants. In gutters use the maximum adjacent top. Clip classification to the viewport bounds and extend an outermost column's top to any uncovered viewport-side sliver.
- KTD2. **Reuse the motion loop.** Retain the latest pointer coordinates while it is inside the outer wrapper, including moves above the skyline; classify on pointer moves and recheck that pointer during animation frames after applying the transform. Once outside the skyline, latch the return until fresh pointer input or a genuine viewport update; do not let the return animation itself re-enter tracking. Scroll and resize reclassify the retained pointer against current client-space geometry, resuming tracking only if it is now inside the active area. Outer-wrapper leave clears the retained pointer and invokes the existing return, so later viewport updates cannot revive a departed pointer. Remove listeners and cancel frames on cleanup.
- KTD3. **Use browser geometry tests.** Add focused coverage in a separate `src/components/HomepageMasonryPointer.browser.test.tsx` using the existing browser harness and real styles, with controlled static image fixtures. Assert translation outcomes rather than private helper structure.

### Assumptions

Rendered vertical column movement contributes to the measured top when hit testing occurs. This work does not add an always-running idle animation loop solely to poll geometry.

## Implementation Units

### U1. Follow the rendered skyline

**Goal:** Implement R1–R5 in the existing pointer-motion effect.

**Dependencies:** None.

**Files:** `src/components/HomepageMasonry.tsx`; `src/components/HomepageMasonryPointer.browser.test.tsx`.

**Approach:** Follow KTD1–KTD3; keep media scheduling and markup unchanged. Keep geometry local to the pointer effect unless a reusable boundary is demonstrated necessary.

**Patterns to follow:** Existing pointer listeners, animation cancellation, ResizeObserver, and `vitest.browser.config.ts` real-browser setup.

**Test scenarios:**
1. Covers AE1. At desktop width, move below a short column, then into the empty space above it while still inside the wrapper; translation returns to center and re-entry resumes it.
2. Covers AE2 and R2. Choose adjacent columns with unequal rendered tops. In their horizontal gutter, a pointer between those tops is outside and recenters; below the lower neighboring top (the larger client-space Y), it tracks. Movement through a vertical gap below the skyline also continues tracking.
3. Covers AE3 and R4. Choose a stationary point that starts below the rendered skyline but becomes above it during a noncentral horizontal excursion. Verify the rendered rectangles actually cross that point without another pointer event, then verify the rail reverses toward center before reaching the original noncentral target and completes centering without reactivation as the skyline returns underneath the pointer.
4. Pointerleave still recenters; a subsequent scroll or resize without new pointer input does not resume tracking. Reduced-motion or coarse-pointer environments never acquire inline motion transforms.
5. Three-column layout uses its actual rendered tops after resize; scrolling re-evaluates client-space geometry using the latest pointer coordinates, including a pointer last moved into headroom. Verify an update that leaves that point outside continues returning, and an update that puts it below the skyline resumes tracking. Use actual browser viewport changes so responsive CSS and the component's column count agree.

**Verification:** Browser regression coverage passes with real layout, and TypeScript reports no new errors.

## Verification Contract

- `pnpm typecheck` checks integration types.
- `pnpm test` checks existing unit behavior.
- `pnpm test:browser src/components/HomepageMasonryPointer.browser.test.tsx src/components/HomepageMasonry.browser.test.tsx` verifies pointer changes and media scheduling in Chromium.
- Run the focused pointer file in WebKit as a second geometry-engine check.
- Inspect the homepage in a browser when the local app and content are available; record unavailable checks honestly.

## Definition of Done

U1 satisfies R1–R5, relevant checks pass, and the diff contains no abandoned experimental code. Review findings are resolved or recorded, and the pull request includes verification evidence.
