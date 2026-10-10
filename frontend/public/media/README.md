# Local media assets

Served as-is at `/media/...`.

- `videografi.mp4` — muted looping clip covering the home-page videographers
  tile (`home.html` references `/media/videografi.mp4` in a `<video>`). Swap
  the file to change the clip. Aim for < 2–3 MB (it loads on the home page) —
  e.g. a stock site's "small"/540p variant, or a clip from a seeded
  videographer. A CSS crossfade montage of three stills runs underneath as the
  fallback while it loads and for reduced-motion users.
- `plan-details.webp` — background of the third "საიდან დავიწყო?" slide
  ("დაგეგმე დეტალები"), referenced from `startSlides` in `home.ts`. Beach
  ceremony aisle (Pexels, asadphoto 169189), resized to 2400 px wide.
- `plan-define.webp` — background of the first "საიდან დავიწყო?" slide
  ("განსაზღვრე შენი ქორწილი"), referenced from `startSlides` in `home.ts`.
  Black-and-white couple with a classic car (Pexels, Caleb Minear 34364053),
  resized to 2400 px wide.
