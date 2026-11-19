# Sunset Heat — Leonida Cover Studio

[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/alyxilussion/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/alyxilussion/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

An entry for the [GTA 6 Cover Art bounty on make.fun](https://make.fun/bounty/gta6-cover-art-01):
a web app that turns your photos into GTA 6-style cover art — multi-panel
posters, Vice City sunset grades, bold caption lettering — and exports a PNG
to share. Everything runs offline in the browser; your photos never leave
your machine.

## What it does

- **6 layouts** — Hero Solo, Duo Split, Quad Grid, Six-Panel Hero, Comic
  Slash (slanted bands), Triple Strip. The six-panel hero is the classic
  GTA poster grid: one big hero photo plus five supporting panels.
- **6 colour grades** — Vice Sunset, Neon Coast, Heat Wave, Palm Noir,
  Dusk Violet, Gold Hour — each a photo filter plus a gradient wash.
- **Painterly effects** — halftone dots, film grain, vignette, ink edges
  (Sobel edge strokes) and a sun flare, all rendered live on canvas.
- **Poster-formula lettering** — a huge Anton title with outline and hard
  shadow, a letterspaced Bebas tagline, a rotated star stamp badge and a
  footer line. The title lives in its own solid band, never over a face,
  and Auto reads the hero photo to put the band on its darker side.
- **Any photo** — upload your own or use the eight built-in Vice City
  scenes. Click a panel to select it, drag to reframe, scroll to zoom,
  fill several panels from one photo or a different photo each.
- **One click to a poster** — Shuffle rolls a fresh combination; Auto-cover
  applies the poster formula (six-panel hero, grade matched to the hero
  photo's warmth, six different photos).
- **3 export sizes** — 1080×1080, 1080×1350 and 1920×1080 PNG.

## Try it

```sh
node serve.ts   # serves app/ on http://localhost:8080
```

Open the page, pick a layout and a grade, write a caption, hit Export PNG.

## Files

- `app/index.html`, `app/style.css` — the editor UI.
- `app/src/cover.js` — the cover render engine (layouts, grades, effects,
  lettering, subject-aware title placement).
- `app/src/main.js` — editor wiring, uploads, drag-to-pan, export.
- `app/src/shots.js` — deterministic shot setups via URL query params.
- `app/samples/` — eight Vice City scenes (six drawn procedurally for this
  entry, two from the kit's starter, free to use).
- `app/fonts/` — Anton and Bebas Neue (SIL Open Font License).
- `main.ts` — the entry program: copies `app/` and `screenshots/` to
  `/output` and writes `dossier.json`.

## License

MIT — see [LICENSE](LICENSE). Fonts are under the SIL Open Font License
(see `app/fonts/OFL.txt`). No Rockstar Games logo, artwork, character or
font is used anywhere in this entry.
