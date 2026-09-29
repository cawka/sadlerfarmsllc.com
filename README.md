# sadlerfarmsllc.com

Static landing page for **Sadler Farms LLC** (Alabama), built with
[Jekyll](https://jekyllrb.com/) and deployed to GitHub Pages via GitHub Actions.

## Local preview

```bash
bundle install
bundle exec jekyll serve
# open http://localhost:4000
```

## Structure

| Path | Purpose |
|------|---------|
| `index.html` | The landing page content |
| `_layouts/default.html` | Page shell (head, SEO/structured data, footer, scripts) |
| `assets/css/style.scss` | Styles (compiled by Jekyll's Sass) |
| `assets/js/site.js` | HLS streaming player (hls.js), sound/quality controls, lightbox |
| `assets/media/` | Web-sized photos (WebP) and HLS video, generated — don't edit by hand |
| `assets/audio/film.m4a` | Film soundtrack (see `assets/audio/README.md`) |
| `tools/build-media.sh` | Regenerates `assets/media/` from the raw drone files |
| `CNAME` | Custom domain for GitHub Pages |
| `.github/workflows/jekyll.yml` | Build + deploy workflow |

## Media

The raw drone deliverables (78 photos, 22 4K clips, ~8 GB) live locally in
`assets/photos/` and `assets/videos/` and are **gitignored**. Source:
the client's Google Drive folder (`gdown --folder <url> -O assets/videos`).

`tools/build-media.sh [photos|film|loops|all]` produces what the site serves:

* photos → `assets/media/photos/<n>-{800,1600}.webp`
* film (hero montage with soundtrack) and silent section loops →
  `assets/media/video/<name>/master.m3u8` — adaptive HLS in 360p/540p/720p
  (quality auto-selected; viewers can override it in the player).

Shot lists (which clips / in-points) are arrays at the top of the script.
Sizes are capped for GitHub Pages; add a `1080 1920 5000k` rung to `LADDER`
once the site moves to hosting without size constraints.

## Deployment

Pushing to `main` triggers the Actions workflow, which builds the site and
publishes it to GitHub Pages. One-time setup: in the repo, go to
**Settings → Pages → Build and deployment → Source: GitHub Actions**.
