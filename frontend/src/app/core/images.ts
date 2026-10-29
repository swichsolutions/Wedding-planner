/**
 * Ask Cloudinary for an image at the width it's shown at, in the best format the browser
 * takes (f_auto) — a phone shouldn't download a 4000px original for a card. Other URLs
 * (local dev uploads, /media) pass through unchanged.
 */
export function sizedImage(url: string | null | undefined, width: number): string | null {
  if (!url) return null;
  const marker = '/image/upload/';
  const at = url.indexOf(marker);
  if (!url.includes('res.cloudinary.com') || at === -1) return url;
  const head = url.slice(0, at + marker.length);
  const rest = url.slice(at + marker.length);
  return `${head}f_auto,q_auto,c_limit,w_${width}/${rest}`;
}
