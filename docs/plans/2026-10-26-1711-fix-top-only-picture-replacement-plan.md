---
title: Top-Only Picture Replacement - Plan
type: fix
date: 2026-10-26
topic: top-only-picture-replacement
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Top-Only Picture Replacement - Plan

## Goal Capsule

- **Objective:** Visitors browsing down the homepage no longer see automatic picture replacements.
- **Means:** Add a page-position condition to the existing replacement eligibility gate and reuse wave settlement (KTD1–KTD3).
- **Authority:** The Product Contract owns behavior; the Planning Contract owns implementation within that scope.
- **Stop conditions:** Return to planning if the correction requires changing scrolling behavior or replacement animation design.
- **Execution profile:** One localized component change with browser regression coverage.
- **Finish and ship:** The implementation owner completes U1 and its verification; publishing requires separate authorization.

## Product Contract

### Summary

Restrict automatic homepage picture replacement to the top of the page.
Stop replacements when the visitor scrolls away, then restart the normal cadence when they return.

### Problem Frame

Replacement currently remains eligible while the title or a small part of the first image row is visible.
Visitors therefore continue seeing replacements after starting to browse down the gallery, contrary to the intended top-only behavior.

### Requirements

- R1. Automatic replacement may run only at the page's top position, subject to the existing media-readiness, visibility, and reduced-motion conditions.
- R2. Leaving the top immediately settles already-launched replacements and discards preparing or queued replacements; obsolete callbacks cannot launch further replacements.
- R3. Returning to the top starts a fresh normal waiting period without catching up on missed replacements, preserving the existing cycle and direction rules.
- R4. Initial rendering or restoration below the top must remain ineligible even if the title or first row is still visible.
- R5. The position rule applies across existing responsive layouts without changing page smoothing, column motion, cursor movement, or media playback policy.

### Acceptance Examples

- AE1. Covers R1, R4. With the title and first row still visible, a visitor scrolls down one CSS pixel and waits longer than a full replacement interval: no replacement starts.
- AE2. Covers R2. A visitor leaves the top during preparation or a staggered wave: queued nodes disappear, already-launched swaps settle once, and late media events do not revive the wave.
- AE3. Covers R3. A visitor returns to the top after a pause: the next wave waits the full applicable initial or between-cycle delay.

## Planning Contract

### Key Technical Decisions

- KTD1. **Use actual document position.** Extend `HomepageMasonry`'s existing eligibility effect with a passive native scroll listener and an initial position read. Define the top as `window.scrollY <= 0`, including negative overscroll; every positive offset is away. Retain the existing intersection checks as additional prerequisites, not as a substitute for position. Native position also covers smooth scrolling, keyboard movement, anchors, and restoration without coupling this gate to `HomepageScroll`.
- KTD2. **Invalidate synchronously on departure.** Update `eligibleRef` and invoke the existing `cancelWaveRef` settlement path when eligibility changes to false, before relying on the state-driven scheduler cleanup. Keep generation checks, launched-swap commits, cycle accounting, and stale-callback rejection in their existing owners. Remove the new listener in effect cleanup.
- KTD3. **Restart through existing scheduling.** Re-enter the current `heroEligible` scheduler on return to the top. Do not preserve elapsed delay or introduce wheel-input state. Existing `galleryMotion` constants remain authoritative for initial and subsequent delays.

### High-Level Technical Design

Directional lifecycle sketch; the existing scheduler and cancellation machinery retain ownership:

```text
Mount or native scroll → recompute existing eligibility AND top-position condition
Eligible → ineligible: invalidate and settle wave → scheduler cleanup clears timers
Ineligible → eligible: existing scheduler starts a fresh delay → normal replacement wave
```

## Implementation Units

### U1. Gate replacement waves on page position

**Goal:** Enforce the top-only interaction without changing replacement or scrolling mechanics.

**Requirements:** R1–R5; AE1–AE3.

**Dependencies:** None.

**Files:**
- Modify `src/components/HomepageMasonry.tsx`.
- Extend `src/components/HomepageMasonry.browser.test.tsx`.

**Approach:**
1. Extend the eligibility effect using KTD1–KTD2 and initialize its position condition before scheduling is possible.
2. Preserve scheduler and settlement behavior under KTD3; avoid changes to the scroll wrappers or motion layers.
3. Add scroll-position setup and cleanup to the existing browser fixture so tests cannot leak scroll state.
4. Extend the existing cancellation and restart coverage with real scroll-event cases while leaving intersection visibility positive.

**Patterns to follow:** The eligibility effect, `settleActiveWave`, and scheduler generation checks in `HomepageMasonry`; the existing staggered-wave and cancellation tests in `HomepageMasonry.browser.test.tsx`.

**Test scenarios:**
1. Covers AE1. At the top with ready, visible media, the initial delay produces a wave; at a positive one-pixel offset with unchanged intersections, a full interval produces none.
2. Covers R4. Mount below the top, emit positive title and first-row intersections, and wait: no incoming transition nodes appear.
3. Covers AE2. Scroll away during preparation and dispatch late readiness events: incoming nodes are discarded and no launch follows.
4. Covers AE2. Scroll away between staggered launches: only launched swaps commit once, queued swaps do not launch, and late readiness or animation events cannot alter the settled result.
5. Covers AE3. Return to the top before any wave has launched and after a partially launched wave: each case waits its full applicable delay and retains the established cycle direction.
6. Covers R1, R5. Returning to the top while hidden or reduced-motion remains active does not enable replacement; repeat the position transition at a touch-layout width.

**Verification:** All new scenarios and existing replacement lifecycle tests pass. Browser scrolling continues to work with the homepage smoothing and column effects active.

## Verification Contract

- Run `pnpm test:browser src/components/HomepageMasonry.browser.test.tsx` and `pnpm test:browser:webkit src/components/HomepageMasonry.browser.test.tsx` for eligibility, cancellation, and cross-browser scroll boundaries.
- Run `pnpm test:browser src/components/HomepageMasonryScroll.browser.test.tsx src/components/HomepageScroll.browser.test.tsx` for the existing scroll integrations.
- Run `pnpm typecheck`.
- In the running homepage, wait at the top for a replacement, scroll slightly while the first row stays visible, and wait through another interval; replacements must remain stopped. Return using both ordinary scrolling and Back to top, and confirm delayed resumption.

## Definition of Done

- U1 satisfies R1–R5 and AE1–AE3 with passing verification results.
- The original partial-scroll reproduction no longer permits automatic replacement.
- Existing wave settlement, direction, and restart-delay tests continue passing.
- The change contains no abandoned experimental code or unrelated cleanup.
