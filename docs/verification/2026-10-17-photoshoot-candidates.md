# Photoshoot candidate verification

## U1 — unchanged layout characterization

Baseline: `1e844dc`, public `/work/A`, title `A`, nine stills retained in
`src/test/fixtures/photoshoot-candidates.ts` before any build. No CMS writes.
The retained filename sequence and `/api/media/file/` URLs are the public content
fingerprint; intrinsic dimensions are not required for fixed-ratio figure geometry.

Chromium 156 (Playwright's bundled 156.0.8078.4), Playwright 1.64,
local production baseline port 3102:

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
The previous supplied observation was y=377.039: the installed Chromium 156 adds
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

## U3 — production navigation evidence

**Result: Chromium production coverage passes; full verification remains blocked
by WebKit runtime availability and the pre-existing static-export build failure.**
This is not a completion claim for all of issue #29.

Authoritative final build: `pnpm build` (Next 16.4.0, React 19.2.6), then a newly
started production server on **3108**. Earlier servers were not used as final
evidence. Only this run's servers on 3107/3108 were stopped; pre-existing servers
were left alone. Public CMS resources were read, never edited.

Reproduction:

```sh
pnpm build
pnpm start --port 3108
pnpm exec tsx scripts/verify-photoshoot-candidates.mjs \
  http://localhost:3108 /tmp/photoshoot-raw.json \
  docs/verification/2026-10-17-photoshoot-candidates-results.json
```

The committed JSON records **every one of 157 final navigation rows**, including
viewport/DPR, selected identities, measured largest stills, actual LCP entries,
CDP urgent-request URLs/initial priorities/initiators, mutations, gallery shifts,
and whether the document was the real hydrated route or a controlled SSR fixture.
Its document SHA-256 fingerprints the final public production response. The full
local raw receipt (all rectangles, observer entries, resource timings, hints and
requests) is retained at
`/var/folders/zl/fkgnlthd363175f4ffymzcjh0000gn/T/opencode/photoshoot-production-final.json`.

### Real `/work/A` matrix

All six rows also passed a separate fresh JavaScript-disabled context, plus a
cached reload of the hydrated route. SSR and hydrated urgency are the same three
identities: `IMG_3814.JPG` (0), `IMG_3834.JPG` (3), `IMG_3912.JPG` (5).
Every nonmember remains lazy/auto. The responsive hint/image/header/hydration
union is **3**, never a separate per-breakpoint allowance. No response Link or
CDP early hints added another identity. All urgent initial requests are parser
initiated at `High`; each identity makes exactly one responsive request on its
initial navigation, with no full-size fallback transfer.

| Viewport / DPR | Final image LCP | Optimizer width | Result |
| --- | --- | --- | --- |
| 390×844 / 2 | IMG_3912.JPG, index 5 | 384 | PASS |
| 390×600 / 2 | IMG_3814.JPG, index 0 | 384 | PASS |
| 390×1000 / 2 | IMG_3912.JPG, index 5 | 384 | PASS |
| 900×900 / 2 | IMG_3814.JPG, index 0 | 1080 | PASS |
| 1440×900 / 1 | IMG_3814.JPG, index 0 | 640 | PASS |
| 1920×1080 / 1 | IMG_3834.JPG, index 3 | 640 | PASS |

Exact reproduction: index 5's rectangle remains `(199,376.03125,191,318.328125)`;
its actual LCP is eager/high and uses `w=384&q=75`. The 191px source size is
unchanged. Other candidate widths follow Next's existing discrete width list
(for example 418.063px × DPR2 requires the next available candidate, 1080).
No loading/priority attribute mutations occurred. Before/after-load/hydration
rectangles match, and there are zero gallery-attributed layout-shift entries.
Native lazy requests can begin at Low and later become High automatically; those
browser promotions are not application-selected urgent identities.

### Controlled content matrix

Each cell below represents all six required viewport/DPR rows; the JSON preserves
their individual measured LCP/rectangle/request results. The four title inputs
are `A`, `Editorial Portraits`, `Editorial Portraits in Natural Light`, and sixty
space-separated `Portraits` words (gallery below viewport). Their actual wrapping
is browser-derived, not forced to the model's sampled line counts.

| Gallery | Title 1 | Title 19 chars | Title 36 chars | Title 599 chars | Urgent identities |
| --- | --- | --- | --- | --- | --- |
| 1 still | 6 PASS | 6 PASS | 6 PASS | 6 PASS | 1 |
| 2 stills | 6 PASS | 6 PASS | 6 PASS | 6 PASS | 1 |
| 6 stills | 6 PASS | 6 PASS | 6 PASS | 6 PASS | 3 |
| 7 stills | 6 PASS | 6 PASS | 6 PASS | 6 PASS | 3 |
| 14 stills | 6 PASS | 6 PASS | 6 PASS | 6 PASS | 2 |
| 14 slots, videos at 0 and 5 | 6 PASS | 6 PASS | 6 PASS | 6 PASS | 3 stills |

Controlled documents use the **installed Next Image and React server renderer**,
the final production stylesheet/header/head, and public image resources with
distinct presentation query URLs. Ready video playback/poster resources come
from the read-only public media API (observed video 62). Controls, playsInline,
poster, paused/manual behavior, no autoplay and metadata preload pass. Video
posters sometimes become page LCP; those are reported as video, not still LCP.
Longer titles sometimes become H1 LCP; below-viewport cases correctly nominate
no visible-still winner. Whenever a still is the actual LCP, it belongs to the
selected set; the independently measured largest visible still is also covered.

These controlled documents are **SSR-only fixtures**, not arbitrary CMS content
hydrated by the real route. Real route hydration/JS-disabled comparison is proved
on the retained content at all six viewports; helper/page tests additionally prove
stable membership for repeated input. No production-only test route or CMS
fixture mutation was introduced.

### Static export and verification limitations

The additional unoptimized Next Image SSR navigation passes at 390×844 DPR2:
same three identities, actual image LCP `IMG_3912.JPG`, direct source request,
no optimizer dependency and no duplicate transfer. This is a rendering smoke
check, **not a successful static-export build**.

The existing `pnpm build:drop` path was also attempted. The canonical checkout's
first attempt hit `ENOTEMPTY .next/dev` while a pre-existing development process
was active. Rather than kill someone else's server, verification moved to an
isolated local clone at
`/var/folders/zl/fkgnlthd363175f4ffymzcjh0000gn/T/opencode/photoshoot-static-smoke`,
at committed implementation `0f28077`, using an SQLite read-only `.backup` copy
and the original public media directory. An initial symlinked dependency tree
was rejected by Turbopack's filesystem root boundary; a normal offline frozen
install resolved that harness issue. The actual build then compiled/typechecked
but failed collecting `/work/[slug]`:

> `"dynamicParams: true" cannot be used with "output: export"`.

That route setting existed at baseline `1e844dc` and is not changed by this work.
Changing fallback routing to fix the broader export path is outside the loading
policy plan; caller action is required. No original CMS database was mutated.
The isolated copy and error evidence are retained. The canonical normal production
build was rebuilt successfully afterward and final verification used fresh port
3108, so the failed export did not invalidate the final production evidence.

WebKit: local targeted `pnpm test:browser:webkit
src/components/PhotoshootGallery.browser.test.tsx` did not execute tests before
the 30-second bound. Full WebKit suite/geometry parity remains a compatible-runtime
CI obligation; the previously diagnosed mac14 protocol mismatch is not classified
as an application bug. Chromium is **156.0.8078.4**, not the separately installed
agent-browser Chrome 155 runtime. No equivalent WebKit LCP telemetry is claimed.

Final repository checks: `pnpm test` **122/122**, `pnpm typecheck` **PASS**,
`pnpm test:browser` **47/47**, `pnpm build` **PASS**. Generated-only
`next-env.d.ts` changes were restored. No settled decision was invalidated: the
four-cap was never exceeded and no required Chromium candidate case was missed.

Early verifier failures were confined to the controlled harness: DCL could run
before its stylesheet loaded after removing Next's deferred scripts. A parser
stylesheet barrier corrected the initial sample; no app layout change or selector
tuning was made to hide it. The final 157-row run has **zero failures**. This
does not waive the two verification blockers above.
