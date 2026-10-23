---
title: Native Photoshoot Navigation - Plan
type: fix
date: 2026-10-23
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Native Photoshoot Navigation - Plan

## Goal Capsule

- **Objective:** Visitors opening a photoshoot from the portfolio see its title and opening images immediately.
- **Means:** Make the public route wrapper measurable and use the framework's native scrolling support (KTD1, KTD2).
- **Authority:** Product requirements govern behavior; technical decisions govern mechanism; units implement both.
- **Execution:** One bounded replacement, verified through real navigation and existing browser coverage.
- **Completion:** Update the existing PR, obtain CI results, and leave merging to the user.
- **Stop:** Report a material layout, media-readiness, or navigation regression that cannot be corrected within this scope.

## Product Contract

### Summary

Replace the photoshoot scroll-reset workaround with native route scrolling, retaining the portfolio's layout and media behavior.

### Problem Frame

The route's boxless readiness wrapper prevents the router from finding a scroll target. The custom reset in PR #44 masks that structural problem and overrides native history restoration.

### Requirements

- R1. Opening a photoshoot through a portfolio link starts at vertical position zero on mobile and desktop, including cached repeat navigation.
- R2. Reload and Back/Forward retain native browser restoration instead of forcibly resetting to zero.
- R3. Homepage work/profile anchors, reduced-motion behavior, and ordinary scrolling after entry remain usable.
- R4. Public page geometry, sticky headers, and critical-image/video readiness retain their existing behavior.

### Scope Boundaries

The accepted replacement removes the custom scroll effects. No gallery redesign, media-delivery change, database change, or new history manager is included.

## Planning Contract

### Key Technical Decisions

- KTD1. **Keep the readiness wrapper as an ordinary block element.** Remove its inline display override while preserving the ref, context, readiness marker, keyed route identity, and image scan. This restores a layout rectangle without changing readiness ownership. Serves R1 and R4. (session-settled: user-approved — chosen over custom scroll effects: the wrapper-only comparison fixed link navigation with identical measured geometry.)
- KTD2. **Declare existing smooth scrolling to Next.js.** Add the documented smooth-scroll data attribute to the frontend root HTML element so route transitions can reset instantly while in-page scrolling remains supported. Serves R1 and R3. See the [Next.js 16 scrolling upgrade guidance](https://nextjs.org/docs/app/guides/upgrading/version-16#scroll-behavior-override).
- KTD3. **Remove the custom reset and its mount.** Native restoration under R2 is the intentional distinction from the prior workaround, not a test failure to suppress.

### Evidence and Constraints

`src/components/PublicMediaReadiness.tsx` owns the wrapper and critical-image scan; `src/app/(frontend)/layout.tsx` owns the HTML element. The installed Next.js 16.4 router checks client rectangles, and its smooth-scroll utility reads the data attribute named by KTD2. Browser-only research found identical geometry in 30 route/viewport combinations and four pixel-identical screenshot pairs. The local database has A/B/c/d photoshoots, not the production roll-up slug. Local WebKit is blocked by a macOS runtime/protocol mismatch; Linux CI provides the configured WebKit suite.

## Implementation Units

### U1. Replace the scroll workaround and verify native routing

**Requirements:** R1-R4; KTD1-KTD3.

**Dependencies:** Existing public routes and local A/B/c/d media fixtures.

**Files:** `src/components/PublicMediaReadiness.tsx`, `src/app/(frontend)/layout.tsx`, `src/app/(frontend)/work/[slug]/page.tsx`, `src/components/PhotoshootScrollReset.tsx` (remove), `scripts/verify-public-navigation.mjs`, `src/components/PublicMediaReadiness.browser.test.tsx` and `src/components/PhotoshootGallery.browser.test.tsx` (existing verification).

**Approach:**
1. Apply KTD1 and KTD2, then remove the now-unused component and page mount under KTD3.
2. Retain the real-navigation regression and delayed-media checks in the existing verification script; replace zero-on-history expectations with R2 checks.
3. Verify both ordinary and reduced-motion navigation and repeat cached entry. Keep changes confined to the files named above and this plan.

**Execution note:** Use the existing real-browser regression as the proof boundary. Verify that disabling the workaround exposes the original failure before applying the structural correction; do not substitute mocked scroll calls for navigation behavior.

**Test scenarios:**
1. From a homepage scrolled by 1200px, open a photoshoot and observe zero scroll and its visible title at 390px and 1440px.
2. Return to the homepage, scroll again, and reopen the cached photoshoot; R1 still holds.
3. Scroll a photoshoot and reload or traverse history; the automatic restoration policy remains active and a nonzero saved position is retained.
4. Complete slow image loading after deliberate visitor scrolling; no custom reset interrupts the visitor.
5. Follow work/profile anchors and verify their targets are visible. Compare page geometry and sticky positioning across the 700px and 1100px breakpoints.
6. Pending critical images block video acquisition; settled images permit eligible silent playback; reduced motion continues to suppress acquisition.

**Verification:** Real navigation satisfies R1-R3, existing readiness/browser checks satisfy R4, and the production build completes in CI.

## Verification Contract

- `pnpm typecheck`, `pnpm test`, and `pnpm test:browser` must pass.
- Run `node scripts/verify-public-navigation.mjs http://localhost:3005 <temporary-report-path>` against this project's running local server, or use its actual assigned port.
- Recheck browser geometry on the shared wrapper at mobile/desktop and breakpoint widths.
- The existing Linux CI includes WebKit component tests and production-build smoke checks; inspect its final commit results. Do not weaken tests to bypass the local WebKit runtime limitation.

## Definition of Done

R1-R4 are verified, the obsolete reset component has no remaining references, and no experimental implementation remains. PR #44 describes the structural fix and native history behavior, the intended files are pushed, and CI is decided. Pre-existing untracked screenshot artifacts remain excluded.
