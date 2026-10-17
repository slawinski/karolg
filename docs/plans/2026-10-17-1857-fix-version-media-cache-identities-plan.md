---
title: Version Media Cache Identities - Plan
type: fix
date: 2026-10-17
deepened: 2026-10-17
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
issue: https://github.com/slawinski/karolg/issues/30
---

# Version Media Cache Identities - Plan

## Goal Capsule

- **Objective:** Portfolio visitors see replacement photography and newly published video without clearing caches, while repeat visits reuse unchanged media.
- **Means:** Revision-bearing public URLs and resource-specific cache policies (KTD1–KTD4).
- **Authority:** Issue #30 and the Product Contract govern behavior; numbered technical decisions govern implementation within those requirements.
- **Execution profile:** Implement the units below with replacement and response-contract coverage, then verify against a production build with browser caching enabled.
- **Stop conditions:** Stop if the implementation requires weakening private-original access or assigning immutable caching to a URL that can return different content. Missing production evidence prevents declaring delivery complete.
- **Completion owner:** The implementing workflow owns code, tests, network evidence, and shipping. This artifact supplies the implementation and verification contract.

---

## Product Contract

### Summary

Version public image and video identities so replacements bypass cached content. Extend optimizer retention and give only genuinely revision-addressed generated assets immutable caching.

### Problem Frame

Bookers and collaborators depend on current photography and video when assessing Carla's work. Stable media URLs can keep showing earlier content after a CMS replacement, and extending cache lifetimes without a replacement identity makes that failure last longer.

### Requirements

**Identity and publication**

- R1. A same-record image replacement changes its public source identity even when its base filename stays the same.
- R2. Publishing a new video derivative revision changes both poster and playback identities.
- R3. Version information survives runtime normalization and all public portfolio loaders.
- R4. A replacement becomes visible without manually purging browser or optimizer caches.

**Caching and access**

- R5. Optimized image responses use an explicitly configured TTL greater than 14,400 seconds.
- R6. Versioned generated assets receive long-lived immutable caching only when their URL addresses a specific published revision.
- R7. Mutable and unversioned resources must revalidate and must not be marked immutable.
- R8. Private video-original access and public redaction remain unchanged.

**Proof**

- R9. Automated coverage proves image replacement, video revision replacement, URL normalization, and cache headers.
- R10. Production-like network verification proves cached reuse on repeat visits and a new URL immediately after replacement publication.

### Acceptance Examples

- AE1. **Covers R1, R3–R5:** Given a cached image with record 7 and filename `portrait.jpg`, replacing its bytes on record 7 produces a different public source URL and optimizer request on the next fresh page request.
- AE2. **Covers R2, R6–R7:** Given published video revision 2 and pending processing revision 3, public URLs continue identifying revision 2. Successful publication changes both identities to revision 3; failed processing retains revision 2.
- AE3. **Covers R6–R8:** A derivative URL explicitly requesting a different revision never returns the current revision's bytes with immutable headers. An unversioned alias can return current published bytes, but must revalidate. Neither URL exposes the original upload.

### Scope Boundaries

- Preserve the current retained-video behavior during pending, processing, and failed replacements.
- Preserve snapshot normalization and static-drop build compatibility; a static deployment still requires rebuilding to publish CMS changes.
- Issue #29's WebKit and static-export verification blockers are separate work and do not gate starting #30.
- No redesign, image-candidate selection changes, CMS editing workflow changes, storage-provider migration, or new transcoding pipeline.
- **Considered and not built:** Historical revision archival and a cache-purge service. Existing cleanup removes superseded derivatives, and R4 requires changing identities rather than purging caches. Revisit archival only if historical URL availability becomes a product requirement.

### Sources

- [Issue #30](https://github.com/slawinski/karolg/issues/30), live description retrieved 2026-10-17; no dependencies or comments.
- `PRODUCT.md`: CMS-managed photography, fast browsing, and performance as part of the portfolio experience.

---

## Planning Contract

### Existing Behavior and Constraints

- `src/collections/Media.ts` increments `processingRevision` for both image and video upload creation/replacement. Metadata-only updates and processing-context writes skip that increment.
- `src/lib/media.ts` preserves `processingRevision`, but URL accessors return unversioned strings. Snapshot normalization deliberately substitutes `/media/` paths through `urlForFilename`.
- `src/lib/media-processing/service.ts` publishes revision-specific filenames through compare-and-swap, but stores stable endpoint URLs. Pending/failed replacement retains published filenames from the previous revision.
- `src/lib/media-processing/paths.ts` validates derivative ownership and extracts revision from `generated/{id}/r{revision}/…`. `video.ts` creates revision directories exclusively and publishes files without overwriting an existing revision.
- `src/lib/media-processing/derivative-response.ts` resolves the current published filename and emits `public, max-age=300` for successful responses and range errors. It already supports GET, HEAD, byte ranges, and generic 404s.
- `src/lib/portfolio.ts` normalizes collection media, but merges `site.heroMedia` without normalizing it. Both public pages declare a 60-second revalidation interval.
- Payload 3.90.2's installed file handler runs access checks before custom upload handlers. Its `modifyResponseHeaders` callback receives headers only, so it is suitable for a uniform mutable-upload policy, not request-specific revision validation.

### Assumptions

These are unconfirmed planning defaults, not feature-level session-settled decisions.

- A1. Use the existing upload revision as the image cache-busting token rather than adding a content hash column and migration. Existing positive safe-integer revisions qualify; missing, zero, malformed, or non-integral revisions remain legacy/unversioned.
- A2. Use a seven-day optimizer minimum and one-year immutable retention for validated generated assets. These durations satisfy the issue without new configuration controls.
- A3. Interpret “immediately” as the first fresh runtime page request after successful publication. An already-open document need not live-update, and a static drop requires a rebuild.
- A4. Keep image source responses revalidating even when their URL has a revision token: the source file still lives at a mutable filename. Long optimizer caching is safe for current clients because replacement changes the optimizer source key.
- A5. Accept request-time rendering of public runtime pages to guarantee fresh CMS identities across web and standalone-worker publication. Media caching remains long-lived; static drops remain prerendered.

### Key Technical Decisions

- KTD1. **Centralize public identity construction in browser-safe media helpers.** For R1–R3, apply A1 to image URLs using a canonical `v` query parameter; replace an existing `v`, preserve unrelated query parameters and fragments, and make repeated normalization idempotent. Derive video tokens from each validated published filename, never the active `processingRevision`. Share pure parsing/formatting without importing filesystem or Payload runtime modules into client code. Existing helpers in `src/lib/media.ts` are the boundary; server path validation remains authoritative.
- KTD2. **Validate derivative identity before immutable delivery.** For R2, R6–R8, keep current endpoint paths and add `v` to identify the published file revision. A single valid token equal to that kind's owned stored-path revision receives the policy in A2. Missing tokens use `public, max-age=0, must-revalidate`; malformed, duplicate, mismatched, or unavailable revision requests return generic non-cacheable errors. Never silently resolve an old version to a new revision. Retired versions may become 404 after cleanup; retained versions remain available during processing or failure. GET, HEAD, and valid 206 responses share the selected successful policy; 404/416 responses use `no-store`.
- KTD3. **Separate mutable upload caching from optimizer caching.** For R5–R8, set `images.minimumCacheTTL` to A2 and use `private, no-cache, max-age=0, must-revalidate` for Payload upload-file responses. Its headers-only callback also covers authenticated private originals, so a uniform public directive would permit shared-cache storage of protected bytes. Do not add immutable headers to all `/api/media/**` or `/media/**` requests. Private-original denial stays first in the custom handler chain. Query presence alone never qualifies a source for immutable caching.
- KTD4. **Render runtime public pages from current CMS data.** For R4 and R10, await Next.js `connection()` before CMS reads on both public pages when `STATIC_EXPORT` is not `1`. The static-export branch omits that request-time boundary. Retire the public pages' 60-second runtime caching assumption; do not add cached wrappers around the public loaders. A standalone Payload worker cannot reliably invoke request-scoped Next cache invalidation, so request-time rendering avoids a worker-to-web invalidation API. Existing client documents need a fresh navigation or reload per A3.
- KTD5. **Normalize at both loader and accessor boundaries.** For R3 and R8, normalize object-valued `site.heroMedia` in addition to media collections, and ensure accessors also handle raw expanded documents. Snapshot overrides remain authoritative for base paths, with image tokens applied afterward and generated revision paths left intact. Do not manufacture a token for unknown legacy URLs or reintroduce video-original fields.

The directive to increase optimizer TTL was checked against Next.js guidance: the optimizer takes the larger of its configured minimum and upstream max-age, and has no general invalidation mechanism. The request remains viable because current public sources change identity on replacement; legacy unversioned images must bypass optimization in public rendering until they have a usable revision. This is part of U3, not a claim that upstream `no-cache` overrides the optimizer minimum.

Query tokens versus new image content-addressed storage were considered. The latter would require persistence, historical-file lifecycle, and migration changes to meet the same requested outcome. Existing revisions and explicitly mutable source responses resolve this choice from current code; no competing storage mechanism needs further development or a bake-off.

### High-Level Technical Design

**Identity data flow**

```text
CMS upload / worker publication -> persisted revision or owned filenames
Fresh runtime request -> request-time rendering -> public CMS loaders
Public CMS loaders -> shared normalization/accessors -> versioned URLs
Versioned image URL -> optimizer cache key -> browser cache
Versioned derivative URL -> owned-revision validation -> browser cache
```

**Video lifecycle**

| State | Active processing revision | Published filenames | Public identity |
|---|---|---|---|
| Ready | 2 | r2 | v2 |
| Replacement pending | 3 | r2 | v2 |
| Processing | 3 | r2 | v2 |
| Failed | 3 | r2 | v2 |
| Published | 3 | r3 | v3 |

**Response decision sketch**

```text
Upload file -> Payload access checks -> private-original denial if anonymous
Allowed upload -> private revalidating response
Derivative alias without v -> owned published file -> public revalidation
Derivative with v -> malformed or mismatched? -> non-cacheable error
Matching v -> owned published revision -> immutable success
Missing file or invalid range -> non-cacheable error
```

### System-Wide Impact and Risks

- Browser image requests, optimizer keys, video posters/playback, CMS thumbnails, normalized loader data, and static snapshots share identity helpers. Tests must cover raw and normalized inputs so they cannot diverge.
- Next.js 16.4.0 and Payload 3.90.2 are pinned in `package.json`. Context7 returned current upstream documentation, not these exact releases; installed source confirms the Payload extension points. Production verification must establish actual optimizer headers and request-time rendering on the pinned runtime.
- Existing browser documents can reference retired video URLs after cleanup. They may use cached old bytes or get a non-cacheable 404, but cannot receive new bytes under an old immutable identity (KTD2).
- Out-of-band changes to files that bypass Payload do not advance revision metadata. Keep such sources mutable; replacement proof must use the supported CMS path.
- Request-time rendering increases CMS reads compared with 60-second page retention (A5). This trades inexpensive portfolio queries for immediate visibility across both publication processes. Do not add polling, a worker-to-web invalidation endpoint, or an invalidation queue; revisit page caching only with a publication mechanism that also covers the CLI worker.

### Research References

- [Next.js Image API](https://nextjs.org/docs/app/api-reference/components/image): `minimumCacheTTL`, cache identity, `localPatterns`, and `unoptimized` behavior shaped KTD1/KTD3.
- [Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16): four-hour default and local-image query handling. Existing `localPatterns` omit `search`, which allows queries; retain pathname restrictions and verify the installed runtime rather than adding a fixed `search` that would reject future revisions.
- [Payload upload configuration](https://payloadcms.com/docs/upload/overview): `modifyResponseHeaders` and upload handlers shaped KTD3. Exact local behavior checked in `node_modules/payload/dist/uploads/endpoints/getFile.js` and `node_modules/payload/dist/uploads/types.d.ts`.
- [Next.js connection API](https://nextjs.org/docs/app/api-reference/functions/connection): request-time rendering excludes subsequent database reads from prerendering and is stable since Next.js 15. This shapes KTD4 without coupling `src/lib/media-processing/task.ts` to a live Next cache context.

---

## Implementation Units

### U1. Carry replacement identity through public media

**Goal:** Make raw and normalized public media agree on replacement identity.

**Requirements:** R1–R3, R8–R9; AE1–AE2.

**Dependencies:** None.

**Files:** Modify `src/lib/media.ts`, `src/lib/media-publication.ts`, `src/lib/portfolio.ts`, and `src/lib/media-processing/service.ts`; extend `src/collections/Media.test.ts`, `src/lib/media.test.ts`, `src/lib/media-publication.test.ts`, `src/lib/portfolio.test.ts`, `src/lib/snapshot.test.ts`, and `src/lib/media-processing/service.test.ts`; add `src/lib/media-replacement.integration.test.ts`. Modify `src/lib/snapshot.ts` only if the shared normalization change requires it.

**Approach:**

1. Implement KTD1/KTD5 at the existing media-helper boundary, sharing a pure revision parser if needed.
2. Have new video publications store the identity emitted by those helpers, and compute it for older stored unversioned endpoint URLs on read.
3. Normalize expanded hero media while preserving scalar relationships, fallback site data, attribution, dimensions, and original redaction.

**Patterns to follow:** `normalizeMediaLike`, `normalizeSnapshotMedia`, `mediaAdminThumbnail`, owned derivative path grammar, and CAS publication.

**Test scenarios:**

1. Covers AE1. Same ID and filename with image revisions 1 and 2 yield different URLs; metadata-only updates keep the same identity.
2. Normalize a URL containing another query and a fragment twice; preserve those values and emit one canonical `v`.
3. Missing/zero/negative/fractional/unsafe revision values remain unversioned; absent URLs remain absent.
4. Covers AE2. Pending/processing/failed active revision 3 with r2 filenames emits v2 for both kinds; successful r3 publication emits v3, and stale CAS publication changes neither URLs nor current files.
5. Both public loaders and expanded `site.heroMedia` preserve image identity, video identity, and video-original redaction.
6. Snapshot images retain the `/media/` base plus identity; generated paths retain their revision address; referenced filenames remain filesystem paths without query strings.
7. Admin image thumbnails carry the upload identity, and video thumbnails identify the retained published poster.
8. Covers AE1. Through a real isolated Payload upload collection using the production hooks, replace image bytes on the same record with the same basename; the persisted revision increases and public identity changes. A following metadata-only write and processing-context color write leave that identity unchanged. Follow the temporary SQLite/Payload lifecycle in `src/lib/media-processing/cas.integration.test.ts`; do not modify production fixtures.

**Verification:** Public accessors and loaders expose identical URLs for equivalent documents, including older records with stable stored video URLs.

### U2. Enforce response cache policies at media delivery

**Goal:** Make response caching match the identity actually served.

**Requirements:** R2, R6–R9; AE2–AE3.

**Dependencies:** U1.

**Files:** Modify `src/lib/media-processing/derivative-response.ts`, `src/collections/Media.ts`, and `src/lib/media-publication.ts` where handler composition needs it; extend `src/lib/media-processing/derivative-response.test.ts`, `src/collections/Media.test.ts`, and `src/lib/media-publication.test.ts`.

**Approach:** Apply KTD2/KTD3 within the existing endpoints and upload configuration. Reuse server ownership validation; do not expose a generic filesystem-serving endpoint.

**Execution note:** Start with response-contract tests that distinguish matching revision, mutable alias, and rejected identity before changing cache headers.

**Patterns to follow:** Existing temporary-root derivative fixtures, single-range parsing, private-original handler, and Payload's header callback.

**Test scenarios:**

1. Matching v2 against owned r2 files returns exact bytes and the one-year immutable policy for poster/playback GET, HEAD, and valid 206 range requests.
2. No token returns current retained published bytes with mandatory revalidation and no immutable directive.
3. v1 after r2 publication, a future revision, duplicate tokens, malformed tokens, unsafe integers, and traversal attempts never return r2 bytes under an immutable identity.
4. Covers AE3. Cleanup of r2 after r3 publication yields a non-cacheable error for v2, while v3 returns r3 bytes.
5. Invalid ranges return 416 with existing range metadata and `no-store`; missing/cross-owned/wrong-kind paths return generic 404 with `no-store` and no filesystem leakage.
6. Covers AE2. Pending and failed revision 3 can still serve a matching v2 request from r2 filenames.
7. Upload responses for originals and image sizes require revalidation. Anonymous video originals still return 404; authenticated original access remains available with a private directive and no shared-cache permission.

**Verification:** Neither success nor error paths accidentally promote a mutable resource to immutable caching; streaming and range semantics survive.

### U3. Extend optimizer retention without trapping legacy media

**Goal:** Cache versioned optimized photography longer while keeping unversioned images fresh.

**Requirements:** R1, R4–R5, R7, R9.

**Dependencies:** U1–U2.

**Files:** Modify `next.config.ts`, `src/components/Visual.tsx`, and the direct image rendering in `src/components/HomepageMasonry.tsx`; extend `src/components/Visual.test.tsx` and `src/components/HomepageMasonry.browser.test.tsx`.

**Approach:**

1. Set the explicit optimizer minimum from A2 and preserve current formats, local pathname allowlists, and static-export `unoptimized` behavior.
2. Keep version-bearing images optimized; bypass optimization for legacy mutable images lacking a usable version, per KTD3.
3. Audit direct `next/image` call sites for the same rule rather than changing unrelated layout or fetch priority.

**Test scenarios:**

1. A revision-bearing runtime image uses the optimizer and its complete source query; replacement changes the rendered source and optimizer key.
2. A legacy image without a usable revision is rendered unoptimized, allowing its revalidating source policy to take effect.
3. Video rendering uses the versioned poster/playback URLs without changing controls or preload behavior.
4. Static-export rendering still resolves local copied assets without requiring the runtime optimizer.

**Verification:** The production server accepts revision queries within allowed image paths and advertises at least 604,800 seconds for optimized versioned images. No mutable-source response is claimed immutable.

### U4. Make new identities visible through rendered-page caches

**Goal:** Publish changed URLs to fresh page requests after CMS replacement.

**Requirements:** R3–R4, R9–R10; AE1–AE2.

**Dependencies:** U1–U3.

**Files:** Modify `src/app/(frontend)/page.tsx` and `src/app/(frontend)/work/[slug]/page.tsx`; add `src/lib/public-rendering.ts` and `src/lib/public-rendering.test.ts` for the shared runtime/static rendering boundary.

**Approach:** Implement KTD4 before loader invocation on each page, keeping the request-time dependency out of pure media helpers and standalone worker services. Keep static parameter generation and the snapshot build compatible with the static branch.

**Test scenarios:**

1. Runtime rendering awaits the request boundary before either page's CMS reads; no public loader result is persisted across fresh requests.
2. Static-export rendering omits the request boundary and still builds snapshot-backed public routes.
3. A request-boundary failure prevents rendering from stale data rather than silently claiming fresh publication.
4. After standalone CLI-worker publication, fresh runtime page requests expose the new derivative identities without calling a Next invalidation API from the worker.
5. Media deletion is reflected on the next fresh runtime request, and standalone processing still needs no Next request cache context.

**Verification:** A production-built homepage and photoshoot page that were warmed before replacement return the new source identity on the first fresh request after publication; no manual purge or 60-second wait is used to obtain the result. Verify the real route behavior in U5 in addition to the helper's unit coverage.

### U5. Capture production-like replacement and cache-reuse evidence

**Goal:** Prove the complete CMS-to-browser contract rather than infer it from unit tests.

**Requirements:** R4–R10; AE1–AE3.

**Dependencies:** U1–U4.

**Files:** Add `docs/verification/issue-30-media-cache-network.md` and linked sanitized network evidence; update `README.md` with the replacement/cache contract if its media-operation instructions need it. Test expectation: no additional unit suite for this evidence-only unit; execute the behavioral checks below.

**Approach:** Use an isolated production-like CMS database/media directory with two visibly different images sharing the same upload filename and two valid video revisions. Record runtime versions, build mode, fixture IDs, timestamps, and URLs. Preserve normal browser caching throughout the replacement sequence.

**Verification scenarios:**

1. Warm homepage/photoshoot pages and a fixed image width/quality/Accept variant. Record image source and optimizer URL, cache-control, bytes/hash, and optimizer MISS then HIT using a second request independent of browser cache.
2. Revisit with browser caching enabled and record memory/disk cache reuse or a zero-transfer cached response for unchanged versioned media. Browser-cache hits and optimizer HIT are separate observations.
3. Replace the image through the real Payload upload path using the same logical record and base filename. Without clearing browser or optimizer cache, make a fresh page request and capture the new source/optimizer URLs and changed visible image on both public routes.
4. Warm video poster/playback, start replacement, and verify AE2 before and after successful publication through the standalone CLI worker. Capture fresh public-page identities, matching immutable requests, an unversioned revalidating alias, old-version rejection after cleanup, HEAD, valid range, and invalid range responses.
5. Repeat with failed video processing and verify that retained poster/playback URLs and bytes stay consistent. Check anonymous original denial and authenticated original access.
6. Verify a legacy unversioned image bypasses the optimizer and revalidates rather than silently inheriting its minimum TTL.
7. Check snapshot URL compatibility and the static-drop build independently of #29's outstanding browser evidence. Do not count a static deployment as proof of runtime optimizer behavior.

**Verification:** Save actual headers and network outcomes, not predicted results. If credentials, production-build execution, browser tooling, FFmpeg, or deployment access prevent a scenario, record it as unverified and block delivery acceptance for that criterion.

---

## Verification Contract

Implementation verification uses the existing `pnpm test`, `pnpm typecheck`, and `pnpm build` scripts. Run the named media, collection, loader, snapshot, service, and Visual tests while developing their units, then the complete unit suite and production build before network proof. Use `pnpm start` for production-like runtime evidence and `pnpm build:drop` for static compatibility in an isolated workspace because the drop script temporarily swaps source files.

Use the existing `pnpm test:browser` script for the homepage image-path regression added in U3. This focused Chromium check does not inherit #29's unresolved WebKit verification work.

No `release:validate` script exists in `package.json`. Browser evidence is required for #30's cache contract, but finishing #29's separate WebKit campaign is not a prerequisite.

| Gate | Units | Passing evidence |
|---|---|---|
| Image replacement identity | U1, U3 | Same-record/same-name replacement changes source and optimizer request |
| Video publication identity | U1, U2 | Retained and newly published revisions match AE2 |
| Normalization and loaders | U1 | Raw, normalized, hero, photoshoot, and snapshot paths preserve identity |
| Response cache/access contract | U2, U3 | Successful immutable delivery is revision-bound; mutable/error/private cases follow KTD2–KTD3 |
| Rendered-page freshness | U4, U5 | Warmed routes emit replacement identity on first fresh request after publication |
| Production-like network | U5 | Browser cache reuse and optimizer HIT proven separately; replacement works without purge |

---

## Definition of Done

- U1–U4 satisfy their named test scenarios and verification outcomes.
- U5 contains reproducible production-like evidence for R10, including replacement visibility with caches left populated.
- Every R-ID is backed by automated coverage or the network evidence assigned above.
- Private-original denial/redaction, retained video behavior, range support, and static normalization remain compatible.
- No required check is represented as passed when it was unavailable or skipped.
- Experimental code and abandoned alternatives are removed from the implementation diff.
