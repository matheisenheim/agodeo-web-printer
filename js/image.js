import { PRINT_WIDTH, LINE_BYTES, APP_VERSION } from './protocol.js';
import { qrMatrix } from './qr.js';
import { renderTestCard } from './templates.js';

export const LINE_BYTES_4BPP = PRINT_WIDTH / 2;

export function textSource(text, fontSize, fontFamily) {
  return { kind: 'text', text, fontSize, fontFamily };
}

export async function imageSource(file) {
  const bmp = await createImageBitmap(file);
  return { kind: 'image', bmp };
}

export function sourceToCanvas(source) {
  const canvas = document.createElement('canvas');
  canvas.width = PRINT_WIDTH;
  if (source.kind === 'template') {
    return source.tpl.render(source.values || {}, PRINT_WIDTH);
  }
  if (source.kind === 'testcard') {
    return renderTestCard(PRINT_WIDTH, APP_VERSION);
  }
  if (source.kind === 'photobooth') {
    const photo = sourceToCanvas({ kind: 'image', bmp: source.bmp });
    const headH = 66;
    const canvas = document.createElement('canvas');
    canvas.width = PRINT_WIDTH;
    canvas.height = photo.height + headH + 14;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
    ctx.lineWidth = 1;
    ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(source.label || 'Souriez !', canvas.width / 2, 16);
    ctx.font = '15px sans-serif';
    ctx.fillText(new Date().toLocaleDateString('fr-FR'), canvas.width / 2, 44);
    ctx.drawImage(photo, 0, headH + 8);
    return canvas;
  }
  if (source.kind === 'qr') {
    const qr = qrMatrix(source.text);
    const count = qr.getModuleCount();
    const quiet = 4;
    const cell = Math.max(1, Math.floor(PRINT_WIDTH / (count + quiet * 2)));
    const size = cell * (count + quiet * 2);
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, size);
    ctx.fillStyle = '#000000';
    const off = Math.floor((PRINT_WIDTH - cell * (count + quiet * 2)) / 2);
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) ctx.fillRect(off + (c + quiet) * cell, (r + quiet) * cell, cell, cell);
      }
    }
    return canvas;
  }
  if (source.kind === 'text') {
    const fontSize = source.fontSize ?? 24;
    const fontFamily = source.fontFamily ?? 'sans-serif';
    const padding = 8;
    const meas = document.createElement('canvas').getContext('2d');
    meas.font = `${fontSize}px ${fontFamily}`;
    const maxW = PRINT_WIDTH - padding * 2;
    const words = String(source.text).split(/\s+/).filter(Boolean);
    const wrapped = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (meas.measureText(t).width > maxW && cur) {
        wrapped.push(cur);
        cur = w;
      } else {
        cur = t;
      }
    }
    if (cur) wrapped.push(cur);
    if (!wrapped.length) wrapped.push('');
    const lineH = Math.ceil(fontSize * 1.25);
    canvas.height = Math.max(1, wrapped.length * lineH + padding * 2);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'top';
    wrapped.forEach((ln, i) => ctx.fillText(ln, padding, padding + i * lineH));
    return canvas;
  }
  const bmp = source.bmp;
  canvas.height = Math.max(1, Math.round((bmp.height * PRINT_WIDTH) / bmp.width));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, PRINT_WIDTH, canvas.height);
  return canvas;
}

export function bitmapFromCanvas(canvas, dither, mode) {
  const { width, height } = canvas;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, width, height).data;
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    gray[i] = 0.299 * img[o] + 0.587 * img[o + 1] + 0.114 * img[o + 2];
  }
  const lines = [];
  if (mode === 2) {
    for (let y = 0; y < height; y++) {
      const line = new Uint8Array(LINE_BYTES_4BPP);
      for (let x = 0; x < width; x++) {
        const v = 15 - Math.round((gray[y * width + x] / 255) * 15);
        if (x % 2 === 0) line[x >> 1] |= v & 0x0f;
        else line[x >> 1] |= (v & 0x0f) << 4;
      }
      lines.push(line);
    }
    return lines;
  }
  if (dither) floydSteinberg(gray, width, height);
  for (let y = 0; y < height; y++) {
    const line = new Uint8Array(LINE_BYTES);
    for (let x = 0; x < width; x++) {
      if (gray[y * width + x] < 128) line[x >> 3] |= 1 << (x & 7);
    }
    lines.push(line);
  }
  return lines;
}

export function renderSourceToLines(source, opts = {}) {
  const mode = opts.mode ?? 0;
  const dither = opts.dither ?? true;
  return bitmapFromCanvas(sourceToCanvas(source), dither, mode);
}

function floydSteinberg(gray, w, h) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const old = gray[i];
      const neu = old < 128 ? 0 : 255;
      const err = old - neu;
      gray[i] = neu;
      if (x + 1 < w) gray[i + 1] += (err * 7) / 16;
      if (y + 1 < h) {
        if (x > 0) gray[i + w - 1] += (err * 3) / 16;
        gray[i + w] += (err * 5) / 16;
        if (x + 1 < w) gray[i + w + 1] += err / 16;
      }
    }
  }
}

export function drawPreview(canvas, lines) {
  canvas.height = Math.max(1, lines.length);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000000';
  lines.forEach((line, y) => {
    for (let b = 0; b < line.length && b * 8 < canvas.width; b++) {
      for (let bit = 0; bit < 8; bit++) {
        if (line[b] & (1 << bit)) ctx.fillRect(b * 8 + bit, y, 1, 1);
      }
    }
  });
}
