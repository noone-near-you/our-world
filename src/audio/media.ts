/**
 * Media base URL — one place to switch local vs CDN.
 *
 * LOCAL (default): files in public/music and public/ambient
 * CDN: set MEDIA_BASE to your CDN root (no trailing slash)
 *
 * Example:
 *   export const MEDIA_BASE = 'https://cdn.jsdelivr.net/gh/YOUR_USER/anniv-media@main';
 *   then songs load from:
 *   https://cdn.jsdelivr.net/gh/YOUR_USER/anniv-media@main/music/bedroom/Adore You.mp3
 *
 * Folder layout on the CDN / media repo must match:
 *   music/<world>/<Song Name>.mp3
 *   ambient/<world>/ambient.mp3
 */

/** Leave empty '' for local public/ files. Paste your CDN root when ready. */
export const MEDIA_BASE = 'https://cdn.jsdelivr.net/gh/noone-near-you/anniv-media@master';

/** Resolve a path like "/music/bedroom/Adore You.mp3" to full URL. */
export function mediaUrl(path: string): string {
  if (!path) return path;
  // already absolute
  if (/^https?:\/\//i.test(path)) return path;
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (!MEDIA_BASE) return clean;
  // encode each segment so spaces in filenames work on CDN
  const encoded = clean
    .split('/')
    .map((seg, i) => (i === 0 || seg === '' ? seg : encodeURIComponent(seg)))
    .join('/');
  return `${MEDIA_BASE.replace(/\/$/, '')}${encoded}`;
}
