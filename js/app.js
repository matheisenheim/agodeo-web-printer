import { CatPrinter } from './printer.js';
import { renderTextToLines, renderImageFileToLines, drawPreview } from './image.js';

const $ = (id) => document.getElementById(id);
const printer = new CatPrinter();
let currentLines = [];
let imageFile = null;

printer.onLog = (msg) => {
  const log = $('log');
  log.textContent += `${msg}\n`;
  log.scrollTop = log.scrollHeight;
};

printer.onState = (flags, text) => {
  $('printerState').textContent = `État : ${text}`;
};

printer.onDisconnect = () => {
  $('connStatus').textContent = 'Déconnecté';
  $('btnConnect').disabled = false;
  $('btnDisconnect').disabled = true;
  $('btnPrint').disabled = true;
};

function refreshPreview() {
  if ($('tabText').classList.contains('active')) {
    currentLines = renderTextToLines($('textInput').value, {
      fontSize: Number($('fontSize').value),
      fontFamily: $('fontFamily').value,
    });
  }
  drawPreview($('preview'), currentLines);
  $('btnPrint').disabled = !printer.connected || currentLines.length === 0;
}

async function refreshImage() {
  if (!imageFile) return;
  currentLines = await renderImageFileToLines(imageFile, { dither: $('dither').checked });
  drawPreview($('preview'), currentLines);
  $('btnPrint').disabled = !printer.connected || currentLines.length === 0;
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
    $('connStatus').textContent = `Erreur de connexion : ${e.message}`;
  }
});

$('btnDisconnect').addEventListener('click', () => printer.disconnect());

$('btnState').addEventListener('click', async () => {
  try {
    const st = await printer.getState();
    $('printerState').textContent = st ? `État : ${st.text}` : 'Pas de réponse de l\'imprimante';
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
  refreshImage();
});

$('textInput').addEventListener('input', refreshPreview);
$('fontSize').addEventListener('input', refreshPreview);
$('fontFamily').addEventListener('change', refreshPreview);

$('imageInput').addEventListener('change', async (e) => {
  imageFile = e.target.files[0] || null;
  await refreshImage();
});

$('dither').addEventListener('change', refreshImage);

$('btnPrint').addEventListener('click', async () => {
  try {
    $('btnPrint').disabled = true;
    $('printStatus').textContent = `Impression de ${currentLines.length} lignes…`;
    const n = await printer.printLines(currentLines, {
      energy: Number($('energy').value),
      feed: Number($('feedSteps').value) || 50,
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
