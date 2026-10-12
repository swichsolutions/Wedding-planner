# Local media assets

Served as-is at `/media/...`.

- `videografi.mp4` — muted looping clip covering the home-page videographers
  tile (`home.html` references `/media/videografi.mp4` in a `<video>`). Swap
  the file to change the clip. Aim for < 2–3 MB (it loads on the home page) —
  e.g. a stock site's "small"/540p variant, or a clip from a seeded
  videographer. A CSS crossfade montage of three stills runs underneath as the
  fallback while it loads and for reduced-motion users.
- `plan-details-3.webp` — background of the third "საიდან დავიწყო?" slide
  ("დაგეგმე დეტალები"), referenced from `startSlides` in `home.ts`. Beka's own
  photo (OneDrive Desktop/9411badc3c9c0017093c677b8c55a4cb.jpg), portrait, only
  1067×1534 at source so kept at that size (webp q82). Crop anchored at
  `center 55%` on wide screens.
- `plan-details-2.webp` — the glass-conservatory aisle tried before it (OneDrive
  Desktop/dae9be358096f0a0760c85a0d7aeed18.jpg), kept for now.
- `plan-details.webp` — the previous third-slide photo, kept for now. Beach
  ceremony aisle (Pexels, asadphoto 169189), 2400 px wide.
- `plan-define-2.webp` — background of the first "საიდან დავიწყო?" slide
  ("განსაზღვრე შენი ქორწილი"), referenced from `startSlides` in `home.ts`.
  Black-and-white couple in a convertible under cypresses, portrait
  (Beka's own photo `156.jpg`, 7728×5152 source), EXIF-rotated and resized to
  2400 px wide with Pillow (webp q82). The slide anchors the crop at
  `center 78%` so the couple stays in frame on wide screens.
- `venue.webp` — the left hero card ("სად ვიპოვო ყველაფერი?" / venues &
  services), referenced as `venueImg` in `home.ts`. Bright hall with an arched
  ceiling, hanging florals and set tables (Pexels 14716282), resized to 1000 px
  wide (webp q82). Replaced an Unsplash table-setting close-up, then a
  chandelier ballroom (Pexels 29624022) Beka passed on.
- `organizer.webp` — the right hero card ("როგორ ვაკონტროლო ყველაფერი?" /
  personal organizer), referenced as `organizerImg` in `home.ts`. Phone calendar
  with the wedding date circled, rings and white flowers (Pexels 25002851),
  resized to 1000 px wide (webp q82). The card used to be a white text sheet with
  a four-item list; it is now a photo card like the other two.
- `plan-define.webp` — the previous first-slide photo, kept for now. Black-and-
  white couple with a classic car (Pexels, Caleb Minear 34364053), 2400 px wide.
- `cat/*.webp` — the category cards of the home carousel (`categoryGroups` in
  `home.ts`). Beka's own renders on a warm-charcoal backdrop with a floor
  reflection, Revolut-style (2026-10-12, the brand's card colour; Downloads/
  "Photos for wedding", 1086×1448): "ChatGPT Image Oct 12, 2026, 03_41_15 PM-1"
  … "-8" = `attire` (dress), `photo` (camera), `transport` (car), `music` (DJ
  deck), `cake`, `rings`, `beauty` (makeup), `decor` (bouquet), and `venues` =
  "Luxurious Candlelit Wedding Table.png". Each PNG had a bevelled rounded
  "card" frame baked in; it was painted out by extending the backdrop outward
  from just inside the frame. `transport`, `music`, `attire` and `decor` got
  extra backdrop at the sides (their subjects ran to the card edge) and `cake`
  extra at the top (its topper met the card name). Saved twice: `name.webp`
  720×960 (q84) and `name-1086.webp` 1086×1448 (q80) for the `srcset`. Earlier
  sets (dark navy, then peach) are no longer in the repo.
