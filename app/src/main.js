// Vice Cover Studio — the editor UI.
//
// Owns the app state, the controls, photo uploads, drag-to-pan on the
// preview, and the export buttons. All drawing goes through cover.js, so
// the preview and the exported PNG are the same render at different sizes.
// Photos are read with FileReader / object URLs on this machine only and
// are never uploaded anywhere.
//
// Screenshot mode (for the maker's own screenshots): ?shot=editor loads a
// fixed scene into the editor; ?shot=cover shows the cover alone, drawn at
// the export size named by ?size=square|portrait|wide. Both set
// window.__shotReady once painted. Extra params: photo, caption, tagline,
// layout, grade.

import {
  LAYOUTS, GRADES, CAPTION_COLORS, EXPORT_SIZES,
  renderCover, exportCoverPNG, panelAtPoint, layoutPanels,
} from './cover.js';

const SAMPLES = [
  // bias: default vertical framing, as a fraction of the available pan
  // range toward the top of the photo — each sample is framed so its
  // subject survives a wide panel's crop (the pier fisherman's head and
  // the boulevard portrait's face sit high in their frames).
  { id: 'portrait', label: 'Portrait', src: 'samples/portrait.jpg', bias: 0.35 },
  { id: 'lowrider', label: 'Lowrider', src: 'samples/lowrider.jpg', bias: 0 },
  { id: 'pier', label: 'Pier', src: 'samples/pier.jpg', bias: 0.7 },
  { id: 'boulevard', label: 'Boulevard', src: 'samples/boulevard.jpg', bias: 0.6 },
];

const state = {
  layout: 'poster',
  grade: 'sunset',
  caption: 'SUNSET HEIST',
  tagline: 'LEONIDA',
  captionColor: 'cream',
  captionSize: 1,
  captionPosition: 'bottom',
  tilt: true,
  stamp: true,
  panels: [null, null, null, null], // { img, src, zoom, dx, dy }
  selected: 0,
  exportSize: EXPORT_SIZES[0],
};

const $ = (sel) => document.querySelector(sel);
const preview = $('#preview');
const statusLine = $('#status');

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function setStatus(text) {
  statusLine.textContent = text;
}

// The preview canvas keeps the selected export size's aspect ratio, scaled
// to at most 900 px on its long side, so the preview IS the export.
function previewSize() {
  const { w, h } = state.exportSize;
  const scale = Math.min(1, 900 / Math.max(w, h));
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

function renderPreview() {
  const { w, h } = previewSize();
  if (preview.width !== w || preview.height !== h) {
    preview.width = w;
    preview.height = h;
  }
  renderCover(preview, state, { selection: state.selected });
  refreshPanelStrip();
  refreshSelectedControls();
}

function refreshPanelStrip() {
  const strip = $('#panel-strip');
  const count = LAYOUTS[state.layout].panels;
  strip.querySelectorAll('.panel-slot').forEach((slot, i) => {
    slot.classList.toggle('hidden', i >= count);
    slot.classList.toggle('selected', i === state.selected && i < count);
    const photo = state.panels[i];
    const img = slot.querySelector('img');
    const plus = slot.querySelector('.slot-plus');
    if (photo) {
      img.src = photo.src;
      img.classList.remove('hidden');
      plus.classList.add('hidden');
    } else {
      img.classList.add('hidden');
      plus.classList.remove('hidden');
    }
    slot.querySelector('.slot-label').textContent = i === 0 ? 'Hero' : `Panel ${i + 1}`;
  });
}

function refreshSelectedControls() {
  const photo = state.panels[state.selected];
  $('#zoom').value = Math.round((photo?.zoom || 1) * 100);
  $('#zoom-value').textContent = `${Math.round((photo?.zoom || 1) * 100)}%`;
  $('#selected-label').textContent =
    state.selected === 0 ? 'Hero panel' : `Panel ${state.selected + 1}`;
  $('#center-photo').disabled = !photo;
}

function setPanelPhoto(index, img, src, biasY) {
  // Portrait photos usually hold the face in the upper half: bias the
  // default framing toward the top so heads survive a wide panel's crop.
  // Samples carry their own bias; uploads use the heuristic.
  const bias = biasY ?? (img.height / img.width > 1.15 ? 0.35 : 0);
  state.panels[index] = { img, src, zoom: 1, dx: 0, dy: 0, biasY: bias };
}

async function fillWithSamples(ids) {
  const jobs = ids.map(async (id, i) => {
    const sample = SAMPLES.find((s) => s.id === id);
    if (!sample) return;
    const img = await loadImage(sample.src);
    setPanelPhoto(i, img, sample.src, sample.bias);
  });
  await Promise.all(jobs);
}

async function fillAllWith(src) {
  const img = await loadImage(src);
  const count = LAYOUTS[state.layout].panels;
  for (let i = 0; i < count; i++) setPanelPhoto(i, img, src);
  renderPreview();
}

// --- uploads ---------------------------------------------------------------

let uploadTarget = 'selected'; // or 'all'
const fileInput = $('#file-input');

function openUpload(target) {
  uploadTarget = target;
  fileInput.click();
}

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  fileInput.value = '';
  if (!file) return;
  try {
    const url = URL.createObjectURL(file);
    if (uploadTarget === 'all') {
      await fillAllWith(url);
      setStatus(`Filled every panel with ${file.name}`);
    } else {
      const img = await loadImage(url);
      setPanelPhoto(state.selected, img, url);
      renderPreview();
      setStatus(`Panel ${state.selected + 1} photo: ${file.name}`);
    }
  } catch {
    setStatus('That file could not be read as a photo.');
  }
});

// --- drag to pan, click to select -------------------------------------------

let drag = null; // { index, startX, startY, dx, dy, moved }

function canvasPoint(event) {
  const rect = preview.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * preview.width,
    y: ((event.clientY - rect.top) / rect.height) * preview.height,
    scale: preview.width / rect.width,
  };
}

preview.addEventListener('pointerdown', (event) => {
  const p = canvasPoint(event);
  const index = panelAtPoint(state, preview.width, preview.height, p.x, p.y);
  if (index < 0) return;
  state.selected = index;
  const photo = state.panels[index];
  const { panels } = layoutPanels(state.layout, preview.width, preview.height, state.captionPosition === 'top');
  drag = {
    index, startX: p.x, startY: p.y,
    dx: photo?.dx || 0, dy: photo?.dy || 0, moved: false,
    pw: panels[index].w, ph: panels[index].h,
  };
  preview.setPointerCapture(event.pointerId);
  renderPreview();
});

preview.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const p = canvasPoint(event);
  const photo = state.panels[drag.index];
  if (!photo) return;
  // Pan in fractions of the panel, so the framing matches at export size.
  photo.dx = drag.dx + (p.x - drag.startX) / drag.pw;
  photo.dy = drag.dy + (p.y - drag.startY) / drag.ph;
  if (Math.abs(p.x - drag.startX) + Math.abs(p.y - drag.startY) > 3) drag.moved = true;
  renderPreview();
});

preview.addEventListener('pointerup', () => { drag = null; });

// --- controls ---------------------------------------------------------------

function buildButtons(container, items, current, onPick) {
  const el = $(container);
  el.innerHTML = '';
  for (const [id, item] of Object.entries(items)) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'choice';
    btn.dataset.id = id;
    btn.textContent = item.name;
    if (id === current) btn.classList.add('active');
    btn.addEventListener('click', () => {
      el.querySelectorAll('.choice').forEach((b) => b.classList.toggle('active', b === btn));
      onPick(id);
    });
    el.appendChild(btn);
  }
}

function initControls() {
  buildButtons('#layout-choices', LAYOUTS, state.layout, (id) => {
    state.layout = id;
    if (state.selected >= LAYOUTS[id].panels) state.selected = 0;
    renderPreview();
  });
  buildButtons('#grade-choices', GRADES, state.grade, (id) => {
    state.grade = id;
    renderPreview();
  });
  buildButtons('#color-choices', CAPTION_COLORS, state.captionColor, (id) => {
    state.captionColor = id;
    renderPreview();
  });

  $('#caption-input').addEventListener('input', (e) => {
    state.caption = e.target.value;
    renderPreview();
  });
  $('#tagline-input').addEventListener('input', (e) => {
    state.tagline = e.target.value;
    renderPreview();
  });
  $('#caption-size').addEventListener('input', (e) => {
    state.captionSize = Number(e.target.value) / 100;
    $('#caption-size-value').textContent = `${e.target.value}%`;
    renderPreview();
  });
  $('#caption-position').addEventListener('change', (e) => {
    state.captionPosition = e.target.value;
    renderPreview();
  });
  $('#tilt-toggle').addEventListener('change', (e) => {
    state.tilt = e.target.checked;
    renderPreview();
  });
  $('#stamp-toggle').addEventListener('change', (e) => {
    state.stamp = e.target.checked;
    renderPreview();
  });
  $('#zoom').addEventListener('input', (e) => {
    const photo = state.panels[state.selected];
    if (!photo) return;
    photo.zoom = Number(e.target.value) / 100;
    $('#zoom-value').textContent = `${e.target.value}%`;
    renderPreview();
  });
  $('#center-photo').addEventListener('click', () => {
    const photo = state.panels[state.selected];
    if (!photo) return;
    photo.zoom = 1;
    photo.dx = 0;
    photo.dy = 0;
    renderPreview();
  });

  $('#upload-one').addEventListener('click', () => openUpload('selected'));
  $('#upload-all').addEventListener('click', () => openUpload('all'));

  // Sample thumbnails: click one to put it in the selected panel.
  const sampleRow = $('#sample-row');
  for (const sample of SAMPLES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sample';
    btn.title = `${sample.label} — put in the selected panel`;
    const img = document.createElement('img');
    img.src = sample.src;
    img.alt = sample.label;
    btn.appendChild(img);
    const label = document.createElement('span');
    label.textContent = sample.label;
    btn.appendChild(label);
    btn.addEventListener('click', async () => {
      const loaded = await loadImage(sample.src);
      setPanelPhoto(state.selected, loaded, sample.src, sample.bias);
      renderPreview();
      setStatus(`${sample.label} in panel ${state.selected + 1}`);
    });
    sampleRow.appendChild(btn);
  }

  // Panel strip slots: click to select, double-click to upload into.
  const strip = $('#panel-strip');
  for (let i = 0; i < 4; i++) {
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = 'panel-slot';
    slot.innerHTML = '<img class="hidden" alt=""><span class="slot-plus">+</span><span class="slot-label"></span>';
    slot.addEventListener('click', () => {
      state.selected = i;
      renderPreview();
    });
    slot.addEventListener('dblclick', () => {
      state.selected = i;
      openUpload('selected');
    });
    strip.appendChild(slot);
  }

  // Export size radios + the export button.
  const sizeRow = $('#size-choices');
  for (const size of EXPORT_SIZES) {
    const label = document.createElement('label');
    label.className = 'size-choice';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'export-size';
    radio.checked = size.id === state.exportSize.id;
    radio.addEventListener('change', () => {
      state.exportSize = size;
      renderPreview();
    });
    label.append(radio, document.createTextNode(size.label));
    sizeRow.appendChild(label);
  }

  $('#export-btn').addEventListener('click', async () => {
    const { w, h, label, id } = state.exportSize;
    setStatus(`Exporting ${label}…`);
    const blob = await exportCoverPNG(state, w, h);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vice-cover-${id}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    window.__lastExport = { w, h, bytes: blob.size, at: Date.now() };
    setStatus(`Exported ${label} PNG (${Math.round(blob.size / 1024)} KB)`);
  });
}

// --- shot mode + boot -------------------------------------------------------

async function applyShotParams() {
  const query = new URLSearchParams(location.search);
  const shot = query.get('shot');
  if (!shot) return false;
  if (query.get('layout') && LAYOUTS[query.get('layout')]) state.layout = query.get('layout');
  if (query.get('grade') && GRADES[query.get('grade')]) state.grade = query.get('grade');
  if (query.get('caption') !== null) state.caption = query.get('caption');
  if (query.get('tagline') !== null) state.tagline = query.get('tagline');
  if (query.get('size')) {
    const found = EXPORT_SIZES.find((s) => s.id === query.get('size'));
    if (found) state.exportSize = found;
  }
  const photo = query.get('photo');
  if (photo === 'all') {
    await fillAllWith('samples/portrait.jpg');
  } else if (photo) {
    const sample = SAMPLES.find((s) => s.id === photo);
    if (sample) {
      const img = await loadImage(sample.src);
      setPanelPhoto(0, img, sample.src, sample.bias);
    }
  }
  if (shot === 'cover') document.body.classList.add('shot-cover');
  return true;
}

async function boot() {
  initControls();
  const shotMode = await applyShotParams();
  if (!shotMode) {
    // Open with a finished cover so the first thing anyone sees is the art.
    await fillWithSamples(['portrait', 'lowrider', 'pier', 'boulevard']);
  } else if (state.panels.every((p) => !p)) {
    await fillWithSamples(['portrait', 'lowrider', 'pier', 'boulevard']);
  }
  try {
    await Promise.all([
      document.fonts.load('80px Anton'),
      document.fonts.load('40px "Bebas Neue"'),
      document.fonts.ready,
    ]);
  } catch { /* fonts fall back to sans-serif; the cover still renders */ }
  renderPreview();
  // Re-render once fonts settle, so lettering never ships in a fallback.
  document.fonts.ready.then(() => renderPreview());
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
}

boot();
