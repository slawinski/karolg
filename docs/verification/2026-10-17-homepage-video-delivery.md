# Homepage video delivery verification

Issue #31; implementation plan:
`docs/plans/2026-10-17-2149-feat-defer-offscreen-video-posters-plan.md`.

## Production mobile network evidence (U5)

Fresh `pnpm build` served with `pnpm start --port 3108`; Chromium
156.0.8078.4, 390×844 viewport, DPR 2. Public homepage, real hydration,
real media and Next Image delivery; no CMS writes or fixture routes.

Reproduce:

```sh
pnpm build
pnpm start --port 3108
# In another terminal:
pnpm exec tsx scripts/verify-homepage-video-delivery.mjs \
  http://localhost:3108 /tmp/homepage-video-raw.json \
  docs/verification/2026-10-17-homepage-video-delivery-results.json
```

The homepage composition is randomized server-side. The script uses fresh
contexts for up to ten layouts to obtain a video that has never entered the
acquisition observer's zone. It records the actual native observer entries
while forwarding callbacks unchanged. The retained run found that case on
load ten, sampled 1,546 ms after navigation, before the six-second swap cycle.

| Check | Observed result |
| --- | --- |
| SSR video playback sources / raw poster attributes | Neither present |
| Initial video at y=1,605 | Acquired metadata, paused; inside observed zone ending at y=2,532 |
| Initial video at y=3,184 | No `src`, `preload="none"`, paused; observer never intersected |
| Initial playback requests for deferred media 62 | **0** |
| Direct/unoptimized poster requests | **0** |
| Optimized poster widths | **384w**, both posters, for 191 CSS-pixel cards at DPR 2 |
| Opening portfolio images | Both eager, high priority, loaded successfully |
| Deferred video moved to y=1,266 | Playback source acquired, metadata preload, remains paused |
| Same video moved to y=252 | Playing, muted, looping, inline, without controls |

The in-zone video legitimately requests playback before scrolling. The zero
request claim applies to the deferred video, not all video resources. Chromium
may fetch lazy posters beyond the fold; those transfers use responsive 384w
optimized candidates rather than raw full-size posters. Acquisition latches
after the first intersection, so final geometry alone cannot establish whether
a source was attached prematurely.

Retained structured evidence:
`2026-10-17-homepage-video-delivery-results.json`. The optional raw report also
includes the CDP request log.

## Local checks

- `pnpm typecheck`: passed.
- `pnpm test`: 159 tests passed in 22 files.
- `pnpm test:browser`: 52 Chromium tests passed in four files.
- `pnpm build`: passed.
- Production network script: passed, no assertion failures.
- `pnpm test:browser:webkit`: browser connection timed out after 60 seconds;
  no tests executed. WebKit verification remains dependent on a compatible CI
  runtime; no local WebKit pass is claimed.

The final build was checked again after narrowing the optimizer allowlist to
`/api/media/*/poster` and adding poster-error fallback. The network script
passed on that build (two layouts, zero failures). A browser regression first
failed on the broken poster staying visible, then passed with the failed image
hidden and restored on a later successful load.

## Browser and source review

| Route | Status | Evidence |
| --- | --- | --- |
| `/` | Pass | Desktop layout, reduced-motion state, and production mobile acquisition/playback checks |
| `/work/d` | Pass | Mobile manual controls; first video plays after pressing play, second remains paused |

No console errors were observed on those routes. Viewport screenshots were
captured locally for the desktop homepage and mobile photoshoot.

An independent source reviewer checked the implementation, tests, script, and
plan. Its actionable poster-error finding was reproduced and fixed; its
optimizer-allowlist suggestion was applied. Its concern about revision-less
legacy media retains the existing explicit unoptimized fallback policy and is
not a change to published-media delivery. The full CE review wrapper could not
complete inside its delegated context because nested reviewer tools were
unavailable; this was a direct independent source review, not a completed
multi-persona or cross-model review.
