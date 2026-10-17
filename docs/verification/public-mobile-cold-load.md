# Public mobile cold-load verification

Plan: `docs/plans/2026-10-18-0032-fix-public-mobile-cold-load-plan.md`.
Baseline source: `6944671`. Native host owns checks and commits; no production CMS writes.

## U1 — baseline

An isolated copy at `/var/folders/zl/fkgnlthd363175f4ffymzcjh0000gn/T/opencode/public-cold-load`
uses a SQLite backup and copied media, disabled job autorun, port 3110. User servers
and `.env` were not modified. Node 24.8.0, pnpm 10.34.6, Next 16.4.0,
React 19.2.6, Payload 3.90.2; successful production Turbopack build.

`scripts/measure-public-cold-load.mjs` uses Chromium 156.0.8078.4,
390×844 DPR2, 4× CPU, 150ms latency, 1.6Mbps download / 750Kbps upload.
This is a separate observed trace experiment, **not** Moto G Power simulated
Lighthouse or its TBT/Speed Index. Long-task blocking is not Lighthouse TBT.
Three cold-browser and three same-context warm repeats per route; optimizer
cache was not purged. Opening identities and complete resource/navigation
entries are retained in the raw JSON.

The copied database has 60 legacy images (482,464,112 original bytes) with
revision zero. Initial real-data trials did not finish critical images inside
12 seconds and subsequent navigation encountered ERR_ABORTED/NETWORK_CHANGED;
those are unsuccessful measurement attempts, not fast LCP evidence.
For matched controlled measurements only, image revisions in the **copied**
database were set to 1, enabling the existing quality-75 optimizer policy.
Real data stays unchanged. No photography quality setting was changed.

Raw evidence (temporary, not committed large artifacts):
`/var/folders/zl/fkgnlthd363175f4ffymzcjh0000gn/T/opencode/cold-load-before.json`
and `cold-load-before-controlled.json`. The latter contains all 30 completed samples.

| Route | Cold LCP median (range), ms | Cold blocking range, ms | CLS |
|---|---:|---:|---:|
| `/` randomized | 748 (720–10884) | 28–59 | 0–0.01123 cold; warm up to 0.03075 |
| `/work/A` | 712 (712–716) | 30–31 | 0 |
| `/work/B` | 732 (724–732) | 27–32 | 0 |
| `/work/c` | 724 (708–748) | 29–32 | 0 |
| `/work/d` video-first | 2500 (2496–2512) | 29–30 | 0 |

Homepage variability and nonzero shifts require investigation, not averaging
away. The project classes in this database are three still galleries and a
two-video gallery; there is no long-title/empty real page.

### Attribution

- Documents return 200; warm local request TTFB was about 22ms independently.
  Resource JSON separates DNS/connect/TLS, redirect, request/response and download.
  The reported 9560ms audit estimate is not a measured TTFB here.
- Baseline video sources acquire inside a 200%-margin band before critical
  images finish. Pausing playback alone does not prevent acquisition.
- Legacy originals dominate transfer in real-data attempts. Revision-less
  optimization bypass is an existing freshness contract, not changed for scores.
- **Reproduced delivery defect:** `/robots.txt` returns 404 on the isolated
  production build despite `robots.ts` existing. Build route table omits it.
  Independent requests and every measured run agree. U5 will inspect this.
- No evidence yet attributes the live timeout to a proxy, host, or leaked admin
  bundle. Public-origin causes remain unknown pending equivalent live evidence.
