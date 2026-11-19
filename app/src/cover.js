// Vice Cover Studio — the cover render engine.
//
// Everything the cover shows is drawn here on a plain 2D canvas, at any
// resolution: multi-panel layouts, per-panel photo fit/pan/zoom, Vice City
// colour grades, and the bold outlined caption lettering. The editor calls
// renderCover for the live preview and exportCoverPNG for the PNG download.
// No network, no library: only the canvas API and the OFL fonts under
// app/fonts (Anton for captions, Bebas Neue for taglines and stamps).

export const LAYOUTS = {
  poster: { name: 'Poster', panels: 4, blurb: 'Hero + 3 panels, GTA cover grid' },
  split: { name: 'Split', panels: 2, blurb: 'Two panels, slanted gutter' },
  solo: { name: 'Solo', panels: 1, blurb: 'One full-bleed photo' },
};

export const GRADES = {
  sunset: { name: 'Vice Sunset', filter: 'saturate(1.3) contrast(1.08) brightness(1.02)' },
  neon: { name: 'Neon Night', filter: 'saturate(1.35) contrast(1.12) brightness(0.98)' },
  noir: { name: 'Palm Noir', filter: 'grayscale(0.85) contrast(1.25) brightness(1.05)' },
  clean: { name: 'Clean', filter: 'saturate(1.05) contrast(1.03)' },
};

export const CAPTION_COLORS = {
  cream: { fill: '#fff6ec', name: 'Cream' },
  gold: { fill: '#ffc24b', name: 'Gold' },
  pink: { fill: '#ff4fd8', name: 'Neon Pink' },
};

export const EXPORT_SIZES = [
  { id: 'square', label: '1080 × 1080', w: 1080, h: 1080 },
  { id: 'portrait', label: '1080 × 1350', w: 1080, h: 1350 },
  { id: 'wide', label: '1920 × 1080', w: 1920, h: 1080 },
];

export const INK = '#0d0616';
export const GUTTER_CREAM = '#fff6ec';

// Panel rects for a layout, as fractions of the canvas. Returns the photo
// panels plus the caption band (null for solo, which captions over a scrim).
// captionTop flips the band to the top of the canvas.
export function layoutPanels(layout, w, h, captionTop) {
  const g = Math.max(6, Math.round(w * 0.008)); // gutter in px
  const bandH = layout === 'solo' ? 0 : Math.round(h * 0.19);
  const photoTop = captionTop && bandH ? bandH + g : 0;
  const photoH = h - bandH - (bandH ? g : 0);
  const band = bandH ? { x: 0, y: captionTop ? 0 : h - bandH, w, h: bandH } : null;

  if (layout === 'solo') {
    return { panels: [{ x: 0, y: 0, w, h, clip: null }], band };
  }
  if (layout === 'split') {
    // Two panels divided by a slanted gutter: the divider leans right as it
    // falls, so the left panel is wider at the top. Polygons leave a gap of
    // g between them; the ink background shows through as the gutter.
    const topX = w * 0.56;
    const botX = w * 0.44;
    const dx = (g / 2) * Math.hypot(w, photoH) / photoH;
    const left = {
      x: 0, y: photoTop, w: topX, h: photoH,
      clip: [[0, photoTop], [topX - dx, photoTop], [botX - dx, photoTop + photoH], [0, photoTop + photoH]],
      slant: [[topX, photoTop], [botX, photoTop + photoH]],
    };
    const right = {
      x: botX, y: photoTop, w: w - botX, h: photoH,
      clip: [[topX + dx, photoTop], [w, photoTop], [w, photoTop + photoH], [botX + dx, photoTop + photoH]],
      slant: null,
    };
    return { panels: [left, right], band };
  }
  // poster: hero on the left, three small panels stacked on the right.
  const heroW = Math.round(w * 0.62);
  const colX = heroW + g;
  const colW = w - colX;
  const smallH = Math.round((photoH - 2 * g) / 3);
  const panels = [{ x: 0, y: photoTop, w: heroW, h: photoH, clip: null }];
  for (let i = 0; i < 3; i++) {
    panels.push({ x: colX, y: photoTop + i * (smallH + g), w: colW, h: smallH, clip: null });
  }
  return { panels, band };
}

// Cover-fit draw rect for one photo inside a panel, with pan (dx, dy as
// fractions of the panel's width/height, so a drag frames the same way at
// preview size and at full export resolution) and zoom (1 = just covers).
// biasY shifts the framing toward the top of the photo as a fraction of
// the available pan range (portrait photos: keep the face in frame).
// Pan is clamped so the photo always covers the whole panel.
export function fitPhoto(img, panel, zoom, dx, dy, biasY = 0) {
  const base = Math.max(panel.w / img.width, panel.h / img.height);
  const s = base * zoom;
  const dw = img.width * s;
  const dh = img.height * s;
  const maxDx = Math.max(0, (dw - panel.w) / 2);
  const maxDy = Math.max(0, (dh - panel.h) / 2);
  const cx = panel.x + panel.w / 2 + Math.max(-maxDx, Math.min(maxDx, dx * panel.w));
  const cy = panel.y + panel.h / 2
    + Math.max(-maxDy, Math.min(maxDy, dy * panel.h + biasY * maxDy));
  return { x: cx - dw / 2, y: cy - dh / 2, w: dw, h: dh };
}

function clipPanel(ctx, panel) {
  ctx.beginPath();
  if (panel.clip) {
    ctx.moveTo(panel.clip[0][0], panel.clip[0][1]);
    for (let i = 1; i < panel.clip.length; i++) ctx.lineTo(panel.clip[i][0], panel.clip[i][1]);
    ctx.closePath();
  } else {
    ctx.rect(panel.x, panel.y, panel.w, panel.h);
  }
  ctx.clip();
}

function gradeOverlay(ctx, panel, grade, w) {
  if (grade === 'clean') return;
  const { x, y, w: pw, h: ph } = panel;
  let grad;
  if (grade === 'sunset') {
    grad = ctx.createLinearGradient(x, y, x, y + ph);
    grad.addColorStop(0, 'rgba(255,46,136,0.20)');
    grad.addColorStop(0.55, 'rgba(255,46,136,0.05)');
    grad.addColorStop(1, 'rgba(255,122,24,0.30)');
    ctx.globalCompositeOperation = 'overlay';
  } else if (grade === 'neon') {
    grad = ctx.createLinearGradient(x, y, x, y + ph);
    grad.addColorStop(0, 'rgba(25,227,214,0.22)');
    grad.addColorStop(1, 'rgba(255,46,136,0.28)');
    ctx.globalCompositeOperation = 'soft-light';
  } else if (grade === 'noir') {
    grad = ctx.createLinearGradient(x, y, x, y + ph);
    grad.addColorStop(0, 'rgba(255,46,136,0.10)');
    grad.addColorStop(1, 'rgba(255,46,136,0.18)');
    ctx.globalCompositeOperation = 'overlay';
  }
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, pw, ph);
  ctx.globalCompositeOperation = 'source-over';
}

function vignette(ctx, panel) {
  const { x, y, w: pw, h: ph } = panel;
  const r = Math.hypot(pw, ph) / 2;
  const grad = ctx.createRadialGradient(x + pw / 2, y + ph / 2, r * 0.45, x + pw / 2, y + ph / 2, r);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(5,2,12,0.30)');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, pw, ph);
}

function drawPanel(ctx, panel, photo, grade, w) {
  ctx.save();
  clipPanel(ctx, panel);
  if (photo && photo.img) {
    const r = fitPhoto(photo.img, panel, photo.zoom || 1, photo.dx || 0, photo.dy || 0, photo.biasY || 0);
    ctx.filter = GRADES[grade].filter;
    ctx.drawImage(photo.img, r.x, r.y, r.w, r.h);
    ctx.filter = 'none';
    gradeOverlay(ctx, panel, grade, w);
    vignette(ctx, panel);
  } else {
    // Empty panel: a dusk gradient with a panel number, so the layout still
    // reads as a poster while the user picks photos.
    const grad = ctx.createLinearGradient(panel.x, panel.y, panel.x, panel.y + panel.h);
    grad.addColorStop(0, '#2a1245');
    grad.addColorStop(1, '#12081f');
    ctx.fillStyle = grad;
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
    ctx.fillStyle = 'rgba(255,246,236,0.55)';
    ctx.font = `${Math.round(Math.min(panel.w, panel.h) * 0.16)}px "Bebas Neue", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ADD PHOTO', panel.x + panel.w / 2, panel.y + panel.h / 2);
  }
  ctx.restore();
  // Thin cream frame around each panel, the poster's white gutter lines.
  ctx.save();
  ctx.strokeStyle = GUTTER_CREAM;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = Math.max(1.5, w * 0.002);
  if (panel.clip) {
    ctx.beginPath();
    ctx.moveTo(panel.clip[0][0], panel.clip[0][1]);
    for (let i = 1; i < panel.clip.length; i++) ctx.lineTo(panel.clip[i][0], panel.clip[i][1]);
    ctx.closePath();
    ctx.stroke();
  } else {
    ctx.strokeRect(panel.x, panel.y, panel.w, panel.h);
  }
  ctx.restore();
}

// Split a caption into at most two lines that fit maxWidth at size px.
function wrapCaption(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [text];
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !line) {
      line = test;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > 2) {
    // Merge the tail into line 2; the size loop below shrinks to fit.
    return [lines[0], lines.slice(1).join(' ')];
  }
  return lines;
}

function drawCaption(ctx, state, w, h, band) {
  const caption = (state.caption || '').toUpperCase();
  const tagline = (state.tagline || '').toUpperCase();
  if (!caption && !tagline) return;
  const color = CAPTION_COLORS[state.captionColor] || CAPTION_COLORS.cream;
  const solo = state.layout === 'solo';
  const top = state.captionPosition === 'top';
  const maxW = w * 0.92;
  const cx = w / 2;

  if (solo) {
    const scrimH = Math.round(h * 0.42);
    const sy = top ? 0 : h - scrimH;
    const grad = ctx.createLinearGradient(0, sy, 0, sy + scrimH);
    if (top) {
      grad.addColorStop(0, 'rgba(13,6,22,0.88)');
      grad.addColorStop(1, 'rgba(13,6,22,0)');
    } else {
      grad.addColorStop(0, 'rgba(13,6,22,0)');
      grad.addColorStop(1, 'rgba(13,6,22,0.88)');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, sy, w, scrimH);
  } else {
    ctx.fillStyle = INK;
    ctx.fillRect(band.x, band.y, band.w, band.h);
    // A thin neon rule where the band meets the photos.
    ctx.fillStyle = '#ff2e88';
    const ruleY = top ? band.y + band.h - Math.max(2, h * 0.004) : band.y;
    ctx.fillRect(band.x, ruleY, band.w, Math.max(2, h * 0.004));
  }

  // Size the caption: start big, shrink to fit the width, wrap to two
  // lines when one will not fit. The caption and tagline are then laid
  // out as ONE stacked block, so the tagline can never cross the caption.
  let size = (solo
    ? Math.min(w * 0.16, h * 0.15)
    : Math.min(w * 0.115, band.h * 0.56)) * (state.captionSize || 1);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let lines = [caption];
  const measure = () => {
    ctx.font = `${size}px Anton, sans-serif`;
    if (caption && ctx.measureText(caption).width > maxW) {
      lines = wrapCaption(ctx, caption, maxW);
      if (lines.length === 1) {
        while (size > 20 && ctx.measureText(caption).width > maxW) {
          size *= 0.94;
          ctx.font = `${size}px Anton, sans-serif`;
        }
      } else {
        size = Math.min(size, (solo ? h * 0.10 : band.h * 0.38) * (state.captionSize || 1));
        ctx.font = `${size}px Anton, sans-serif`;
        while (size > 20 && lines.some((l) => ctx.measureText(l).width > maxW)) {
          size *= 0.94;
          ctx.font = `${size}px Anton, sans-serif`;
        }
      }
    }
  };
  measure();

  // Block geometry, then shrink the whole block if it overflows its area.
  const blockBudget = solo ? h * 0.30 : band.h * 0.92;
  const geometry = () => {
    const lineH = size * 1.02;
    const captionH = caption ? lines.length * lineH : 0;
    const tagSize = Math.max(14, size * 0.26);
    const tagH = tagline ? tagSize * 1.2 : 0;
    const gap = tagline && caption ? tagSize * 0.6 : 0;
    return { lineH, captionH, tagSize, tagH, gap, blockH: captionH + gap + tagH };
  };
  let g = geometry();
  while (g.blockH > blockBudget && size > 20) {
    size *= 0.94;
    measure();
    g = geometry();
  }

  // Tagline above the caption when the caption sits at the bottom (a
  // kicker), below it when the caption sits at the top.
  const tagFirst = !top;
  const capCenterY = tagline && tagFirst
    ? g.tagH + g.gap + g.captionH / 2
    : g.captionH / 2;
  const tagCenterY = tagline && tagFirst
    ? g.tagH / 2
    : g.captionH + g.gap + g.tagH / 2;

  const blockTop = solo
    ? (top ? h * 0.06 : h * 0.94 - g.blockH)
    : band.y + (band.h - g.blockH) / 2;
  const blockCenterY = blockTop + g.blockH / 2;

  ctx.translate(cx, blockCenterY);
  if (state.tilt) ctx.rotate(-0.018);
  const rel = (y) => y - g.blockH / 2;

  if (caption) {
    const outline = Math.max(2, size * 0.14);
    const shadow = Math.max(3, size * 0.055);
    ctx.font = `${size}px Anton, sans-serif`;
    lines.forEach((line, i) => {
      const y = rel(capCenterY - g.captionH / 2 + g.lineH / 2 + i * g.lineH);
      // Hard offset shadow, then thick outline, then the fill.
      ctx.fillStyle = 'rgba(10,3,18,0.9)';
      ctx.fillText(line, shadow, y + shadow);
      ctx.lineWidth = outline;
      ctx.strokeStyle = INK;
      ctx.lineJoin = 'round';
      ctx.strokeText(line, 0, y);
      ctx.fillStyle = color.fill;
      ctx.fillText(line, 0, y);
    });
  }
  if (tagline) {
    ctx.font = `${g.tagSize}px "Bebas Neue", sans-serif`;
    try { ctx.letterSpacing = `${Math.round(g.tagSize * 0.32)}px`; } catch { /* older canvas: no letter-spacing */ }
    ctx.fillStyle = '#19e3d6';
    ctx.fillText(tagline, 0, rel(tagCenterY));
  }
  ctx.restore();
}

function drawStamp(ctx, state, w, h) {
  if (!state.stamp) return;
  const top = state.captionPosition !== 'top' || state.layout === 'solo';
  const pad = Math.round(w * 0.02);
  const label = 'VICE CITY 2026';
  const fs = Math.max(13, Math.round(w * 0.016));
  ctx.save();
  ctx.font = `${fs}px "Bebas Neue", sans-serif`;
  try { ctx.letterSpacing = `${Math.round(fs * 0.25)}px`; } catch { /* older canvas */ }
  const tw = ctx.measureText(label).width + fs * 0.5;
  const bw = tw + fs * 1.1;
  const bh = fs * 2.1;
  const bx = w - pad - bw;
  const by = top ? pad : h - pad - bh;
  ctx.fillStyle = 'rgba(13,6,22,0.72)';
  ctx.strokeStyle = '#ffc24b';
  ctx.lineWidth = Math.max(1.5, w * 0.0016);
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, bh * 0.28);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffc24b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, bx + bw / 2, by + bh / 2 + fs * 0.05);
  ctx.restore();
}

// Draw the whole cover onto ctx's canvas at its current size.
export function renderCover(canvas, state, options = {}) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, w, h);

  const { panels, band } = layoutPanels(state.layout, w, h, state.captionPosition === 'top');
  panels.forEach((panel, i) => {
    drawPanel(ctx, panel, state.panels[i], state.grade, w);
  });
  // Slanted cream divider for the split layout.
  if (state.layout === 'split' && panels[0].slant) {
    ctx.save();
    ctx.strokeStyle = GUTTER_CREAM;
    ctx.lineWidth = Math.max(2, w * 0.003);
    ctx.beginPath();
    ctx.moveTo(panels[0].slant[0][0], panels[0].slant[0][1]);
    ctx.lineTo(panels[0].slant[1][0], panels[0].slant[1][1]);
    ctx.stroke();
    ctx.restore();
  }
  drawCaption(ctx, state, w, h, band);
  drawStamp(ctx, state, w, h);

  // Editor-only selection outline around the selected panel.
  if (options.selection != null && panels[options.selection]) {
    const p = panels[options.selection];
    ctx.save();
    ctx.strokeStyle = '#ff2e88';
    ctx.lineWidth = Math.max(2, w * 0.004);
    ctx.setLineDash([Math.max(6, w * 0.012), Math.max(4, w * 0.008)]);
    if (p.clip) {
      ctx.beginPath();
      ctx.moveTo(p.clip[0][0], p.clip[0][1]);
      for (let i = 1; i < p.clip.length; i++) ctx.lineTo(p.clip[i][0], p.clip[i][1]);
      ctx.closePath();
      ctx.stroke();
    } else {
      ctx.strokeRect(p.x, p.y, p.w, p.h);
    }
    ctx.restore();
  }
  return { panels, band };
}

// Which panel (if any) holds point (x, y) in canvas pixels.
export function panelAtPoint(state, w, h, x, y) {
  const { panels } = layoutPanels(state.layout, w, h, state.captionPosition === 'top');
  for (let i = panels.length - 1; i >= 0; i--) {
    const p = panels[i];
    if (p.clip) {
      // Point-in-polygon for the slanted split panels.
      let inside = false;
      const pts = p.clip;
      for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) {
        const [ax, ay] = pts[a];
        const [bx, by] = pts[b];
        if ((ay > y) !== (by > y) && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
      }
      if (inside) return i;
    } else if (x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h) {
      return i;
    }
  }
  return -1;
}

// Render the cover at full export resolution and return a PNG blob.
export function exportCoverPNG(state, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  renderCover(canvas, state);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
