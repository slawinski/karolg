---
version: 2
slug: "src-app-frontend-page-tsx"
primary_target: "src/app/(frontend)/page.tsx"
related_targets: ["src/app/(frontend)/work/[slug]/page.tsx"]
---

# Surface brief — home (/)

Mode: Experience. The page behaves like a digital fashion editorial rather than a conventional portfolio landing page.

## Audience, job, action

Casting directors and agencies should be able to identify Carla, scan essential facts, and reach out quickly.

Creative collaborators should be able to move from the opening image into immersive project work.

Followers should be able to understand the person and visual point of view without the site becoming biography-heavy.

Primary action: **contact / inquire**.

Secondary action: **explore work**.

## Chosen direction

**Editorial fashion minimalism + Swiss modernism + cinematic neo-luxury.**

The home page should feel like a sequence of composed screens or magazine spreads. Each viewport gets a strong visual idea; interface chrome stays quiet.

This replaces the previous acid-lime, proof-wall, brutalist, and avant-garde directions.

## First viewport

The opening should establish Carla immediately through photography, name, and a small amount of precise metadata.

Preferred composition:

- one dominant portrait
- Carla's name in large high-contrast serif type
- small grotesk navigation and measurements / role metadata
- controlled asymmetry
- dark or warm-neutral editorial palette
- optional partial next/previous image at an edge to imply a wider body of work
- contact remains visible but quiet

Do not use a conventional centered hero with CTA buttons.

## Page rhythm

Suggested sequence:

1. **Identity / opening portrait**
2. **Editorial index / selected work**
3. **Immersive project feature**
4. **Profile / measurements / representation**
5. **Contact**

Sections may blend into each other. They do not need to read as boxed modules.

## Photography

The five existing screenshot crops are development placeholders only. Use them as image material, not as UI references.

Photography should:

- dominate the composition
- be allowed to crop aggressively
- use black-and-white and muted color naturally
- preserve skin texture and photographic character
- avoid decorative duotones, halftones, and artificial poster effects

When original photography arrives, art direction should be reviewed again.

## Typography

- Display / identity: elegant high-contrast serif
- UI / metadata: precise neutral grotesk sans-serif
- very large type may coexist with very small metadata
- no handwritten, marker, stencil, or intentionally distressed type
- no brutalist all-caps wall-of-type treatment

## Interaction and motion

Motion is restrained:

- subtle crossfade
- controlled image reveal
- slow horizontal gallery movement
- minor crop/parallax shift
- smooth project transitions

Avoid:

- kinetic typography
- novelty cursor effects
- scroll hijacking
- flashy WebGL
- constant animation

Reduced-motion mode should remain complete and intentional.

## Responsive constraints

Maintain the 5-tier system:

- mobile ≤640
- tablet 641–1024
- laptop 1025–1440
- desktop base
- wide ≥1720

Responsive behavior must preserve the composition, not merely stack desktop columns.

On mobile:

- one dominant image at a time
- large type remains large
- metadata simplifies but stays accessible
- horizontal sequences become swipeable where appropriate
- no hover dependency
- 44px touch targets
- AA contrast
- visible focus states

## CMS / technical constraints

Payload data architecture remains intact:

- site-settings
- projects
- media
- users

Public routes remain:

- /
- /work/[slug]
- /admin

The redesign should stay performance-first: Server Components where possible, optimized images, restrained JavaScript, and no animation framework unless clearly justified.

## Design acceptance test

The result should feel closer to a luxury fashion editorial, agency book, or campaign microsite than to a normal portfolio template.

If a section looks like a generic card grid, SaaS landing page, brutalist experiment, or art-school typography exercise, redesign it.
