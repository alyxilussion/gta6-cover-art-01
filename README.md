# Vice Cover Studio — GTA-style cover art maker

[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/alyxilussion/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/alyxilussion/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

Turn your photo and a caption into cover art in the style of GTA 6's
posters: a multi-panel grid, bold outlined lettering, and a Vice City
sunset or neon colour grade — exported as a PNG to share. Built for the
[make.fun gta6-cover-art-01 bounty](https://make.fun/bounty/gta6-cover-art-01).

## What it does

- **Multi-panel posters** — three layouts: Poster (hero + 3 panels),
  Split (two panels, slanted gutter), Solo (one full-bleed photo).
- **Any photo** — upload your own per panel, or fill every panel with one
  photo. Drag to reposition, zoom 100–250%, crop by panning.
- **Colour grades** — Vice Sunset, Neon Night, Palm Noir, Clean, applied
  per panel on canvas.
- **Caption lettering** — big condensed type (Anton, OFL) with a thick
  outline and hard shadow, editable text, tagline, colour, size, position
  and tilt, plus a "Vice City 2026" stamp.
- **One-click export** — 1080 × 1080, 1080 × 1350 and 1920 × 1080 PNG.

## Offline by design

The app is static files under `app/` with no build step and no network
request: serve it with any static server and open `app/index.html` in
desktop Chrome. Photos are read on your own machine and never uploaded.
Fonts are OFL files shipped under `app/fonts/`; sample photos are the
kit's free samples plus images made with an image model. Nothing here is
Rockstar's: no logo, artwork, character or font from any game.

## Try it

```sh
node serve.ts   # serves app/ on http://localhost:8080
```

Or any static server, e.g. `python3 -m http.server --directory app 8080`.

## Entry program

`main.ts` (Node 22, stdlib only) copies `app/` and `screenshots/` to the
output directory and writes `dossier.json` with the vendored make.fun
library:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see [LICENSE](LICENSE).
