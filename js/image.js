import { PRINT_WIDTH, LINE_BYTES } from './protocol.js';

export function renderTextToLines(text, opts = {}) {
  const fontSize = opts.fontSize ?? 24;
  const fontFamily = opts.fontFamily ?? 'sans-serif';
  const padding = opts.padding ?? 8;
  const meas = document.createElement('canvas').getContext('2d');
  meas.font = `${fontSize}px ${fontFamily}`;
  const maxW = PRINT_WIDTH - padding * 2;
  const words = String(text).split(/\s+/).filter(Boolean);
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
  const canvas = document.createElement('canvas');
  canvas.width = PRINT_WIDTH;
  canvas.height = Math.max(1, wrapped.length * lineH + padding * 2);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000000';
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textBaseline = 'top';
  wrapped.forEach((ln, i) => ctx.fillText(ln, padding, padding + i * lineH));
  return bitmapFromCanvas(canvas, false);
}

export async function renderImageFileToLines(file, opts = {}) {
  const dither = opts.dither ?? true;
  const bmp = await createImageBitmap(file);
  const h = Math.max(1, Math.round((bmp.height * PRINT_WIDTH) / bmp.width));
  const canvas = document.createElement('canvas');
  canvas.width = PRINT_WIDTH;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, PRINT_WIDTH, h);
  bmp.close();
  return bitmapFromCanvas(canvas, dither);
}

export function bitmapFromCanvas(canvas, dither) {
  const { width, height } = canvas;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, width, height).data;
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    gray[i] = 0.299 * img[o] + 0.587 * img[o + 1] + 0.114 * img[o + 2];
  }
  if (dither) floydSteinberg(gray, width, height);
  const lines = [];
  for (let y = 0; y < height; y++) {
    const line = new Uint8Array(LINE_BYTES);
    for (let x = 0; x < width; x++) {
      if (gray[y * width + x] < 128) line[x >> 3] |= 1 << (x & 7);
    }
    lines.push(line);
  }
  return lines;
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
    for (let b = 0; b < line.length; b++) {
      for (let bit = 0; bit < 8; bit++) {
        if (line[b] & (1 << bit)) ctx.fillRect(b * 8 + bit, y, 1, 1);
      }
    }
  });
}
