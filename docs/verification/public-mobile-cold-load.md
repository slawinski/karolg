# Public mobile cold-load verification

Plan: `docs/plans/2026-10-18-0032-fix-public-mobile-cold-load-plan.md`.
Baseline source: `6944671`. Native host owns checks and commits; no production CMS writes.

## U1 — baseline

An isolated copy at `/var/folders/zl/fkgnlthd363175f4ffymzcjh0000gn/T/opencode/public-cold-load`
uses a SQLite backup and copied media, disabled job autorun, port 3110. User servers
and `.env` were not modified. Node 24.8.0, pnpm 10.34.6, Next 16.4.0,
React 19.2.6, Payload 3.90.2; successful production Turbopack build.

`scripts/measure-public-cold-load.mjs` uses Chromium 156.0.8078.4,
390×844 DPR2, 4× CPU, 150ms latency, 1.6Mbps download / 750Kbps upload.
This is a separate observed trace experiment, **not** Moto G Power simulated
Lighthouse or its TBT/Speed Index. Long-task blocking is not Lighthouse TBT.
Three cold-browser and three same-context warm repeats per route; optimizer
cache was not purged. Opening identities and complete resource/navigation
entries are retained in the raw JSON.

The copied database has 60 legacy images (482,464,112 original bytes) with
revision zero. Initial real-data trials did not finish critical images inside
12 seconds and subsequent navigation encountered ERR_ABORTED/NETWORK_CHANGED;
those are unsuccessful measurement attempts, not fast LCP evidence.
For matched controlled measurements only, image revisions in the **copied**
database were set to 1, enabling the existing quality-75 optimizer policy.
Real data stays unchanged. No photography quality setting was changed.

Raw evidence (temporary, not committed large artifacts):
`/var/folders/zl/fkgnlthd363175f4ffymzcjh0000gn/T/opencode/cold-load-before.json`
and `cold-load-before-controlled.json`. The latter contains all 30 completed samples.

| Route | Cold LCP median (range), ms | Cold blocking range, ms | CLS |
|---|---:|---:|---:|
| `/` randomized | 748 (720–10884) | 28–59 | 0–0.01123 cold; warm up to 0.03075 |
| `/work/A` | 712 (712–716) | 30–31 | 0 |
| `/work/B` | 732 (724–732) | 27–32 | 0 |
| `/work/c` | 724 (708–748) | 29–32 | 0 |
| `/work/d` video-first | 2500 (2496–2512) | 29–30 | 0 |

Homepage variability and nonzero shifts require investigation, not averaging
away. The project classes in this database are three still galleries and a
two-video gallery; there is no long-title/empty real page.

### Attribution

- Documents return 200; warm local request TTFB was about 22ms independently.
  Resource JSON separates DNS/connect/TLS, redirect, request/response and download.
  The reported 9560ms audit estimate is not a measured TTFB here.
- Baseline video sources acquire inside a 200%-margin band before critical
  images finish. Pausing playback alone does not prevent acquisition.
- Legacy originals dominate transfer in real-data attempts. Revision-less
  optimization bypass is an existing freshness contract, not changed for scores.
- **Reproduced delivery defect:** `/robots.txt` returns 404 on the isolated
  production build despite `robots.ts` existing. Build route table omits it.
  Independent requests and every measured run agree. U5 will inspect this.
- No evidence yet attributes the live timeout to a proxy, host, or leaked admin
  bundle. Public-origin causes remain unknown pending equivalent live evidence.

## U5 — attributed delivery correction

The installed Next metadata matcher anchors robots at app root; unlike sitemap,
it does not accept the route-group prefix. Installed `dist/docs/.../robots.md`
and Context7 both require root placement. Moving the unchanged static handler
to `src/app/robots.ts` makes the production route table include `/robots.txt`.
Before: 404. After: 200, expected allow/disallow/sitemap, TTFB 20.6ms,
total 21.2ms on first independent local request. No Payload dependency added.

Live read-only check on 2026-10-18: `https://carlagorecka.com/` returned 200;
DNS 5.2ms, connect 40.7ms, TLS 95.4ms, TTFB 272.4ms, total 367.0ms,
no redirect. Live `/robots.txt` also returned **404**, not a reproduced timeout:
DNS 1.8ms, connect 37.7ms, TLS 90.6ms, TTFB 138.4ms, total 139.0ms.
This validates the placement defect across environments but does not establish
the cause of the reported intermittent timeout. The local fix is not deployed.

No format/quality, persistent cache, hosting, dependency or speculative bundle
change was made. Baseline resources identify public framework/application chunks;
no measured evidence establishes an unnecessary public dependency. Legacy image
originals are expensive, but changing their mutable-cache contract is not allowed.

During U6, shift source attribution corrected the initial hypothesis: a measured
homepage shift at 11.53s came from a lower `gallery-static-image` moving upward
when the first-row swap committed a different aspect ratio. A regression test
failed with a frame changing from 114.19 to 360.88px high. Slot geometry is now
reserved from its opening media, retaining object-fit crops and the composition
instead of changing the rail topology speculatively.

## U6 — recovered verification and final refinements

The interrupted native run's implementation was retained, not reimplemented.
Its raw artifacts were inspected on resume. Earlier worker transcripts are not
available: historical characterization below comes from saved artifacts/source,
**not** an invented red-test observation. The geometry failure above is a receipt
already recorded by the earlier host. On resume, the hidden-mount readiness test
actually failed (`expected 'false' to be 'true'`, 3-second timeout): visibility
initialization cancelled the frame responsible for discovering critical images.
The scan now has its own frame handle; visibility still cancels the two final
paint-opportunity frames. The same regression then passed with the full suite.
Cached critical images also finish decoding before readiness, with decode failure
treated as settled. The minimum foreground delay remains 1500ms; no audit-specific
timing, retries, manual controls, quality changes or production data edits added.

### Repository gates

| Command | Final observed result |
|---|---|
| `pnpm typecheck` | Passed |
| `pnpm test` | 23 files, 164 tests passed (includes real SQLite/media processing compatibility tests) |
| `pnpm test:browser` | 5 files, 62 Chromium tests passed; initial resume run was 61 passed / 1 failed, then fixed |
| `pnpm test:browser:webkit src/components/PhotoshootVideo.browser.test.tsx src/components/PhotoshootGallery.browser.test.tsx src/components/HomepageMasonry.browser.test.tsx src/components/PublicMediaReadiness.browser.test.tsx` | Infrastructure failure: browser session connection timeout after 60 seconds; **no tests executed** |
| `pnpm build` | Passed in isolated production copy; dynamic home/project and static robots/sitemap present |
| `git diff --check` | Passed |

The build uses the canonical tracked `src` files copied byte-for-byte (87 files,
combined path/content SHA256 `d7529ed3fd920033d75c31b424f429633cdf7c3ffd3a6844da5ee572d10b304c`).
Building in the isolated copy avoids replacing `.next` under the user's running
3108 server. That server and the development server were not restarted. Only the
verified work-owned 3110 process was restarted. Build dependencies/config are
unchanged. The temporary query instrumentation used for freshness proof is not in
the final source/build. Test-generated failure screenshots are excluded, along
with all pre-existing `.vitest-attachments/` and `src/components/__screenshots__/`
artifacts; no cleanup or staging of those directories is part of this resume.

### Matched local-production results

`public-mobile-cold-load-results.json` contains extracted per-run metrics, opening
identities, checks, and SHA256 identities of the raw input artifacts. Raw full
reports, network logs, traces and screenshots remain under the temporary directory
named in U1, not in Git. They are required for reproducing the full diagnostics;
the committed JSON is a summary, not a substitute HAR or Lighthouse report.

Recovered observed Chromium experiment: three cold contexts and three paired warm
loads per route, warm server optimizer cache, protocol from U1. Values below are
LCP median (min–max), milliseconds. Every final sample's CLS is 0.

| Route/class | Before cold | After cold | Before warm | After warm |
|---|---:|---:|---:|---:|
| `/`, randomized selections | 748 (720–10884) | 748 (736–756) | 468 (376–528) | 444 (204–580) |
| `/work/A`, still | 712 (712–716) | 728 (716–728) | 200 (200–204) | 200 (200–212) |
| `/work/B`, still | 732 (724–732) | 728 (716–732) | 200 (196–204) | 212 (208–216) |
| `/work/c`, larger still gallery | 724 (708–748) | 716 (712–720) | 184 (184–216) | 200 (200–204) |
| `/work/d`, mixed/video-first | 2500 (2496–2512) | 716 (712–724) | 200 (196–200) | 212 (212–216) |

The mixed gallery's cold LCP decreased 71.4%. Completed resource bytes at the
same visual cutoff (both visible video posters ready, including the baseline's
native posters) fell from 409,256 to 82,492 (79.8%). Warm resource bytes at this
cutoff were already zero. Do **not** compare only eager-image bytes here: adding
critical video posters changes that set between revisions. These are completed
resource transfer sizes, not partially transferred in-flight bytes or total
session traffic. Rich media is still downloaded and played later.

Homepage decoded document median fell from 101,146 to 75,964 bytes (24.9%);
opening media remain random and all eligible pool members are retained. Project
HTML increases slightly from the readiness/poster markup (mixed page 18,772 to
24,437 bytes); project queries no longer load unrelated portfolio data. The
home's initial LCP was already subsecond in most trace samples: the original
median did not improve, although the outlier range narrowed. No uniform speedup
across still-only pages is claimed.

Investigation of `/work/A`'s one-frame cold increase: repeat on the final
uninstrumented production build gave cold 716 (712–716), warm 196 (196–208),
blocking 30ms cold / 0 warm, CLS 0. Thus the 16ms increase was not sustained.
A fresh randomized homepage repeat gave cold 716 (700–732), warm 208 (204–460),
blocking 28–30ms cold / 0 warm, CLS 0. These are separate final rechecks, not a
replacement for the original comparison. The corrected measurement script saves
opening identities before swaps. Older homepage `criticalEnd`/playback-before-
critical fields sampled eager nodes after a swap and can refer to incoming media:
they do **not** prove an acquisition violation or quantify initial-byte savings.
Use the readiness-tagged acquisition and delayed-poster network checks below.

`/work/B` was also rechecked rather than averaging away its 12ms warm difference:
cold 736 (732–740), warm 204 (200–208), blocking 29–32ms cold / 0 warm, CLS 0.
The warm median returns to the baseline range; the cold median is 4ms above the
baseline's maximum, versus 4ms below in the original after run. This is a
single-frame-scale variation, not evidence of a uniform regression or gain.
Still-only cold LCP is already about 0.7 seconds, and warm LCP about 0.2 seconds;
scoped-query reduction and acquisition priority, not manufactured millisecond
gains, are the relevant proof at that floor. Three runs are not a statistical
guarantee against future regressions.

Observed long-task blocking (not Lighthouse TBT) was 28–59ms cold home before,
28–30ms after; still galleries changed by single-digit milliseconds (before
27–32, after 26–36). Mixed gallery was 29–30 before, 34 after. This small extra
client boundary cost is disclosed, not described as a TBT improvement.

### Lighthouse, separately from observed traces

Recovered full `cold-lh-{before,after}-{home,video}-{1,2,3}.json` and matching
`-0.trace.json`/`-0.devtoolslog.json` files contain Lighthouse 13.4.1 / Chrome 155,
mobile simulated throttling, 412×823 DPR1.75, 4× CPU, 150ms RTT and 1638.4Kbps
throughput. These are local controlled-data runs, not the user's live Moto G Power
capture. Earlier `canary-cold-lh-*` attempts are preserved separately and are not
mixed into this comparison. All twelve selected reports have complete performance
metrics; there is no recorded runtime error in the extracted reports.

| Metric, median (range) | Home before | Home after | Video before | Video after |
|---|---:|---:|---:|---:|
| Performance score | 96 (87–98) | 96 (96–96) | 91 (91–92) | 98 (98–98) |
| LCP, ms | 2718 (2418–3118) | 2789 (2785–2792) | 3460 (3386–3461) | 2411 (2409–2412) |
| TBT, ms | 18.5 (17–326.5) | 16.5 (15.5–17) | 31 (30–32) | 15.5 (14.5–16) |
| FCP, ms | 909 (906–915) | 906 (904–908) | 911 (910–911) | 905 (905–905) |
| Speed Index, ms | 909 (906–1283) | 906 (904–908) | 911 (910–911) | 905 (905–905) |
| CLS | 0 | 0 | 0 | 0 |

The home LCP increase is inside its baseline selection range; this is not proof
of improved homepage Lighthouse LCP. Score ≥90 and TBT ≤200ms are attained in
these final local samples; LCP ≤2500ms is attained for video, **not home**.
Robots passes after the root move. These results do not establish live scores,
CrUX behavior, a hosting cause, or resolution of an intermittent live timeout.

### Motion, visual, navigation and freshness evidence

- Recovered `public-motion-chromium-final.json`: DPR2 at widths 390, 700, 900,
  1440 and 1920. Project videos actually advance playback, muted/inline with no
  controls; source attachment occurs only with readiness true at 1607–1611ms.
  Offscreen media remains unacquired at the widest tier. Figure rectangles are
  identical before poster load/play and afterwards; no raw poster duplicates.
  Reduced motion pauses playing videos. Five screenshot pairs are preserved;
  mobile project and desktop homepage photographs were also inspected on resume.
- Homepage observation lasts 35 seconds per tier: 6/6/6/12/12 animation-end
  events (multiple swap cycles), CLS 0 at all five widths, then real silent
  autoplay after programmatic scroll. This is not audit-window-only silence.
- `public-navigation.json`, independently repeated on the final production build
  as `public-navigation-resumed.json`: every sitemap route (`/`, `/work/A`,
  `/work/B`, `/work/c`, `/work/d`) returns 200 with content. A deliberately delayed
  optimized critical poster blocks **source acquisition** beyond the minimum
  delay; autoplay follows readiness. Actual Next Link navigation resets readiness
  and sources. Reduced-motion entry has no acquired source or manual controls.
- Browser lifecycle tests cover offscreen/hidden/reduced transitions, late play
  resolution, expected cancellation versus rejected-autoplay fallback, media error,
  source-revision cleanup, route reset, swap deadlines and breakpoint cancellation.
- Recovered `public-freshness.json` and `public-cold-load/verify-freshness.ts`:
  copied-database settings/project edits appear in content/metadata on the next
  production request. Temporary query logging records four queries for four
  requests, rather than metadata/page duplicates. Actual FFmpeg replacement
  processing retains published revision 1 while pending, then publishes revision
  2; the next response uses its poster and playback identities. No TTL awaited.
  Existing media-replacement integration tests cover retained derivatives on
  failure. No live database was edited and legacy revision-zero behavior stays.
- `public-empty-gallery.json` records a temporary long-title, empty-gallery
  fixture returning a usable 200 shell, subsequently removed from the copied DB.
- Direct WebKit 27.2 production probe failed before opening a page:
  `Protocol error (Page.overrideSetting): Unknown setting: PushAPIEnabled`.
  The focused Vitest retry on resume also failed at session startup (above).
  WebKit autoplay/visual compatibility is **unverified**, not a poster fallback
  pass. Next check: run with a functioning matching Playwright WebKit installation
  or real mobile Safari; no dependency upgrade was made as a workaround.
- The isolated server logs contain `ERR_INVALID_STATE: Controller is already
  closed` during browser navigation/cancellation. All enumerated responses and
  assertions completed; no source attribution establishes a cause. This is
  retained diagnostic evidence, not grounds for speculative delivery changes.

### Unit evidence and requirement coverage

| Unit | Evidence strategy / final proof |
|---|---|
| U1 | Non-behavioral measurement; deliberate no-unit-test exception. Saved baseline resources/doc phases and independent robots requests are the characterization. |
| U2 | Inspected/extended portfolio, homepage and public-rendering tests; revision/media-replacement compatibility tests retained. Baseline source and decoded HTML characterize redundant work; historical test-first ordering is unavailable. Scoped-read assertions, paginated member/attribution/revision checks, and copied-DB production freshness/query receipts pass. |
| U3 | Inspected/extended homepage/readiness browser tests. Saved baseline shows early playback acquisition; historical red order is unavailable. Pending/error/cached/decoded image, route-reset, visibility/reduced, cleanup, delayed-source, preparation and multiple-cycle checks pass. Hidden-mount failure was witnessed red and fixed on resume. |
| U4 | Inspected/changed Visual, candidate, gallery and video tests replacing old manual-control expectations. Historical red order unavailable; baseline source has controls. Actual silent delayed playback, optimized responsive poster priority, four-identity budget, rejection/cancellation/error fallback and stable geometry are covered. |
| U5 | Baseline 404 is saved before-characterization; unchanged robots handler moved to supported root, robots tests pass and production responds 200. No speculative optimizer/bundle fix. |
| U6 | Integrated regression evidence above, fresh repository gates and uninstrumented production navigation/rechecks; no final simplify/review/PR/CI performed. WebKit exception and live-deployment checkpoint remain explicit. |

R1/R8: every current page, controlled cold/warm classes and responsive motion;
R2: reserved opening-slot geometry, stable project figures and zero final CLS;
R3/AE3: request-local query reuse plus actual copied-DB publication proof;
R4–R6/AE1–AE2: image/decode/foreground readiness gates acquisition, no controls,
actual delayed autoplay, cancellation/fallback/cleanup tests; R7: document phases,
404→200 robots correction and bounded live uncertainty. AE4: responsive reserved
frames and full-cycle zero-shift observations. External exceptions are WebKit
execution and post-deployment/live performance, not missing implementation units.

## Review fixes — findings #2 and #1 (2026-10-18)

Source: temporary `ce-code-review/performance-final/review.json`. These are
localized follow-up fixes, not changes to the plan's media behavior or budgets.

- **#2, incoming visibility:** `HomepageVideo` now omits inline opacity while
  preparing. The existing incoming-layer CSS and `gallery-in` animation own the
  reveal; normal active/outgoing playback still uses inline opacity 0/1.
  Extended the existing connected-candidate/stagger browser proof before editing
  production code. Chromium failed at the new preparation assertion with
  **expected `0`, received `1`**. After the fix, computed opacity is 0 before
  readiness, while a ready peer waits for the last candidate, and through 239ms
  of the queued stagger. At the 240ms launch, the real CSS animation exists;
  seeking its clock verifies opacity 0 at 750ms, positive at 1125ms and 1 at
  1500ms. Seeking is intentional: fake JS timers do not advance CSS animation
  time. Existing identity, stagger, commit and cleanup assertions remain intact.
  The active-video lifecycle proof also checks computed opacity 1 during play
  and 0 after moving offscreen.
- **#1, verifier target:** sitemap discovery must return 200 and a nonempty URL
  list with valid HTTP(S) locations. Each location's pathname and search are
  assigned to the requested BASE; query `&amp;` is decoded. Reports now record
  the exact requested URL and status, including a failing route before asserting.
  Added `scripts/verify-public-navigation.test.ts`, invoking the actual CLI
  against an ephemeral loopback server. Its sitemap advertises a different
  canonical origin, `/work/ok?revision=2&amp;view=full`, and `/work/broken`.
  Before the fix the target received only `/sitemap.xml`, failing the expected
  project-request assertion; empty discovery also incorrectly entered browser
  navigation and timed out. After the fix the server receives both target
  project paths, including the decoded search, records the exact target URLs
  with statuses 200 and 500, and the CLI fails specifically on the broken target
  route. Three additional cases reject a 500 sitemap, empty list and invalid URL.
- **Optional review coverage:** added deterministic browser cases for 500ms
  visible + 5000ms hidden + the remaining 1000ms visible readiness budget,
  including actual source acquisition and autoplay after publication. Added
  separate deferred play promises across hide/resume and source replacement:
  the newer promise settles first, the obsolete one last, without pausing the
  current owner or restoring its poster. Both pass without production hook or
  readiness changes.

Final local checks on this follow-up tree:

```text
pnpm test
  24 files / 168 tests passed (includes all 4 CLI fixture cases)
pnpm typecheck
  passed
pnpm test:browser src/components/HomepageMasonry.browser.test.tsx \
  src/components/PhotoshootVideo.browser.test.tsx \
  src/components/PublicMediaReadiness.browser.test.tsx \
  --browser.screenshotDirectory=/var/folders/zl/fkgnlthd363175f4ffymzcjh0000gn/T/opencode \
  --attachmentsDir=/var/folders/zl/fkgnlthd363175f4ffymzcjh0000gn/T/opencode
  Chromium: 3 files / 56 tests passed
git diff --check
  passed
```

The earlier production navigation receipts did not record checked origins and
must not be treated as all-route proof for BASE. This follow-up proves the
verifier correction with controlled servers; it does **not** claim a fresh
full production-navigation run. Port 3110's prior production copy was not
synced/rebuilt or used as evidence for this fix. The existing full-build receipt
above remains prior evidence; no new build was needed for the one-line opacity
binding and standalone verifier changes after Chromium/type verification.
WebKit and live-deployment limitations above remain unchanged.

No commits, pushes, real CMS or `.env` edits, or port-3108 operations were made.
The pre-existing `src/lib/homepage.ts` simplification is preserved. Excluded
artifact directories remain uncommitted: the first deliberate red browser run
emitted a failure screenshot despite `--browser.screenshotFailures=false`;
subsequent runs redirected artifact paths outside the checkout. No artifact
cleanup or edits to pre-existing user artifacts were attempted.
