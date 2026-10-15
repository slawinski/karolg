# Carla Gorecka portfolio

A responsive fashion and movement portfolio built with **Next.js 16** and **Payload CMS 3**.

Payload is the source of truth for photoshoots and mixed image/video media. The homepage creates live masonry slots for every photoshoot and can rotate each slot through other ready media from the same shoot.

## Local development

~~~bash
cp .env.example .env
# Replace PAYLOAD_SECRET with at least 32 random characters.
pnpm install
pnpm exec payload migrate
pnpm dev
~~~

Development schema pushing is disabled; local, CI, and production databases use
the checked-in migrations. If Payload reports that the database was modified by
development-mode schema pushes and warns that migration will lose data, answer
**No** and back up the database before reconciling its migration state.

Open:

- Portfolio: http://localhost:3000
- Payload admin: http://localhost:3000/admin

Payload stores originals and generated files in the root `media/` directory. SQLite data remains in `data/` by default.

## CMS workflow

1. Create a **Photoshoot**.
2. Optionally create one or more **Photographers**.
3. Assign the Photoshoot's optional Photographers from its edit screen or directly in the Photoshoots list.
4. Upload an image or video in **Media** and assign its Photoshoot.

Media inherit photographer attribution from their Photoshoot. The provenance is stored in the CMS and static snapshot but is not rendered as a public credit.

Images retain Payload's existing card/hero image generation. On a new or replaced image, the server also derives a deterministic transition color after EXIF orientation and alpha flattening. SVG uploads are not accepted. Existing images remain valid while this value is null.

Accepted videos are QuickTime/MOV, MP4/M4V, and WebM. The original upload is retained privately for administrators and processing, and a new video starts as `pending`. Anonymous API responses omit its original filename and URL. The `media-processing` worker validates bounded stream and container metadata, creates an H.264/AAC MP4 and JPEG poster with preemptive duration, output-size, and thread limits, derives the poster transition color, then atomically publishes the matching revision. A replacement keeps its last published playback and poster available while the new revision is pending or failed. First-time failures remain excluded from the public portfolio.

Generated files live under `media/generated/<media-id>/r<revision>/`. Runtime clients use controlled `GET`/`HEAD` endpoints at `/api/media/:id/playback` and `/api/media/:id/poster`; playback supports a single HTTP byte range. Static snapshots rewrite those generated filenames to `/media/...` and copy only referenced image originals and video derivatives. Video originals are never included in the public export.

The photoshoot page renders ready videos with controls. Homepage videos are muted, looping, and control-free during normal motion; they only play while current, at least 10% visible, and the document is visible. Reduced-motion mode disables gallery swaps, rail motion, and autoplay and exposes manual video controls. Video controls are never nested inside the photoshoot link.

## FFmpeg and workers

Video processing requires `ffmpeg` and `ffprobe` with `libx264`. The commands default to `PATH`; override them when needed:

~~~env
FFMPEG_PATH=/absolute/path/to/ffmpeg
FFPROBE_PATH=/absolute/path/to/ffprobe
~~~

The defaults accept up to 10 minutes, 8192 pixels per dimension, 33.5 megapixels, 60fps, and eight streams. FFmpeg uses two threads, each generated output is capped at 512 MiB, and processing stops when `media/generated` reaches its 20 GiB quota. Override these limits with the `VIDEO_*` settings in `.env.example` only after checking host capacity.

The app config auto-runs one job at a time from the SQLite-safe `media-processing` queue. Jobs are exclusive per media ID and newer pending revisions supersede obsolete pending work. A one-shot worker is also available:

~~~bash
pnpm media:worker
~~~

Retry a single record with authenticated `POST /api/media/:id/reprocess`, or use the resumable CLI. CLI runs are dry by default:

~~~bash
pnpm media:reprocess -- --kind=video --failed-only
pnpm media:reprocess -- --kind=video --failed-only --apply
pnpm media:reprocess -- --after-id=120 --limit=50 --apply
pnpm media:backfill-colors
pnpm media:backfill-colors -- --apply
~~~

The command prints the last processed ID for `--after-id` resumption. Do not run `--apply` until database and media backups exist.

## Database schema

The checked-in SQLite migrations bootstrap the full schema on an empty database or conditionally upgrade the legacy portfolio schema with photographers, media metadata, relationships, and Payload jobs tables. Existing media rows default to `image` / `ready`. The photographer migration promotes each Photoshoot's matching nonempty per-media assignment; previously unassigned media then inherit that Photoshoot attribution. It stops with identified records if one Photoshoot contains conflicting nonempty attribution sets.

~~~bash
pnpm exec payload migrate
~~~

Run pending migrations before starting an updated application. Automatic development schema pushing is disabled so that it cannot be mixed with this migration workflow. Generate future migrations against a disposable database first. Never use migration generation or test processing against production/local portfolio data.

## Homepage behavior

There is no Featured flag. The homepage automatically creates four or five initial slots for larger photoshoots and keeps the full usable media pool available for later swaps. Slots are interleaved across photoshoots. One global scheduler preloads the next image or waits for video readiness, performs the existing 1.5-second outgoing → persisted color → incoming transition, and preserves the existing idle cadence. Scheduling pauses offscreen, in hidden tabs, and under reduced motion.

Every card retains a separate accessible link to `/work/[photoshoot-slug]`. The photoshoot page renders all assigned usable images and ready videos; an empty assignment still renders the page shell.

## Static Cloudflare Drop export

~~~bash
pnpm build:drop
~~~

`build:drop` snapshots Site Settings, Photoshoots, Photographers, and Media. It preserves image-original and video playback/poster metadata, rewrites each public file URL to `/media/<filename>`, and creates all photoshoot routes. After Next creates `out/`, the script builds an exact referenced-asset manifest and copies only those files from root `media/` into `out/media/`; private video originals are excluded. It fails clearly if a referenced file—or a ready video's required playback/poster—is missing. Its `finally` block restores the CMS routes and runtime portfolio module even when export fails.

Next static export only deploys files present in `out`; source `media/` files are not implicitly included. Drag `out/` into Cloudflare Drop.

## Production persistence

Required environment variables:

~~~env
PAYLOAD_SECRET=<long-random-secret>
DATABASE_URL=file:./data/karolg.db
NEXT_PUBLIC_SITE_URL=https://your-domain.example
~~~

`PAYLOAD_SECRET` has no built-in fallback and startup fails unless it is a non-placeholder value of at least 32 characters. Upload and processing bounds can be tuned with the `UPLOAD_MAX_*`, `UPLOAD_TIMEOUT_MS`, `VIDEO_MAX_*`, `VIDEO_THREADS`, and `VIDEO_GENERATED_QUOTA_BYTES` variables documented in `.env.example`. Large uploads are streamed through `data/upload-tmp` instead of being held entirely in memory. Keep the request limit at least as large as the per-file limit.

For a persistent single-server/container deployment, mount both `./data` and root `./media`. The jobs worker must share those volumes. For serverless or multi-instance production, move both database and media storage to persistent shared services before enabling video processing.
