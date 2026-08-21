# Local media assets

Served as-is at `/media/...`.

- `videografi.mp4` — muted looping clip covering the home-page videographers
  tile (`home.html` references `/media/videografi.mp4` in a `<video>`). Swap
  the file to change the clip. Aim for < 2–3 MB (it loads on the home page) —
  e.g. a stock site's "small"/540p variant, or a clip from a seeded
  videographer. A CSS crossfade montage of three stills runs underneath as the
  fallback while it loads and for reduced-motion users.
