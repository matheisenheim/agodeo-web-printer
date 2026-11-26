import { CatPrinter } from './printer.js';
import { textSource, imageSource, renderSourceToLines, drawPreview } from './image.js';
import { qrSource } from './qr.js';
import { TEMPLATES, templateSource, testCardSource } from './templates.js';
import { startCamera, stopCamera, cameraRunning, captureFrame, listCameras, currentFacing, currentDeviceId, torchSupported, torchIsOn, setTorch, setFocusMode, focusAt, zoomCaps, setZoom, trackCaps, trackSettings, applyAdvanced } from './photobooth.js';
import { APP_VERSION } from './protocol.js';
import { FILTERS } from './filters.js';

const $ = (id) => document.getElementById(id);
function val(id, def = '') {
  const el = document.getElementById(id);
  return el ? el.value : def;
}
function isChecked(id, def = true) {
  const el = document.getElementById(id);
  return el ? el.checked : def;
}
const LAST_KEY = 'agodeo-last-device';
const printer = new CatPrinter();
let currentSource = null;

$('appVersion').textContent = `v${APP_VERSION}`;

printer.onLog = (msg) => {
  const log = $('log');
  log.textContent += `${msg}\n`;
  log.scrollTop = log.scrollHeight;
};

printer.onLog(`agodeo-web-printer v${APP_VERSION}`);

printer.onState = (flags, text) => {
  const warn = printer.lastBattery !== null && printer.lastBattery !== undefined && printer.lastBattery < 20
    ? '⚠ batterie < 20 % — '
    : '';
  $('printerState').textContent = `État : ${warn}${text}`;
};

printer.onDisconnect = () => {
  printer.stopStatusPolling();
  $('connStatus').textContent = 'Déconnecté';
  $('btnConnect').disabled = false;
  $('btnDisconnect').disabled = true;
  $('btnPrint').disabled = true;
};

function currentMode() {
  return Number(val('printMode', '1'));
}

function currentDither() {
  if (!currentSource) return false;
  if (currentSource.kind === 'image' || currentSource.kind === 'photobooth') return isChecked('dither', true);
  return false;
}

function notify(msg) {
  $('popupMsg').textContent = msg;
  $('popup').hidden = false;
}

$('btnPopupClose').addEventListener('click', () => { $('popup').hidden = true; });
$('popup').addEventListener('click', (e) => { if (e.target === $('popup')) $('popup').hidden = true; });

let currentView = 'printer';
let prevView = 'printer';
let savedMode = null;
let selectedCamId = null;
let cameras = [];
let screenFlash = false;
let wakeLock = null;

let filterIdx = 0;

function applyFilter() {
  const f = FILTERS[filterIdx];
  const cam = $('cam');
  if (cam) cam.style.filter = f.css;
  const lab = $('filterLabel');
  if (lab) lab.textContent = f.name;
}

function cycleFilter(dir) {
  filterIdx = (filterIdx + dir + FILTERS.length) % FILTERS.length;
  applyFilter();
}

let swipeX = null;
let swipeY = null;
$('camWrap').addEventListener('pointerdown', (e) => {
  swipeX = e.clientX;
  swipeY = e.clientY;
});
function showFocusRing(clientX, clientY, ringId = 'focusRing', wrapId = 'camWrap') {
  const r = $(ringId);
  if (!r) return;
  const rect = $(wrapId).getBoundingClientRect();
  r.style.left = `${clientX - rect.left}px`;
  r.style.top = `${clientY - rect.top}px`;
  r.classList.remove('show');
  void r.offsetWidth;
  r.classList.add('show');
}

$('camWrap').addEventListener('pointerup', (e) => {
  if (swipeX === null) return;
  const dx = e.clientX - swipeX;
  const dy = e.clientY - swipeY;
  swipeX = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    cycleFilter(dx < 0 ? 1 : -1);
    return;
  }
  if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && cameraRunning()) {
    const rect = $('camWrap').getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    focusAt(isFrontCam() ? 1 - px : px, py);
    showFocusRing(e.clientX, e.clientY);
  }
});

let tapX2 = null;
let tapY2 = null;
$('camWrap2').addEventListener('pointerdown', (e) => {
  tapX2 = e.clientX;
  tapY2 = e.clientY;
});
$('camWrap2').addEventListener('pointerup', (e) => {
  if (tapX2 === null) return;
  const dx = e.clientX - tapX2;
  const dy = e.clientY - tapY2;
  tapX2 = null;
  if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && camTabRunning) {
    const rect = $('camWrap2').getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    focusAt(isFrontCam() ? 1 - px : px, py);
    showFocusRing(e.clientX, e.clientY, 'focusRing2', 'camWrap2');
  }
});
$('filterLabel').addEventListener('click', () => cycleFilter(1));

async function acquireWakeLock() {
  try {
    if (navigator.wakeLock && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch (e) {}
}

async function releaseWakeLock() {
  try {
    if (wakeLock) await wakeLock.release();
  } catch (e) {}
  wakeLock = null;
}

if (document.addEventListener) {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && currentView === 'booth') acquireWakeLock();
  });
}

function setScreenFlash(on) {
  $('flashOverlay').hidden = !on;
  document.body.classList.toggle('flashing', on);
}

function flashMode() {
  return cameraRunning() && torchSupported() ? 'torch' : 'screen';
}

function updateFlashButton() {
  const b = $('btnTorch');
  if (!b) return;
  const running = cameraRunning();
  b.hidden = !running;
  const mode = flashMode();
  b.textContent = mode === 'torch' ? '🔦' : '🖥️';
  b.title = mode === 'torch'
    ? 'Flash LED de la caméra (torche)'
    : 'Flash écran : plein blanc pendant le minuteur et la capture (pas de flash LED sur cette caméra)';
  const on = running && (mode === 'torch' ? torchIsOn() : screenFlash);
  b.classList.toggle('on', on);
}

$('btnTorch').addEventListener('click', async () => {
  if (!cameraRunning()) return;
  if (flashMode() === 'torch') {
    const ok = await setTorch(!torchIsOn());
    if (!ok) notify('❌ Flash (torche) non disponible sur cette caméra.');
  } else {
    screenFlash = !screenFlash;
  }
  updateFlashButton();
});

function showView(name) {
  if ((name === 'booth' || name === 'camera') && currentView !== name) prevView = currentView;
  if (currentView === 'camera' && name !== 'camera') stopCamTab();
  currentView = name;
  document.querySelectorAll('.view').forEach((v) => {
    v.classList.toggle('active', v.id === `view-${name}`);
  });
  document.querySelectorAll('.tabbar-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === name);
  });
  const booth = name === 'booth';
  document.body.classList.toggle('booth', booth);
  document.body.classList.toggle('camfs', name === 'camera');
  if (booth) {
    if (savedMode === null) savedMode = val('printMode', '1');
    $('printMode').value = '1';
    refreshCameras().catch(() => {});
    acquireWakeLock();
  } else {
    if (savedMode !== null) {
      $('printMode').value = savedMode;
      savedMode = null;
    }
    if (cameraRunning()) stopBoothCamera();
    setScreenFlash(false);
    screenFlash = false;
    updateFlashButton();
    releaseWakeLock();
    if (name === 'content') refreshPreview();
  }
  if (name === 'camera' && !camTabRunning && !cameraRunning()) startCamTab();
}

document.querySelectorAll('.tabbar-btn').forEach((b) => {
  b.addEventListener('click', () => showView(b.dataset.view));
});

$('btnExitBooth').addEventListener('click', () => showView(prevView || 'printer'));
$('btnExitCam').addEventListener('click', () => showView(prevView || 'printer'));

function updateFullscreenBtn() {
  const on = !!document.fullscreenElement;
  $('btnFullscreen').textContent = on ? '🗗' : '⛶';
  $('btnFullscreen').classList.toggle('on', on);
  $('btnFullscreen').title = on ? 'Quitter le plein écran' : 'Plein écran';
}

$('btnFullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  } catch (e) {
    notify(`❌ Plein écran : ${e.message}`);
  }
});

if (document.addEventListener) {
  document.addEventListener('fullscreenchange', updateFullscreenBtn);
}
updateFullscreenBtn();

const SUBTABS = { Text: 'paneText', Image: 'paneImage', Qr: 'paneQr', Template: 'paneTemplate' };

function activeTab() {
  if ($('tabQr').classList.contains('active')) return 'qr';
  if ($('tabImage').classList.contains('active')) return 'image';
  if ($('tabTemplate').classList.contains('active')) return 'template';
  return 'text';
}

function switchSubTab(tab) {
  for (const [name, pane] of Object.entries(SUBTABS)) {
    $(`tab${name}`).classList.toggle('active', name === tab);
    $(pane).hidden = name !== tab;
  }
  refreshPreview();
}

$('tabText').addEventListener('click', () => switchSubTab('Text'));
$('tabImage').addEventListener('click', () => switchSubTab('Image'));
$('tabQr').addEventListener('click', () => switchSubTab('Qr'));
$('tabTemplate').addEventListener('click', () => switchSubTab('Template'));

function currentTemplate() {
  return TEMPLATES.find((t) => t.id === $('templateSelect').value) || TEMPLATES[0];
}

function collectTemplateValues() {
  const tpl = currentTemplate();
  const values = {};
  const inputs = $('templateFields').querySelectorAll('input');
  tpl.fields.forEach((f, i) => {
    values[f.key] = inputs[i] ? inputs[i].value : f.def;
  });
  currentSource = templateSource(tpl, values);
}

function renderTemplateFields() {
  const tpl = currentTemplate();
  const div = $('templateFields');
  div.innerHTML = '';
  tpl.fields.forEach((f) => {
    const lab = document.createElement('label');
    lab.textContent = `${f.label} `;
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.value = f.def;
    inp.addEventListener('input', () => {
      collectTemplateValues();
      refreshPreview();
    });
    lab.appendChild(inp);
    div.appendChild(lab);
  });
  collectTemplateValues();
}

function buildTemplateUI() {
  const sel = $('templateSelect');
  sel.innerHTML = '';
  for (const t of TEMPLATES) {
    const o = document.createElement('option');
    o.value = t.id;
    o.textContent = t.name;
    sel.appendChild(o);
  }
  sel.addEventListener('change', () => {
    renderTemplateFields();
    refreshPreview();
  });
  renderTemplateFields();
}

function refreshPreview() {
  if (currentView === 'booth') return;
  const tab = activeTab();
  if (tab === 'text') {
    currentSource = textSource(val('textInput'), Number(val('fontSize', '24')), val('fontFamily', 'sans-serif'));
  } else if (tab === 'qr') {
    currentSource = qrSource(val('qrText'));
  } else if (tab === 'template') {
    collectTemplateValues();
  }
  if (!currentSource) {
    drawPreview($('preview'), []);
    $('btnPrint').disabled = true;
    return;
  }
  const lines = renderSourceToLines(currentSource, { mode: 0, dither: currentDither() });
  drawPreview($('preview'), lines);
  $('btnPrint').disabled = !printer.connected;
}

async function refreshState() {
  try {
    const st = await printer.getState();
    $('printerState').textContent = st ? `État : ${st.text}` : 'Pas de réponse d\'état — essaie quand même « Imprimer », l\'état est informatif.';
  } catch (e) {
    $('printerState').textContent = `Erreur : ${e.message}`;
  }
}

function afterConnect() {
  $('connStatus').textContent = `Connecté : ${printer.device.name || printer.device.id}`;
  $('btnConnect').disabled = true;
  $('btnDisconnect').disabled = false;
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify({ id: printer.device.id, name: printer.device.name || '' }));
  } catch (e) {}
  showReconnectButton();
  refreshPreview();
  refreshState();
  printer.startStatusPolling(30000);
}

function showReconnectButton() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(LAST_KEY) || 'null'); } catch (e) {}
  if (saved && saved.id) {
    $('btnReconnect').hidden = false;
    $('reconnectLabel').textContent = saved.name || saved.id;
  }
}

$('btnConnect').addEventListener('click', async () => {
  try {
    $('connStatus').textContent = 'Choisis ton imprimante dans la liste…';
    await printer.connect(val('namePrefix').trim());
    afterConnect();
  } catch (e) {
    let msg = e.message;
    if (/disconnect|rejected|not connected|unavailable/i.test(msg)) {
      msg += ' — ferme l\'app FunPrint sur ton téléphone (une seule connexion à la fois), éteins puis rallume l\'imprimante, recharge cette page, puis réessaie.';
    }
    $('connStatus').textContent = `Erreur de connexion : ${msg}`;
  }
});

$('btnReconnect').addEventListener('click', async () => {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(LAST_KEY) || 'null'); } catch (e) {}
  if (!saved || !saved.id) return;
  try {
    $('connStatus').textContent = `Reconnexion à ${saved.name || saved.id}…`;
    await printer.reconnect(saved.id);
    afterConnect();
  } catch (e) {
    $('connStatus').textContent = `Erreur de reconnexion : ${e.message}`;
  }
});

$('btnDisconnect').addEventListener('click', () => printer.disconnect());

$('btnState').addEventListener('click', refreshState);

$('btnInfo').addEventListener('click', async () => {
  try {
    const info = await printer.getInfo();
    if (!info) {
      $('printerState').textContent = 'Infos B0/B1 non disponibles sur ce modèle.';
      return;
    }
    const typeTxt = info.type === null ? '?' : `0x${info.type.toString(16)} (${info.type})`;
    const countTxt = info.count ? `0x${info.count.map((b) => b.toString(16).padStart(2, '0')).join(' ')}` : '?';
    $('printerState').textContent = `Firmware : ${info.version || '?'} — type (B0) : ${typeTxt} — A7 (ID série) : ${countTxt}`;
  } catch (e) {
    $('printerState').textContent = `Erreur : ${e.message}`;
  }
});

$('btnCancel').addEventListener('click', async () => {
  try {
    await printer.cancel();
    notify('Annulation envoyée (AC).');
  } catch (e) {
    notify(`Erreur : ${e.message}`);
  }
});

async function listUsb() {
  if (!navigator.usb) {
    $('connStatus').textContent = 'WebUSB non disponible : Chrome/Edge requis, en HTTPS ou localhost.';
    return;
  }
  const devices = await navigator.usb.getDevices();
  const txt = devices.length
    ? devices.map((d) => `${d.productName || 'USB'} (VID:PID ${d.vendorId.toString(16)}:${d.productId.toString(16)}, ${d.manufacturerName || '?'})`).join(' | ')
    : 'aucun périphérique USB autorisé';
  $('connStatus').textContent = `USB : ${txt}`;
  printer.onLog(`sonde USB : ${devices.length} périphérique(s)${devices.length ? ' — ' + txt : ''}`);
}

$('btnUsbProbe').addEventListener('click', listUsb);

$('btnUsbPick').addEventListener('click', async () => {
  if (!navigator.usb) {
    $('connStatus').textContent = 'WebUSB non disponible : Chrome/Edge requis, en HTTPS ou localhost.';
    return;
  }
  try {
    const dev = await navigator.usb.requestDevice({ filters: [] });
    printer.onLog(`USB choisi : ${dev.productName || '?'} (VID:PID ${dev.vendorId.toString(16)}:${dev.productId.toString(16)})`);
    await listUsb();
  } catch (e) {
    $('connStatus').textContent = `USB : ${e.message}`;
  }
});

$('btnFeed').addEventListener('click', async () => {
  try {
    await printer.feed(Number(val('feedSteps', '50')) || 50);
    notify('Papier avancé.');
  } catch (e) {
    notify(`Erreur : ${e.message}`);
  }
});

async function printCurrent() {
  if (!currentSource) {
    notify('Rien à imprimer.');
    return;
  }
  if (!printer.connected) {
    notify('❌ Imprimante non connectée — connecte-la dans l\'onglet 🖨️ Imprimante, puis re-prends la photo.');
    return;
  }
  try {
    $('btnPrint').disabled = true;
    const mode = currentMode();
    const lines = renderSourceToLines(currentSource, { mode, dither: currentDither() });
    notify(`Impression de ${lines.length} lignes (mode ${mode === 2 ? '4 bits / 16 gris — HD' : '1 bit mono'})…`);
    const n = await printer.printLines(lines, {
      energy: Number(val('energy', '49152')),
      feed: isChecked('autoFeed', false) ? Number(val('feedSteps', '50')) || 50 : 0,
      mode,
    });
    notify(`✅ Impression réussie : ${n} lignes envoyées.`);
  } catch (e) {
    notify(`❌ L'imprimante ne répond pas / erreur : ${e.message}`);
  } finally {
    refreshPreview();
  }
}

$('btnPrint').addEventListener('click', printCurrent);

function countdown(n) {
  return new Promise((resolve) => {
    const el = $('countdown');
    let i = n;
    el.hidden = false;
    el.textContent = String(i);
    $('btnCapture').disabled = true;
    const t = setInterval(() => {
      i -= 1;
      if (i <= 0) {
        clearInterval(t);
        el.hidden = true;
        $('btnCapture').disabled = false;
        resolve();
      } else {
        el.textContent = String(i);
      }
    }, 1000);
  });
}

async function refreshCameras() {
  cameras = await listCameras();
  if (cameraRunning()) {
    const cur = currentDeviceId();
    if (cur && cameras.some((c) => c.deviceId === cur)) selectedCamId = cur;
  }
  if (selectedCamId && !cameras.some((c) => c.deviceId === selectedCamId)) selectedCamId = null;
  const btn = $('btnCamSwitch');
  if (btn) btn.disabled = cameras.length < 2;
  updateCamSwitchLabel();
}

$('btnCamSwitch').addEventListener('click', async () => {
  if (cameras.length === 0) await refreshCameras();
  if (cameras.length < 2) return;
  let idx = cameras.findIndex((c) => c.deviceId === selectedCamId);
  if (idx === -1 && cameraRunning()) {
    const f = currentFacing();
    if (f === 'user') idx = cameras.findIndex((c) => /(back|arrière|rear|environment)/i.test(c.label || ''));
    else if (f === 'environment') idx = cameras.findIndex((c) => /(front|avant|user)/i.test(c.label || ''));
  }
  const next = cameras[(idx + 1) % cameras.length];
  selectedCamId = next.deviceId;
  if (!cameraRunning()) {
    updateCamSwitchLabel();
    return;
  }
  stopCamera($('cam'));
  try {
    await startCamera($('cam'), selectedCamId);
    await setFocusMode('continuous');
    updateCamSwitchLabel();
    updateFlashButton();
  } catch (e) {
    $('btnCapture').disabled = true;
    notify(`❌ Caméra : ${e.message}`);
  }
});

if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
  navigator.mediaDevices.addEventListener('devicechange', () => {
    refreshCameras().catch(() => {});
  });
}

function stopBoothCamera() {
  stopCamera($('cam'));
  $('btnCam').textContent = 'Démarrer la caméra';
  $('btnCapture').disabled = true;
  updateCamSwitchLabel();
  updateFlashButton();
}

function facingTextFor(facing, label) {
  if (facing === 'environment' || /(back|arrière|rear)/i.test(label || '')) return 'Dos';
  if (facing === 'user' || /(front|avant)/i.test(label || '')) return 'Face';
  return '';
}

function updateCamSwitchLabel() {
  const b = $('btnCamSwitch');
  if (!b) return;
  const cam = cameras.find((c) => c.deviceId === selectedCamId);
  let txt = facingTextFor(cameraRunning() ? currentFacing() : null, (cam && cam.label) || '');
  if (!txt && cameraRunning() && !selectedCamId) txt = 'Dos';
  b.textContent = txt ? `🔄 ${txt}` : '🔄 Changer de caméra';
  applyMirror();
}

function isFrontCam() {
  if (!cameraRunning()) return false;
  const cam = cameras.find((c) => c.deviceId === selectedCamId);
  const txt = facingTextFor(currentFacing(), (cam && cam.label) || '');
  if (txt) return txt === 'Face';
  return false;
}

function applyMirror() {
  const m = isFrontCam();
  $('cam').classList.toggle('mirrored', m);
  const c2 = $('cam2');
  if (c2) c2.classList.toggle('mirrored', m);
}

async function startBoothCamera() {
  try {
    await startCamera($('cam'), selectedCamId || undefined);
    await setFocusMode('continuous');
    await refreshCameras();
    updateCamSwitchLabel();
    updateFlashButton();
    $('btnCam').textContent = 'Arrêter la caméra';
    $('btnCapture').disabled = false;
  } catch (e) {
    notify(`❌ Caméra : ${e.message} — appuie sur « Démarrer la caméra ».`);
  }
}

$('btnCam').addEventListener('click', async () => {
  if (cameraRunning()) {
    stopBoothCamera();
    return;
  }
  await startBoothCamera();
});

$('btnCapture').addEventListener('click', async () => {
  try {
    if (screenFlash) setScreenFlash(true);
    await countdown(3);
    let bmp;
    try {
      bmp = await captureFrame($('cam'), undefined, isFrontCam(), FILTERS[filterIdx].css);
    } finally {
      setScreenFlash(false);
    }
    currentSource = { kind: 'image', bmp };
    await printCurrent();
  } catch (e) {
    notify(`❌ Erreur capture : ${e.message}`);
  }
});

$('btnTestCard').addEventListener('click', async () => {
  currentSource = testCardSource();
  refreshPreview();
  if (printer.connected) {
    notify('Impression de la page de test…');
    await printCurrent();
  } else {
    notify('Page de test prête dans l\'aperçu — connecte l\'imprimante puis « Imprimer ».');
  }
});

window.addEventListener('beforeunload', () => { stopCamera($('cam')); stopCamera($('cam2')); });

// --- Onglet Appareil photo (📷 Photo) ---
let camTabRunning = false;
let lastShot = null;
const camConstraints = { width: 1280, height: 720, frameRate: 30 };
let initialSettings = null;
const manualSliders = {};

const MANUAL_PARAMS = [
  { key: 'focusDistance', label: 'Focus manuel', fmt: (v) => v.toFixed(2) },
  { key: 'exposureCompensation', label: 'Exposition (EV)', fmt: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}` },
  { key: 'exposureTime', label: 'Pose (capture seule)', fmt: (v) => v.toFixed(1) },
  { key: 'iso', label: 'ISO', fmt: (v) => String(Math.round(v)) },
  { key: 'colorTemperature', label: 'Blancs (K)', fmt: (v) => String(Math.round(v)) },
  { key: 'brightness', label: 'Luminosité', fmt: (v) => v.toFixed(1) },
  { key: 'contrast', label: 'Contraste', fmt: (v) => v.toFixed(2) },
  { key: 'saturation', label: 'Saturation', fmt: (v) => v.toFixed(2) },
  { key: 'sharpness', label: 'Netteté', fmt: (v) => v.toFixed(2) },
];

const MODE_FOR_PARAM = {
  focusDistance: { sel: 'modeFocus', key: 'focusMode' },
  exposureTime: { sel: 'modeExposure', key: 'exposureMode' },
  iso: { sel: 'modeExposure', key: 'exposureMode' },
  colorTemperature: { sel: 'modeWB', key: 'whiteBalanceMode' },
};

const MODE_SELECTS = [['modeFocus', 'focusMode'], ['modeExposure', 'exposureMode'], ['modeWB', 'whiteBalanceMode']];

function fillModeSelect(sel, values, key) {
  sel.innerHTML = '';
  if (!values || !values.length) {
    sel.disabled = true;
    return;
  }
  sel.disabled = false;
  for (const v of values) {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = v;
    sel.appendChild(o);
  }
  const cur = trackSettings()[key];
  if (cur && values.includes(cur)) sel.value = cur;
}

function buildResFps(caps) {
  const resSel = $('resSelect');
  const fpsSel = $('fpsSelect');
  resSel.innerHTML = '';
  fpsSel.innerHTML = '';
  const PRESETS = [[640, 480], [1280, 720], [1920, 1080], [2560, 1440], [3840, 2160]];
  const w = caps.width;
  const h = caps.height;
  for (const [pw, ph] of PRESETS) {
    if (w && (pw < w.min || pw > w.max)) continue;
    if (h && (ph < h.min || ph > h.max)) continue;
    const o = document.createElement('option');
    o.value = `${pw}x${ph}`;
    o.textContent = `${pw}×${ph}`;
    if (pw === camConstraints.width && ph === camConstraints.height) o.selected = true;
    resSel.appendChild(o);
  }
  if (!resSel.options.length) resSel.disabled = true;
  const fr = caps.frameRate;
  for (const f of [15, 24, 30, 60]) {
    if (fr && (f < fr.min || f > fr.max)) continue;
    const o = document.createElement('option');
    o.value = String(f);
    o.textContent = `${f} fps`;
    if (f === camConstraints.frameRate) o.selected = true;
    fpsSel.appendChild(o);
  }
  if (!fpsSel.options.length) fpsSel.disabled = true;
}

function buildManualPanel() {
  if (!camTabRunning) return;
  const caps = trackCaps();
  fillModeSelect($('modeFocus'), caps.focusMode, 'focusMode');
  fillModeSelect($('modeExposure'), caps.exposureMode, 'exposureMode');
  fillModeSelect($('modeWB'), caps.whiteBalanceMode, 'whiteBalanceMode');
  const rows = $('manualRows');
  rows.innerHTML = '';
  for (const k in manualSliders) delete manualSliders[k];
  const settings = trackSettings();
  for (const p of MANUAL_PARAMS) {
    const c = caps[p.key];
    if (!c || c.min === undefined || c.max === undefined) continue;
    const fmt = p.key === 'exposureTime' && c.max < 10
      ? (v) => `${(v * 1000).toFixed(0)} ms`
      : p.fmt;
    const modeFor = MODE_FOR_PARAM[p.key];
    const row = document.createElement('div');
    row.className = 'mrow';
    const lab = document.createElement('label');
    lab.textContent = p.label;
    const inp = document.createElement('input');
    inp.type = 'range';
    inp.min = c.min;
    inp.max = c.max;
    inp.step = c.step || (c.max - c.min) / 100;
    inp.value = settings[p.key] !== undefined ? settings[p.key] : c.min;
    const val = document.createElement('span');
    val.className = 'mval';
    val.textContent = fmt(Number(inp.value));
    inp.addEventListener('input', async () => {
      const v = Number(inp.value);
      val.textContent = fmt(v);
      if (p.key === 'exposureTime') return;
      const extra = modeFor ? { [modeFor.key]: 'manual' } : {};
      await applyAdvanced(Object.assign({ [p.key]: v }, extra));
      if (modeFor) $(modeFor.sel).value = 'manual';
    });
    row.appendChild(lab);
    row.appendChild(inp);
    row.appendChild(val);
    rows.appendChild(row);
    manualSliders[p.key] = { inp, val, fmt };
  }
  buildResFps(caps);
}

for (const [id, key] of MODE_SELECTS) {
  $(id).dataset.key = key;
  $(id).addEventListener('change', async (e) => {
    await applyAdvanced({ [e.target.dataset.key]: e.target.value });
  });
}

$('btnManual').addEventListener('click', () => {
  const p = $('manualPanel');
  p.hidden = !p.hidden;
  $('btnManual').classList.toggle('on', !p.hidden);
  if (!p.hidden) buildManualPanel();
});

$('btnManualReset').addEventListener('click', async () => {
  await applyAdvanced({ focusMode: 'continuous', exposureMode: 'continuous', whiteBalanceMode: 'continuous', torch: false });
  const zc = zoomCaps();
  const zmin = zc ? zc.min : 1;
  await setZoom(zmin);
  const zs = $('zoomSlider');
  zs.value = zmin;
  $('zoomVal').textContent = `${Number(zmin).toFixed(1)}×`;
  if (initialSettings) {
    for (const p of MANUAL_PARAMS) {
      if (initialSettings[p.key] === undefined) continue;
      await applyAdvanced({ [p.key]: initialSettings[p.key] });
      const s = manualSliders[p.key];
      if (s) {
        s.inp.value = initialSettings[p.key];
        s.val.textContent = s.fmt(initialSettings[p.key]);
      }
    }
  }
  buildManualPanel();
});

$('resSelect').addEventListener('change', async () => {
  const [w, h] = val('resSelect').split('x').map(Number);
  if (!w || !h) return;
  camConstraints.width = w;
  camConstraints.height = h;
  if (camTabRunning) {
    stopCamera($('cam2'));
    await startCamTab();
  }
});

$('fpsSelect').addEventListener('change', async () => {
  camConstraints.frameRate = Number(val('fpsSelect'));
  if (camTabRunning) {
    stopCamera($('cam2'));
    await startCamTab();
  }
});

function camTabUI() {
  $('btnCam2').textContent = camTabRunning ? 'Arrêter la caméra' : 'Démarrer la caméra';
  $('btnShot').disabled = !camTabRunning;
  const tb = $('btnTorch2');
  const supported = camTabRunning && torchSupported();
  tb.hidden = !supported;
  tb.classList.toggle('on', supported && torchIsOn());
  const sw = $('btnCamSwitch2');
  sw.disabled = cameras.length < 2;
  const cam = cameras.find((c) => c.deviceId === selectedCamId);
  let txt = facingTextFor(camTabRunning ? currentFacing() : null, (cam && cam.label) || '');
  if (!txt && camTabRunning && !selectedCamId) txt = 'Dos';
  sw.textContent = txt ? `🔄 ${txt}` : '🔄 Changer de caméra';
  applyMirror();
}

function stopCamTab() {
  stopCamera($('cam2'));
  camTabRunning = false;
  camTabUI();
  $('camStatus').textContent = '';
}

function camMedia() {
  return {
    width: { ideal: camConstraints.width },
    height: { ideal: camConstraints.height },
    frameRate: { ideal: camConstraints.frameRate },
  };
}

async function startCamTab() {
  try {
    await startCamera($('cam2'), selectedCamId || undefined, camMedia());
    await setFocusMode('continuous');
    camTabRunning = true;
    await refreshCameras();
    initialSettings = trackSettings();
    buildManualPanel();
    const zc = zoomCaps();
    const zs = $('zoomSlider');
    if (zc) {
      zs.min = zc.min;
      zs.max = zc.max;
      zs.step = zc.step || 0.1;
      zs.value = Math.max(zc.min, 1);
      zs.disabled = false;
      $('zoomVal').textContent = `${Number(zs.value).toFixed(1)}×`;
    } else {
      zs.disabled = true;
    }
    camTabUI();
    $('camStatus').textContent = '';
  } catch (e) {
    notify(`❌ Caméra : ${e.message} — appuie sur « Démarrer la caméra ».`);
  }
}

$('btnCam2').addEventListener('click', async () => {
  if (camTabRunning) {
    stopCamTab();
    return;
  }
  await startCamTab();
});

$('btnCamSwitch2').addEventListener('click', async () => {
  if (cameras.length === 0) await refreshCameras();
  if (cameras.length < 2) return;
  let idx = cameras.findIndex((c) => c.deviceId === selectedCamId);
  if (idx === -1 && camTabRunning) {
    const f = currentFacing();
    if (f === 'user') idx = cameras.findIndex((c) => /(back|arrière|rear|environment)/i.test(c.label || ''));
    else if (f === 'environment') idx = cameras.findIndex((c) => /(front|avant|user)/i.test(c.label || ''));
  }
  const next = cameras[(idx + 1) % cameras.length];
  selectedCamId = next.deviceId;
  if (!camTabRunning) {
    camTabUI();
    return;
  }
  stopCamera($('cam2'));
  try {
    await startCamera($('cam2'), selectedCamId, camMedia());
    await setFocusMode('continuous');
    initialSettings = trackSettings();
    buildManualPanel();
    camTabUI();
  } catch (e) {
    notify(`❌ Caméra : ${e.message}`);
  }
});

$('btnTorch2').addEventListener('click', async () => {
  if (!camTabRunning) return;
  const ok = await setTorch(!torchIsOn());
  if (!ok) notify('❌ Flash (torche) non disponible sur cette caméra.');
  camTabUI();
});

$('zoomSlider').addEventListener('input', async () => {
  const z = Number(val('zoomSlider', '1'));
  $('zoomVal').textContent = `${z.toFixed(1)}×`;
  await setZoom(z);
});

let camTimerOn = false;
let camGridOn = false;

$('btnTimer2').addEventListener('click', () => {
  camTimerOn = !camTimerOn;
  $('btnTimer2').classList.toggle('on', camTimerOn);
});

$('btnGrid2').addEventListener('click', () => {
  camGridOn = !camGridOn;
  $('btnGrid2').classList.toggle('on', camGridOn);
  $('gridOverlay').hidden = !camGridOn;
});

async function restorePose() {
  const caps = trackCaps();
  const c = caps.exposureTime;
  if (!c || c.min === undefined) return;
  const v = initialSettings && initialSettings.exposureTime !== undefined ? initialSettings.exposureTime : c.min;
  await applyAdvanced({ exposureTime: v });
}

async function applyManualNow() {
  if (!camTabRunning) return;
  const caps = trackCaps();
  const obj = {};
  for (const p of MANUAL_PARAMS) {
    const s = manualSliders[p.key];
    const c = caps[p.key];
    if (!s || !c || c.min === undefined) continue;
    obj[p.key] = Number(s.inp.value);
    const modeFor = MODE_FOR_PARAM[p.key];
    if (modeFor) obj[modeFor.key] = 'manual';
  }
  for (const [id, key] of MODE_SELECTS) {
    const sel = $(id);
    if (sel && !sel.disabled && sel.value) obj[key] = sel.value;
  }
  if (Object.keys(obj).length) await applyAdvanced(obj);
}

$('btnShot').addEventListener('click', async () => {
  try {
    if (camTimerOn) {
      const cs = $('camStatus');
      for (let i = 3; i > 0; i--) {
        cs.textContent = `Minuteur : ${i}…`;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    await applyManualNow();
    await new Promise((r) => setTimeout(r, 250));
    const bmp = await captureFrame($('cam2'), undefined, isFrontCam(), 'none');
    lastShot = bmp;
    await restorePose();
    const cv = $('shotCanvas');
    cv.width = bmp.width;
    cv.height = bmp.height;
    cv.getContext('2d').drawImage(bmp, 0, 0);
    $('shotPreview').hidden = false;
    $('camStatus').textContent = 'Photo prise.';
  } catch (e) {
    notify(`❌ Photo : ${e.message}`);
  }
});

$('btnShotClose').addEventListener('click', () => {
  $('shotPreview').hidden = true;
});

$('btnShotDownload').addEventListener('click', () => {
  const cv = $('shotCanvas');
  cv.toBlob((b) => {
    if (!b) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = `photo-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
});

$('btnShotPrint').addEventListener('click', async () => {
  if (!lastShot) return;
  currentSource = { kind: 'image', bmp: lastShot };
  await printCurrent();
});

function parseHex(str) {
  const clean = String(str || '').trim().replace(/0x/gi, '').replace(/\s+/g, '');
  if (clean.length % 2 !== 0) throw new Error('hex invalide (nombre impair de chiffres)');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

async function labSend(cmdHex, payloadHex) {
  try {
    const cmd = parseHex(cmdHex)[0];
    const payload = parseHex(payloadHex);
    if (cmd === undefined || Number.isNaN(cmd)) throw new Error('commande hex invalide');
    await printer.send(cmd, payload);
    notify(`envoyé : cmd=0x${cmd.toString(16)} payload=${payloadHex || '(vide)'}`);
  } catch (e) {
    notify(`Labo : ${e.message}`);
  }
}

$('btnLabSend').addEventListener('click', () => labSend(val('labCmd'), val('labPayload')));

document.querySelectorAll('.lab-quick').forEach((b) => {
  b.addEventListener('click', () => labSend(b.dataset.cmd, b.dataset.payload));
});

$('textInput').addEventListener('input', refreshPreview);
$('fontSize').addEventListener('input', refreshPreview);
$('fontFamily').addEventListener('change', refreshPreview);
$('qrText').addEventListener('input', refreshPreview);

$('imageInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) currentSource = await imageSource(file);
  refreshPreview();
});

$('dither').addEventListener('change', refreshPreview);
$('printMode').addEventListener('change', refreshPreview);

function checkEnvironment() {
  if (!window.isSecureContext) {
    $('connStatus').textContent = 'Contexte non sécurisé : Web Bluetooth exige HTTPS ou une URL en http://localhost / http://127.0.0.1 (pas l\'IP du réseau).';
    $('btnConnect').disabled = true;
    return;
  }
  if (!navigator.bluetooth) {
    $('connStatus').textContent = 'Web Bluetooth non supporté par ce navigateur : utilise une version récente de Chrome ou Edge (pas Firefox ni Safari).';
    $('btnConnect').disabled = true;
    return;
  }
  navigator.bluetooth.getAvailability()
    .then((ok) => {
      if (!ok) $('connStatus').textContent = 'Bluetooth éteint ou indisponible sur cet appareil : active-le, puis recharge la page.';
    })
    .catch(() => {});
  showReconnectButton();
  buildTemplateUI();
  refreshPreview();
}

window.addEventListener('error', (e) => {
  $('connStatus').textContent = `Erreur JS : ${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`;
});

checkEnvironment();
applyFilter();
printer.onLog('app prête — si ce message manque, le JS n\'a pas charge correctement (vide le cache / Ctrl+F5)');

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
