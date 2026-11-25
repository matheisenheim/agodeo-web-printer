import { PRINT_WIDTH } from './protocol.js';
import { qrMatrix } from './qr.js';

const INK = '#000000';
const PAPER = '#ffffff';

function wrapLines(ctx, text, maxW) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = t;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

function drawTeaLeaf(ctx, x, y, size, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.bezierCurveTo(size * 0.75, -size * 0.35, size * 0.75, size * 0.35, 0, size);
  ctx.bezierCurveTo(-size * 0.75, size * 0.35, -size * 0.75, -size * 0.35, 0, -size);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = Math.max(1, size * 0.09);
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.75);
  ctx.lineTo(0, size * 0.75);
  for (let i = 1; i <= 3; i++) {
    const yy = -size * 0.75 + (size * 1.5 * i) / 4;
    ctx.moveTo(0, yy);
    ctx.lineTo(size * 0.3, yy - size * 0.14);
    ctx.moveTo(0, yy);
    ctx.lineTo(-size * 0.3, yy - size * 0.14);
  }
  ctx.stroke();
  ctx.restore();
}

function reliefFrame(ctx, w, h, pad) {
  ctx.fillStyle = '#6f6f6f';
  ctx.fillRect(pad + 3, pad + 3, w - 2 * pad - 6, h - 2 * pad - 6);
  ctx.fillStyle = PAPER;
  ctx.fillRect(pad, pad, w - 2 * pad, h - 2 * pad);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(pad + 1.5, pad + 1.5, w - 2 * pad - 3, h - 2 * pad - 3);
  ctx.lineWidth = 1;
  ctx.strokeRect(pad + 8, pad + 8, w - 2 * pad - 16, h - 2 * pad - 16);
  const s = 12;
  drawTeaLeaf(ctx, pad + 17, pad + 17, s, Math.PI / 4);
  drawTeaLeaf(ctx, w - pad - 17, pad + 17, s, -Math.PI / 4);
  drawTeaLeaf(ctx, pad + 17, h - pad - 17, s, -Math.PI / 4);
  drawTeaLeaf(ctx, w - pad - 17, h - pad - 17, s, Math.PI / 4);
}

function drawQr(ctx, url, qx, qy, box) {
  const qr = qrMatrix(url);
  const count = qr.getModuleCount();
  const cell = Math.max(2, Math.floor(box / (count + 8)));
  const side = cell * (count + 8);
  ctx.fillStyle = PAPER;
  ctx.fillRect(qx, qy, side, side);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.strokeRect(qx, qy, side, side);
  ctx.fillStyle = INK;
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) ctx.fillRect(qx + (c + 4) * cell, qy + (r + 4) * cell, cell, cell);
    }
  }
}

const FIELDS = [
  { key: 'nom', label: 'Nom du thé', def: 'EARL GREY' },
  { key: 'sous', label: 'Origine / notes', def: 'Bergamote · Sri Lanka — Uva Highlands' },
  { key: 'poids', label: 'Poids / conditionnement', def: '100 g — 20 sachets' },
  { key: 'url', label: 'URL du QR (optionnel)', def: '' },
];

function layoutHeights(v, nomSize, sousSize, poidsSize, inner, hasQr, qrBox, pad) {
  const meas = document.createElement('canvas').getContext('2d');
  meas.font = `bold ${nomSize}px serif`;
  const nomLines = wrapLines(meas, v.nom, inner);
  meas.font = `${sousSize}px sans-serif`;
  const sousLines = wrapLines(meas, v.sous, inner);
  const h = pad * 2 + 14
    + nomLines.length * nomSize * 1.15 + 6
    + sousLines.length * sousSize * 1.3 + 6
    + poidsSize + 14
    + (hasQr ? qrBox + 10 : 0);
  return { nomLines, sousLines, h: Math.ceil(h) };
}

function renderRelief(v, w) {
  const pad = 16;
  const inner = w - 2 * (pad + 14);
  const nomSize = 40;
  const sousSize = 20;
  const poidsSize = 18;
  const hasQr = !!(v.url && v.url.trim());
  const qrBox = 84;
  const { nomLines, sousLines, h } = layoutHeights(v, nomSize, sousSize, poidsSize, inner, hasQr, qrBox, pad);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  reliefFrame(ctx, w, h, pad);
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  let y = pad + 14;
  ctx.font = `bold ${nomSize}px serif`;
  for (const ln of nomLines) {
    ctx.fillText(ln, w / 2, y);
    y += nomSize * 1.15;
  }
  y += 6;
  ctx.font = `${sousSize}px sans-serif`;
  for (const ln of sousLines) {
    ctx.fillText(ln, w / 2, y);
    y += sousSize * 1.3;
  }
  y += 6;
  ctx.font = `${poidsSize}px sans-serif`;
  ctx.fillText(v.poids || '', w / 2, y);
  if (hasQr) {
    drawQr(ctx, v.url, w - pad - 14 - qrBox, h - pad - 14 - qrBox, qrBox);
  }
  return canvas;
}

function renderMedallion(v, w) {
  const pad = 16;
  const inner = w - 2 * (pad + 14);
  const R = 46;
  const nomSize = 36;
  const sousSize = 19;
  const poidsSize = 17;
  const meas = document.createElement('canvas').getContext('2d');
  meas.font = `bold ${nomSize}px serif`;
  const nomLines = wrapLines(meas, v.nom, inner);
  meas.font = `${sousSize}px sans-serif`;
  const sousLines = wrapLines(meas, v.sous, inner);
  const h = Math.ceil(pad * 2 + R * 2 + 12 + nomLines.length * nomSize * 1.15 + 6 + sousLines.length * sousSize * 1.3 + 6 + poidsSize + 10);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  const cx = w / 2;
  const cy = pad + R;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, R - 6, 0, Math.PI * 2);
  ctx.stroke();
  drawTeaLeaf(ctx, cx, cy, R * 0.55, -Math.PI / 6);
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  let y = cy + R + 12;
  ctx.font = `bold ${nomSize}px serif`;
  for (const ln of nomLines) {
    ctx.fillText(ln, cx, y);
    y += nomSize * 1.15;
  }
  y += 6;
  ctx.font = `${sousSize}px sans-serif`;
  for (const ln of sousLines) {
    ctx.fillText(ln, cx, y);
    y += sousSize * 1.3;
  }
  y += 6;
  ctx.font = `${poidsSize}px sans-serif`;
  ctx.fillText(v.poids || '', cx, y);
  return canvas;
}

function renderBandeau(v, w) {
  const pad = 16;
  const inner = w - 2 * (pad + 14);
  const nomSize = 38;
  const sousSize = 19;
  const poidsSize = 17;
  const brancheH = 34;
  const meas = document.createElement('canvas').getContext('2d');
  meas.font = `bold ${nomSize}px serif`;
  const nomLines = wrapLines(meas, v.nom, inner);
  meas.font = `${sousSize}px sans-serif`;
  const sousLines = wrapLines(meas, v.sous, inner);
  const h = Math.ceil(pad * 2 + 10 + brancheH + 10 + nomLines.length * nomSize * 1.15 + 6 + sousLines.length * sousSize * 1.3 + 6 + poidsSize + 12);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  reliefFrame(ctx, w, h, pad);
  const y0 = pad + 10 + brancheH / 2;
  const x0 = pad + 24;
  const x1 = w - pad - 24;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(w / 2, y0 + 8, x1, y0);
  ctx.stroke();
  const n = 5;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = x0 + (x1 - x0) * t;
    const y = y0 + 4 * Math.sin(Math.PI * t) + 4;
    drawTeaLeaf(ctx, x, y - 8, 10, -Math.PI / 2 + (t - 0.5) * 0.8);
  }
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  let y = pad + 10 + brancheH + 10;
  ctx.font = `bold ${nomSize}px serif`;
  for (const ln of nomLines) {
    ctx.fillText(ln, w / 2, y);
    y += nomSize * 1.15;
  }
  y += 6;
  ctx.font = `${sousSize}px sans-serif`;
  for (const ln of sousLines) {
    ctx.fillText(ln, w / 2, y);
    y += sousSize * 1.3;
  }
  y += 6;
  ctx.font = `${poidsSize}px sans-serif`;
  ctx.fillText(v.poids || '', w / 2, y);
  return canvas;
}

export const TEMPLATES = [
  {
    id: 'relief-tea',
    name: 'Boîte à thé — cadre bas-relief & feuilles (QR optionnel)',
    fields: FIELDS,
    render: renderRelief,
  },
  {
    id: 'medaillon',
    name: 'Médaillon « sceau de thé »',
    fields: FIELDS.filter((f) => f.key !== 'url'),
    render: renderMedallion,
  },
  {
    id: 'bandeau',
    name: 'Bandeau — branche de thé en haut',
    fields: FIELDS.filter((f) => f.key !== 'url'),
    render: renderBandeau,
  },
];

export function templateSource(tpl, values) {
  return { kind: 'template', tpl, values };
}
