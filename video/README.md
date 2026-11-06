# Product clips

Short animated clips for weddingplanner.ge, built from code with [Remotion](https://www.remotion.dev).
The interface in them is captured from the real running site, in its real before and after states; the
code animates those captures (pointer, camera, ticks). Three things are redrawn on top in the same style so
they can move: the rolling numbers, the progress bars and the guest reply menu. A few secondary controls
(edit and delete icons, for example) are hidden in the captures to keep the cards clean. Remotion's free license applies while
Swich has up to 3 employees; above that it needs a paid company license.

| Clip | Composition | Output | Size target |
|---|---|---|---|
| Instagram, 1080x1920, with hook, captions and call to action | `Instagram` | `out/weddingplanner-instagram.mp4` | none |
| Website organizer section, 692x1536 (the phone's screen), silent seamless loop | `Website` | `out/organizer.mp4`, `out/organizer-poster.jpg` | under 3 MB each |
| Invitations page, 692x1536, silent seamless loop, 10% slower than the organizer clip | `Invitation` | `out/invitation.mp4`, `out/invitation-poster.jpg` | under 3 MB each |

## Remaking the clips

The captures are not in git (`public/cap/` is rebuilt). They come from the local stack, with a fictional
couple (ნინო & გიორგი) that is created fresh each time. Never run this against production.

1. Start the API with uploads on local disk, so nothing reaches the live Cloudinary:
   `Cors__AllowedOrigins__0=http://localhost:4301 Cloudinary__CloudName=" " ASPNETCORE_ENVIRONMENT=Development dotnet run --urls http://localhost:5119`
2. Start the site: `npx ng serve --port 4301` in `frontend/`.
3. In this folder: `npm run seed`, then `npm run capture`.
4. Render, passing a Chrome Headless Shell (Playwright's works, so Remotion downloads nothing):
   `npm run render:instagram -- --browser-executable="$LOCALAPPDATA/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe"`
   and likewise `render:web:mp4`, `poster`.
5. Copy `out/organizer.mp4` and `out/organizer-poster.jpg` to `frontend/public/media/` for the site.

`npm run studio` opens Remotion's preview, for scrubbing through the timeline.

The invitation clip has its own capture: with the same two servers running, `npm run seed:invite`, then
`npm run capture:invite`, then `render:invitation` and `poster:invitation`, and copy both files to
`frontend/public/media/` too. Seed fresh each time, because the capture answers one invitation. In those
captures the fields are emptied so typing can be drawn on them, dates and times are drawn as text, some
secondary fields and buttons are hidden, and the share card shows the live domain with a QR code that opens
the real `/invitations` page.

## Where things are

- `capture/seed.mjs`: the fictional couple and their data. `capture/hall-plan.html`: the fictional floor plan.
- `capture/capture.mjs`: lifts each element as a transparent PNG, before and after the real action, and writes `src/cap-manifest.json` with its geometry.
- `src/scenes.tsx`: one function per scene, with its layout, camera, and pointer path. Captions are at the end of each scene.
- `src/Story.tsx`: the scene order for each clip, and the website loop.
- `src/kit.tsx`: formats, brand colours, easing, the pointer, click effects, captions.
- `capture/seed-invite.mjs`, `capture/capture-invite.mjs`, `src/invite.tsx`: the same three jobs for the invitation clip. Its pace is `INVITE_PACE` in `src/Story.tsx`.

Text and screens are built into the video, so each language needs its own render. A redesigned screen
needs `npm run capture` and a new render; a changed element may also need its selector updated in `capture.mjs`.
