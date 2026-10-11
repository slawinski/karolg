# Carla Gorecka portfolio

A fast, responsive fashion / movement portfolio built with **Next.js 16** and **Payload CMS 3**.

The ViV variant uses an image-first masonry portfolio driven directly by Payload Media.

## Local development

~~~bash
cp .env.example .env
pnpm install
pnpm dev
~~~

Open:

- Portfolio: http://localhost:3000
- Payload admin: http://localhost:3000/admin

## CMS-first media

Portfolio photography comes **only from Payload CMS**.

The homepage queries the `media` collection and renders every returned document as the masonry wall. There is no checked-in image manifest, no per-file import list, and no local `sesja` fallback.

To add or remove portfolio images, use **Media** in `/admin`, then refresh the portfolio. Alt text is used for accessibility and the optional caption is shown below the image.

Projects remain available for curated project pages. A project page renders the images assigned to its **Gallery** field; those are Payload Media relationships as well.

## CMS model

- **Site settings** — identity copy, roles, locations, profile facts, Instagram/email and optional hero media.
- **Projects** — optional curated stories with a cover and gallery backed by Media.
- **Media** — the single source of truth for portfolio photography.
- **Users** — Payload administrators.

## Cloudflare Drop preview

The static preview snapshots the current Payload data instead of falling back to repository images.

~~~bash
pnpm install
pnpm build:drop
~~~

`build:drop` reads Site Settings, Projects and Media from Payload, converts media URLs to static `/media/...` paths, builds all project routes from that snapshot, excludes the Payload admin/API, and writes the static site to `out/`.

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
