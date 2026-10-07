# Design — THE PROOF WALL

A printer's galley meets the Factory drying rack. Ink, pressure, misregistration —
brutalist-editorial pushed from polite paper into the print shop after hours.

## Color strategy: Committed

One saturated ink carries whole regions. Light ground picked from the use scene:
proofs are judged under gallery daylight against paper, so the ground is paper.

- `--paper`: #f4f1e6 (proofing stock, warm-neutral)
- `--ink`: #141311 (body ink, off-black — never pure #000)
- `--signal`: #e8380d (vermilion selection ink; marks the active pull, selects, links)
- `--signal-deep`: #b32a08 (small mono uses — keeps small text AA)
- `--ink-soft`: #4a463c (secondary text, warm tint of the surface hue — never gray)
- `--paper-2`: #e7e2d2 (mount board for quiet zones)
- Secondary text on colored ground is tinted from that hue, never gray.

## Type

- Chase/display: Anton 400 in caps via `next/font/google` (`--chase` variable;
  fallback `Arial Narrow, Helvetica Neue, sans-serif`). Tracking -0.02em,
  never below -0.04em. Display type verified against 320px overflow.
- Text: workhorse grotesque, sentence case, 65–75ch measure.
- Labels/measurements (edition marks, folio numbers, registration notes):
  `ui-monospace` stack — used for data and measurement, which is its legitimate
  job, not a costume.
- No gradient text. Emphasis = weight or size. No eyebrow on every section:
  edition marks (`ED. 01/04`, folio numbers) are the recurring label system
  because the sequence carries information the reader needs.

## Material and composition

- Furniture bars: 2–3px ink rules lock regions (the chase). Borders declare
  elevation alone — no ghost cards, no soft shadows under bordered panels.
- Halftone dot screen (`radial-gradient` dots) is allowed as a printing artifact
  of this world; fractal-noise grain is not.
- Registration crosses in margins are the world's own grammar (simple geometric
  marks), not decoration.
- Home scroll = walking the drying rack: stories are editions, keeper print
  large with variant pulls and selects beside it. Rack grid reflows from
  multi-up sheets to single pulls on small screens.
- Radius: all-sharp (0). Pills only for small controls, if any.

## Motion (one authored moment)

The squeegee-wipe proof reveal, scroll-driven (`clip-path`, exponential
ease-out, content visible by default). Everything else is still. Hovering a
frame shifts its ink layers a hair off-register (printed shudder); active
selection swaps which ink sits on top. Reduced motion locks all layers in
perfect registration and makes reveals instant. No scroll listeners, no
`window.scrollY` in state — CSS scroll-driven animations only.

## States and interaction

- Selects carry the signal-red pull; links underline on hover (hover-capable
  only) with 44px targets on coarse pointers.
- Focus-visible: 2px ink outlines (signal on dark ground), never removed.
- Loading/empty/error: Payload-driven regions keep skeletal shapes matching
  final layout; CMS failures fall back to fallback content, never to blank chrome.

## Responsive rules

The 5-tier system survives the new world: mobile ≤640 / tablet 641–1024 /
laptop 1025–1440 / desktop base / wide ≥1720. Small screens fan one edition per
viewport; the edition grid never wraps mid-thought. Touch never depends on
hover. Type is run at every breakpoint until nothing overflows.
