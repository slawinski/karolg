---
title: Photoshoot Media Viewer - Plan
type: feat
date: 2026-10-24
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-plan-bootstrap
execution: code
---

# Photoshoot Media Viewer - Plan

## Goal Capsule

- **Objective:** Visitors can explore a photoshoot's photographs and videos continuously, then return to the place they left in the gallery.
- **Means:** One mixed-media browser-viewport viewer, governed by R1–R8 and implemented through KTD1–KTD4.
- **Authority:** The Product Contract controls behavior; the Planning Contract controls mechanisms within those requirements; implementation units and examples do not override either.
- **Execution profile:** Extend the current public route on `feat/photoshoot-media-viewer`. Keep CMS and media-delivery contracts intact under R9.
- **Completion owner:** The calling LFG workflow implements, verifies, reviews, and ships the work. This document authorizes no implementation by the planning run.
- **Stop conditions:** Stop for evidence that a session-settled decision is infeasible, or if implementation requires changing R9. Report the conflict rather than silently choosing a different experience.

---

## Product Contract

### Summary

Add an ordered mixed-media overlay to `/work/[slug]`, opening at the selected gallery item.
Keep the interface quiet while supporting continuous browsing and controlled video playback.

### Problem Frame

Bookers and collaborators need to inspect the photography beyond the cropped gallery slots and browse a story without repeatedly returning to the grid.
The existing route presents a multi-column gallery with silent inline videos but no shared inspection experience.
This serves the fast-scan/deep-browse principle in `PRODUCT.md`.

### Key Decisions

- **One gallery overlay.** (session-settled: user-directed — chosen over a single-image overlay or device fullscreen: browse the story without returning to the grid.) Governs R1, R2.
- **No visible previous/next controls.** (session-settled: user-directed — chosen over chevrons: retain a minimalist overlay with keyboard and swipe navigation.) Governs R3, R4.
- **Photos and videos share the viewer.** (session-settled: user-directed — chosen over a photo-only viewer: videos need controls and sound in the same browsing sequence.) Governs R1, R5.
- **Containment, return position, and playback cleanup.** (session-settled: user-approved — chosen over cropped viewing, losing gallery position, or assuming autoplay always succeeds: inspect whole images and return without lingering audio, with a play fallback when blocked.) Governs R2, R6, R7, R8.

### Requirements

**Opening and viewing**

- R1. Activating any usable photo or video gallery item opens one viewer at that item's index in the current route's media array, retaining the array's mixed-media order.
- R2. The overlay occupies the available browser viewport while browser chrome remains available, and photographs fit completely without cropping.

**Navigation and dismissal**

- R3. Show a visible close button and no visible previous/next buttons, chevrons, or navigation hit-zone controls.
- R4. Desktop left/right arrows and horizontal mobile swipes navigate the sequence without interfering with native video controls.
- R5. Videos expose native playback, seek, and volume controls and remain inline within the browser overlay.
- R6. Entering a video attempts playback with sound enabled; if browser policy blocks it, an operable play fallback remains available.
- R7. Leaving an active video, closing the overlay, or leaving the route stops that viewer video's playback and audio, including late asynchronous playback starts.
- R8. The close button and Escape dismiss the overlay, restoring the opening gallery position and the activating item's focus.

**Preservation**

- R9. Preserve gallery layout, media URLs and revision handling, readiness/loading behavior, silent inline video behavior, and CMS structures.
- R10. Preserve the public site's accessibility requirements from `PRODUCT.md`: meaningful alt text, visible keyboard focus, semantic controls, AA functional-text contrast, 44px touch targets, and reduced-motion support.

### Acceptance Examples

- AE1. **Covers R1, R2, R4:** In a photo/video/photo sequence, open the middle video and navigate right outside its native controls; the third item appears without returning to the grid.
- AE2. **Covers R6:** When audible playback is denied, the viewer stays open on the selected video and the visitor can start it using the native play control.
- AE3. **Covers R7:** Navigate from a video while its play request is pending, then resolve that request; the outgoing video cannot restart or interrupt the new item.
- AE4. **Covers R8:** Open an item far down the gallery, browse several items, then close with either dismissal method; the original trigger regains focus without scrolling to the currently viewed item.
- AE5. **Covers R4, R5:** With video controls focused, arrow keys seek or adjust the video rather than changing gallery items; a drag on the native seek bar never navigates the viewer.

### Scope Boundaries

- Zoom and download features are out of scope.
- Device fullscreen, new CMS ordering, media processing changes, and gallery redesign are out of scope under R2 and R9.
- Considered and not built: adjacent-slide preloading, a third-party carousel, and a generalized site-wide modal framework. The requested single active item does not require them; reconsider only if measured implementation evidence establishes a browsing or compatibility problem.
- Considered and not built: custom replacement video controls. Native controls satisfy R5 and avoid a separate accessibility and playback UI surface.

---

## Planning Contract

### Key Technical Decisions

- KTD1. **Keep the route server-rendered and add a client gallery controller with server-rendered media slots.** `src/app/(frontend)/work/[slug]/page.tsx` continues fetching media and selecting eager candidates. A new `PhotoshootGallery` receives the ordered serializable media data plus server-rendered figure children. It owns the gallery section, delegates activation from per-figure native button triggers, and manages a single selected index. This keeps `Visual` and data fetching out of a new client import graph. Context7's Next.js server/client composition guidance supports passing rendered children through a client boundary. Implements R1, R9.
- KTD2. **Use a native modal dialog with a separate active-media renderer.** A new `PhotoshootMediaViewer` owns the browser top-layer dialog, initial close-button focus, scoped input handlers, scroll lock, and dismissal cleanup. Use modal opening rather than a non-modal open attribute. Existing `Visual` keeps its crop and inline-video behavior; viewer photos use Next Image with contain sizing, `100vw` sizes, and the existing revision-dependent optimization policy. Only the active viewer item mounts, and no viewer image participates in initial critical-media selection. This avoids propagating viewer behavior into homepage or gallery media. Implements R2, R3, R8–R10.
- KTD3. **Use a dedicated viewer video lifecycle, not the deferred decorative-video hook.** Resolve playback/poster through `src/lib/media.ts`. The active video has native controls, inline playback, sound enabled, and an observed play attempt. Scope each attempt to its mounted item/session; pause and release the outgoing source on navigation, close, and unmount, and ignore obsolete promise results. An obsolete successful start must be paused without touching a newer element. Catch policy rejection and keep the native play affordance available; expected cancellation is not a playback error. The existing hook intentionally gates muted autoplay on readiness, intersection, and motion, so reusing it would violate R5–R7. Explicit viewer playback bypasses those decorative-autoplay gates without changing them. MDN's play-promise guidance establishes why fallback and late-result ownership are necessary.
- KTD4. **Give native video input priority over viewer navigation.** Handle desktop arrows only within the open dialog, outside video/control and editable targets, ignoring modified or already-handled events. Do not install capture handlers that consume video input. On photos, recognize horizontal-dominant touch swipes over the media stage. On videos, reserve an unobtrusive non-video swipe surface around the player, including a minimum 44px-high gutter outside its bounds, and exclude the entire native video element from gesture recognition. Native controls live in browser-owned UI, so guessing their internal geometry is unreliable. The close button is outside gesture surfaces. Implements R4, R5, R10.

These choices are bounded component-level changes with no new persistent format or shared public interface.
A custom portal modal is a viable alternative to KTD2, but would require reproducing native inertness and focus handling without a demonstrated benefit here; no costly unresolved architecture fork requires a bake-off.

### Assumptions

These defaults are unvalidated agent bets, permitted by the request's reasonable-default instruction.

- A1. Navigation is bounded at the first and last items, without wrapping; no existing viewer pattern was found in the scoped components.
- A2. Opening does not change URL, history, or browser Back behavior. Backdrop clicks do not dismiss; explicit close and Escape own dismissal.
- A3. Use a charcoal/black background, whole-media containment, a persistent safe-area-aware close button, and no animated slide transitions. Do not add a visible counter or gesture tutorial; provide screen-reader-only navigation instructions and item position.
- A4. Each newly entered video starts from the beginning, unmuted at the browser's normal volume; controls may change mute/volume for that visit. Do not loop viewer videos or preserve per-item playback progress across navigation.
- A5. A touch swipe advances once on release when horizontal distance is at least 50 CSS pixels and exceeds vertical distance by at least 1.5 times. Vertical, short, multi-touch, canceled, and mouse-drag gestures do not advance. Allow browser pinch zoom rather than adding a zoom feature.
- A6. A failed active media request keeps the overlay closable and navigable with a short accessible unavailable message; add no automatic retry system. This is distinct from policy-blocked playback, which retains native play controls.
- A7. Native volume presentation follows the browser and OS. On iOS, system volume may substitute for an on-player volume slider; no custom volume slider or fullscreen player is introduced.

### Existing Behavior Trace

Fresh source reads establish the following ownership chain:

1. `getPhotoshootMedia` in `src/lib/portfolio.ts` queries filename-sorted media, normalizes each document, and filters with `isUsableMedia`. The returned array is already the public sequence; do not re-sort or filter it in the viewer.
2. The route computes `selectPhotoshootCandidates` and maps figures with seven repeating aspect ratios. `Visual` renders revision-aware Next images or delegates to `PhotoshootVideo`.
3. `PhotoshootVideo` displays a responsive poster over a muted, looping, inline, control-free video. `useDeferredVideoSource` acquires and plays only under its readiness, visibility, and motion conditions, and pauses/releases through cleanup.
4. `PublicMediaReadiness` scans critical images after hydration and waits for them plus a foreground delay. Viewer-only media must not change that scan or unlock the gallery early.

The controller must leave the original figures mounted while the overlay is open.
Inert background content does not itself pause media; the original inline videos remain muted and governed by their unchanged lifecycle under R9.
Only the dedicated viewer video can produce sound.

### High-Level Technical Design

**Component ownership sketch**

| Owner | Input | Directed output / responsibility |
|---|---|---|
| Work route | CMS photoshoot and ordered usable media | Rendered figures and serializable media go to PhotoshootGallery |
| PhotoshootGallery | Figure children and matching array | Trigger index, opener reference, and selected media go to PhotoshootMediaViewer |
| PhotoshootMediaViewer | Selected index and media | Modal dialog renders one contained photo or controlled video; change/close events return to gallery controller |
| Existing Visual subtree | Existing route props | Gallery images/posters/inline video remain mounted independently |

**Viewer lifecycle sketch**

| State | Entry / event | Next state and ownership effect |
|---|---|---|
| Closed | Gallery activation | Save opener and scroll position, lock background scroll, open dialog at selected index |
| Photo active | Adjacent valid navigation | Tear down outgoing active media and mount the selected item |
| Video starting | Play succeeds for current item | Video active |
| Video starting | Policy blocks playback | Video paused with native play fallback |
| Video active or paused | Native controls | Remain on that item; native browser interaction owns playback |
| Any open state | Valid navigation | Pause/release outgoing video before replacement, then enter next photo or video state |
| Any open state | Close, Escape, route unmount | Invalidate attempts, stop/release viewer video, close dialog, restore owned styles; restore focus/scroll only if returning to the same mounted gallery |

**Open/close protocol sketch:** Capture opener and document scroll → mount selected item and open modal → focus close without scrolling → on dismissal synchronously stop media and invalidate pending work → close modal and release owned scroll-lock styles → restore opener with scroll prevention and the captured document position.

For mobile scroll locking, retain the existing inline style values before applying a fixed-body lock with captured offsets, then restore exactly those values before restoring scroll.
Compensate for the desktop scrollbar only while locked so gallery columns do not reflow.
Dialog styling must reset native max-size/margins and use dynamic viewport height with a fallback, safe-area padding, and a separate media region below the close affordance.
The video swipe gutter reduces the available media region rather than covering any player controls.

### Risks and Implementation-Time Checks

- Autoplay can be blocked even after a user gesture, particularly when React mounts the video after the event. KTD3 relies on a play attempt plus native fallback, not guaranteed autoplay. Try promptly once the active element is mounted; do not retry in a loop or silently switch to muted playback.
- Native media control event targets differ by browser. KTD4 excludes the whole video surface; test actual seek/volume interaction in Chromium and WebKit, plus real mobile Safari.
- Existing geometry tests recreate figures without `Visual` or a real route. U1 must add controller integration coverage while retaining their geometry assertions.
- The browser test configuration aliases Next Image to `src/test/NextImage.tsx`. Browser component tests can prove containment CSS and state, but actual optimizer URLs and request behavior need a running Next route check.
- A7 is a browser capability qualification, not evidence invalidating the shared viewer decision. Verify audible playback with a clip containing an audio track; current controlled fixtures alone do not prove sound output.

### Sources and Research

- `PRODUCT.md`: editorial restraint, fast scan/deep browse, performance, and accessibility constraints.
- `src/app/(frontend)/work/[slug]/page.tsx`, `src/components/Visual.tsx`, `src/components/PhotoshootVideo.tsx`, `src/components/useDeferredVideoSource.ts`, `src/components/PublicMediaReadiness.tsx`: rendering and lifecycle evidence used in KTD1–KTD3.
- `src/lib/media.ts`, `src/lib/media-revision.ts`, `src/lib/portfolio.ts`: public order, usability, and revision-aware delivery contracts.
- `src/lib/media-processing/video.ts`: playback transcoding maps the first audio stream to AAC when the source has audio, supporting audible viewer playback without delivery changes. Source clips without audio remain silent.
- `src/components/PhotoshootGallery.browser.test.tsx`, `src/components/PhotoshootVideo.browser.test.tsx`, `src/components/Visual.test.tsx`, `vitest.browser.config.ts`: geometry and media lifecycle patterns for verification.
- [Next.js server/client composition](https://nextjs.org/docs/app/getting-started/server-and-client-components), retrieved through Context7 `/vercel/next.js`: KTD1's slot composition. Installed versions are Next.js 16.4.0 and React 19.2.6; fetched guidance is current upstream guidance, not a 16.4.0-specific compatibility receipt.
- [Next Image reference](https://nextjs.org/docs/app/api-reference/components/image), retrieved through Context7 `/vercel/next.js`: KTD2's positioned media container, fill behavior, and containment sizing.
- [MDN dialog](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog): KTD2's modal inertness and focus behavior.
- [MDN media play](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play): KTD3's promise rejection and asynchronous playback ownership.

---

## Implementation Units

### U1. Connect the preserved gallery to a contained modal photo viewer

**Goal:** Open the selected gallery item without changing the existing gallery presentation.

**Requirements:** R1–R3, R8–R10; AE4. **Dependencies:** None.

**Files:** Modify `src/app/(frontend)/work/[slug]/page.tsx` and `src/app/(frontend)/styles.css`; create `src/components/PhotoshootGallery.tsx`, `src/components/PhotoshootMediaViewer.tsx`, and `src/components/PhotoshootMediaViewer.browser.test.tsx`; extend `src/components/PhotoshootGallery.browser.test.tsx`.

**Approach:**

1. Compose the existing route figures into KTD1's client section, retaining keys, classes, sizes, eager flags, and exact array index correspondence.
2. Add a labeled native button as an absolutely positioned sibling of each figure's `Visual`, above its poster. Keep it out of normal flow so inline-block baselines and column geometry remain unchanged; do not nest the media subtree inside a button.
3. Build KTD2's dialog, contained photo rendering, and open/close protocol. Keep all added styling scoped to gallery triggers and viewer classes.
4. Keep route fetches, candidate selection, and the PublicMediaReadiness boundary in place. Reset controller ownership on photoshoot route change.

**Patterns to follow:** Existing route figure mapping, `Visual` image revision policy, `PhotoshootGallery.browser.test.tsx` responsive geometry assertions, and `PRODUCT.md` functional-control styling constraints.

**Test scenarios:**

1. Click the sixth item in the nine-item regression gallery; the dialog selects index five, retains alt text, and does not remount or reorder the figures.
2. Use Enter and Space on gallery triggers; each opens its own item and initially focuses the visible close button.
3. Covers AE4. Open after scrolling down the page, close by button and Escape separately, and verify original scroll position and opener focus after browsing once navigation is available.
4. Render portrait, landscape, square, and dimensionless photo fixtures at mobile, laptop, and landscape-phone viewports; whole images remain within the media region and the close target stays visible.
5. Empty galleries render without a usable viewer; a one-item gallery opens and closes correctly.
6. Unmount an open gallery and remount another photoshoot; owned document styles are restored and no old opener steals focus on the new page.
7. Retain the existing nine-slot baseline and 700/701, 1100/1101 breakpoint assertions after adding the actual trigger/controller shell.

**Verification:** The real route opens selected images in a modal with background interaction blocked, no browser fullscreen transition, and no gallery geometry or critical-image attribute changes.

### U2. Add ordered keyboard and touch navigation with native-control priority

**Goal:** Browse adjacent mixed-media slots through the inputs in R4.

**Requirements:** R1, R3, R4, R10; AE1, AE5. **Dependencies:** U1.

**Files:** Modify `src/components/PhotoshootGallery.tsx`, `src/components/PhotoshootMediaViewer.tsx`, `src/app/(frontend)/styles.css`, and `src/components/PhotoshootMediaViewer.browser.test.tsx`.

**Approach:** Apply KTD4 with A1 and A5, and expose only nonvisual item-position/navigation instructions under A3. Keep the close target stable across slide changes. Reserve video gesture space in the layout before U3 adds the real player.

**Patterns to follow:** Existing browser test event/viewport patterns; preserve the route's array order rather than interpreting CSS column coordinates as reading order.

**Test scenarios:**

1. Covers AE1. Navigate both directions through an interleaved photo/video/photo array and verify exact array order and selected-item identity.
2. At the first and last item, outward arrows and swipes do nothing; repeat with a single item.
3. At mobile width, a 70px horizontal photo swipe advances once; short, predominantly vertical, canceled, multi-touch, and mouse gestures do not.
4. With close focused, ordinary left/right arrows navigate; modified keys, handled events, and editable targets do not.
5. Covers AE5. Events originating on the video surface never change the index, while a swipe in the reserved video gutter does.
6. Close and reopen repeatedly; one input produces one transition, with no stale listeners or navigation when closed.

**Verification:** Native control priority is upheld in both browser engines after U3, no previous/next UI appears at any breakpoint, and horizontal touch browsing works with the browser toolbar present.

### U3. Integrate audible native video playback and race-safe teardown

**Goal:** Play and control videos in the same sequence without leaking audio.

**Requirements:** R1, R5–R7, R9, R10; AE1–AE3, AE5. **Dependencies:** U1, U2.

**Files:** Modify `src/components/PhotoshootMediaViewer.tsx` and `src/components/PhotoshootMediaViewer.browser.test.tsx`; add `src/test/fixtures/photoshoot-viewer.ts` for deterministic mixed media if needed. Existing inline tests remain regression gates in `src/components/PhotoshootVideo.browser.test.tsx` and `src/components/PublicMediaReadiness.browser.test.tsx`.

**Approach:**

1. Implement KTD3 using client-safe helpers from `src/lib/media.ts`; do not import CMS querying code into the viewer.
2. Add native poster, playback controls, contained sizing, inline mode, and active-video play ownership. Apply A4 and distinguish blocked playback from unavailable media under A6.
3. Unify media cleanup across index changes, button close, native dialog cancel/close events, and route unmount. Cleanup must finish even when opening failed or playback is pending.
4. Keep decorative inline media and readiness hooks unchanged. Add a readable active-media failure state without disabling close or navigation.

**Patterns to follow:** `PhotoshootVideo.browser.test.tsx` deferred play promises, replacement ownership, and policy-error fixtures; existing `mediaPresentationUrl`/`mediaPosterUrl` revision handling.

**Execution note:** Prove teardown and late-play ownership with controlled promises before trusting audible browser playback; mocked success alone cannot establish native controls or actual sound.

**Test scenarios:**

1. Open a video directly and enter one from a photo; each has controls, inline mode, a revision-aware playback source/poster, sound enabled, and one play attempt.
2. Covers AE2. Reject play with a policy error; native controls remain visible, there is no unhandled rejection, and a later user play can succeed.
3. Covers AE3. Hold play pending, navigate or close, then resolve it; the outgoing element is paused/released and cannot play again.
4. Rapidly navigate video A → video B → photo, resolving promises out of order; no obsolete result changes the active UI or leaves audio running.
5. Navigate away from a playing video, close using each dismissal path, and unmount the route; each tears down playback and its source.
6. Covers AE5. With real native controls, seek and change volume/mute without gallery navigation; swipe the external gutter to leave and verify playback stops.
7. Trigger media error; show A6's unavailable state while retaining close and adjacent navigation. Reopening or changing item does not inherit stale failure state.
8. Open explicitly before public readiness and with reduced motion enabled; the viewer remains operable while unchanged inline videos still respect their existing gates.

**Verification:** A sound-bearing real clip plays audibly when permitted, falls back when blocked, and stops on every transition. Native control interaction and return-position behavior work in Chromium, WebKit, and mobile Safari.

---

## Verification Contract

Verification is execution work; no tests or runtime probes are part of authoring this plan.

| Gate | Existing entry point | Required proof |
|---|---|---|
| Static typing | `pnpm typecheck` | Server/client props and dialog/media refs typecheck |
| Unit regressions | `pnpm test` | Existing media/revision, candidate, portfolio, and Visual behavior remains intact |
| Chromium browser coverage | `pnpm test:browser` | New viewer behavior plus existing gallery, video, and readiness suites pass |
| WebKit browser coverage | `pnpm test:browser:webkit` | Dialog, touch surfaces, focus, and playback ownership behave in the second engine |
| Production compatibility | `pnpm build` | No client bundle/server import boundary or route build regression |
| Real-route browser QA | Running Next app on `/work/[slug]` | Actual optimized photo requests, fit, media order, no fullscreen request, scroll restoration, and unchanged initial media requests |
| Real mobile playback | Safari on a phone with browser toolbar visible | Audible allowed playback or operable blocked-play fallback, system/native volume behavior, native seek, swipe gutter, and close reachability |

Use existing scripts and configuration; `release:validate` is not defined in `package.json`.
Do not replace native-control checks with synthetic events alone.
Capture narrow evidence of the mixed gallery opening, whole-photo fit, video controls, a successful swipe outside the player, and restored gallery position.
Preserve existing user artifacts in `.vitest-attachments/` and `src/components/__screenshots__/`; any newly generated verification artifacts must be distinguishable from them.

---

## Definition of Done

- U1: Correct item opens and closes with R2/R8/R10 behavior, and existing geometry/readiness delivery contracts remain intact.
- U2: Navigation follows the ordered array and respects KTD4/A1/A5 without visible previous/next controls.
- U3: Native video playback, blocked-play fallback, and asynchronous cleanup satisfy AE1–AE3/AE5 with no lingering audio.
- All R-IDs are verified through the named automated gates and real-browser checks; report any environment-limited check explicitly rather than claiming it passed.
- The implementation contains no abandoned experimental code or unrelated changes, and the pre-existing untracked user artifacts remain preserved.
