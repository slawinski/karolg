---
title: Nested CG Crescent Favicon - Plan
type: feat
date: 2026-10-18
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Nested CG Crescent Favicon - Plan

## Goal Capsule

- **Objective:** Visitors can recognize Carla Gorecka's initials in the portfolio's browser-tab icon, including at 16px.
- **Means:** Nested-crescent direction B (D1), refined through visual inspection (KTD1).
- **Authority:** Requirements own the visual outcome; Key Decisions preserve the user's choices; technical decisions and units implement those requirements.
- **Execution profile:** Small asset refinement with manual visual and served-page verification. This document authorizes no implementation by itself.
- **Stop conditions:** Report evidence that the settled direction cannot meet R1–R3 rather than substituting another concept.
- **Ownership:** The subsequent implementer completes the units and records verification evidence. Shipping requires separate authorization; this planning run ends with the reviewed document.

## Product Contract

### Summary

Replace the public favicon with a nested CG crescent symbol and confirm its small-size appearance and browser integration.

### Problem Frame

The portfolio identifies Carla Gorecka, but its current favicon shows a K inside a circle. That mark does not represent her initials.

### Requirements

**Visual identity**

- R1. Replace the K with artsy nested CG crescents: an outer C cradles a smaller G, with both initials distinguishable rather than compressed side by side.
- R2. The outer C replaces the old enclosing circle; retain ink `#10100f` and off-white `#f5f4f0`.
- R3. Refine the mark to remain legible at 16px and inspect it at 24px and 32px, against both light and dark browser chrome.

**Accessibility and delivery**

- R4. Give the SVG the accessible label `Carla Gorecka`.
- R5. Serve the replacement at `/favicon.svg` and verify the public page's rendered icon metadata and browser-tab identity resolve to the new mark.
- R6. Preserve the unrelated untracked `.vitest-attachments/` and `src/components/__screenshots__/` contents.

### Key Decisions

- D1. **Nested crescents B** (session-settled: user-directed — chosen over shared-gesture A, seal C, and orbit D: a compact symbol keeps both initials distinguishable without squishing letters side by side). Governs R1, R2.

### Scope Boundaries

This work changes the favicon, not the portfolio's wider identity or page design. Alternative concepts A, C, and D are closed by D1.
Do not introduce an icon-generation pipeline, additional formats, or theme-specific assets: the brief requests a single SVG, and the existing asset already carries an off-white tile. Reconsider only if the requested browser inspection demonstrates a delivery or visibility problem that cannot be solved within the approved mark.

## Planning Contract

### Key Technical Decisions

- KTD1. **Refine the SVG in place.** Keep the self-contained `64 × 64` viewBox and off-white background pattern in `public/favicon.svg`; adjust the two curves' geometry, weights, and spacing within R1–R3 rather than introducing a font or image dependency.
- KTD2. **Use the existing metadata route.** `src/app/(frontend)/layout.tsx` already declares `/favicon.svg` as its icon. Verify that integration under R5; a layout edit is needed only if inspection finds an actual mismatch.
- KTD3. **Use visual proof for this asset.** Automated assertions that mirror path data or element counts would not prove recognition at favicon size. Inspect the rendered asset and real tab integration instead.

### Assumptions

- **Unvalidated agent bet:** The existing opaque off-white tile remains appropriate in both chrome themes. Verify this under R3 before completion.
- **Unvalidated agent bet:** A usable local public page can be served using the existing development setup. If environment prerequisites prevent the runtime checks, report the gap rather than treating source inspection as equivalent proof.

### Deferred Implementation Details

Exact curve control points, stroke weight, terminal treatment, spacing, and optical centering are execution refinements, not product blockers. The supplied B sketch is a starting point rather than final geometry.
The sketch's outer curve runs from approximately `(48,12)` around a left edge at `x=8` to `(48,52)`; the inner curve starts near `(48,23)`, wraps around `x=24`, and ends with a right-side inward bar around `y=33`. Both rough strokes are 5 units wide in the 64-unit viewBox.

### Sources and Research

- `public/favicon.svg`: existing square tile, palette, SVG image role, and K/circle construction.
- `src/app/(frontend)/layout.tsx`: public icon declaration and Carla Gorecka title metadata.
- `package.json`: existing `dev` script and package-manager declaration; no new dependency is needed.
- User-provided chat brief: authoritative visual direction and provenance. The external temporary sketch `001-marks.html`, option B, was read; the geometry summary above keeps the plan usable without that temporary file.

No conflict with D1 or the approved small-size refinement was found in the inspected sources. Final legibility remains an execution-time visual judgment.

## Implementation Units

### U1. Refine the nested CG asset and accessible name

**Goal:** Produce the approved mark in the existing favicon asset.

**Requirements:** R1, R2, R3, R4, R6; D1.

**Dependencies:** None.

**Files:** Modify `public/favicon.svg`.

**Approach:**
1. Replace the current K and separate circle with the two nested curves, using the supplied B geometry as the starting point under KTD1.
2. Update the image's accessible name under R4.
3. Refine optical spacing and curve weight against the size/theme matrix in the Verification Contract, keeping D1 intact.

**Patterns to follow:** Existing SVG namespace, image role, square viewBox, and flat background in `public/favicon.svg`.

**Execution note:** Seek proof from actual-size rendering before judging a large preview; the smallest sample is the deciding case.

**Test expectation:** none — this is an asset/styling change; per KTD3, add no test file that duplicates the SVG implementation.

**Verification:** Complete visual scenarios V1 and V2 and accessible-name scenario V3 below.

### U2. Verify the served favicon and public tab integration

**Goal:** Establish that visitors receive the refined asset through the existing page metadata.

**Requirements:** R3, R5, R6.

**Dependencies:** U1.

**Files:** Inspect `public/favicon.svg` and `src/app/(frontend)/layout.tsx`; modify the layout only if a verified icon-integration mismatch requires it under KTD2.

**Approach:** Inspect the served asset response, rendered public-page icon links, and actual browser tab. Refresh with a fresh page or browser context when the favicon cache still shows the K.

**Patterns to follow:** Existing public layout icon and title metadata; keep any necessary correction limited to the icon declaration.

**Test expectation:** none — this is manual runtime integration verification, not new application behavior.

**Verification:** Complete V4 and V5 below and record what was observed; a failed runtime prerequisite remains an explicit verification gap.

## Verification Contract

Use the existing local development setup (`pnpm dev`, from `package.json`) during implementation, not during this planning run. No new automated asset test is required. Existing Vitest suites do not establish visual legibility and need not run for an SVG-only change.

| Scenario | Action | Passing evidence |
|---|---|---|
| V1 — actual-size matrix | Render the final served SVG at 16, 24, and 32 CSS pixels at native scale against light and dark chrome-like surrounds. | All six combinations preserve the outer C, the smaller G, and the inward G bar without merging the curves or clipping their strokes; 16px satisfies R3. |
| V2 — approved direction | Compare the final silhouette with direction B and inspect the asset's palette. | R1–R2 hold; no residual K or separate enclosing circle is visible. |
| V3 — accessible name | Inspect the final SVG image semantics. | The image role has accessible name `Carla Gorecka`, satisfying R4. |
| V4 — served resource and head | Load `/favicon.svg` directly and inspect the rendered head of a public page. | The SVG request succeeds with SVG content, contains the replacement rather than cached K data, and the icon link resolves to that resource; existing Carla Gorecka title metadata remains consistent. |
| V5 — real tab | Open the public page in a fresh browser context and inspect the tab in actual light and dark browser chrome. | The new icon appears in both themes and is identifiable at tab size. Page color-scheme emulation or a preview strip alone is not proof of browser-chrome appearance. |

Capture a compact size/theme comparison and record browser, pixel density, and actual-chrome observations with the implementation handoff. Keep temporary inspection material outside the production diff and preserve R6.

## Definition of Done

- U1 meets R1–R4 through V1–V3, with no unresolved visual defect at 16px.
- U2 meets R5 through V4–V5; any environment limitation or unavailable actual-chrome check is disclosed rather than marked passed.
- R6 holds, and the final implementation diff contains only the favicon and any evidence-justified icon metadata correction.
- Abandoned geometry variants and temporary preview code are removed from the implementation diff.
