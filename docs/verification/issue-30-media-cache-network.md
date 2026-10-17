# Issue #30 — media identity and cache verification

## Result

**Runtime replacement/cache proof passes. Delivery acceptance is blocked by the
required static-drop build gate.** `pnpm build:drop` compiles and typechecks, then
fails collecting `/work/[slug]` because the existing `dynamicParams: true` is
incompatible with `output: export`. This gate has not been waived. WebKit work
from issue #29 was not used as a gate or represented as completed here.

Actual sanitized observations are in
[`issue-30-media-cache-network.json`](issue-30-media-cache-network.json).
Desktop and mobile captures show synthetic colored fixtures, not portfolio data:
[`desktop`](issue-30-media-cache-desktop.png),
[`mobile`](issue-30-media-cache-mobile.png).

## Isolation and source

- Original checkout: feature branch `fix/version-media-cache-identities`, forked
  from `6c6b5e4`; all preceding issue #29 commits preserved.
- Production build and network run: `90ac6b2bd263db532ba1f264457952509af58fd8`.
  Subsequent changes add coverage and documentation only.
- Runtime: Node 24.8.0, pnpm 10.34.6, Next 16.4.0, Payload 3.90.2,
  React 19.2.6, Sharp 0.35.5, Playwright 1.64.0, Chromium 156.0.8078.4.
- Isolated local clones under
  `/var/folders/zl/fkgnlthd363175f4ffymzcjh0000gn/T/opencode/`:
  `issue30-runtime` and `issue30-static`. Dependencies installed offline with the
  frozen lockfile, without symlinking the original dependency directory.
- Entire CMS DB and media tree were generated from scratch in
  `issue30-runtime/fixtures/`. The fixture DB uses production collections/hooks,
  with schema push enabled only during initial disposable schema creation.
  Runtime and workers use the unchanged production config with schema push off.
- Fixture IDs: image **1**, legacy image **2**, video **3**, photoshoot **1**,
  slug `cache-fixture`. A random temporary administrator was used for original
  access verification. Credentials/tokens/cookies are excluded from the receipt.
- Production server: `pnpm start --port 3110`, started and stopped by the harness.
  No pre-existing server was stopped. Original CMS DB and media were not used.

## Replacement sequence (2026-10-17, UTC)

The passing sequence starts at **17:15:27Z**. Browser caching stayed enabled in
one Chromium context throughout: no routing/interception, no cache clearing,
and `Network.setCacheDisabled({cacheDisabled:false})`. Fixture/cache resets
occurred only before this complete sequence, after failed harness experiments.

1. Create 1200×1600 red JPEG `portrait.jpg` on record 1, green legacy JPEG on
   record 2, and a valid one-second 320×480 H.264 video on record 3. Publish video
   revision 1 with the real `pnpm media:worker` CLI. Disable in-web job autorun.
2. Request a fixed image variant twice with independent Node fetches:
   `/_next/image?url=%2Fapi%2Fmedia%2Ffile%2Fportrait.jpg%3Fv%3D1&w=640&q=75`,
   `Accept: image/webp`. Observe **MISS**, then **HIT**; both are 1170 bytes,
   SHA-256 `4f8219572134ff7481ec05f42b957ec55a85f7c427ce0d580934927646c5443a`.
   Actual policy: `public, max-age=604800, must-revalidate`.
3. Warm `/` and `/work/cache-fixture`, then navigate away and back in the same
   browser context. CDP records cache-served optimized portrait requests with
   zero encoded transfer. This is separate from the independent optimizer HIT.
4. Use Payload's real local upload API to replace record 1 with a blue JPEG,
   the same basename, and `overwriteExistingFiles:true`. Persisted revision
   advances 1→2. The first fresh request to **each warmed route** emits the v2
   source/optimizer identity and decodes blue pixels. No purge or revalidation
   interval wait occurs. The same fixed optimizer variant with v2 is **MISS**,
   1070 bytes, SHA-256
   `550b4951eb3265b0623d98f767eed96b2bdbcf443518cf1824448e91f040c6fc`.
5. Replace video 3 with a valid blue MP4 using the same upload API. Active
   revision becomes 2/pending while both identities and hashes still identify
   published r1. Run the standalone CLI worker. The first fresh homepage and
   photoshoot requests then emit `/api/media/3/poster?v=2` and
   `/api/media/3/playback?v=2`. Both hashes change. Old v1 requests return
   non-cacheable 404s after cleanup; they never return r2 bytes.
6. For **both** poster/playback, verify matching GET/HEAD, 206 range `bytes=0-9`,
   invalid-range 416, and an unversioned alias. Matching successes use
   `public, max-age=31536000, immutable`; aliases use
   `public, max-age=0, must-revalidate`; 404/416 use `no-store`. Duplicate,
   malformed, future, old, and unsafe-integer tokens return 404.
7. Replace video 3 with a valid green MP4, then run the real worker with the
   supported `VIDEO_MAX_DIMENSION=64` environment setting. Probe validation
   rejects the 320×480 input. Revision 3 becomes failed while both public URLs
   and hashes retain r2. This exercises actual processing failure, not a mock.
8. Anonymous `/api/media/file/motion.mp4` returns 404. An authenticated request
   returns 200 with `private, no-cache, max-age=0, must-revalidate`.
9. Legacy image 2 renders directly as `/api/media/file/legacy.jpg`, without an
   optimizer URL, and its response requires revalidation. Desktop 1440×900 and
   mobile 390×844 screenshots retain the replacement and published poster.
10. Delete image 1 through Payload. The first fresh request to each route
    contains zero matching portrait images. No worker-to-Next invalidation API
    is used anywhere in this sequence.

The final receipt contains **30 response records**, **13 page observations**,
and **21 browser cache-hit events** across the sequence. Cache events retain
URLs, phase, cache flags and encoded length; no sensitive request headers.

## Automated verification

- Initial identity proof: 9 intended failures across media/accessor, thumbnail,
  loader and snapshot tests before implementation; then all focused tests pass.
- Response proof: 15 intended failures for revision validation, immutable versus
  mutable policies, and non-cacheable errors before implementation.
- U3: actual Next Image SSR failed because legacy sources were still optimized;
  the focused Chromium test failed because the legacy image lacked bypass.
- U4: five intended failures before the request boundary was implemented,
  including real page reads occurring too early and boundary failure not stopping
  rendering. The passing tests exercise both pages and work metadata.
- Real isolated Payload replacement integration: same ID/basename, persisted
  revision increase, metadata-only/color-context identity stability.
- Complete suite and typecheck pass; final totals are recorded in the JSON.
- Complete Chromium browser suite: **48/48** in three files.
- `pnpm build`: **PASS**, both public routes reported `ƒ` (on-demand rendering).
- `pnpm build:drop`: **BLOCKED**, described below.
- No lint script is configured. No `release:validate` script exists.

Additional coverage checks raw/normalized hero video redaction and retained
revision identities in both loaders; matching retained revisions in pending,
processing and failed states; and cross-owned, wrong-kind and missing files.

## Access/cache security check

Installed Payload 3.90.2 `getFile.js` was inspected: access checks occur before
custom handlers, and headers are modified only for allowed file delivery.
`privateVideoOriginalHandler` remains first in the upload handler chain. Its
anonymous denial is non-cacheable. The uniform upload policy is **private**,
so authenticated originals are not made eligible for shared-cache storage.

Derivative requests still use server-owned filename validation and filesystem
containment; the shared browser-safe parser also rejects unsafe revisions.
An explicit request token must match that kind's owned stored path before stat
or streaming. Range errors and lookup/identity failures cannot inherit the
immutable success policy. Public normalization continues redacting original
video filenames/URLs. Actual anonymous/authenticated and range requests above
confirm these boundaries on the production build. This focused implementation
check does not substitute for LFG's later standalone code review.

## Static compatibility blocker and recovery

In the separate `issue30-static` clone, the unmodified `pnpm build:drop` command
uses only the isolated fixture DB/media. Snapshot generation reports media=2,
photoshoots=1 after the deletion scenario. Compilation and TypeScript pass;
page-data collection fails with:

```text
"dynamicParams: true" cannot be used with "output: export".
Failed to collect page data for /work/[slug]
```

The route export predates issue #30. The drop script's `finally` restored runtime
source and CMS routes (only generated `next-env.d.ts` differs in the temp clone).
Shared snapshot tests pass: versioned copied images retain `/media/` paths,
generated files retain revision-addressed paths, and manifest filenames have no
query strings. A successful complete static-drop build is **not** claimed.

Recovery: LFG must resolve the static route configuration under separately
confirmed scope and rerun `pnpm build:drop` in an isolated clone with a populated
photoshoot snapshot. Do not change runtime fallback routing merely to conceal
this build failure. Then reconcile U5's outstanding gate before accepting
delivery. Runtime evidence need not be repeated unless behavior changes.

## Reproduction and retained local evidence

Retained in `issue30-runtime/scripts/`:

- `issue30-fixture.mjs`: isolated production-collection fixture creator and
  image/video replacement/deletion actions.
- `issue30-network.mjs`: production server lifecycle, Node response/hash checks,
  real CLI publication/failure, and non-intercepted Chromium/CDP proof.

The fixture script intentionally refuses the original checkout. For a fresh
sequence, preserve the existing fixture directory/results, create a fresh
disposable DB/media tree, seed via `pnpm exec tsx scripts/issue30-fixture.mjs seed`,
publish its first video with `pnpm media:worker`, build with the fixture
`DATABASE_URL`/`MEDIA_STATIC_DIR`, then run `node scripts/issue30-network.mjs`.
The harness supplies its disposable secret internally; CLI/build commands require
the same isolated-only value. Set `DISABLE_MEDIA_JOB_AUTORUN=1`. The network
harness starts/stops its own port 3110 process group and writes
`fixtures/network-results.json` plus screenshots. Its source hashes are recorded
in the sanitized JSON. Never run it against production DB/media.

Earlier failed harness attempts are retained as `fixtures-attempt1` and
`fixtures-attempt2`. They established that Payload rejects both plain-text and
truncated fake MP4 uploads before processing. The final failure fixture therefore
uses a valid MP4 and the supported worker dimension limit; no upload validation
was weakened. An initial temporary `.ts` harness caused a TypeScript error;
moving the harness to `.mjs` restored normal build validation. These were harness
failures, not suppressed application checks.
