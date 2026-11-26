import { CatPrinter } from './printer.js';
import { textSource, imageSource, renderSourceToLines, drawPreview } from './image.js';
import { qrSource } from './qr.js';
import { TEMPLATES, templateSource, testCardSource } from './templates.js';
import { startCamera, stopCamera, cameraRunning, captureFrame, captureStill, blobToStill, openCaptureStream, captureBlobFromTrack, applyAdvancedToTrack, waitAppliedExposure, accumulateLongExposure, measureLuma, stopStream, listCameras, currentFacing, currentDeviceId, torchSupported, torchIsOn, setTorch, setFocusMode, focusAt, zoomCaps, setZoom, trackCaps, trackSettings, applyAdvanced } from './photobooth.js';
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
let imageBusy = false;
function setImageBusy(b) {
  imageBusy = b;
  const inp = $('imageInput');
  if (inp) inp.disabled = b;
  const tab = $('tabImage');
  if (tab) tab.disabled = b;
}

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
  $('printerInfo').hidden = true;
};

function currentMode() {
  return Number(val('printMode', '1'));
}

function previewDither() {
  if (!currentSource) return false;
  if (currentSource.kind === 'image' || currentSource.kind === 'photobooth') return isChecked('dither', true);
  return false;
}

function currentDither() {
  if (currentMode() === 2) return false;
  return previewDither();
}

function updateDitherUI() {
  const hd = currentMode() === 2;
  const d = $('dither');
  if (!d) return;
  d.disabled = hd;
  if (hd) d.checked = false;
  if (d.parentElement) d.parentElement.title = hd ? 'Inactif en mode HD : 16 niveaux de gris réels, pas de tramage' : '';
}

function notify(msg) {
  $('popupMsg').textContent = msg;
  $('popup').hidden = false;
}

$('btnPopupClose').addEventListener('click', () => { $('popup').hidden = true; });
$('popup').addEventListener('click', (e) => { if (e.target === $('popup')) $('popup').hidden = true; });

let currentView = 'home';
let prevView = 'home';
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

$('btnExitBooth').addEventListener('click', () => showView(prevView || 'home'));
$('btnExitCam').addEventListener('click', () => showView(prevView || 'home'));

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
  const lines = renderSourceToLines(currentSource, { mode: 0, dither: previewDither() });
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

async function refreshPrinterInfo() {
  const el = $('printerInfo');
  if (!el) return;
  if (!printer.connected) {
    el.hidden = true;
    return;
  }
  const name = printer.device.name || printer.device.id;
  el.hidden = false;
  el.textContent = `Connexion à ${name}… récupération des infos…`;
  try {
    const st = await printer.getState(2500);
    let info = null;
    try { info = await printer.getInfo(2500); } catch (e) { info = null; }
    const parts = [`✅ Connecté : ${name}`];
    if (st && st.text) parts.push(st.text);
    if (info && info.version) parts.push(`firmware ${info.version}`);
    if (info && info.type !== null && info.type !== undefined) parts.push(`type 0x${info.type.toString(16)}`);
    if (info && info.count) parts.push(`impressions (A7) : 0x${info.count.map((b) => b.toString(16).padStart(2, '0')).join(' ')}`);
    el.textContent = parts.join(' — ');
  } catch (e) {
    el.textContent = `✅ Connecté : ${name} — infos indisponibles (${e.message})`;
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
  refreshPrinterInfo();
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

let printBusy = false;
async function printCurrent() {
  if (printBusy) return;
  if (!currentSource) {
    notify('Rien à imprimer.');
    return;
  }
  if (!printer.connected) {
    notify('❌ Imprimante non connectée — connecte-la dans l\'onglet 🖨️ Imprimante, puis re-prends la photo.');
    return;
  }
  printBusy = true;
  const isImage = currentSource.kind === 'image' || currentSource.kind === 'photobooth';
  if (isImage) setImageBusy(true);
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
    printBusy = false;
    if (isImage) setImageBusy(false);
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
  switchSubTab('Image');
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
  { key: 'focusDistance', label: 'Focus manuel', group: 'focus', fmt: (v) => v.toFixed(2) },
  { key: 'exposureCompensation', label: 'Exposition (EV)', group: 'expo', fmt: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}` },
  { key: 'exposureTime', label: 'Pose (capture seule)', group: 'expo', fmt: null },
  { key: 'iso', label: 'ISO', group: 'expo', fmt: (v) => String(Math.round(v)) },
  { key: 'colorTemperature', label: 'Blancs (K)', group: 'image', fmt: (v) => String(Math.round(v)) },
  { key: 'brightness', label: 'Luminosité', group: 'image', fmt: (v) => v.toFixed(1) },
  { key: 'contrast', label: 'Contraste', group: 'image', fmt: (v) => v.toFixed(2) },
  { key: 'saturation', label: 'Saturation', group: 'image', fmt: (v) => v.toFixed(2) },
  { key: 'sharpness', label: 'Netteté', group: 'image', fmt: (v) => v.toFixed(2) },
];

const MANUAL_GROUPS = { expo: 'rowsExpo', focus: 'rowsFocus', image: 'rowsImage' };

const MODE_FOR_PARAM = {
  focusDistance: { sel: 'modeFocus', key: 'focusMode' },
  exposureTime: { sel: 'modeExposure', key: 'exposureMode' },
  iso: { sel: 'modeExposure', key: 'exposureMode' },
  colorTemperature: { sel: 'modeWB', key: 'whiteBalanceMode' },
};

const MODE_SELECTS = [['modeFocus', 'focusMode'], ['modeExposure', 'exposureMode'], ['modeWB', 'whiteBalanceMode']];

function fillModeSelect(sel, values, key) {
  sel.innerHTML = '';
  delete sel.dataset.dirty;
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
  else if (values.includes('continuous')) sel.value = 'continuous';
  else sel.value = values[0];
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
  for (const g of Object.values(MANUAL_GROUPS)) {
    const el = $(g);
    if (el) el.innerHTML = '';
  }
  for (const k in manualSliders) delete manualSliders[k];
  const settings = trackSettings();
  for (const p of MANUAL_PARAMS) {
    const c = caps[p.key];
    if (!c || c.min === undefined || c.max === undefined) continue;
    const fmt = p.key === 'exposureTime'
      ? (c.max < 10 ? (v) => `${v.toFixed(3)} s` : (v) => `${(v / 1000).toFixed(3)} s`)
      : p.fmt;
    const modeFor = MODE_FOR_PARAM[p.key];
    const supported = p.key !== 'exposureTime' || c.min < c.max;
    const row = document.createElement('div');
    row.className = 'mrow';
    const lab = document.createElement('label');
    lab.textContent = supported ? p.label : `${p.label} (non supportée)`;
    const inp = document.createElement('input');
    inp.type = 'range';
    inp.min = c.min;
    inp.max = c.max;
    inp.step = c.step || (c.max - c.min) / 100;
    inp.value = settings[p.key] !== undefined ? settings[p.key] : c.min;
    inp.disabled = !supported;
    const val = document.createElement('span');
    val.className = 'mval';
    val.textContent = fmt(Number(inp.value));
    inp.addEventListener('input', async () => {
      const v = Number(inp.value);
      val.textContent = fmt(v);
      manualSliders[p.key].dirty = true;
      if (p.key === 'exposureTime') return;
      const extra = modeFor ? { [modeFor.key]: 'manual' } : {};
      await applyAdvanced(Object.assign({ [p.key]: v }, extra));
      if (modeFor) {
        $(modeFor.sel).value = 'manual';
        $(modeFor.sel).dataset.dirty = '1';
      }
    });
    row.appendChild(lab);
    row.appendChild(inp);
    row.appendChild(val);
    const rows = $(MANUAL_GROUPS[p.group] || 'rowsImage');
    if (rows) rows.appendChild(row);
    manualSliders[p.key] = { inp, val, fmt, dirty: false, supported };
  }
  buildResFps(caps);
  const pa = $('poseAutoLuma');
  const ec = caps.exposureTime;
  if (pa) pa.disabled = !(ec && ec.min !== undefined && ec.min < ec.max);
  const ps = manualSliders.exposureTime;
  if (ps && poseAutoOn) ps.inp.disabled = true;
}

for (const [id, key] of MODE_SELECTS) {
  $(id).dataset.key = key;
  $(id).addEventListener('change', async (e) => {
    e.target.dataset.dirty = '1';
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
  for (const k in manualSliders) if (manualSliders[k]) manualSliders[k].dirty = false;
  for (const [id] of MODE_SELECTS) {
    const sel = $(id);
    if (sel) delete sel.dataset.dirty;
  }
  if (poseAutoOn) {
    $('poseAutoLuma').checked = false;
    poseAutoOn = false;
    stopLumaSampler();
    const ps = manualSliders.exposureTime;
    if (ps) ps.inp.disabled = !ps.supported;
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
  stopLumaSampler();
  stopAls();
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
    startAls().catch(() => {});
    if (poseAutoOn) startLumaSampler();
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
let centerOn = false;
let poseAutoOn = false;
let autoPoseSec = 0;
let lumaTimer = null;
let alsLux = null;
let alsSensor = null;
let alsHandler = null;

function poseRangeSeconds() {
  const caps = trackCaps();
  const c = caps.exposureTime;
  if (!c || c.min === undefined) return null;
  return {
    min: exposureSeconds(caps, c.min),
    max: Math.min(exposureSeconds(caps, c.max), 8),
  };
}

function lumaToPoseSeconds(luma) {
  const r = poseRangeSeconds();
  if (!r) return 0;
  const t = Math.pow(Math.max(0, Math.min(1, 1 - (luma || 0) / 255)), 2);
  return r.min + (r.max - r.min) * t;
}

function luxToPoseSeconds(lux) {
  const r = poseRangeSeconds();
  if (!r) return 0;
  const t = Math.pow(1 - Math.max(0, Math.min(1, Math.log10(lux + 1) / Math.log10(1001))), 2);
  return r.min + (r.max - r.min) * t;
}

function computeAutoPose() {
  const L = measureLuma($('cam2'));
  const pL = L === null ? 0 : lumaToPoseSeconds(L);
  const pX = alsLux === null ? 0 : luxToPoseSeconds(alsLux);
  autoPoseSec = Math.max(pL, pX);
  return autoPoseSec;
}

async function startAls() {
  try {
    if ('AmbientLightSensor' in window) {
      try {
        const perm = await navigator.permissions.query({ name: 'ambient-light-sensor' });
        if (perm.state === 'granted' || perm.state === 'prompt') {
          alsSensor = new AmbientLightSensor({ frequency: 2 });
          alsSensor.addEventListener('reading', () => { alsLux = alsSensor.illuminance; });
          alsSensor.start();
        }
      } catch (e) {}
    }
  } catch (e) {}
  if ('DeviceLightEvent' in window && !alsHandler) {
    try {
      if (DeviceLightEvent.requestPermission) {
        const r = await DeviceLightEvent.requestPermission();
        if (r !== 'granted') return;
      }
    } catch (e) {}
    alsHandler = (e) => { alsLux = e.value; };
    window.addEventListener('devicelight', alsHandler);
  }
}

function stopAls() {
  if (alsSensor) {
    try { alsSensor.stop(); } catch (e) {}
    alsSensor = null;
  }
  if (alsHandler) {
    window.removeEventListener('devicelight', alsHandler);
    alsHandler = null;
  }
  alsLux = null;
}

function updatePoseAutoLabel() {
  const s = manualSliders.exposureTime;
  if (!s) return;
  const caps = trackCaps();
  const c = caps.exposureTime;
  if (!c || c.min === undefined) return;
  const raw = c.max >= 10 ? autoPoseSec * 1000 : autoPoseSec;
  s.val.textContent = s.fmt(raw) + (alsLux !== null ? ` (${Math.round(alsLux)} lx)` : '');
}

function startLumaSampler() {
  stopLumaSampler();
  lumaTimer = setInterval(() => {
    if (!camTabRunning || !poseAutoOn) return;
    if (measureLuma($('cam2')) === null && alsLux === null) return;
    computeAutoPose();
    updatePoseAutoLabel();
  }, 500);
}

function stopLumaSampler() {
  if (lumaTimer) clearInterval(lumaTimer);
  lumaTimer = null;
}

$('poseAutoLuma').addEventListener('change', (e) => {
  poseAutoOn = e.target.checked;
  const ps = manualSliders.exposureTime;
  if (ps) {
    if (poseAutoOn) {
      ps.dirty = false;
      ps.inp.disabled = true;
    } else {
      ps.inp.disabled = !ps.supported;
    }
  }
  if (poseAutoOn && camTabRunning) {
    startAls().catch(() => {});
    startLumaSampler();
  } else {
    stopLumaSampler();
  }
});

let orientRAF = null;
let capturing = false;

window.addEventListener('deviceorientation', (e) => {
  if (e.gamma === null && e.beta === null) return;
  if (orientRAF !== null || typeof requestAnimationFrame !== 'function') return;
  orientRAF = requestAnimationFrame(() => {
    orientRAF = null;
    const dot = $('centerDot');
    if (!dot) return;
    if (!centerOn || !capturing) {
      dot.style.transform = '';
      return;
    }
    const max = 26;
    const x = Math.max(-max, Math.min(max, (e.gamma || 0) * 0.9));
    const y = Math.max(-max, Math.min(max, ((e.beta || 0) - 45) * 0.9));
    dot.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  });
});

$('btnCenter').addEventListener('click', async () => {
  if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
    try {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== 'granted') notify('ℹ️ Capteur d\'orientation refusé — le point restera au centre.');
    } catch (e) {}
  }
  centerOn = !centerOn;
  $('btnCenter').classList.toggle('on', centerOn);
  $('centerMark').hidden = !centerOn;
});

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

function collectDirtyConstraints() {
  const caps = trackCaps();
  const obj = {};
  for (const p of MANUAL_PARAMS) {
    const s = manualSliders[p.key];
    const c = caps[p.key];
    if (!s || !s.dirty || !c || c.min === undefined) continue;
    obj[p.key] = Number(s.inp.value);
    const modeFor = MODE_FOR_PARAM[p.key];
    if (modeFor) obj[modeFor.key] = 'manual';
  }
  for (const [id, key] of MODE_SELECTS) {
    const sel = $(id);
    if (sel && !sel.disabled && sel.dataset.dirty && sel.value) obj[key] = sel.value;
  }
  return obj;
}

async function applyManualNow() {
  if (!camTabRunning) return;
  const obj = collectDirtyConstraints();
  if (Object.keys(obj).length) await applyAdvanced(obj);
}

function exposureSeconds(caps, raw) {
  if (raw === undefined || raw === null) return 0;
  const c = caps && caps.exposureTime;
  return c && c.max >= 10 ? raw / 1000 : raw;
}

function poseSeconds() {
  const s = manualSliders.exposureTime;
  if (!s || !s.dirty) return 0;
  const caps = trackCaps();
  if (!caps.exposureTime || caps.exposureTime.min === undefined) return 0;
  const applied = trackSettings().exposureTime;
  const v = applied !== undefined ? applied : Number(s.inp.value);
  return exposureSeconds(caps, v);
}

function startShotCountdown(pose) {
  const el = $('shotCountdown');
  const t0 = performance.now();
  el.hidden = false;
  el.textContent = pose.toFixed(1);
  return setInterval(() => {
    const remaining = pose - (performance.now() - t0) / 1000;
    el.textContent = remaining > 0 ? remaining.toFixed(1) : '0.0';
  }, 100);
}

$('btnShot').addEventListener('click', async () => {
  $('manualPanel').hidden = true;
  $('btnManual').classList.remove('on');
  let cdTimer = null;
  let capStream = null;
  capturing = true;
  const t0 = performance.now();
  let bmp = null;
  let realPose = 0;
  try {
    if (camTimerOn) {
      const cs = $('camStatus');
      for (let i = 3; i > 0; i--) {
        cs.textContent = `Minuteur : ${i}…`;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    const obj = collectDirtyConstraints();
    let poseReq = 0;
    if (poseAutoOn) {
      poseReq = computeAutoPose();
      const c = trackCaps().exposureTime;
      if (c && c.min !== undefined && poseReq > 0) {
        obj.exposureTime = c.max >= 10 ? poseReq * 1000 : poseReq;
        obj.exposureMode = 'manual';
      }
    } else if (obj.exposureTime !== undefined) {
      poseReq = exposureSeconds(trackCaps(), obj.exposureTime);
    }
    if (poseReq > 2) {
      realPose = poseReq;
      cdTimer = startShotCountdown(realPose);
      $('camStatus').textContent = `Pose ${realPose.toFixed(1)} s…`;
      const autoExp = exposureSeconds(trackCaps(), trackSettings().exposureTime) || 1 / 30;
      const gain = Math.max(1, Math.min(8, realPose / autoExp));
      bmp = await accumulateLongExposure($('cam2'), realPose, isFrontCam(), 'none', 640, gain);
    } else if (!Object.keys(obj).length) {
      bmp = await captureFrame($('cam2'), undefined, isFrontCam(), 'none');
    } else {
      const variants = Object.keys(obj).length ? [[obj], []] : [[]];
      for (const [adv] of variants) {
        try {
          capStream = await openCaptureStream({ deviceId: currentDeviceId(), media: camMedia(), advanced: adv });
          const track = capStream.getVideoTracks()[0];
          const caps = track.getCapabilities ? track.getCapabilities() : {};
          if (Object.keys(adv).length) await applyAdvancedToTrack(track, adv);
          let rawApplied;
          if (adv.exposureTime !== undefined) {
            rawApplied = await waitAppliedExposure(track, adv.exposureTime);
          } else {
            const st = track.getSettings ? track.getSettings() : {};
            rawApplied = st.exposureTime;
          }
          realPose = exposureSeconds(caps, rawApplied !== undefined ? rawApplied : adv.exposureTime);
          if (realPose > 2) cdTimer = startShotCountdown(realPose);
          $('camStatus').textContent = realPose > 2 ? `Pose ${realPose.toFixed(1)} s…` : 'Capture en cours…';
          const blob = await captureBlobFromTrack(track);
          bmp = await blobToStill(blob, undefined, isFrontCam(), 'none');
          break;
        } catch (e) {
          if (cdTimer) { clearInterval(cdTimer); cdTimer = null; }
          $('shotCountdown').hidden = true;
          stopStream(capStream);
          capStream = null;
          bmp = null;
        }
      }
      if (!bmp) {
        await applyManualNow();
        realPose = poseSeconds();
        if (realPose > 2) cdTimer = startShotCountdown(realPose);
        await new Promise((r) => setTimeout(r, 250));
        $('camStatus').textContent = realPose > 2 ? `Pose ${realPose.toFixed(1)} s…` : 'Capture en cours…';
        bmp = await captureStill($('cam2'), undefined, isFrontCam(), 'none');
        await restorePose();
      }
    }
    lastShot = bmp;
    const cv = $('shotCanvas');
    cv.width = bmp.width;
    cv.height = bmp.height;
    cv.getContext('2d').drawImage(bmp, 0, 0);
    $('shotPreview').hidden = false;
    const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
    $('camStatus').textContent = realPose > 2
      ? `Photo prise en ${elapsed} s (pose appliquée ${realPose.toFixed(1)} s).`
      : 'Photo prise.';
  } catch (e) {
    notify(`❌ Photo : ${e.message}`);
  } finally {
    if (capStream) stopStream(capStream);
    capturing = false;
    const dot = $('centerDot');
    if (dot) dot.style.transform = '';
    if (cdTimer) clearInterval(cdTimer);
    $('shotCountdown').hidden = true;
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
  if (!file || imageBusy) {
    e.target.value = '';
    return;
  }
  setImageBusy(true);
  try {
    currentSource = await imageSource(file);
    refreshPreview();
  } catch (err) {
    notify(`❌ Image : ${err.message}`);
  } finally {
    setImageBusy(false);
    e.target.value = '';
  }
});

$('dither').addEventListener('change', refreshPreview);
$('printMode').addEventListener('change', () => {
  updateDitherUI();
  refreshPreview();
});
updateDitherUI();

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
