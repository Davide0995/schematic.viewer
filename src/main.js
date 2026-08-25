import { parseNBT } from './nbt.js';
import { parseLitematic } from './litematic.js';
import { parseSchematic } from './schematic.js';
import { TextureManager } from './texture-manager.js';
import { SchematicRenderer } from './renderer.js';

const texMgr = new TextureManager();
let renderer = null;
let currentData = null;

// DOM refs
const canvas         = document.getElementById('main-canvas');
const loadingEl      = document.getElementById('loading');
const loadingText    = document.getElementById('loading-text');
const emptyState     = document.getElementById('empty-state');
const errorState     = document.getElementById('error-state');
const infoPanel      = document.getElementById('info-panel');
const schematicInfo  = document.getElementById('schematic-info');
const textureStatus  = document.getElementById('texture-status');
const rebuildBtn     = document.getElementById('rebuild-btn');
const sliceYMin      = document.getElementById('slice-y-min');
const sliceYMax      = document.getElementById('slice-y-max');
const sliceYMinVal   = document.getElementById('slice-y-min-val');
const sliceYMaxVal   = document.getElementById('slice-y-max-val');
const cullCb         = document.getElementById('cull-faces');
const wireCb         = document.getElementById('show-wireframe');
const gridCb         = document.getElementById('show-grid');
const resetCamBtn    = document.getElementById('reset-camera');
let loadRequestId = 0;

function showLoading(msg) {
  loadingEl.hidden = false;
  loadingText.textContent = msg;
  emptyState.classList.add('hidden');
}
function hideLoading() { loadingEl.hidden = true; }
function clearError() {
  errorState.hidden = true;
  errorState.textContent = '';
}
function showError(message) {
  hideLoading();
  errorState.textContent = message;
  errorState.hidden = false;
}

function setInfo(data) {
  const { width, height, length, palette } = data;
  schematicInfo.innerHTML = [
    ['Size',   `${width} × ${height} × ${length}`],
    ['Volume', `${(width*height*length).toLocaleString()} blocks`],
    ['Unique',  `${palette.length} block types`],
  ].map(([k,v]) => `<div class="info-row"><span class="info-label">${k}</span><span class="info-val">${v}</span></div>`).join('');

  // Set Y slider ranges
  const maxH = height;
  sliceYMin.max = maxH; sliceYMin.value = 0;
  sliceYMax.max = maxH; sliceYMax.value = maxH;
  sliceYMinVal.textContent = 0;
  sliceYMaxVal.textContent = maxH;
  infoPanel.hidden = false;
  rebuildBtn.disabled = false;
}

async function loadSchematic(file) {
  const requestId = ++loadRequestId;
  clearError();
  if (file.size > 256 * 1024 * 1024) {
    showError('This file is larger than 256 MB and cannot be loaded in the browser.');
    return;
  }
  showLoading(`Parsing ${file.name}…`);
  try {
    const buf = await file.arrayBuffer();
    if (requestId !== loadRequestId) return;
    const nbt = parseNBT(buf);
    const ext = file.name.split('.').pop().toLowerCase();

    let data;
    if (ext === 'litematic') {
      data = parseLitematic(nbt);
    } else if (ext === 'schematic') {
      data = parseSchematic(nbt);
    } else {
      // Try litematic first, fall back to schematic
      try { data = parseLitematic(nbt); } catch { data = parseSchematic(nbt); }
    }

    currentData = data;
    setInfo(data);
    await buildAndRender(data);
  } catch (err) {
    if (requestId !== loadRequestId) return;
    showError(`Failed to load schematic: ${err.message}`);
    console.error(err);
  }
}

async function buildAndRender(data) {
  if (!data) return;
  showLoading('Building geometry… 0%');
  await texMgr.ready;

  const opts = {
    cull: cullCb.checked,
    yMin: parseInt(sliceYMin.value),
    yMax: parseInt(sliceYMax.value),
  };

  if (!renderer) renderer = new SchematicRenderer(canvas);

  const meshCount = await renderer.buildGeometry(data, texMgr, opts, pct => {
    loadingText.textContent = `Building geometry… ${pct}%`;
  });

  const { width, height, length } = data;
  const cx = width / 2, cy = height / 2, cz = length / 2;
  const size = Math.max(width, height, length);
  renderer.resetCamera(cx, cy, cz, size);
  renderer.setWireframe(wireCb.checked);
  renderer.setGrid(gridCb.checked, cx, cz, Math.max(width, length));

  hideLoading();
  emptyState.classList.add('hidden');
}

// File input: schematic
document.getElementById('schematic-file').addEventListener('change', e => {
  if (e.target.files[0]) loadSchematic(e.target.files[0]);
});

// File input: texture pack
document.getElementById('texture-pack').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  textureStatus.textContent = 'Loading textures…';
  textureStatus.className = '';
  try {
    const count = await texMgr.loadFromZip(file);
    textureStatus.textContent = `✓ ${count} textures loaded`;
    textureStatus.className = '';
    if (currentData) await buildAndRender(currentData);
  } catch (err) {
    textureStatus.textContent = `✗ ${err.message}`;
    textureStatus.className = 'error';
  }
});

// Drag & drop on drop zones
function setupDrop(zoneId, handler) {
  const zone = document.getElementById(zoneId);
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('over');
    const file = e.dataTransfer.files[0];
    if (file) handler(file);
  });
}

setupDrop('schematic-drop', loadSchematic);
setupDrop('texture-drop', async file => {
  document.getElementById('texture-pack').value = '';
  textureStatus.textContent = 'Loading textures…';
  try {
    const count = await texMgr.loadFromZip(file);
    textureStatus.textContent = `✓ ${count} textures loaded`;
    textureStatus.className = '';
    if (currentData) await buildAndRender(currentData);
  } catch (err) {
    textureStatus.textContent = `✗ ${err.message}`;
    textureStatus.className = 'error';
  }
});

// Drag & drop on main canvas
canvas.addEventListener('dragover', e => e.preventDefault());
canvas.addEventListener('drop', e => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  if (['litematic','schematic','nbt'].includes(ext)) loadSchematic(file);
  else if (['zip','jar'].includes(ext)) {
    texMgr.loadFromZip(file).then(count => {
      textureStatus.textContent = `✓ ${count} textures loaded`;
      if (currentData) buildAndRender(currentData);
    }).catch(err => { textureStatus.textContent = `✗ ${err.message}`; textureStatus.className = 'error'; });
  }
});

// Controls
sliceYMin.addEventListener('input', () => { sliceYMinVal.textContent = sliceYMin.value; });
sliceYMax.addEventListener('input', () => { sliceYMaxVal.textContent = sliceYMax.value; });
rebuildBtn.addEventListener('click', () => { if (currentData) buildAndRender(currentData); });
wireCb.addEventListener('change', () => { if (renderer) renderer.setWireframe(wireCb.checked); });
gridCb.addEventListener('change', () => {
  if (!renderer || !currentData) return;
  const { width, length, height } = currentData;
  renderer.setGrid(gridCb.checked, width/2, length/2, Math.max(width, length));
});
resetCamBtn.addEventListener('click', () => {
  if (!renderer || !currentData) return;
  const { width, height, length } = currentData;
  renderer.resetCamera(width/2, height/2, length/2, Math.max(width, height, length));
});
