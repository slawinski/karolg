# Photoshoot candidate verification

## U1 — unchanged layout characterization

Baseline: `1e844dc`, public `/work/A`, title `A`, nine stills retained in
`src/test/fixtures/photoshoot-candidates.ts` before any build. No CMS writes.
The retained filename sequence and `/api/media/file/` URLs are the public content
fingerprint; intrinsic dimensions are not required for fixed-ratio figure geometry.

Chromium 155, Playwright 1.64, local production baseline port 3102:

| Width | Column starts (zero-based slots) | First top | Card width |
| --- | --- | --- | --- |
| 390 | 0, 4 | 212.234 | 191 |
| 700 | 0, 4 | 278.156 | 346 |
| 701 | 0, 4 | 230.797 | 324.875 |
| 900 | 0, 4 | 245.234 | 418.063 |
| 1100 | 0, 4 | 263.953 | 510.953 |
| 1101 | 0, 3, 6 | 264.141 | 335.453 |
| 1440 | 0, 3, 6 | 333.172 | 438.719 |
| 1920 | 0, 3, 6 | 382.875 | 593.328 |

At 390×844, slot 5 is `(199,376.031,191,318.328)` versus slot 0
`(0,212.234,191,254.656)`. This reproduces the larger later-card relationship.
The previous supplied observation was y=377.039: the installed Chrome 155 adds
3 CSS px of inline baseline descent after each inline-block figure instead of
the earlier engine's approximately 4. The model must include this contribution
in addition to the CSS bottom margin. Browser rounding is approximately 1/64px.
Margins are retained within columns; each new column starts at gallery top.
Contiguous minimum-maximum partitions match these observed starts (not masonry).

The characterization tests use the production stylesheet and figure/header/head
composition with controlled absolute-fill media; they do not claim Next Image
delivery evidence. They exercise 0/1/2/6/7/14 slots, leading and boundary videos,
wrapping and below-viewport titles, all matrix widths and breakpoint boundaries.

WebKit local limitation: the targeted run timed out after 30 seconds without
executing tests. The caller's prior runtime diagnosis is a bundled native mac14
protocol mismatch (`Unknown setting: PushAPIEnabled`), not an application failure.
No cross-engine layout/LCP parity is claimed. A compatible WebKit CI run remains
required for complete verification; no unbounded runtime-install attempts made.

## U2 — geometry-derived SSR selection

Before implementation, the strengthened actual Next Image SSR test failed because
index 5 was `loading="lazy"` with no high priority. The new helper test initially
failed on its absent module. After integration, `pnpm test` passes 122 tests in
22 files, `pnpm typecheck` passes, and `pnpm test:browser` passes 47 tests in
3 files, including unchanged homepage lifecycle coverage.

The helper uses contiguous minimum-maximum balancing, full-slot ratios including
videos/placeholders, clipped visible area, and marginal normalized-area coverage
over the plan's width/height/title-line envelope. Source URL identities are
deduplicated before allocating the global four-slot budget. No filename, slug,
or fixed-index selection exceptions exist. The route computes one set, and
`Visual`, stylesheet, sizes, map order, and manual video delivery are unchanged.

Tests replace the obsolete first-still-only policy assertion with the retained
regression's urgent SSR/preload union. The short video-plus-two-stills fixture
still selects just its dominant first still: selecting the later smaller still
would add zero coverage, so unused budget is deliberately not filled.

Browser coverage tests compare the selected set with independently measured
clipped rectangles across all six required viewports, 1/2/6/7/9/14-slot galleries,
leading/interleaved videos, and short/wrapping/below-viewport titles. They pass
without relaxing the four-identity budget. Production LCP is a separate U3 gate.
