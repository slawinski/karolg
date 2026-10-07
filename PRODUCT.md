# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Casting directors and agencies deciding whether to book — need instant credibility, then proof in the work.
- Creative collaborators (photographers, brands, studios) exploring stories and range for joint projects.
- Followers and fans following the person behind the assignments.
- All three confirmed; booking inquiry is the convertible action, exploration depth is the shared success signal.

## Product Purpose

A portfolio site for Carla Gorecka — model, classical Pilates teacher, creative — that turns attention into booking inquiries. Success means a visitor goes deep into the work and then reaches out (email or Instagram).

## Positioning

A body-aware point of view no casting book can copy: fashion and portraiture shot through a classical-Pilates understanding of line, control, and motion. Warsaw-based, working worldwide.

## Operating Context

- Bookers scan fast for credibility, then slow down into stories that prove range.
- Collaborators browse galleries the way they would flip a printed book or contact sheet.
- Content is CMS-managed (Payload): `projects` collection, `media`, `site-settings` global. Routes: `/`, `/work/[slug]`, `/admin`.
- A 5-tier responsive system (mobile/tablet/laptop/desktop/wide) is already built and must keep working through the redesign.

## Capabilities and Constraints

- Redesign has free rein over sections, copy, and layout, with one binding constraint: it must stay brutalist-editorial.
- The five `public/placeholders/*.webp` images are temporary screenshot crops; free to art-direct, treat, or replace — no commissioned photography is guaranteed.
- No invented commercial claims (clients, rates, bookings); demonstration content is authorable, facts are not.

## Brand Commitments

- Name: CARLA GORECKA. Voice: honest, natural, authentic, in motion.
- Binding visual family: brutalist-editorial. The incumbent paper/acid/serif system is evidence of the subject, not authority over the new world.

## Evidence on Hand

- Five photo crops in `public/placeholders/` (instagram-01/02/04/05/06.webp).
- CMS copy model in `src/lib/portfolio.ts` (fallback site + projects) and Payload collections/globals in `src/`.
- Absences future work must not fabricate: client list, testimonials, metrics, booking history.

## Product Principles

1. The work leads from the first viewport; interface recedes.
2. Slow immersive pacing — story-by-story exploration over scanning.
3. Contact is always one reach away, never a hunt.
4. Brutalist honesty: authored assets, never chrome where an image belongs.
5. Motion is material and orchestrated once — and always collapsible under reduced-motion.

## Accessibility & Inclusion

WCAG AA contrast, 44px touch targets, visible keyboard focus, `prefers-reduced-motion` support — all already established, all preserved.
