// Sunset Heat — editor wiring.
// Owns the app state, the control rail, drag-to-pan, uploads, shuffle,
// auto-cover (the poster formula) and PNG export. Rendering lives in
// cover.js; shot-mode URL params live in shots.js.
import {
  COVER_SIZES, LAYOUTS, GRADES, SAMPLE_PHOTOS,
  defaultState, renderCover, renderExportCanvas, panelAt,
  layoutRects, resolveTitleSide,
} from './cover.js';
import { applyShotParams } from './shots.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const state = defaultState();
let selectedPanel = 0;
let drag = null; // { panel, x, y, panX, panY }
let previewQueued = false;

const stageCanvas = $('#stage-canvas');
const stageCtx = stageCanvas.getContext('2d');

// --------------------------------------------------------------- photos

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function loadSamples() {
  const loaded = await Promise.all(SAMPLE_PHOTOS.map(async (s) => {
    try {
      const img = await loadImage(`samples/${s.file}`);
      return { img, name: s.label };
    } catch {
      return null;
    }
  }));
  state.photos = loaded.filter(Boolean).map((l) => l.img);
  state.photoNames = loaded.filter(Boolean).map((l) => l.name);
  state.slots = state.slots.map((s) => Math.min(s, Math.max(0, state.photos.length - 1)));
  buildTray();
}

function buildTray() {
  const tray = $('#photo-tray');
  tray.innerHTML = '';
  state.photos.forEach((img, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'thumb';
    b.title = state.photoNames[i] || `Photo ${i + 1}`;
    b.setAttribute('aria-label', `Use ${b.title} in the selected panel`);
    const t = document.createElement('img');
    t.src = img.src;
    t.alt = '';
    t.draggable = false;
    b.appendChild(t);
    const cap = document.createElement('span');
    cap.textContent = state.photoNames[i] || `Photo ${i + 1}`;
    b.appendChild(cap);
    b.addEventListener('click', () => {
      state.slots[selectedPanel] = i;
      queuePreview();
      updateStatus();
    });
    tray.appendChild(b);
  });
}

function addUploads(files) {
  const images = [...files].filter((f) => f.type.startsWith('image/'));
  if (!images.length) {
    setStatus('That file is not an image — try a JPG or PNG.');
    return;
  }
  images.forEach((file) => {
    const url = URL.createObjectURL(file);
    loadImage(url).then((img) => {
      state.photos.push(img);
      state.photoNames.push(file.name.replace(/\.[^.]+$/, ''));
      state.slots[selectedPanel] = state.photos.length - 1;
      buildTray();
      queuePreview();
      setStatus(`Added ${file.name} to panel ${selectedPanel + 1}.`);
    }).catch(() => setStatus(`Could not read ${file.name}.`));
  });
}

// --------------------------------------------------------------- preview

function fitPreviewCanvas() {
  const size = COVER_SIZES[state.size] || COVER_SIZES['1920x1080'];
  const maxW = 1100;
  const scale = Math.min(1, maxW / size.w);
  stageCanvas.width = Math.round(size.w * scale);
  stageCanvas.height = Math.round(size.h * scale);
}

function renderPreview() {
  previewQueued = false;
  fitPreviewCanvas();
  renderCover(stageCanvas, state);
  drawSelection();
}

function queuePreview() {
  if (previewQueued) return;
  previewQueued = true;
  requestAnimationFrame(renderPreview);
}

function drawSelection() {
  if (selectedPanel < 0) return;
  const W = stageCanvas.width;
  const H = stageCanvas.height;
  const r = currentRects()[selectedPanel];
  if (!r) return;
  stageCtx.save();
  stageCtx.strokeStyle = '#ff2e88';
  stageCtx.lineWidth = 3;
  stageCtx.setLineDash([10, 6]);
  stageCtx.strokeRect(r.x * W + 1.5, r.y * H + 1.5, r.w * W - 3, r.h * H - 3);
  stageCtx.restore();
}

// The layout rects in normalised coords — the same geometry cover.js renders,
// so selection, hit-testing and dragging can never drift from the artwork.
function currentRects() {
  return layoutRects(state.layout, resolveTitleSide(state) === 'top');
}

// --------------------------------------------------------------- status

function setStatus(text) {
  $('#status-line').textContent = text;
}

function updateStatus() {
  const name = state.photoNames[state.slots[selectedPanel]] || 'No photo';
  const zoom = state.zoom[selectedPanel] || 1;
  const total = LAYOUTS[state.layout].panels;
  $('#panel-label').textContent = `Panel ${selectedPanel + 1} of ${total} — ${name} — zoom ${zoom.toFixed(1)}x`;
  $('#zoom-slider').value = String(Math.round(zoom * 100));
  $('#zoom-label').textContent = `${zoom.toFixed(1)}x`;
}

// --------------------------------------------------------------- controls

function markActive(group, value) {
  $$(`[data-group="${group}"]`).forEach((b) => {
    b.classList.toggle('active', b.dataset.value === value);
    b.setAttribute('aria-pressed', b.dataset.value === value ? 'true' : 'false');
  });
}

function buildPickers() {
  const layoutPick = $('#layout-pick');
  for (const [key, def] of Object.entries(LAYOUTS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick';
    b.dataset.group = 'layout';
    b.dataset.value = key;
    b.innerHTML = `<strong>${def.label}</strong><span>${def.blurb}</span>`;
    b.addEventListener('click', () => {
      state.layout = key;
      selectedPanel = Math.min(selectedPanel, def.panels - 1);
      markActive('layout', key);
      queuePreview();
      updateStatus();
    });
    layoutPick.appendChild(b);
  }
  const gradePick = $('#grade-pick');
  for (const [key, def] of Object.entries(GRADES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick swatch';
    b.dataset.group = 'grade';
    b.dataset.value = key;
    b.innerHTML = `<i class="sw sw-${key}"></i><strong>${def.label}</strong>`;
    b.addEventListener('click', () => {
      state.grade = key;
      markActive('grade', key);
      queuePreview();
    });
    gradePick.appendChild(b);
  }
  const sizePick = $('#size-pick');
  for (const [key, def] of Object.entries(COVER_SIZES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick';
    b.dataset.group = 'size';
    b.dataset.value = key;
    b.innerHTML = `<strong>${key}</strong><span>${def.label}</span>`;
    b.addEventListener('click', () => {
      state.size = key;
      markActive('size', key);
      queuePreview();
    });
    sizePick.appendChild(b);
  }
  markActive('layout', state.layout);
  markActive('grade', state.grade);
  markActive('size', state.size);
}

function wireWords() {
  const bind = (id, key) => {
    const el = $(id);
    el.value = state[key];
    el.addEventListener('input', () => {
      state[key] = el.value;
      queuePreview();
    });
  };
  bind('#title-input', 'title');
  bind('#tagline-input', 'tagline');
  bind('#stamp-input', 'stamp');
  bind('#footer-input', 'footer');
  const pos = $('#title-pos');
  pos.value = state.titlePos;
  pos.addEventListener('change', () => {
    state.titlePos = pos.value;
    queuePreview();
  });
  for (const fx of ['halftone', 'grain', 'vignette', 'ink', 'flare']) {
    const el = $(`#fx-${fx}`);
    el.checked = !!state.fx[fx];
    el.addEventListener('change', () => {
      state.fx[fx] = el.checked;
      queuePreview();
    });
  }
  $('#zoom-slider').addEventListener('input', (e) => {
    state.zoom[selectedPanel] = Number(e.target.value) / 100;
    queuePreview();
    updateStatus();
  });
}

// --------------------------------------------------------------- shuffle + auto

function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function photoWarmth(img) {
  try {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    const cx = c.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0, 16, 16);
    const d = cx.getImageData(0, 0, 16, 16).data;
    let r = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; b += d[i + 2]; }
    return r - b;
  } catch {
    return 0;
  }
}

function shuffleCover() {
  const layouts = Object.keys(LAYOUTS);
  const grades = Object.keys(GRADES);
  state.layout = layouts[Math.floor(Math.random() * layouts.length)];
  state.grade = grades[Math.floor(Math.random() * grades.length)];
  const n = LAYOUTS[state.layout].panels;
  const picks = shuffled(state.photos.map((_, i) => i)).slice(0, n);
  state.slots = picks.concat(state.slots).slice(0, 6);
  state.pan = state.pan.map(() => ({ x: (Math.random() - 0.5) * 0.2, y: (Math.random() - 0.5) * 0.2 }));
  state.zoom = state.zoom.map(() => 1 + Math.random() * 0.4);
  state.fx.ink = Math.random() < 0.3;
  state.titlePos = 'auto';
  $('#title-pos').value = 'auto';
  markActive('layout', state.layout);
  markActive('grade', state.grade);
  syncFxBoxes();
  queuePreview();
  updateStatus();
  setStatus('Shuffled — a fresh roll of the poster dice.');
}

function autoCover() {
  // The poster formula: six-panel hero grid, a grade matched to the hero
  // photo's warmth, six different photos, title on the dark side.
  const picks = shuffled(state.photos.map((_, i) => i)).slice(0, 6);
  state.slots = picks.concat([0, 0, 0, 0, 0, 0]).slice(0, 6);
  state.layout = 'six';
  const hero = state.photos[picks[0]];
  const warm = hero ? photoWarmth(hero) : 0;
  state.grade = warm > 600 ? (Math.random() < 0.5 ? 'sunset' : 'heat')
    : warm < -200 ? (Math.random() < 0.5 ? 'neon' : 'dusk') : 'gold';
  state.pan = state.pan.map(() => ({ x: 0, y: 0 }));
  state.zoom = state.zoom.map(() => 1);
  state.fx = { halftone: true, grain: true, vignette: true, ink: false, flare: true };
  state.titlePos = 'auto';
  $('#title-pos').value = 'auto';
  markActive('layout', 'six');
  markActive('grade', state.grade);
  syncFxBoxes();
  queuePreview();
  updateStatus();
  setStatus('Auto-cover: six-panel hero, grade matched to the hero photo.');
}

function syncFxBoxes() {
  for (const fx of ['halftone', 'grain', 'vignette', 'ink', 'flare']) {
    $(`#fx-${fx}`).checked = !!state.fx[fx];
  }
}

// --------------------------------------------------------------- export

function exportPNG() {
  const canvas = renderExportCanvas(state);
  canvas.toBlob((blob) => {
    if (!blob) {
      setStatus('Export failed in this browser — try again.');
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sunset-heat-cover-${state.size}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setStatus(`Exported ${state.size} PNG — check your downloads.`);
  }, 'image/png');
}

// --------------------------------------------------------------- pointer

function canvasPoint(e) {
  const r = stageCanvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (stageCanvas.width / r.width),
    y: (e.clientY - r.top) * (stageCanvas.height / r.height),
  };
}

function wirePointer() {
  stageCanvas.addEventListener('pointerdown', (e) => {
    const p = canvasPoint(e);
    const idx = panelAt(state, stageCanvas.width, stageCanvas.height, p.x, p.y);
    if (idx < 0) return;
    selectedPanel = idx;
    updateStatus();
    queuePreview();
    drag = {
      panel: idx, x: p.x, y: p.y,
      panX: (state.pan[idx] || { x: 0 }).x, panY: (state.pan[idx] || { y: 0 }).y,
    };
    stageCanvas.setPointerCapture(e.pointerId);
  });
  stageCanvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = canvasPoint(e);
    const rects = currentRects();
    const r = rects[drag.panel];
    if (!r) return;
    const dx = (p.x - drag.x) / (r.w * stageCanvas.width);
    const dy = (p.y - drag.y) / (r.h * stageCanvas.height);
    state.pan[drag.panel] = {
      x: Math.max(-0.6, Math.min(0.6, drag.panX + dx)),
      y: Math.max(-0.6, Math.min(0.6, drag.panY + dy)),
    };
    queuePreview();
  });
  const endDrag = () => { drag = null; };
  stageCanvas.addEventListener('pointerup', endDrag);
  stageCanvas.addEventListener('pointercancel', endDrag);
  stageCanvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const z = state.zoom[selectedPanel] || 1;
    state.zoom[selectedPanel] = Math.max(1, Math.min(3, z - Math.sign(e.deltaY) * 0.1));
    queuePreview();
    updateStatus();
  }, { passive: false });
  stageCanvas.addEventListener('dragover', (e) => e.preventDefault());
  stageCanvas.addEventListener('drop', (e) => {
    e.preventDefault();
    addUploads(e.dataTransfer.files);
  });
  window.addEventListener('keydown', (e) => {
    if (e.target.matches('input, select, textarea')) return;
    const pan = state.pan[selectedPanel] || { x: 0, y: 0 };
    const step = 0.04;
    if (e.key === 'ArrowLeft') state.pan[selectedPanel] = { ...pan, x: pan.x - step };
    else if (e.key === 'ArrowRight') state.pan[selectedPanel] = { ...pan, x: pan.x + step };
    else if (e.key === 'ArrowUp') state.pan[selectedPanel] = { ...pan, y: pan.y - step };
    else if (e.key === 'ArrowDown') state.pan[selectedPanel] = { ...pan, y: pan.y + step };
    else if (e.key === '+' || e.key === '=') state.zoom[selectedPanel] = Math.min(3, (state.zoom[selectedPanel] || 1) + 0.1);
    else if (e.key === '-') state.zoom[selectedPanel] = Math.max(1, (state.zoom[selectedPanel] || 1) - 0.1);
    else return;
    queuePreview();
    updateStatus();
  });
}

// --------------------------------------------------------------- boot

async function boot() {
  buildPickers();
  wireWords();
  wirePointer();
  $('#upload-input').addEventListener('change', (e) => {
    addUploads(e.target.files);
    e.target.value = '';
  });
  $('#fill-all-btn').addEventListener('click', () => {
    const photo = state.slots[selectedPanel];
    const n = LAYOUTS[state.layout].panels;
    for (let i = 0; i < n; i++) state.slots[i] = photo;
    queuePreview();
    setStatus('Every panel now shows the same photo — drag each to reframe it.');
  });
  $('#shuffle-btn').addEventListener('click', shuffleCover);
  $('#auto-btn').addEventListener('click', autoCover);
  $('#export-btn').addEventListener('click', exportPNG);

  await document.fonts.ready;
  await loadSamples();
  const params = new URLSearchParams(location.search);
  if ([...params.keys()].length) {
    applyShotParams(state, params, { markActive, syncFxBoxes, updateStatus });
    // keep the rail in sync with shot params
    $('#title-input').value = state.title;
    $('#tagline-input').value = state.tagline;
    $('#stamp-input').value = state.stamp;
    $('#footer-input').value = state.footer;
    $('#title-pos').value = state.titlePos;
    markActive('layout', state.layout);
    markActive('grade', state.grade);
    markActive('size', state.size);
  }
  renderPreview();
  updateStatus();
  setStatus('Ready — click a panel, then pick a photo or type a caption.');
  window.__sunsetHeat = {
    state, renderPreview, exportPNG, shuffleCover, autoCover,
    ready: true,
  };
  window.__shotReady = true;
  if (params.get('shot') === 'export') {
    // let the preview paint once, then trigger the real export download
    requestAnimationFrame(() => setTimeout(exportPNG, 150));
  }
}

boot().catch((err) => {
  setStatus(`Something went wrong starting the studio: ${err.message}`);
});
