// Hashed URLs for the site's images: m('photos/41-800.webp') -> /_astro/41-800.<hash>.webp
const files = import.meta.glob('/assets/media/{photos,concepts,plans}/*.webp', {
  query: '?url', import: 'default', eager: true,
}) as Record<string, string>;

export function m(path: string): string {
  const url = files[`/assets/media/${path}`];
  if (!url) throw new Error(`Missing image: assets/media/${path}`);
  return url;
}
