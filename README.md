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
| `_layouts/default.html` | Page shell (head, fonts, footer) |
| `assets/css/style.scss` | Styles (compiled by Jekyll's Sass) |
| `assets/img/hero.svg` | Placeholder hero background |
| `CNAME` | Custom domain for GitHub Pages |
| `.github/workflows/jekyll.yml` | Build + deploy workflow |

## Replacing the hero image

The hero currently uses a generated SVG placeholder. To use a real photo:

1. Drop a wide landscape photo (≈1600×1000, JPG) at `assets/img/hero.jpg`.
2. In `assets/css/style.scss`, change the `url("/assets/img/hero.svg")`
   line under `.hero` to `url("/assets/img/hero.jpg")`.

Good free, license-clear sources for an Alabama farm/field photo:
[Unsplash](https://unsplash.com/s/photos/alabama-farm) or
[Pexels](https://www.pexels.com/search/farmland/) (both free for commercial
use, no attribution required). Best is a real photo of the actual parcels.

## Deployment

Pushing to `main` triggers the Actions workflow, which builds the site and
publishes it to GitHub Pages. One-time setup: in the repo, go to
**Settings → Pages → Build and deployment → Source: GitHub Actions**.
