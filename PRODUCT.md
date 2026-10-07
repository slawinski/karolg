# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Casting directors and agencies deciding whether to book — need instant credibility, then proof in the work.
- Creative collaborators (photographers, brands, studios) exploring stories and range for joint projects.
- Followers and fans following the person behind the assignments.
- Booking inquiry is the convertible action; exploration depth is the shared success signal.

## Product Purpose

A portfolio site for Carla Gorecka — model, classical Pilates teacher, creative — that turns attention into booking inquiries while presenting her work with the depth and confidence of a fashion editorial.

Success means a visitor understands who Carla is, sees enough strong work to remember her, explores one or more stories, and can contact her without friction.

## Positioning

A body-aware point of view no generic casting book can copy: fashion and portraiture informed by a classical-Pilates understanding of line, control, posture, and movement. Warsaw-based, working internationally.

## Operating Context

- Bookers scan quickly for identity, measurements, representation, and visual credibility.
- Collaborators browse more slowly, treating the site like a digital editorial or lookbook.
- The site should support both behaviors without splitting into separate experiences.
- Content is CMS-managed with Payload: projects, media, site-settings; routes include /, /work/[slug], and /admin.
- The existing 5-tier responsive system (mobile/tablet/laptop/desktop/wide) must survive the redesign.

## Product Experience

The site is intentionally **less like a normal website**.

Rather than a standard landing-page stack, it should feel like a sequence of composed editorial screens:

1. identity / opening portrait
2. portfolio or editorial index
3. immersive project spreads
4. profile / measurements / representation
5. contact

The interaction model may include horizontal galleries or cinematic transitions where useful, but the information architecture must stay clear.

## Visual Direction

The binding visual family is:

**editorial fashion minimalism + cinematic neo-luxury**

This replaces the previous acid-lime, brutalist, avant-garde, and Swiss-modernist directions.

Key characteristics:

- art-directed fashion-magazine composition
- image-first layouts
- controlled asymmetry rather than rigid grid-display aesthetics
- high-contrast serif display typography
- neutral grotesk sans-serif UI and metadata
- very large type paired with very small technical information
- monochrome, charcoal, warm-white, and natural photographic tones
- generous negative space
- thin rules, numbering, measurements, and editorial indices
- full-viewport or near-full-viewport compositions
- subtle, restrained motion

Explicitly excluded:

- acid-lime as a signature color
- brutalism / neo-brutalism
- Swiss / International Style as a named visual direction
- avant-garde typography as spectacle
- handwritten/scribbled graphics
- proof-wall, halftone, misregistration, or print-shop visual metaphors
- intentionally awkward layouts
- loud color clashes
- gimmick-first interaction

## Capabilities and Constraints

- Redesign has free rein over sections, copy, and layout within the visual direction above.
- The five public/placeholders/*.webp images are temporary screenshot crops only; they may be used to establish composition until original photography arrives.
- Final photography should come from original full-resolution assets managed through Payload.
- No invented commercial claims: do not fabricate clients, campaigns, agencies, rates, testimonials, metrics, awards, or booking history.
- Performance remains a product requirement: the experience should feel rich without becoming JavaScript-heavy.

## Brand Commitments

- Name: CARLA GORECKA.
- Voice: honest, natural, direct, calm, in motion.
- The person and photography are always more important than the interface.
- The Pilates / movement dimension should distinguish the work without turning the portfolio into a fitness website.

## Evidence on Hand

- Five temporary photo crops in public/placeholders/.
- CMS copy model in src/lib/portfolio.ts.
- Payload collections and globals in src/.
- Known public identity and visual material from the supplied Instagram screenshot.
- Unknowns that must not be fabricated: commercial client list, testimonials, rates, booking history, formal campaign credits.

## Product Principles

1. **The work leads from the first viewport.** Interface is quiet and secondary.
2. **Every major screen is composed.** Think editorial spread, not stacked components.
3. **Photography is layout.** Images are not merely content inside cards.
4. **Precision over novelty.** Editorial composition and typographic discipline carry the experience.
5. **Luxury through restraint.** Calm spacing, strong imagery, and typography do more than decorative effects.
6. **Fast scan, deep browse.** A booker gets facts quickly; a collaborator can linger.
7. **Contact is always close.** Never make booking or inquiry a hunt.
8. **Motion is cinematic, not performative.** Use it sparingly and respect reduced motion.
9. **Mobile gets its own composition.** Do not simply collapse desktop.
10. **Performance is part of the aesthetic.** No visual idea is worth a sluggish portfolio.

## Accessibility & Inclusion

WCAG AA contrast for functional text, 44px touch targets, visible keyboard focus, semantic navigation, meaningful image alt text, and prefers-reduced-motion support are required across the experience.
