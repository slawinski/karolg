# Homepage first-row crop — U6 mobile cold-load verification

## Result

**PASS for the U6 measured layout-shift gate.** All three cold homepage loads
had CLS **0**, within the required **≤ 0.0112** budget. All three paired warm
loads also had CLS 0. Every sample has `shifts: []`: no recorded shift source
names a resizing `.image-frame` (or any other element).

Plan: `docs/plans/2026-10-18-2142-fix-homepage-first-row-crop-plan.md`, **U6 only**.
Measured source: HEAD `8c7baf8375f4d516f70c2292fb42c08f1c2bf243` plus the
existing uncommitted, behavior-preserving one-pass portrait/remainder partition
in `src/lib/homepage.ts`. That change was copied into the measured build.
Measurement began at `2026-10-18T20:36:51.090Z`.

## Isolation and production build

Fresh experiment root (all raw evidence below is relative to this directory):

```text
/var/folders/zl/fkgnlthd363175f4ffymzcjh0000gn/T/opencode/homepage-crop-u6-2ynd3mz_
```

- Site copy: `<root>/site`. Tracked files were copied from the current canonical
  working tree, including the dirty `homepage.ts`; no existing temporary site or
  process was reused or modified.
- SQLite was backed up using SQLite's backup API from a read-only source
  connection. Current `media/` files were copied, not linked to canonical media.
- A new copy-local `.env` uses an independently generated valid secret, absolute
  paths to the copied DB/media, `DISABLE_MEDIA_JOB_AUTORUN=1`, and local site URL
  `http://localhost:3120`. No canonical environment secrets were copied or printed.
- Dependencies were installed in the new copy using
  `pnpm install --offline --frozen-lockfile`.
- **`pnpm build` passed** in the copy: production Turbopack compilation,
  TypeScript, and static generation completed. The route table contains dynamic
  `/` and `/work/[slug]`, and static robots/sitemap. See `build.log`.
- Node **24.8.0**, pnpm **10.34.6**, Next **16.4.0**, React **19.2.6**,
  Payload **3.90.2**, Playwright **1.64.0**.
- All **87 tracked `src/` files** match canonical source byte-for-byte after
  build. Combined sorted relative-path/NUL/content SHA256:
  `520d2f87ed3a01e6264a9c6a1aa586a30b85c56d6bed73c4a7b366b969b320b9`.
  The build regenerated only the copy's tracked `next-env.d.ts`; no copied
  application source or measurement-script content changed.
- Post-measurement SHA256 comparison against `source-manifest.json` found **no
  changes** to canonical tracked files, canonical `.env`, existing SQLite DB and
  sidecar files, or media files. Source revisions remain 60 images at revision 0
  and two videos at revision 1. Canonical builds/tests were not run.

An initial setup attempt stopped at an already-created destination `media/`
directory in the newly allocated `homepage-crop-u6-ds6fs_a2` directory. That
incomplete artifact was left alone; the complete experiment used the fresh root
above and no measurements came from the incomplete copy.

## Matched measurement protocol

Followed `docs/verification/public-mobile-cold-load.md` and the existing,
**unmodified** `scripts/measure-public-cold-load.mjs`:

- Chromium **156.0.8078.4**, viewport **390×844**, **DPR 2**.
- CDP **4× CPU**, **150 ms latency**, **1,600,000 bits/s download** and
  **750,000 bits/s upload** (throughput supplied to CDP in bytes/s).
- Three new browser contexts, each with one cold navigation followed by a warm
  navigation in the same context/page. Both navigations request a randomized
  homepage composition; warm does not mean identical opening photographs.
- Each load is observed for **12 seconds after DOMContentLoaded**. No scrolling
  or user input is introduced. This is the existing observed-trace protocol,
  not Lighthouse simulated mobile performance or Lighthouse TBT.
- Warm server optimizer: before measurement, the isolated helper `site/warm-u6.mjs`
  requested all 60 image identities and two video poster identities at widths
  384 and 640, q75, with AVIF/WebP image acceptance. All **124** requests returned
  **200**; receipts are in `optimizer-warmup.json`. Optimizer cache was retained.
  Actual measured optimized resource entries use **384w, q75**.

### Controlled copied-data adjustment

To match the prior protocol's q75 path, **only the copied database** had the 60
image rows' `processing_revision` changed from 0 to 1. The two video rows were
already revision 1 and were unchanged. No other columns were edited by this
adjustment. `db-adjustment.json` preserves before/after counts. No photography,
quality configuration, optimizer policy, or source DB content was changed.

This is controlled revision-1 evidence. It does **not** measure the canonical
revision-zero original-image delivery path, whose expensive transfers and
unsuccessful attempts are documented in the older verification record.

Commands run from `<root>/site`:

```sh
pnpm install --offline --frozen-lockfile
python3 ../prepare-controlled.py
pnpm build > ../build.log 2>&1
nohup pnpm start --port 3120 > ../server.log 2>&1 &
node warm-u6.mjs
node scripts/measure-public-cold-load.mjs http://localhost:3120 ../homepage-cold-load.json /
```

## Exact observed results

Long-task blocking is the script's sum of `max(0, duration − 50 ms)` over observed
long tasks, **not Lighthouse TBT**. All durations below are milliseconds.

| Repeat | Cache | HTTP | LCP | FCP | Long-task blocking | CLS | Shift entries |
|---|---|---:|---:|---:|---:|---:|---:|
| 1 | Cold | 200 | 756 | 756 | 38 | 0 | 0 |
| 1 | Same-context warm | 200 | 200 | 200 | 0 | 0 | 0 |
| 2 | Cold | 200 | 712 | 712 | 29 | 0 | 0 |
| 2 | Same-context warm | 200 | 212 | 212 | 0 | 0 | 0 |
| 3 | Cold | 200 | 732 | 732 | 38 | 0 | 0 |
| 3 | Same-context warm | 200 | 456 | 200 | 0 | 0 | 0 |

- Cold LCP median **732**, range **712–756**; cold blocking median **38**,
  range **29–38**.
- Warm LCP median **212**, range **200–456**; warm blocking **0** in every run.
- Cold and warm CLS median/range **0**. There are no source rectangles to
  attribute because no layout-shift entries were observed.
- Every robots check returned **200**. No recorded resource entry has HTTP
  status ≥400. All six samples completed; no failed sample was dropped or
  substituted by a retry.

### Limitations and diagnostics

- Three randomized compositions at one mobile viewport are evidence for this
  protocol window, not proof for every pool, breakpoint, later rotation cycle,
  or media identity. Empty shift lists establish no observed frame-resize shift;
  they do not independently prove every swap occurred or that all crop/fit
  requirements pass. U1–U5 behavior gates are outside this run.
- The unchanged script captures eager `currentSrc || src` immediately after
  DOMContentLoaded. Warm repeat 1 captured one transient `3840w` fallback URL;
  warm repeat 3 captured two. The actual optimized resource records use `384w`.
  Warm repeat 3 therefore reports `criticalEnd: 0` despite completing its load.
  Do not use these opening-URL matches, `criticalEnd`, or
  `bytesBeforeCritical` as critical-image completion or byte-savings proof.
  LCP, CLS, and long tasks come from independent PerformanceObservers. Full
  captured identities and resource entries are retained without script repair.
- No fresh before-build comparison was performed. The older record's final
  zero-CLS samples and roughly subsecond LCP are context, not a matched claim of
  improvement from the crop change. No live-site, CrUX, Lighthouse, WebKit, or
  real-device/Safari result is claimed.
- `server.log` includes the no-email-adapter warning and
  `ERR_INVALID_STATE: Controller is already closed` (also documented in the
  prior protocol). The log lacks enough attribution to assign this exception
  to a particular measured request. All samples completed with document/robots
  200 and no resource HTTP errors; the listener remains alive. This exception
  is retained diagnostic evidence, not a clean-server-log claim.
- **Tests exception:** U6 is measurement-only, as its plan explicitly specifies.
  No new tests were written and no unit, browser-suite, or standalone typecheck
  command was run. The copy's production build did execute its TypeScript check.
  This receipt does not certify or rerun the broader plan's test gates.

## Raw evidence and running QA server

The production server is **left running** for host desktop/mobile browser QA:

- URL: **http://localhost:3120**
- Startup-advertised LAN URL: `http://192.168.0.11:3120` (external-device
  reachability has not been tested).
- Listener **PID 45707**, parent **45698**, `next-server (v16.4.0)`.
- Verified process working directory:
  `/private/var/folders/zl/fkgnlthd363175f4ffymzcjh0000gn/T/opencode/homepage-crop-u6-2ynd3mz_/site`.
- Startup ready in **130 ms**; log: `<root>/server.log`.

Raw JSON:

```text
/var/folders/zl/fkgnlthd363175f4ffymzcjh0000gn/T/opencode/homepage-crop-u6-2ynd3mz_/homepage-cold-load.json
```

Raw SHA256:
`6fe055ebd56d18062d45bcbebe398ee62d85f911708619dff58fdd6a7637d66d`.

Measurement script SHA256 (identical canonical/copied):
`913d23ee54abda4d287ad5673aedaab9ad696508a28c0eff7152bc190a923fc4`.

Additional temporary evidence: `summary.json`, `source-manifest.json`,
`db-adjustment.json`, `optimizer-warmup.json`, `build.log`, `server.log`, and the
copy-local preparation/warmup helpers. Raw files contain the browser version,
protocol, six samples, opening image identities, shifts, navigation timings,
video states, and complete resource timing entries. These are temporary
PerformanceObserver/resource reports, not saved DevTools trace or HAR files.

Only this new verification document is owned by this task in the canonical
repository. The older verification document, plan, production source, and
measurement script were left untouched. No commit was made.
