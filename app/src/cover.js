// Sunset Heat — cover render engine.
// Draws GTA-style multi-panel cover art on a 2D canvas: layouts, colour
// grades, painterly effects (halftone, ink edges, grain, vignette, flare)
// and poster-formula lettering with a subject-aware title band.
// No network, no libraries: plain Canvas 2D, deterministic per state.

export const COVER_SIZES = {
  '1080x1080': { w: 1080, h: 1080, label: 'Square 1080 x 1080' },
  '1080x1350': { w: 1080, h: 1350, label: 'Portrait 1080 x 1350' },
  '1920x1080': { w: 1920, h: 1080, label: 'Landscape 1920 x 1080' },
};

export const LAYOUTS = {
  hero:  { label: 'Hero Solo', panels: 1, blurb: 'One photo, full bleed' },
  duo:   { label: 'Duo Split', panels: 2, blurb: 'Two photos, side by side' },
  quad:  { label: 'Quad Grid', panels: 4, blurb: 'Four photos, 2 x 2 grid' },
  six:   { label: 'Six-Panel Hero', panels: 6, blurb: 'Hero + five, GTA poster grid' },
  comic: { label: 'Comic Slash', panels: 3, blurb: 'Three slanted bands' },
  strip: { label: 'Triple Strip', panels: 3, blurb: 'Three vertical strips' },
};

export const GRADES = {
  // wash entries: [colour | [gradient from, gradient to], alpha, composite]
  // A wash must be strong enough to read on a bright daylight photo: the
  // grade is what makes any photo look sunset-drenched, not a whisper.
  // The main wash uses the 'color' composite: it replaces hue and
  // saturation while keeping luminance, which is exactly what a photo
  // grade does — 'overlay' leaves bright daylight photos untouched.
  sunset: { label: 'Vice Sunset', filter: 'saturate(1.35) contrast(1.10)',
            wash: [[['#ff2e88', '#ffb020'], 0.34, 'color'], ['#ff8c42', 0.18, 'soft-light']] },
  neon:   { label: 'Neon Coast', filter: 'saturate(1.50) contrast(1.12)',
            wash: [['#00e5ff', 0.30, 'color'], ['#ff2e88', 0.24, 'screen']] },
  heat:   { label: 'Heat Wave', filter: 'saturate(1.35) contrast(1.18)',
            wash: [[['#ff7a1a', '#ffd166'], 0.38, 'color'], ['#ffd166', 0.16, 'screen']] },
  noir:   { label: 'Palm Noir', filter: 'grayscale(1) contrast(1.28) brightness(1.04)',
            wash: [['#ff2e88', 0.25, 'soft-light'], ['#19c2b8', 0.16, 'overlay']] },
  dusk:   { label: 'Dusk Violet', filter: 'saturate(1.20) contrast(1.08)',
            wash: [[['#7b2fff', '#ff5e8a'], 0.38, 'color'], ['#ff5e8a', 0.16, 'soft-light']] },
  gold:   { label: 'Gold Hour', filter: 'saturate(1.25) contrast(1.06) brightness(1.03)',
            wash: [[['#ffb020', '#ff7a1a'], 0.30, 'color'], ['#b96a00', 0.18, 'multiply']] },
};

export const SAMPLE_PHOTOS = [
  { file: 'sunset-boulevard.jpg', label: 'Sunset Boulevard' },
  { file: 'neon-night.jpg', label: 'Neon Night' },
  { file: 'beach-pier.jpg', label: 'Beach Pier' },
  { file: 'skyline-dusk.jpg', label: 'Skyline Dusk' },
  { file: 'palms-sunset.jpg', label: 'Palms Sunset' },
  { file: 'ocean-drive.jpg', label: 'Ocean Drive' },
  { file: 'boulevard.jpg', label: 'Boulevard' },
  { file: 'pier.jpg', label: 'Pier' },
];

const BAND_H = 0.17;      // title band height, fraction of cover height
const GUTTER = 0.008;     // panel gutter, fraction of cover width
const PAPER = '#fff6e8';  // gutter / paper colour
const BAND_TOP = '#171226';
const BAND_BOTTOM = '#0b0817';

// ---------------------------------------------------------------- layouts

// Every layout returns panel rects in normalised coords plus the band side.
// Panels never overlap the title band: the band is its own solid region, so
// lettering can never land on a face (the v1 tagline-on-chin failure).
// Exported so the editor's hit-testing uses the exact same geometry.
export function layoutRects(layout, bandTop) {
  const g = GUTTER;
  const y0 = bandTop ? BAND_H : 0;
  const ph = 1 - BAND_H; // panel area height
  const P = (x, y, w, h, slant = 0) => ({ x, y, w, h, slant });
  switch (layout) {
    case 'hero':
      return [P(0, y0, 1, ph)];
    case 'duo':
      return [P(0, y0, 0.5 - g / 2, ph), P(0.5 + g / 2, y0, 0.5 - g / 2, ph)];
    case 'quad': {
      const hw = 0.5 - g / 2, hh = ph / 2 - g / 2;
      return [P(0, y0, hw, hh), P(0.5 + g / 2, y0, hw, hh),
              P(0, y0 + ph / 2 + g / 2, hw, hh), P(0.5 + g / 2, y0 + ph / 2 + g / 2, hw, hh)];
    }
    case 'six': {
      const heroW = 0.56;
      const rx = heroW + g, rw = 1 - heroW - g;
      const topH = ph / 2 - g / 2, botY = y0 + ph / 2 + g / 2;
      const topW = rw / 2 - g / 2, botW = rw / 3 - (2 * g) / 3;
      return [
        P(0, y0, heroW, ph),
        P(rx, y0, topW, topH), P(rx + topW + g, y0, topW, topH),
        P(rx, botY, botW, topH), P(rx + botW + g, botY, botW, topH),
        P(rx + 2 * (botW + g), botY, botW, topH),
      ];
    }
    case 'comic': {
      const bh = ph / 3 - (2 * g) / 3;
      return [P(0, y0, 1, bh, 0.045), P(0, y0 + bh + g, 1, bh, -0.045),
              P(0, y0 + 2 * (bh + g), 1, bh, 0.045)];
    }
    case 'strip': {
      const sw = 1 / 3 - (2 * g) / 3;
      return [P(0, y0, sw, ph), P(sw + g, y0, sw, ph), P(2 * (sw + g), y0, sw, ph)];
    }
    default:
      return [P(0, y0, 1, ph)];
  }
}

// ---------------------------------------------------------------- photos

function drawPhotoCover(ctx, img, rect, pan, zoom) {
  const { x, y, w, h, slant } = rect;
  ctx.save();
  ctx.beginPath();
  if (slant) {
    const s = slant * w;
    ctx.moveTo(x + s, y);
    ctx.lineTo(x + w + s, y);
    ctx.lineTo(x + w - s, y + h);
    ctx.lineTo(x - s, y + h);
    ctx.closePath();
  } else {
    ctx.rect(x, y, w, h);
  }
  ctx.clip();
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = x + (w - dw) / 2 + pan.x * w * 0.5;
  const dy = y + (h - dh) / 2 + pan.y * h * 0.5;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

function applyGradeWash(ctx, rect, grade) {
  const g = GRADES[grade] || GRADES.sunset;
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  for (const [paint, alpha, mode] of g.wash) {
    ctx.globalCompositeOperation = mode;
    ctx.globalAlpha = alpha;
    if (Array.isArray(paint)) {
      const grad = ctx.createLinearGradient(x, y, x + w, y + h);
      grad.addColorStop(0, paint[0]);
      grad.addColorStop(1, paint[1]);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = paint;
    }
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

// Which side of the hero photo is darker? The title band goes there, so the
// lettering always sits on the photo's darkest side (subject-aware placement).
export function sampleDarkSide(img) {
  try {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    const cx = c.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0, 32, 32);
    const d = cx.getImageData(0, 0, 32, 32).data;
    let top = 0, bot = 0;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 32; x++) {
      const i = (y * 32 + x) * 4;
      top += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    }
    for (let y = 24; y < 32; y++) for (let x = 0; x < 32; x++) {
      const i = (y * 32 + x) * 4;
      bot += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    }
    return top < bot ? 'top' : 'bottom';
  } catch {
    return 'bottom';
  }
}

export function resolveTitleSide(state) {
  if (state.titlePos === 'top') return 'top';
  if (state.titlePos === 'bottom') return 'bottom';
  const hero = state.photos[state.slots[0]];
  return hero ? sampleDarkSide(hero) : 'bottom';
}

// ---------------------------------------------------------------- lettering

function fitFont(ctx, text, family, weight, maxWidth, startPx, minPx) {
  let size = startPx;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > minPx && ctx.measureText(text).width > maxWidth) {
    size = Math.max(minPx, size * 0.94);
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

function drawTitleBand(ctx, band, state, W, H) {
  const { x, y, w, h } = band;
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, BAND_TOP);
  grad.addColorStop(1, BAND_BOTTOM);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  // magenta rule on the band's panel edge
  ctx.fillStyle = '#ff2e88';
  if (band.top) ctx.fillRect(x, y + h - Math.max(3, H * 0.004), w, Math.max(3, H * 0.004));
  else ctx.fillRect(x, y, w, Math.max(3, H * 0.004));

  const cx = x + w / 2;
  const title = (state.title || 'SUNSET HEAT').toUpperCase();
  const titlePx = fitFont(ctx, title, 'Anton, sans-serif', 400, w * 0.92, h * 0.52, 12);
  const titleY = y + h * 0.46;
  // hard offset shadow, then outline, then gradient fill
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `400 ${titlePx}px Anton, sans-serif`;
  try { ctx.letterSpacing = `${Math.round(titlePx * 0.01)}px`; } catch { /* older browser */ }
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillText(title, cx + titlePx * 0.045, titleY + titlePx * 0.055);
  ctx.lineWidth = Math.max(2, titlePx * 0.07);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#0a0614';
  ctx.strokeText(title, cx, titleY);
  const tg = ctx.createLinearGradient(0, titleY - titlePx * 0.5, 0, titleY + titlePx * 0.5);
  tg.addColorStop(0, '#ffffff');
  tg.addColorStop(0.55, '#fff3d6');
  tg.addColorStop(1, '#ffb020');
  ctx.fillStyle = tg;
  ctx.fillText(title, cx, titleY);
  ctx.restore();

  const tagline = (state.tagline || '').trim();
  if (tagline) {
    const tagPx = fitFont(ctx, tagline, '"Bebas Neue", sans-serif', 400, w * 0.86, h * 0.20, 10);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `400 ${tagPx}px "Bebas Neue", sans-serif`;
    try { ctx.letterSpacing = `${Math.round(tagPx * 0.28)}px`; } catch { /* older browser */ }
    ctx.fillStyle = '#ffb020';
    ctx.fillText(tagline.toUpperCase(), cx, y + h * 0.76);
    ctx.restore();
  }

  const footer = (state.footer || '').trim();
  if (footer) {
    const ftPx = Math.max(9, h * 0.115);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `400 ${ftPx}px "Bebas Neue", sans-serif`;
    try { ctx.letterSpacing = `${Math.round(ftPx * 0.32)}px`; } catch { /* older browser */ }
    ctx.fillStyle = 'rgba(255,246,232,0.72)';
    ctx.fillText(`★ ${footer.toUpperCase()} ★`, cx, y + h * 0.93);
    ctx.restore();
  }
}

function drawStamp(ctx, x, y, r, text) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.21);
  ctx.fillStyle = '#ff2e88';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.07);
  ctx.strokeStyle = '#fff6e8';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.86, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#fff6e8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `400 ${r * 0.62}px Anton, sans-serif`;
  ctx.fillText('★', 0, -r * 0.34);
  const label = (text || 'GTA VI').toUpperCase();
  const size = fitFont(ctx, label, 'Anton, sans-serif', 400, r * 1.55, r * 0.42, 8);
  ctx.font = `400 ${size}px Anton, sans-serif`;
  ctx.fillText(label, 0, r * 0.30);
  ctx.restore();
}

// ---------------------------------------------------------------- effects

let noiseTile = null;
function grainTile() {
  if (noiseTile) return noiseTile;
  const s = 160;
  const c = document.createElement('canvas');
  c.width = s; c.height = s;
  const cx = c.getContext('2d');
  const img = cx.createImageData(s, s);
  let seed = 1337; // fixed LCG: the same grain every render
  for (let i = 0; i < img.data.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const v = 118 + (seed % 76);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  cx.putImageData(img, 0, 0);
  noiseTile = c;
  return c;
}

function halftoneDots(ctx, W, H, step, strength) {
  const small = document.createElement('canvas');
  const sw = Math.max(24, Math.round(W / step));
  const sh = Math.max(24, Math.round(H / step));
  small.width = sw; small.height = sh;
  const sx = small.getContext('2d', { willReadFrequently: true });
  sx.drawImage(ctx.canvas, 0, 0, sw, sh);
  const d = sx.getImageData(0, 0, sw, sh).data;
  ctx.save();
  ctx.fillStyle = '#12081f';
  ctx.globalAlpha = strength;
  for (let gy = 0; gy < sh; gy++) {
    for (let gx = 0; gx < sw; gx++) {
      const i = (gy * sw + gx) * 4;
      const lum = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
      // Skip bright areas entirely: dots on a bright sky read as dirt,
      // not print texture. Halftone lives in mid-tones and shadows.
      if (lum > 0.72) continue;
      const r = (1 - lum) * step * 0.42;
      if (r < 0.6) continue;
      ctx.beginPath();
      ctx.arc((gx + 0.5) * step, (gy + 0.5) * step, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function inkEdges(ctx, W, H, strength) {
  const sw = 320;
  const sh = Math.max(120, Math.round((320 * H) / W));
  const small = document.createElement('canvas');
  small.width = sw; small.height = sh;
  const sx = small.getContext('2d', { willReadFrequently: true });
  sx.drawImage(ctx.canvas, 0, 0, sw, sh);
  const d = sx.getImageData(0, 0, sw, sh).data;
  const lum = new Float32Array(sw * sh);
  for (let i = 0; i < sw * sh; i++) {
    lum[i] = 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2];
  }
  const out = sx.createImageData(sw, sh);
  for (let y = 1; y < sh - 1; y++) {
    for (let x = 1; x < sw - 1; x++) {
      const i = y * sw + x;
      const gx = -lum[i - sw - 1] - 2 * lum[i - 1] - lum[i + sw - 1]
        + lum[i - sw + 1] + 2 * lum[i + 1] + lum[i + sw + 1];
      const gy = -lum[i - sw - 1] - 2 * lum[i - sw] - lum[i - sw + 1]
        + lum[i + sw - 1] + 2 * lum[i + sw] + lum[i + sw + 1];
      const mag = Math.min(255, Math.hypot(gx, gy));
      const o = i * 4;
      out.data[o] = 10; out.data[o + 1] = 6; out.data[o + 2] = 18;
      out.data[o + 3] = mag > 28 ? Math.min(255, (mag - 28) * 2.2) : 0;
    }
  }
  sx.putImageData(out, 0, 0);
  ctx.save();
  ctx.globalAlpha = strength;
  ctx.globalCompositeOperation = 'multiply';
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(small, 0, 0, W, H);
  ctx.restore();
}

function sunFlare(ctx, x, y, r) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, 'rgba(255,240,200,0.85)');
  g.addColorStop(0.25, 'rgba(255,180,90,0.35)');
  g.addColorStop(1, 'rgba(255,120,60,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  const streak = ctx.createLinearGradient(x - r * 1.6, y, x + r * 1.6, y);
  streak.addColorStop(0, 'rgba(255,200,120,0)');
  streak.addColorStop(0.5, 'rgba(255,220,160,0.5)');
  streak.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = streak;
  ctx.fillRect(x - r * 1.6, y - Math.max(1, r * 0.02), r * 3.2, Math.max(2, r * 0.04));
  ctx.restore();
}

// ---------------------------------------------------------------- render

export function defaultState() {
  return {
    layout: 'six',
    grade: 'sunset',
    fx: { halftone: true, grain: true, vignette: true, ink: false, flare: true },
    title: 'SUNSET HEAT',
    tagline: 'LEONIDA • VICE CITY • 2026',
    stamp: 'GTA VI',
    footer: 'A LEONIDA STORY',
    titlePos: 'auto',
    size: '1920x1080',
    photos: [],
    photoNames: [],
    slots: [0, 1, 2, 3, 4, 5],
    pan: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }],
    zoom: [1, 1, 1, 1, 1, 1],
  };
}

// Hit-test a point (canvas px) against the layout: returns a panel index or -1.
export function panelAt(state, W, H, px, py) {
  const side = resolveTitleSide(state);
  const rects = layoutRects(state.layout, side === 'top');
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (px >= r.x * W && px <= (r.x + r.w) * W && py >= r.y * H && py <= (r.y + r.h) * H) return i;
  }
  return -1;
}

export function renderCover(canvas, state) {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext('2d');
  const side = resolveTitleSide(state);
  const bandTop = side === 'top';
  const rects = layoutRects(state.layout, bandTop);
  const grade = GRADES[state.grade] || GRADES.sunset;

  // paper gutters show through between panels
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  // panels: photo + grade, each clipped to its rect
  rects.forEach((nr, i) => {
    const rect = { x: nr.x * W, y: nr.y * H, w: nr.w * W, h: nr.h * H, slant: nr.slant };
    const img = state.photos[state.slots[i] ?? 0];
    if (img) {
      ctx.save();
      try { ctx.filter = grade.filter; } catch { /* filter unsupported */ }
      drawPhotoCover(ctx, img, rect, state.pan[i] || { x: 0, y: 0 }, state.zoom[i] || 1);
      ctx.restore();
      applyGradeWash(ctx, rect, state.grade);
    } else {
      ctx.fillStyle = '#2a1a3a';
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    // panel keyline
    ctx.save();
    ctx.strokeStyle = 'rgba(10,6,20,0.55)';
    ctx.lineWidth = Math.max(1, W * 0.0012);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  });

  // title band (solid region, never over a face)
  const band = bandTop
    ? { x: 0, y: 0, w: W, h: H * BAND_H, top: true }
    : { x: 0, y: H * (1 - BAND_H), w: W, h: H * BAND_H, top: false };
  drawTitleBand(ctx, band, state, W, H);

  // stamp badge, top corner of the panel area
  const stampText = (state.stamp || '').trim();
  if (stampText) {
    const r = Math.min(W, H) * 0.052;
    const sx = W - r * 1.35;
    const sy = bandTop ? H * BAND_H + r * 1.35 : r * 1.35;
    drawStamp(ctx, sx, sy, r, stampText);
  }

  // global painterly effects
  const fx = state.fx || {};
  if (fx.flare) {
    const hero = rects[0];
    sunFlare(ctx, hero.x * W + hero.w * W * 0.78, hero.y * H + hero.h * H * 0.18,
      Math.min(W, H) * 0.16);
  }
  if (fx.ink) inkEdges(ctx, W, H, 0.55);
  if (fx.halftone) halftoneDots(ctx, W, H, Math.max(12, Math.round(W / 110)), 0.10);
  if (fx.grain) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.globalCompositeOperation = 'overlay';
    const tile = grainTile();
    const pat = ctx.createPattern(tile, 'repeat');
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  if (fx.vignette) {
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42,
      W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(8,4,16,0)');
    vg.addColorStop(1, 'rgba(8,4,16,0.42)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }
}

// Render the cover at its export size on an offscreen canvas.
export function renderExportCanvas(state) {
  const size = COVER_SIZES[state.size] || COVER_SIZES['1920x1080'];
  const c = document.createElement('canvas');
  c.width = size.w;
  c.height = size.h;
  renderCover(c, state);
  return c;
}
