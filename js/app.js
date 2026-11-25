import { CatPrinter } from './printer.js';
import { textSource, imageSource, renderSourceToLines, drawPreview } from './image.js';
import { APP_VERSION } from './protocol.js';

const $ = (id) => document.getElementById(id);
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
  $('printerState').textContent = `État : ${text}`;
};

printer.onDisconnect = () => {
  $('connStatus').textContent = 'Déconnecté';
  $('btnConnect').disabled = false;
  $('btnDisconnect').disabled = true;
  $('btnPrint').disabled = true;
};

function currentMode() {
  return Number($('printMode').value);
}

function currentDither() {
  return currentSource && currentSource.kind === 'image' ? $('dither').checked : false;
}

function refreshPreview() {
  if ($('tabText').classList.contains('active')) {
    currentSource = textSource($('textInput').value, Number($('fontSize').value), $('fontFamily').value);
  }
  if (!currentSource) {
    drawPreview($('preview'), []);
    $('btnPrint').disabled = true;
    return;
  }
  const lines = renderSourceToLines(currentSource, { mode: 0, dither: currentDither() });
  drawPreview($('preview'), lines);
  $('btnPrint').disabled = !printer.connected || currentSource === null;
}

$('btnConnect').addEventListener('click', async () => {
  try {
    $('connStatus').textContent = 'Choisis ton imprimante dans la liste…';
    await printer.connect($('namePrefix').value.trim());
    $('connStatus').textContent = `Connecté : ${printer.device.name || printer.device.id}`;
    $('btnConnect').disabled = true;
    $('btnDisconnect').disabled = false;
    refreshPreview();
  } catch (e) {
    let msg = e.message;
    if (/disconnect|rejected|not connected|unavailable/i.test(msg)) {
      msg += ' — ferme l\'app FunPrint sur ton téléphone (une seule connexion à la fois), éteins puis rallume l\'imprimante, recharge cette page, puis réessaie.';
    }
    $('connStatus').textContent = `Erreur de connexion : ${msg}`;
  }
});

$('btnDisconnect').addEventListener('click', () => printer.disconnect());

$('btnState').addEventListener('click', async () => {
  try {
    const st = await printer.getState();
    $('printerState').textContent = st ? `État : ${st.text}` : 'Pas de réponse d\'état — essaie quand même « Imprimer », l\'état est informatif.';
  } catch (e) {
    $('printerState').textContent = `Erreur : ${e.message}`;
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

$('tabText').addEventListener('click', () => {
  $('tabText').classList.add('active');
  $('tabImage').classList.remove('active');
  $('paneText').hidden = false;
  $('paneImage').hidden = true;
  refreshPreview();
});

$('tabImage').addEventListener('click', () => {
  $('tabImage').classList.add('active');
  $('tabText').classList.remove('active');
  $('paneImage').hidden = false;
  $('paneText').hidden = true;
  refreshPreview();
});

$('textInput').addEventListener('input', refreshPreview);
$('fontSize').addEventListener('input', refreshPreview);
$('fontFamily').addEventListener('change', refreshPreview);

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
  navigator.bluetooth.getAvailability().then((ok) => {
    if (!ok) $('connStatus').textContent = 'Bluetooth éteint ou indisponible sur cet appareil : active-le, puis recharge la page.';
  });
  refreshPreview();
}

checkEnvironment();
