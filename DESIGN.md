# Design — Editorial Fashion System

The site should feel like a high-fashion editorial spread that happens to be interactive.

The visual direction is **editorial fashion minimalism + cinematic neo-luxury**. It is deliberately less like a conventional portfolio website and more like a sequence of composed magazine spreads, campaign artboards, title cards, and image-led scenes.

This direction explicitly replaces the earlier acid-lime, brutalist, avant-garde, and Swiss-modernist references.

## Design intent

The work leads. Interface recedes.

Each major viewport should feel intentionally art-directed rather than assembled from familiar web components. The visitor should experience a sequence of composed screens:

1. opening portrait / identity
2. editorial index or portfolio navigation
3. immersive project spreads
4. profile / measurements / representation
5. contact

The site may scroll normally, horizontally, or use composed transitions where appropriate, but it should never feel like a generic header → hero → cards → footer template.

## Visual family

### Keep

- fashion-magazine art direction
- cinematic image-first layouts
- high-contrast editorial serif typography
- restrained grotesk sans-serif for UI and metadata
- large shifts in typographic scale: very large identity text + very small precise metadata
- elegant, controlled asymmetry
- full-bleed or near-full-bleed photography
- generous negative space
- thin rules, indices, measurements, folio numbers, and quiet technical labels
- monochrome and muted photography, with natural skin tones allowed to carry warmth
- subtle overlapping of type and image when it improves composition
- screens that read as deliberate spreads rather than stacked modules
- typographic precision without turning the composition into a rigid modernist grid

### Drop

- acid-lime as a signature color
- brutalism / neo-brutalism
- Swiss / International Style as a visual reference
- avant-garde-for-its-own-sake
- handwritten or scribbled typography
- halftone, print-shop, proof-wall, registration-mark, or misprint metaphors
- loud clashes, intentionally awkward type collisions, and hostile spacing
- heavy graphic gimmicks
- novelty UI that distracts from the person and photography
- conventional card grids when an editorial composition can do the job better

## Color strategy

The default palette should be quiet and photographic:

- --black: #0b0b0a
- --charcoal: #171715
- --warm-white: #f3f0e8
- --soft-white: #e8e4dc
- --mid: #8a857c
- --line: a low-contrast tint derived from the current surface

Photography may introduce warm skin tones, brown, cream, black, red clothing, and other natural image colors.

If an accent is used, it should be restrained and contextual — for example dusty burgundy, muted bronze, or warm beige. The site does **not** require a brand accent color.

Dark and light editorial spreads may alternate. The transition between them should feel intentional rather than decorative.

## Typography

### Display

Use an elegant high-contrast serif for:

- Carla Gorecka identity
- project titles
- editorial statements
- large section transitions

Characteristics:

- refined, fashion-editorial, not ornamental
- large optical scale
- tight but controlled spacing
- allowed to overlap photography where legibility survives
- never used as a shock device

### Interface / metadata

Use a neutral grotesk sans-serif for:

- navigation
- measurements
- representation
- project indices
- labels
- credits
- contact information

Small text should feel precise and calm, with deliberate tracking. Metadata should resemble editorial production notes or agency information, not developer-console UI.

Avoid handwritten fonts, decorative display systems, and rigid modernist typography used as an aesthetic statement.

## Composition

The layout should feel composed rather than visibly grid-driven.

Preferred patterns:

- one dominant image with a narrow secondary image at the edge
- full-height portrait with tiny metadata floating in negative space
- asymmetrical two- or three-column editorial spreads
- oversized serif identity crossing image boundaries
- horizontal portfolio reels with partial adjacent frames visible
- bottom or side strips of selected works
- measurements aligned like magazine or agency data
- quiet overlays on photography
- alternating image-led and type-led scenes
- irregular but deliberate image proportions that feel art-directed rather than system-generated

Photography is part of the composition, not content placed inside a card.

Cards, rounded panels, badges, floating glass surfaces, and conventional dashboard-like components should be avoided unless functionally necessary.

## Image treatment

Photography should remain the emotional center of the experience.

- prefer original crops over decorative masks
- black-and-white may be used heavily
- color imagery should remain natural and muted
- preserve skin texture and photographic grain
- avoid artificial duotones and aggressive color grading
- use editorial crops: close portraits, off-center framing, edge crops, and partial bodies are welcome
- let images touch viewport edges when composition benefits

The temporary Instagram screenshot crops are development placeholders only. Final art direction should be revisited when full-resolution originals are available.

## Motion

Motion should be cinematic and restrained.

Appropriate:

- subtle crossfades
- measured image reveals
- slow horizontal movement between portfolio frames
- understated text entrance
- small parallax or crop movement where it adds depth
- smooth project-to-project transitions

Avoid:

- bouncy easing
- constant motion
- novelty cursor effects
- scroll hijacking
- flashy WebGL
- aggressive kinetic typography
- motion that competes with the photography

The site must remain fully understandable with prefers-reduced-motion enabled.

## Interaction

Navigation should be quiet, obvious, and secondary to the work.

- contact is always easy to find
- project navigation may feel like an editorial index
- horizontal galleries must still work naturally on touch
- no interaction may depend on hover
- links and controls must retain visible focus states
- minimum touch targets: 44px
- no hidden navigation puzzles

## Responsive composition

The existing 5-tier responsive model remains:

- mobile ≤640
- tablet 641–1024
- laptop 1025–1440
- desktop base
- wide ≥1720

Responsive design is not just stacking desktop blocks vertically. Each breakpoint should preserve the editorial idea of the spread.

On small screens:

- prioritize one strong image at a time
- preserve generous typography
- simplify secondary metadata without deleting important facts
- maintain intentional crop and rhythm
- horizontal reels may become swipeable sequences
- avoid cramped multi-column arrangements

The mobile result should still feel like a designed fashion publication, not a collapsed desktop site.

## Accessibility

- WCAG AA contrast for functional text
- 44px touch targets
- visible keyboard focus
- semantic navigation
- prefers-reduced-motion
- meaningful image alt text
- avoid placing essential text where photography can make it unreadable

## Design test

A screen belongs in this system if it could plausibly exist as:

- a luxury fashion editorial spread
- a modern model agency book
- a campaign title card
- an art-directed portfolio page

It does not belong if it primarily reads as:

- a startup landing page
- a component-library demo
- a brutalist experiment
- a Swiss-modernist poster translated too literally to the web
- an art-school typography exercise
- a conventional portfolio template
