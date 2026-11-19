// Shot mode: deterministic cover setups driven by URL query params, so
// screenshots are reproducible (the E2E script loads these URLs).
//   ?shot=cover&layout=six&grade=sunset&size=1920x1080
//     &photos=sunset-boulevard,neon-night,beach-pier,skyline-dusk,palms-sunset,ocean-drive
//     &caption=SUNSET%20HEAT&tagline=LEONIDA%20%E2%80%A2%20VICE%20CITY%20%E2%80%A2%202026
//     &stamp=GTA%20VI&footer=A%20LEONIDA%20STORY&titlepos=bottom
//     &fx=halftone,grain,vignette,flare
//   ?shot=editor  -> the plain editor (a photo is loaded by default)
//   ?shot=export  -> like cover, then main.js triggers the real PNG export
// Unknown values are ignored (the current state stands).
import { LAYOUTS, GRADES, COVER_SIZES, SAMPLE_PHOTOS } from './cover.js';

function photoIndexByFile(file) {
  return SAMPLE_PHOTOS.findIndex((s) => s.file === file);
}

export function applyShotParams(state, params, ui) {
  const layout = params.get('layout');
  if (layout && LAYOUTS[layout]) state.layout = layout;
  const grade = params.get('grade');
  if (grade && GRADES[grade]) state.grade = grade;
  const size = params.get('size');
  if (size && COVER_SIZES[size]) state.size = size;
  const caption = params.get('caption');
  if (caption !== null) state.title = caption;
  const tagline = params.get('tagline');
  if (tagline !== null) state.tagline = tagline;
  const stamp = params.get('stamp');
  if (stamp !== null) state.stamp = stamp;
  const footer = params.get('footer');
  if (footer !== null) state.footer = footer;
  const titlePos = params.get('titlepos');
  if (titlePos === 'top' || titlePos === 'bottom' || titlePos === 'auto') {
    state.titlePos = titlePos;
  }
  const fx = params.get('fx');
  if (fx !== null) {
    const wanted = new Set(fx.split(',').map((s) => s.trim()).filter(Boolean));
    for (const key of Object.keys(state.fx)) state.fx[key] = wanted.has(key);
  }
  const photos = params.get('photos');
  if (photos !== null) {
    const files = photos.split(',').map((s) => s.trim()).filter(Boolean);
    const slots = files
      .map((f) => photoIndexByFile(f))
      .filter((i) => i >= 0 && i < state.photos.length);
    if (slots.length) {
      state.slots = slots.concat(state.slots).slice(0, 6);
      state.pan = state.pan.map(() => ({ x: 0, y: 0 }));
      state.zoom = state.zoom.map(() => 1);
    }
  }
  const photo = params.get('photo');
  if (photo !== null) {
    const i = photoIndexByFile(photo);
    if (i >= 0 && i < state.photos.length) {
      state.slots = state.slots.map(() => i);
    }
  }
  if (ui) {
    ui.markActive('layout', state.layout);
    ui.markActive('grade', state.grade);
    ui.markActive('size', state.size);
    ui.syncFxBoxes();
    ui.updateStatus();
  }
}
