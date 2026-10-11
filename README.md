# Carla Gorecka portfolio

A fast, responsive fashion / movement portfolio built with **Next.js 16** and **Payload CMS 3**.

The ViV variant uses a CMS-driven masonry portfolio. Media is organized into photoshoots, individual images can be featured, and the homepage links featured images into complete photoshoot galleries.

## Local development

~~~bash
cp .env.example .env
pnpm install
pnpm dev
~~~

Open:

- Portfolio: http://localhost:3000
- Payload admin: http://localhost:3000/admin

## Photoshoots and featured images

Payload is the single source of truth for photography.

In the admin:

1. Create a **Photoshoot**.
2. Open each image in **Media** and assign its **Photoshoot**.
3. Check **Featured on homepage** for images that should appear on the homepage.
4. Save.

The homepage queries only featured Media items. A featured image is rendered in the masonry wall and links to:

`/work/[photoshoot-slug]`

The photoshoot page then queries every Media item assigned to that photoshoot and renders the complete masonry gallery.

Nothing in the frontend names individual image files. Adding, removing, featuring, or moving images between photoshoots is entirely CMS-driven.

## CMS model

- **Site settings** — identity copy, roles, locations, profile facts, Instagram/email and optional hero media.
- **Photoshoots** — title, URL slug, description, year and ordering.
- **Media** — uploaded image, alt text, optional caption, Photoshoot relationship and Featured flag.
- **Users** — Payload administrators.

Internally the Photoshoots collection retains the historical Payload slug `projects` so existing SQLite records remain compatible; the admin UI and frontend treat those records as photoshoots.

## Cloudflare Drop preview

The static preview snapshots the current Payload data instead of falling back to repository images.

~~~bash
pnpm install
pnpm build:drop
~~~

`build:drop` snapshots Site Settings, Photoshoots and Media, including each image's Photoshoot relationship and Featured flag. It rewrites media URLs to static `/media/...` paths and creates all `/work/[photoshoot-slug]` routes before exporting to `out/`.

Payload uploads in `public/media/` are copied into `out/media/` by Next's static export. Drag `out/` into Cloudflare Drop.

The normal `pnpm dev` and `pnpm build` commands remain fully CMS-backed.

## Production

Required environment variables:

~~~env
PAYLOAD_SECRET=<long-random-secret>
DATABASE_URL=file:./data/karolg.db
NEXT_PUBLIC_SITE_URL=https://your-domain.example
~~~

For a persistent single-server/container deployment, mount both `./data` and `./public/media`. For serverless or multi-instance production, move the database and media to persistent external services.
