---
title: ViV-inspired Portfolio Footer - Plan
type: feat
date: 2026-10-24
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# ViV-inspired Portfolio Footer - Plan

## Goal Capsule

- **Objective:** Visitors finish browsing Carla's work with a distinctive editorial closing screen and clear routes to her portfolio, profile, and contact.
- **Means:** Recreate the composition and scroll-linked reveal of ViV's `c-footer` with Carla's content, using KTD1–KTD4.
- **Authority:** Requirements govern product behavior; technical decisions govern mechanisms within those requirements; units and examples override neither.
- **Execution profile:** Local frontend implementation and browser verification. Preserve existing CMS, gallery, viewer, and native navigation contracts.
- **Completion owner:** An implementing agent or developer completes the units and verification after implementation is authorized. Planning does not authorize commits, pushes, or a PR.
- **Stop conditions:** Report any evidence that the confirmed identity or route coverage cannot work, or that implementation requires changing media delivery or navigation contracts.

---

## Product Contract

### Summary

Replace the existing compact footers with one shared editorial footer on the homepage and photoshoot pages.
Adapt ViV's serif statement, grouped links, oversized identity, copyright, parallax, and dark-overlay fade to Carla's portfolio.

### Problem Frame

The current public pages end with small utility strips.
The requested reference gives visitors a composed closing screen that makes identity and onward navigation prominent, consistent with the editorial direction in `PRODUCT.md`.

### Key Decisions

- **Adapt the reference to Carla.** (session-settled: user-directed — chosen over literal ViV content: the recreation serves Carla's portfolio.) Governs R1, R2.
- **Cover both public portfolio page types.** (session-settled: user-directed — chosen over homepage only: the same closing treatment belongs after individual photoshoots.) Governs R3.

### Requirements

**Composition and content**

- R1. Match the reference's spacious, light-background composition: a large serif statement at the upper left, grouped sans-serif links beside it, oversized Carla branding below, and small copyright text.
- R2. Use existing site settings for the statement, identity, locations, and contact details, with existing portfolio fallbacks where available; do not reproduce ViV artists, business claims, logo, or destinations.
- R3. Render the shared footer once at the end of `/` and every valid `/work/[slug]` page, retaining access to Selected work, Profile, Instagram, and Back to top.
- R4. Include an Email link only when the configured email is non-empty after trimming; Instagram remains available when email is absent.

**Motion and reachability**

- R5. Reveal the footer with reversible, linear scroll-linked motion from the moment its outer top reaches the viewport bottom until that top reaches the viewport top.
- R6. Across R5's interval, move the inner content from −25% to 0% of its own height and fade the dark overlay from opacity 0.5 to 0.1.
- R7. Keep all content reachable on mobile, short landscape viewports, and with enlarged text; allow a footer taller than the viewport instead of cropping content to a fixed height.
- R8. With JavaScript unavailable or reduced motion enabled, show the complete static footer without parallax or scroll-dependent fading; live preference changes must take effect immediately.
- R9. Retain semantic links, visible keyboard focus, functional-text AA contrast, and minimum 44px targets; decorative layers must not intercept input or conceal focused controls.

**Integration**

- R10. Preserve normal document scrolling, route and anchor navigation, browser history restoration, media readiness, and viewer focus/scroll restoration; footer motion must not introduce page jumps.

### Acceptance Examples

- AE1. **Covers R5, R6:** At half of the reveal interval, the inner translation is −12.5% and overlay opacity is 0.3; scrolling back returns through the same values without an entrance replay.
- AE2. **Covers R7, R9:** On a short landscape screen, visitors can scroll to every footer link and the copyright; keyboard focus is never left in a clipped region.
- AE3. **Covers R8:** Enabling reduced motion halfway through the reveal immediately produces the static readable state; disabling it resumes from current geometry.
- AE4. **Covers R4:** Empty or whitespace email omits Email without leaving an empty group; a populated address supplies a mail link.
- AE5. **Covers R10:** Closing a photoshoot viewer restores its prior gallery scroll and focus, and the footer returns to the progress corresponding to that position.

### Scope Boundaries

- The footer and its transition from preceding content are active scope; gallery layout, media loading, CMS schema, and page-wide redesign are not.
- The request supersedes the compact utility-footer wording in `DESIGN.md`; update those specific statements without revising the broader visual system.
- ViV's artist hover-media previews, hover-dependent background colors, automatic navbar hiding, and separate 1.6-second SVG logo wipe are not part of the confirmed parallax/opacity treatment.
- No new booking address, fabricated representation, linked artist roster, contact form, or animation/scrolling dependency.
- A general scroll-lock registry is unnecessary for this localized change; use the existing modal state and verify compatibility before widening interfaces.

---

## Planning Contract

### Key Technical Decisions

- KTD1. **Share a page-level footer component.** Add `PortfolioFooter` at both existing footer insertion points inside their route-keyed `PublicMediaReadiness` boundaries, rather than moving it to the root layout. This preserves existing page ownership and avoids changing frontend 404 behavior. Implements R3.
- KTD2. **Use native geometry and batched DOM updates.** Both routes scroll the document. Measure the untransformed outer footer, clamp reveal progress to `(viewport height − footer top) / viewport height`, and update dedicated inner-transform/overlay properties in one requested frame. Do not store continuous progress in React state, install a perpetual animation loop, or import ViV's GSAP/Lenis setup. Implements R5, R6, R10.
- KTD3. **Default to readable static markup.** Render footer text and links on the server; install motion as progressive enhancement. A CSS minimum height of `100svh` supplies reveal travel while natural growth satisfies R7. The static state uses zero translation and the final overlay value from R6. Keep the dark layer decorative and local, and choose foreground colors that meet R9 throughout the fade.
- KTD4. **Own and clean up the motion lifecycle.** Recalculate on mount, scroll, resize, `pageshow`, visibility return, and size changes to the footer or preceding page content. Subscribe to live reduced-motion changes, cancel queued frames, and disconnect listeners/observers on unmount. Pause updates while the existing media-viewer dialog is open and resample after body-scroll restoration. Use a narrowly scoped observer of dialog insertion/removal if needed, not a new global scroll service. Implements R8, R10; follows React's Effect setup/cleanup contract.
- KTD5. **Use existing content and typography.** Use `site.heroHeadline` with `fallbackSite.heroHeadline` for the statement, `site.name` with the existing name fallback for a typographic wordmark/copyright, and existing location labels as supporting metadata. Use Explore links to `/#work` and `/#about`, plus Connect links per R4. Reuse the local serif/sans stacks rather than downloading ViV fonts or embedding its logo. Implements R1, R2, R4.
- KTD6. **Keep focus independent of animation.** While focus is inside the footer, use its static state without a transition, then resample on focus exit. Give each page's existing main a route-local top anchor for Back to top. Keep overlay pointer events disabled and avoid clipping that hides reachable content. Implements R3, R9.

### High-Level Technical Design

The following sketches describe boundaries and lifecycle, not implementation code.

**Component/data ownership**

```text
Homepage site settings -> PortfolioFooter -> semantic content and dedicated motion layers
Photoshoot site settings -> the same PortfolioFooter
Native viewport events -> outer-footer measurement -> inner transform and overlay opacity
Existing viewer dialog state -> pause/resample footer measurements
```

**Motion lifecycle**

| Mode | Entry | Render/update behavior | Exit |
| --- | --- | --- | --- |
| Static | Server render, no enhancement, or reduced motion | KTD3 static presentation | Enhancement becomes eligible |
| Tracking | Visible document, motion enabled, no modal or footer focus | KTD2 geometry mapping | A suspension condition or unmount |
| Suspended | Hidden document or media viewer open | Cancel queued work; retain last valid presentation | Resample after return/restoration |
| Focus-readable | Footer contains keyboard focus | KTD6 static presentation | Focus leaves; resample |
| Disposed | Route unmount | Remove owned listeners, observers, and pending frames | New route creates a fresh instance |

Tracking begins with an immediate sample, including when the route is already scrolled.
Progress remains at its completed value while the rest of a tall footer scrolls past.
Measure geometry anew after layout changes; do not cache an absolute page offset that delayed content can invalidate.

### Alternatives and Risks

- **Native updates over GSAP/Lenis:** The reference bundles both, but this site has neither dependency and requires no scroll replacement. The geometry is simple and reversible, so developing competing implementations would add no useful evidence.
- **Natural height over exact fixed-height copying:** ViV uses `height:100svh` with hidden overflow. That can hide Carla's longer wordmark or links in landscape and enlarged-text modes; KTD3 preserves its composition while satisfying R7.
- **No image/font readiness gate:** Contact must be usable before the gallery's readiness delay completes. Size observation updates motion when layout changes; readiness does not control footer visibility.
- **Modal scroll locking:** `PhotoshootMediaViewer` fixes the body with negative saved coordinates and restores it on close. KTD4 must ignore those intermediate measurements; U3 verifies this against the actual viewer.
- **Router coverage:** Browser component tests alias Next Link, so they cannot prove real history restoration or route transitions. The live-route checks in the Verification Contract are required.

### Deferred Implementation Details

- Tune line breaks, italic emphasis, wordmark scale, and exact spacing against the reference at implementation time, using the existing CMS text without inventing claims.
- Verify the smallest sufficient dialog observation strategy in the browser; expand the viewer interface only if the integration test demonstrates that passive observation cannot preserve R10.

### Sources and Research

- [ViV homepage](https://vivmgmt.com/), inspected 2026-10-24: `c-footer` markup and stylesheet establish composition and responsive grouping.
- [ViV layout script](https://vivmgmt.com/_astro/Layout.astro_astro_type_script_index_0_lang.gekIbzeD.js): `data-footer-parallax` timeline establishes R5/R6. The stylesheet's final `.c-footer__bg` opacity is 0.1, not zero. Asset hashes may change; use these recorded values as the baseline.
- [React useEffect](https://react.dev/reference/react/useEffect) and [Effect synchronization](https://react.dev/learn/synchronizing-with-effects), consulted through Context7: mirrored cleanup and Strict Mode setup/cleanup govern KTD4.
- `src/app/(frontend)/page.tsx` and `src/app/(frontend)/work/[slug]/page.tsx`: existing page-owned footer locations and site settings.
- `src/lib/portfolio.ts` and `src/globals/SiteSettings.ts`: existing statement, contact, name, and location fields; no schema additions required.
- `src/components/PublicMediaReadiness.tsx`, `src/components/HomepageMasonry.tsx`, and `src/components/PhotoshootMediaViewer.tsx`: route lifecycle, motion cleanup patterns, and body-lock ownership.
- `PRODUCT.md` and `DESIGN.md`: editorial typography, no invented commercial claims, accessibility, and restrained motion.

---

## Implementation Units

### U1. Build and integrate the shared editorial footer

**Goal:** Replace both utility strips with the same readable, responsive closing composition.

**Requirements:** R1–R4, R7–R9; AE2, AE4.

**Dependencies:** None.

**Files:** Create `src/components/PortfolioFooter.tsx`, `src/components/PortfolioFooter.test.tsx`, and `src/components/PortfolioFooter.browser.test.tsx`; modify `src/app/(frontend)/page.tsx`, `src/app/(frontend)/work/[slug]/page.tsx`, `src/app/(frontend)/styles.css`, and `DESIGN.md`.

**Approach:**
1. Implement KTD1, KTD3, and KTD5 using small serializable props from the existing page data.
2. Replace the two footer blocks and remove their obsolete desktop/mobile CSS, including selectors that hide footer spans.
3. Add the route-local top targets from KTD6 and revise only the superseded compact-footer statements in `DESIGN.md`.

**Patterns to follow:** Existing page data loading, `fallbackSite`, and public serif/sans CSS. Do not request photoshoot lists just to populate a new footer roster.

**Execution note:** Establish the static composition in the browser before adding scroll enhancement.

**Test scenarios:**
1. Render server markup with populated settings: statement, name, copyright, and real link destinations are present without hydration.
2. Covers AE4. Render missing, whitespace, and populated email: only the populated case creates a mail link; Instagram remains present.
3. Covers AE2. At phone and short landscape sizes, all links and copyright remain reachable without horizontal page overflow; targets and focus indicators satisfy R9.

**Verification:** Both real page types show one shared footer; no media query hides its identity or copyright.

### U2. Add the scroll-linked parallax and opacity lifecycle

**Goal:** Match the reference reveal without replacing native scrolling.

**Requirements:** R5, R6, R8–R10; AE1, AE3.

**Dependencies:** U1.

**Files:** Modify `src/components/PortfolioFooter.tsx`, `src/components/PortfolioFooter.browser.test.tsx`, and `src/app/(frontend)/styles.css`.

**Approach:**
1. Implement KTD2 and KTD4 against the stable outer geometry and isolated presentation layers.
2. Implement the static and focus-readable states from KTD3/KTD6; preserve normal-flow dimensions while applying transforms.
3. Keep work event-driven, read geometry before writing styles, and release all owned resources on route unmount.

**Patterns to follow:** `HomepageMasonry` visibility/reduced-motion cleanup and `PublicMediaReadiness` cancellation patterns, without inheriting their media delay.

**Test scenarios:**
1. Covers AE1. Scroll a deterministic tall-page fixture through reveal start, midpoint, and end, then reverse; computed transforms and opacity follow R6 within rendering tolerance.
2. Covers AE3. Toggle reduced motion during partial reveal: cancel pending motion and show the static state; returning to motion samples current progress.
3. Mount at an already-scrolled position, then change viewport and preceding-content height: progress updates without requiring an additional scroll.
4. Focus a footer link during partial reveal: its focus indicator and content are visible; leaving focus restores position-based progress.
5. Unmount/remount under Strict Mode with a queued frame: the old instance cannot update removed elements or duplicate listeners.

**Verification:** The animation is linear and reversible, no perpetual frame loop remains idle, and no component rerenders continuously on scroll.

### U3. Verify real routes and viewer restoration

**Goal:** Prove the new ending remains usable through real portfolio navigation and gallery viewing.

**Requirements:** R3, R7–R10; AE2, AE5.

**Dependencies:** U2.

**Files:** Extend `src/components/PortfolioFooter.browser.test.tsx`; extend `src/components/PhotoshootMediaViewer.browser.test.tsx` only for the shared viewer/footer integration fixture. Existing `src/app/(frontend)/work/[slug]/page.test.tsx` remains a media-delivery regression check.

**Approach:** Exercise the existing viewer alongside the footer, then inspect real Next routes where mocked Link components cannot establish navigation behavior. Fix footer-owned failures in U1/U2 files without widening gallery or router scope.

**Test scenarios:**
1. Covers AE5. Open the actual viewer near footer entry, close via button and Escape, and verify original scroll, opener focus, and footer progress.
2. Unmount the route while the viewer is open: existing body-style restoration and footer cleanup both complete.
3. On real routes, navigate homepage to photoshoot and back with browser history; check the restored position and footer state without resets.
4. Follow Selected work, Profile, and Back to top from both page types; each reaches its intended target.
5. Covers AE2. Check a sparse photoshoot, a long gallery, phone portrait, short landscape, and enlarged text with no clipped terminal content.

**Verification:** Chromium and WebKit component tests pass; live-route evidence establishes history/anchor behavior and records reference-comparison screenshots at entry, midpoint, and completed reveal.

---

## Verification Contract

Run checks during implementation, not during planning.

| Check | Command or method | Required evidence |
| --- | --- | --- |
| Types | `pnpm typecheck` | Shared props and lifecycle code typecheck |
| Server rendering | `pnpm test` | U1 content cases and existing SSR media-delivery checks pass |
| Chromium behavior | `pnpm test:browser` | U1–U3 browser scenarios pass |
| WebKit behavior | `pnpm test:browser:webkit` | Motion, focus, and viewer restoration hold |
| Production integration | `pnpm build` and the repository's `pnpm start` flow | Both real route types render without hydration errors |
| Visual and navigation review | Real browser at 390×844, 844×390, 1366×768, and a wide desktop | Reference composition and R5/R6 states, real history/anchors, reduced motion, and enlarged-text reachability |

Use fixture browser tests for reproducible geometry and the existing viewer, not arbitrary sleeps or network-dependent photographs.
Capture screenshots for visual review rather than adding brittle pixel snapshots as the sole proof of motion.
No `release:validate` script exists in this repository; no behavioral-skill evaluation is applicable to this frontend-only change.

---

## Definition of Done

- U1's composition and content checks, U2's motion/lifecycle checks, and U3's real-route/viewer checks satisfy their cited requirements.
- The footer matches the reference's hierarchy and recorded reveal values while remaining recognizably Carla's portfolio.
- The Verification Contract passes, with actual-route evidence supplementing component tests.
- Existing media delivery, readiness, native scroll restoration, and viewer focus behavior remain intact.
- Remove superseded footer CSS and abandoned experimental code; leave unrelated user work untouched.
