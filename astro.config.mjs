// Static build for GitHub Pages. Images under assets/media/{photos,concepts,plans},
// the stylesheet and site.js get content-hashed file names (in /_astro/), so a
// replaced file always gets a new URL. Videos and PDFs live in public/ and keep
// fixed URLs (HLS playlists and outside links point at them).
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://sadlerfarmsllc.com',
  trailingSlash: 'ignore',
  compressHTML: false,
  build: { format: 'directory', inlineStylesheets: 'never' },
  vite: {
    build: { assetsInlineLimit: 0, cssMinify: false },
    css: { preprocessorOptions: { scss: { style: 'compressed' } } },
  },
});
