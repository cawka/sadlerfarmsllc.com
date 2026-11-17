# sadlerfarmsllc.com

Static landing page for **Sadler Farms LLC** (Alabama), built with
[Astro](https://astro.build/) and deployed to GitHub Pages via GitHub Actions.

## Local preview

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static site in dist/
```

## Structure

| Path | Purpose |
|------|---------|
| `src/pages/index.astro` | The landing page content |
| `src/pages/developers.astro` | Redirect from the old /developers/ page |
| `src/layouts/Default.astro` | Page shell (head, SEO/structured data, footer, scripts) |
| `src/components/` | Before/after slider, lightbox, inline SVGs |
| `src/data/developer.json` | Site facts and plan/survey sheets (shared with `tools/build-pdfs.py`) |
| `src/styles/style.scss` | Styles |
| `src/scripts/site.js` | HLS streaming player (hls.js), sound/quality controls, sliders, lightbox |
| `src/media.ts` | `m('photos/41-800.webp')`: hashed URL for an image in `assets/media/` |
| `assets/media/` | Web-sized photos, concept images and plans (WebP), generated — don't edit by hand |
| `public/` | Served as-is at fixed URLs: HLS video, PDF downloads, favicon, OG image, CNAME |
| `tools/build-media.sh` | Regenerates `assets/media/` and `public/assets/media/video/` from the raw files |
| `.github/workflows/deploy.yml` | Build + deploy workflow |

Images, the stylesheet and the script get content-hashed file names
(`/_astro/<name>.<hash>.webp`), so a replaced file always gets a new URL and
browsers never show a stale copy. Videos and PDFs keep fixed URLs.

## Media

The raw drone deliverables (78 photos, 22 4K clips, ~8 GB) live locally in
`assets/photos/` and `assets/videos/` and are **gitignored**. Source:
the client's Google Drive folder (`gdown --folder <url> -O assets/videos`).

`tools/build-media.sh [photos|film|loops|all]` produces what the site serves:

* photos → `assets/media/photos/<n>-{800,1600}.webp`
* film (hero montage with soundtrack) and silent section loops →
  `public/assets/media/video/<name>/master.m3u8` — adaptive HLS in 360p/540p/720p
  (quality auto-selected; viewers can override it in the player).

Shot lists (which clips / in-points) are arrays at the top of the script.
Sizes are capped for GitHub Pages; add a `1080 1920 5000k` rung to `LADDER`
once the site moves to hosting without size constraints.

## Deployment

Pushing to `main` triggers the Actions workflow, which builds the site and
publishes it to GitHub Pages. One-time setup: in the repo, go to
**Settings → Pages → Build and deployment → Source: GitHub Actions**.
