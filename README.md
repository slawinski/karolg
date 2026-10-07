# Carla Gorecka portfolio

A fast, responsive fashion / movement portfolio built with **Next.js 16** and **Payload CMS 3**. The visual direction follows the acid-lime editorial prototype: oversized typography, a magazine-like grid, contact-sheet imagery and a single vivid accent color.

## Stack

- Next.js App Router / React Server Components
- Payload CMS 3
- SQLite via `@payloadcms/db-sqlite`
- `next/image` + Sharp for responsive image delivery
- CSS only for layout and interaction; no client-side UI library or animation runtime

## Local development

```bash
cp .env.example .env
pnpm install
pnpm dev
```

Open:

- Portfolio: `http://localhost:3000`
- Payload admin: `http://localhost:3000/admin`

On the first admin visit Payload will guide you through creating the first user.

## CMS model

- **Site settings** — hero copy, roles, locations, profile facts, Instagram/email and hero image.
- **Projects** — editorial/campaign/personal/movement/portrait projects with a cover, gallery, featured flag and ordering.
- **Media** — image uploads with generated `card` and `hero` sizes.
- **Users** — Payload administrators.

## Temporary photo placeholders

The public site currently uses a small set of WebP crops taken from the Instagram screenshot supplied during the design process. They are intentionally low-resolution **development placeholders only** and live in `public/placeholders/`.

Once original photographs are available, upload them to Payload Media and assign them to **Site Settings → Hero Media** and the relevant **Projects → Cover / Gallery** fields. CMS images automatically take precedence over the screenshot placeholders.

## Performance decisions

- Server Components by default; the public site ships almost no custom client JavaScript.
- Five-minute ISR (`revalidate = 300`) for public pages.
- Local system fonts: zero render-blocking font requests.
- Responsive AVIF/WebP delivery via Next Image.
- CSS layout/hover effects rather than runtime animation libraries.
- Reduced-motion support and semantic navigation.

## Production

Required environment variables:

```env
PAYLOAD_SECRET=<long-random-secret>
DATABASE_URL=file:./data/karolg.db
NEXT_PUBLIC_SITE_URL=https://your-domain.example
```

SQLite and local media are a good fit for a persistent single-server/container deployment. Mount both `./data` and `./public/media` as persistent volumes. For serverless/multi-instance hosting, move the database to Postgres and media to object storage before launch.
