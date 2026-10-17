---
title: Retire the Cloudflare Drop Export - Plan
type: refactor
date: 2026-10-17
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Retire the Cloudflare Drop Export - Plan

## Goal Capsule

- **Objective:** The Next.js server deployment is the single supported publishing path, so contributors no longer maintain or gate work on an unused static export.
- **Means:** Delete the export's scripts, tests, configuration, and CI gate, and record the server-only support policy (KTD1, KTD2, KTD3).
- **Authority:** The repository's Product Contract and `PRODUCT.md` framing; this plan's Requirements and Key Decisions.
- **Stop conditions:** Stop if removal requires changing shared runtime media identity, the CMS loaders, or the video pipeline — those are preserved by R7.
- **Who finishes and ships:** `ce-work` implements the units; LFG commits, opens the PR, and watches CI.

## Product Contract

### Summary

Remove the Cloudflare Drop static export and record the Next.js server as the only supported deployment. The export is close to unused: nobody publishes or recovers the site through it, its CI gate currently fails, and a populated run already failed on a route/export incompatibility. The server path keeps its responsive image optimizer, controlled video endpoints, and revisioned caching.

### Problem Frame

The export was a second, partial deployment path layered over a working server. It carries its own build orchestration, CMS snapshot generator, asset copier, tests, and documentation, and it gates every PR. It now fails more than it helps: `pnpm build:drop` fails in CI when the snapshot is empty, and a populated run cannot collect `/work/[slug]` because the route sets `dynamicParams = true` against `output: export`. The maintenance cost lands on unrelated server work, which must keep the export building even though no one depends on it.

### Requirements

**Deployment support policy**

- R1. The repository records the Next.js server deployment as the only supported deployment path.
- R2. The README documents that path's persistence and recovery requirements: mounted `./data` and `./media` shared with the jobs worker, and recovery by restoring both volumes and redeploying.

**Export removal**

- R3. The `build:drop` package command and its CI step are removed.
- R4. Export-only scripts and their tests are deleted.
- R5. Static-export configuration and the request-boundary exception are removed.
- R6. Export-only ignore entries and documentation are removed.

**Runtime preservation**

- R7. Shared runtime behavior is unchanged: CMS loading and pagination, media normalization and privacy rules, revisioned presentation URLs, responsive image optimization, and controlled video endpoints.

**Evidence and verification**

- R8. The retirement records the measured server-path verification reports and, per issue #32, states the export's approximate 460 MB size as an estimate from that issue rather than a measured manifest.
- R9. The remaining CI checks pass after removal.

### Key Decisions

- **KD1. Retire the export rather than repair or retain it.** (session-settled: user-directed — chosen over patching the export CI and preserving support: no publishing or recovery dependency exists, and repeated export failures block unrelated work.) Governs R1, R3, R4, R5, R6.
- **KD2. No replacement static fallback.** Recovery is restoring the server's `data/` and `media/` volumes and redeploying. Governs R2.

### Scope Boundaries

- In scope: removal of export machinery and the support-policy record for the server path.
- Not in scope: any change to responsive image handling, video processing, CMS publishing, or the request-time rendering behavior protected by R7.
- Not in scope: a tested production backup/restore runbook. R2 documents the required volumes; a demonstrated restore is not established by this work.
- Historical `docs/plans/` and `docs/verification/` records that mention the export stay as historical records and are not rewritten.
- Considered and not built: removing `derivativeUrl`'s stored `/media/<filename>` short-circuit. It is export-oriented (its comment names snapshot URLs and its only producer was `urlForFilename`), but it sits in shared request-time code, so this plan keeps it and retains test coverage rather than changing runtime URL derivation for any stored `/media/...` value.

### Sources

- Issue #32, "Decide the future of the Cloudflare Drop export" (origin of the approximate 460 MB export-size figure recorded by R8).
- CI run 39055722625: `pnpm build:drop` fails with `TS2307` because `src/lib/public-rendering.test.ts` imports `../app/(frontend)/work/[slug]/page` while the snapshot parks the work routes.
- `docs/verification/issue-30-media-cache-network.md:138-146`: a populated export (`media=2, photoshoots=1`) failed route collection on `"dynamicParams: true" cannot be used with "output: export"`.
- `docs/verification/2026-10-17-photoshoot-candidates.md` and `docs/verification/issue-30-media-cache-network.md`: measured server-path image, cache, and delivery evidence.

## Planning Contract

### Key Technical Decisions

- KTD1. **Keep the request boundary as a thin helper.** `src/lib/public-rendering.ts` keeps exporting `awaitPublicRequest()` and always awaits `connection()`; the `STATIC_EXPORT` branch is deleted. Inlining `connection()` into each page would widen the diff and lose the boundary test's focus.
- KTD2. **Remove the export-only injectable options; keep the stored-URL short-circuit.** Delete both options on `normalizeMediaLike` in `src/lib/media.ts` — `normalizePhotoshoot` and `urlForFilename` — since the deleted snapshot module is their only producer, and remove the `NormalizeMediaOptions` type once it is empty. Keep the stored-URL short-circuit in `derivativeUrl` (`src/lib/media.ts:124`, whose own comment says "Snapshot URLs already address the immutable revision directory") as backward compatibility for any stored `/media/<filename>` derivative URL. Its former test coverage lived in the deleted `snapshot.test.ts` and the `urlForFilename` fixture, so retain a direct test for it in `media.test.ts` rather than leaving it untested.
- KTD3. **Always wrap the Next config with `withPayload`.** Delete the `isStaticExport` conditional in `next.config.ts` so `output`, `trailingSlash`, and `images.unoptimized` never activate.

### Assumptions

- A1. No live domain, scheduled job, or documented workflow depends on the export. Stated by the user in the brainstorm; treated as a user-confirmed operational assertion, not independently verified.
- A2. The export has not shipped successfully in current history; the last recorded populated attempt failed. Historical `out/` artifacts, if any, are not supported by this work.

## Implementation Units

### U1. Remove the export build command and CI gate

- **Goal:** Stop invoking the export from the package scripts and CI.
- **Requirements:** R3, R9
- **Dependencies:** None
- **Files:** Modify `package.json`, `.github/workflows/ci.yml`
- **Approach:** Remove the `build:drop` script. Remove the `pnpm build:drop` step from the CI build job; leave `pnpm test`, browser tests, `pnpm typecheck`, `pnpm exec payload migrate`, and `pnpm build` in place.
- **Test expectation:** none — build/orchestration change; verified by CI running the remaining steps.

### U2. Delete export-only scripts and tests

- **Goal:** Remove the export's build orchestration, snapshot generator, and asset copier.
- **Requirements:** R4
- **Dependencies:** U1
- **Files:** Delete `scripts/build-drop.mjs`, `scripts/snapshot-cms.ts`, `scripts/static-assets.mjs`, `scripts/static-assets.d.mts`, `scripts/static-assets.test.ts`; modify `scripts/verify-photoshoot-candidates.mjs`
- **Approach:** Delete the files. `scripts/` retains `reprocess-media.ts`, and retains `verify-photoshoot-candidates.mjs` after removing its `unoptimized-static-config` scenario (`scripts/verify-photoshoot-candidates.mjs:212-215`) and the now-unused `unoptimized` parameter (`:40`, `:50`), which emulate the retired static-export image configuration. The snapshot CLI imports `src/lib/snapshot.ts`, removed in U3.
- **Test expectation:** none — deletion; confirmed by `pnpm typecheck` and `pnpm test` finding no dangling imports.

### U3. Remove the snapshot normalization module and the export-only media option

- **Goal:** Delete the snapshot module and the option that only it consumed, without touching shared behavior.
- **Requirements:** R4, R7
- **Dependencies:** U2
- **Files:** Delete `src/lib/snapshot.ts`, `src/lib/snapshot.test.ts`; modify `src/lib/media.ts`, `src/lib/media.test.ts`
- **Approach:** Delete the snapshot module and its test. In `src/lib/media.ts`, remove the `normalizePhotoshoot` and `urlForFilename` fields from `NormalizeMediaOptions` and their conditional branches: `normalizePhotoshoot` (lines 206-208) always calls `normalizePhotoshootReference(doc.photoshoot)`, and all three `urlForFilename` branches fall back to their own stored value — `stringValue(doc.url)` (line 197), `stringValue(doc.playbackUrl)` (lines 223-226), and `stringValue(doc.posterUrl)` (lines 230-233). With every option gone, delete the `NormalizeMediaOptions` type and the `options` parameter, and update callers to `normalizeMediaLike(value)`. Keep `derivativeUrl`'s stored-URL short-circuit (`media.ts:124`) and `originalMediaUrl` (per KTD2). In `src/lib/media.test.ts`, drop the `urlForFilename` fixture from the "normalizes photoshoot photographers and static derivative URLs" case, keep its photographer-normalization assertions, and add a direct test for the stored-URL short-circuit now that the snapshot test that covered it is deleted.
- **Test scenarios:**
  - `normalizeMediaLike(value)` returns the stored `url` for an image and the derived `playbackUrl`/`posterUrl` for a video.
  - The photographer-normalization case still resolves photographer references from a photoshoot without the `normalizePhotoshoot` option.
  - `mediaPresentationUrl` for the legacy `/media/movie.mp4` fixture is unchanged.
  - A derivative URL that already ends in `/media/<filename>` is returned unchanged.
- **Verification:** `pnpm test` passes with the shared media-model tests intact.

### U4. Remove static-export configuration and the request-boundary exception

- **Goal:** Make the server path the only configured build.
- **Requirements:** R5, R7
- **Dependencies:** None
- **Files:** Modify `next.config.ts`, `src/lib/public-rendering.ts`, `src/lib/public-rendering.test.ts`
- **Approach:** In `next.config.ts`, delete `isStaticExport`, the `output`/`trailingSlash` spread, the `images.unoptimized` spread, and the conditional default export; always export `withPayload(nextConfig, { devBundleServerPackages: false })` (KTD3). In `public-rendering.ts`, keep `awaitPublicRequest()` and always `await connection()` (KTD1). In the test, remove the `STATIC_EXPORT` stubs and the snapshot-omission assertion; keep the "does not read CMS data before the boundary" and failure-propagation cases.
- **Test scenarios:**
  - `awaitPublicRequest()` awaits `connection()` once.
  - Home, work, and metadata do not read CMS data before the boundary resolves.
  - A failing boundary propagates and does not read stale data.
- **Verification:** `pnpm test` and `pnpm build` succeed.

### U5. Remove export ignores and documentation; record the server-only policy

- **Goal:** Remove export references from ignore rules and docs, and state the single supported deployment path with its persistence and recovery requirements.
- **Requirements:** R1, R2, R6, R8
- **Dependencies:** U1, U2, U3, U4
- **Files:** Modify `.gitignore`, `README.md`
- **Approach:** Remove the `out` and `.drop-*` / `src/lib/.portfolio.drop.generated.ts` ignore entries. Delete the `## Static Cloudflare Drop export` README section (`README.md:109`) and fold its surviving statements into the existing `## Production persistence` section (`README.md:119`) rather than adding a parallel section, so the README keeps a single persistence passage: the server path is the only supported deployment; the required `PAYLOAD_SECRET`, `DATABASE_URL`, and `NEXT_PUBLIC_SITE_URL`; the mounted `./data` and `./media` volumes shared with the jobs worker; and recovery by restoring both volumes and redeploying (KD2). Remove the static-specific claims in the CMS workflow, media, and caching passages. Link the measured server-path verification reports and note the export's approximate 460 MB size as an estimate (R8).
- **Test expectation:** none — documentation and ignore-rule change.

## Verification Contract

| Check | Command | Proves |
|---|---|---|
| Unit suite | `pnpm test` | Shared media, loader, homepage, and public-rendering behavior intact (R7) |
| Typecheck | `pnpm typecheck` | No dangling imports from deleted modules (R4) |
| Production build | `pnpm build` | Server path builds without the export configuration (R5) |
| Residual export references | Search the tree for `build:drop`, `STATIC_EXPORT`, `isStaticExport`, `static-assets`, `snapshot-cms`, `urlForFilename`, `normalizePhotoshoot`, `unoptimized-static-config`, and `Cloudflare` outside `docs/` history | Export machinery removed (R3, R4, R5, R6) |
| CI | GitHub Actions `CI` workflow on the PR | Remaining checks pass (R9) |

Browser tests (`pnpm test:browser`, `pnpm test:browser:webkit`) remain in CI and must pass; no unit in this plan changes browser behavior.

## Definition of Done

- R1–R9 are satisfied.
- `build:drop`, the export scripts, the snapshot module, and the `STATIC_EXPORT` configuration are gone, and no non-historical file references them.
- `pnpm test`, `pnpm typecheck`, and `pnpm build` pass locally; the PR's CI run is green.
- The README states the server-only support policy with persistence and recovery requirements and links the measured evidence.
- Abandoned-attempt code and leftover scratch files are removed from the diff.
- The PR references issue #32.
