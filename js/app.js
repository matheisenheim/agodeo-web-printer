import { CatPrinter } from './printer.js';
import { textSource, imageSource, qrSource, renderSourceToLines, drawPreview } from './image.js';
import { TEMPLATES, templateSource, testCardSource } from './templates.js';
import { startCamera, stopCamera, cameraRunning, captureFrame } from './photobooth.js';
import { APP_VERSION } from './protocol.js';

const $ = (id) => document.getElementById(id);
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
  return Number($('printMode').value);
}

function currentDither() {
  if (!currentSource) return false;
  if (currentSource.kind === 'image' || currentSource.kind === 'photobooth') return $('dither').checked;
  return false;
}

function activeTab() {
  if ($('tabQr').classList.contains('active')) return 'qr';
  if ($('tabImage').classList.contains('active')) return 'image';
  if ($('tabTemplate').classList.contains('active')) return 'template';
  if ($('tabPhotobooth').classList.contains('active')) return 'photobooth';
  return 'text';
}

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
  const tab = activeTab();
  if (tab === 'text') {
    currentSource = textSource($('textInput').value, Number($('fontSize').value), $('fontFamily').value);
  } else if (tab === 'qr') {
    currentSource = qrSource($('qrText').value);
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
    await printer.connect($('namePrefix').value.trim());
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
    $('printerState').textContent = `Firmware : ${info.version || '?'} — type (B0) : ${typeTxt} — impressions (A7) : ${countTxt}`;
  } catch (e) {
    $('printerState').textContent = `Erreur : ${e.message}`;
  }
});

$('btnCancel').addEventListener('click', async () => {
  try {
    await printer.cancel();
    $('printStatus').textContent = 'Annulation envoyée (AC).';
  } catch (e) {
    $('printStatus').textContent = `Erreur : ${e.message}`;
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
    await printer.feed(Number($('feedSteps').value) || 50);
    $('printStatus').textContent = 'Papier avancé.';
  } catch (e) {
    $('printStatus').textContent = `Erreur : ${e.message}`;
  }
});

const TABS = { Text: 'paneText', Image: 'paneImage', Qr: 'paneQr', Template: 'paneTemplate', Photobooth: 'panePhotobooth' };

let savedMode = null;

function switchTab(tab) {
  for (const [name, pane] of Object.entries(TABS)) {
    $(`tab${name}`).classList.toggle('active', name === tab);
    $(pane).hidden = name !== tab;
  }
  if (tab === 'Photobooth') {
    if (savedMode === null) savedMode = $('printMode').value;
    $('printMode').value = '2';
  } else if (savedMode !== null) {
    $('printMode').value = savedMode;
    savedMode = null;
  }
  if (tab !== 'Photobooth' && cameraRunning()) {
    stopCamera($('cam'));
    $('btnCam').textContent = 'Démarrer la caméra';
    $('btnCapture').disabled = true;
  }
  refreshPreview();
}

$('tabText').addEventListener('click', () => switchTab('Text'));
$('tabImage').addEventListener('click', () => switchTab('Image'));
$('tabQr').addEventListener('click', () => switchTab('Qr'));
$('tabTemplate').addEventListener('click', () => switchTab('Template'));
$('tabPhotobooth').addEventListener('click', () => switchTab('Photobooth'));

function applyMirror() {
  $('cam').classList.toggle('mirrored', $('pbMirror').checked);
}

$('pbMirror').addEventListener('change', applyMirror);

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

$('btnCam').addEventListener('click', async () => {
  try {
    if (cameraRunning()) {
      stopCamera($('cam'));
      $('btnCam').textContent = 'Démarrer la caméra';
      $('btnCapture').disabled = true;
      return;
    }
    $('connStatus').textContent = 'Demande d\'accès à la caméra… (autorise-la dans le navigateur)';
    await startCamera($('cam'));
    applyMirror();
    $('btnCam').textContent = 'Arrêter la caméra';
    $('btnCapture').disabled = false;
    $('connStatus').textContent = 'Caméra active.';
  } catch (e) {
    $('connStatus').textContent = `Caméra : ${e.message}`;
  }
});

$('btnCapture').addEventListener('click', async () => {
  try {
    if ($('pbTimer').checked) await countdown(3);
    const bmp = await captureFrame($('cam'), undefined, $('pbMirror').checked);
    currentSource = $('pbFrame').checked
      ? { kind: 'photobooth', bmp, label: $('pbLabel').value }
      : { kind: 'image', bmp };
    refreshPreview();
    $('printStatus').textContent = 'Photo capturée — « Imprimer » pour la sortir.';
  } catch (e) {
    $('printStatus').textContent = `Erreur capture : ${e.message}`;
  }
});

$('btnTestCard').addEventListener('click', async () => {
  currentSource = testCardSource();
  refreshPreview();
  if (printer.connected) {
    $('printStatus').textContent = 'Impression de la page de test…';
    $('btnPrint').click();
  } else {
    $('printStatus').textContent = 'Page de test prête dans l\'aperçu — connecte l\'imprimante puis « Imprimer ».';
  }
});

window.addEventListener('beforeunload', () => stopCamera($('cam')));

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
    $('printStatus').textContent = `envoyé : cmd=0x${cmd.toString(16)} payload=${payloadHex || '(vide)'}`;
  } catch (e) {
    $('printStatus').textContent = `Labo : ${e.message}`;
  }
}

$('btnLabSend').addEventListener('click', () => labSend($('labCmd').value, $('labPayload').value));

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

$('btnPrint').addEventListener('click', async () => {
  try {
    $('btnPrint').disabled = true;
    const mode = currentMode();
    const lines = renderSourceToLines(currentSource, { mode, dither: currentDither() });
    $('printStatus').textContent = `Impression de ${lines.length} lignes (mode ${mode === 2 ? '4 bits / 16 gris — HD' : '1 bit mono'})…`;
    const n = await printer.printLines(lines, {
      energy: Number($('energy').value),
      feed: Number($('feedSteps').value) || 50,
      mode,
    });
    $('printStatus').textContent = `Terminé : ${n} lignes envoyées.`;
  } catch (e) {
    $('printStatus').textContent = `Erreur : ${e.message}`;
  } finally {
    refreshPreview();
  }
});

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
printer.onLog('app prête — si ce message manque, le JS n\'a pas charge correctement (vide le cache / Ctrl+F5)');

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
