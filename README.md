# Carla Gorecka portfolio

A fast, responsive fashion / movement portfolio built with **Next.js 16** and **Payload CMS 3**.

The current visual direction is **editorial fashion minimalism + cinematic neo-luxury**: image-first, highly art-directed, typographically precise, and intentionally less like a conventional website.

The experience should feel closer to a sequence of interactive fashion-editorial spreads than to a standard header → hero → cards → footer portfolio.

## Design direction

Core characteristics:

- high-fashion editorial composition
- cinematic, image-led layouts
- controlled asymmetry rather than rigid grid-display aesthetics
- high-contrast serif display type
- neutral grotesk sans-serif for UI and metadata
- extreme but controlled hierarchy: very large identity type + very small precise information
- monochrome, charcoal, warm-white, and natural photographic tones
- generous negative space
- thin rules, numbering, measurements, and editorial indices
- full-viewport or near-full-viewport scenes
- restrained, cinematic motion

Explicitly **not** part of the direction:

- acid-lime branding
- brutalism / neo-brutalism
- Swiss / International Style as a visual direction
- avant-garde typography as spectacle
- handwritten/scribbled graphics
- proof-wall, halftone, or misregistration effects
- deliberately awkward layouts
- loud color clashes
- gimmick-first interactions

See DESIGN.md for the full visual system and PRODUCT.md for product principles.

## Stack

- Next.js App Router / React Server Components
- Payload CMS 3
- SQLite via @payloadcms/db-sqlite
- next/image + Sharp for responsive image delivery
- CSS-first layout and interaction; client JavaScript should stay minimal

## Local development

~~~bash
cp .env.example .env
pnpm install
pnpm dev
~~~

Open:

- Portfolio: http://localhost:3000
- Payload admin: http://localhost:3000/admin

On the first admin visit Payload will guide you through creating the first user.

## CMS model

- **Site settings** — hero copy, roles, locations, profile facts, Instagram/email and hero image.
- **Projects** — editorial/campaign/personal/movement/portrait projects with a cover, gallery, featured flag and ordering.
- **Media** — image uploads with generated card and hero sizes.
- **Users** — Payload administrators.

## Temporary photo placeholders

The public site currently uses a small set of WebP crops taken from the Instagram screenshot supplied during the design process.

They are intentionally low-resolution **development placeholders only** and live in public/placeholders/.

Once original photographs are available, upload them to Payload Media and assign them to **Site Settings → Hero Media** and the relevant **Projects → Cover / Gallery** fields. CMS images automatically take precedence over the screenshot placeholders.

The final art direction should be reviewed against the full-resolution originals; photography is a structural part of the design, not interchangeable card content.

## Experience structure

The intended sequence is approximately:

1. opening portrait / identity
2. editorial index / selected work
3. immersive project spreads
4. profile / measurements / representation
5. contact

This is guidance rather than a mandatory component list. Sections may merge into each other as long as the information remains clear.

## Performance decisions

- Server Components by default; the public site should ship very little custom client JavaScript.
- Five-minute ISR (revalidate = 300) for public pages.
- Optimized responsive image delivery through Next Image.
- Motion should be CSS-native or otherwise lightweight unless a richer implementation is strongly justified.
- Reduced-motion support and semantic navigation are required.
- Visual richness must not come at the cost of sluggish interaction or unstable layout.

## Responsive philosophy

The project uses five responsive tiers:

- mobile ≤640
- tablet 641–1024
- laptop 1025–1440
- desktop base
- wide ≥1720

Responsive design should preserve the editorial composition rather than simply stack desktop modules. Mobile should still feel deliberately art-directed.

## Production

Required environment variables:

~~~env
PAYLOAD_SECRET=<long-random-secret>
DATABASE_URL=file:./data/karolg.db
NEXT_PUBLIC_SITE_URL=https://your-domain.example
~~~

SQLite and local media are a good fit for a persistent single-server/container deployment. Mount both ./data and ./public/media as persistent volumes. For serverless/multi-instance hosting, move the database to Postgres and media to object storage before launch.


## Cloudflare Drop preview

This branch can be exported as a fully static preview for [Cloudflare Drop](https://www.cloudflare.com/drop/):

~~~bash
pnpm install
pnpm build:drop
~~~

The command creates an `out/` directory containing plain HTML, CSS, JavaScript and image assets. Drag the **contents of `out/`** (or the `out/` folder itself) into Cloudflare Drop.

Static preview mode intentionally uses the repository fallback content and placeholder images. Payload Admin and the Payload API are excluded from the export; normal `pnpm dev` / `pnpm build` behavior is unchanged and still uses Payload CMS.
