// Carousel de filtres du photobooth.
// Chaque entrée : { name, css, draw } —
//   css  : filtre CSS appliqué à l'aperçu (video) et à la capture (ctx.filter)
//   draw : overlay (ctx, w, h, t) dessiné par-dessus, en live et dans la photo imprimée
// Stickers : emoji Twemoji (jdecked/twemoji, graphismes CC-BY 4.0 — voir vendor/twemoji/LICENSE-GRAPHICS.txt)
// embarqués en local dans vendor/twemoji/ pour rester 100 % hors ligne.

const EMOJI_CODES = ['1f385', '1f384', '2744', '1f431', '1f436'];
const EMOJI = {};

export function preloadFilters() {
  if (typeof Image === 'undefined') return;
  for (const code of EMOJI_CODES) {
    if (EMOJI[code]) continue;
    const img = new Image();
    img.src = `vendor/twemoji/${code}.svg`;
    EMOJI[code] = img;
  }
}

function emoji(c, code, dx, dy, dw, dh) {
  const img = EMOJI[code];
  if (!img || !img.complete || !img.naturalWidth) return;
  c.drawImage(img, dx, dy, dw, dh);
}

function drawFrame(c, w, h, color, lw, inset = 0) {
  c.strokeStyle = color;
  c.lineWidth = lw;
  c.strokeRect(inset + lw / 2, inset + lw / 2, w - 2 * (inset + lw / 2), h - 2 * (inset + lw / 2));
}

function whiskers(c, w, h, y0) {
  c.strokeStyle = 'rgba(0,0,0,0.55)';
  c.lineWidth = Math.max(1.5, w * 0.004);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const y = y0 + i * w * 0.02;
      c.beginPath();
      c.moveTo(w / 2 + side * w * 0.08, y);
      c.lineTo(w / 2 + side * (w * 0.08 + w * 0.13), y - (i - 1) * w * 0.008);
      c.stroke();
    }
  }
}

function drawSantaHat(c, w, h) {
  const dw = w * 0.34;
  emoji(c, '1f385', w / 2 - dw / 2, -dw * 0.52, dw, dw);
}

function drawSnowScene(c, w, h, t) {
  drawFrame(c, w, h, '#c0392b', Math.max(5, w * 0.022));
  emoji(c, '1f384', w * 0.76, h * 0.74, w * 0.2, w * 0.2);
  const n = 16;
  const s = Math.max(8, w * 0.03);
  for (let i = 0; i < n; i++) {
    const x = (((i * 137.5) % 997) / 997) * w;
    const speed = (18 + (i % 5) * 9) * (h / 600);
    const y = ((((t || 0) / 1000) * speed + ((i * 61.8) % h)) % h + h) % h;
    emoji(c, '2744', x, y, s, s);
  }
}

function drawCat(c, w, h) {
  const dw = w * 0.36;
  emoji(c, '1f431', w / 2 - dw / 2, -dw * 0.42, dw, dw);
  whiskers(c, w, h, h * 0.16);
}

function drawDog(c, w, h) {
  const dw = w * 0.36;
  emoji(c, '1f436', w / 2 - dw / 2, -dw * 0.48, dw, dw);
  whiskers(c, w, h, h * 0.16);
  c.fillStyle = '#3b2f2f';
  c.beginPath();
  c.ellipse(w / 2, h * 0.40, w * 0.045, w * 0.032, 0, 0, Math.PI * 2);
  c.fill();
}

export const FILTERS = [
  { name: 'Aucun', css: 'none', draw: null },
  { name: 'N&B', css: 'grayscale(1)', draw: null },
  { name: 'Sépia', css: 'sepia(0.85)', draw: null },
  { name: 'Chaud', css: 'sepia(0.35) saturate(1.5) contrast(1.05)', draw: null },
  { name: 'Froid', css: 'saturate(0.55) brightness(1.08) hue-rotate(160deg)', draw: null },
  { name: 'Contraste', css: 'contrast(1.7) saturate(1.3)', draw: null },
  { name: 'Inversé', css: 'invert(1) hue-rotate(180deg)', draw: null },
  { name: '🎩 Bonnet Noël', css: 'saturate(1.05)', draw: drawSantaHat },
  { name: '❄️ Neige', css: 'brightness(1.05) saturate(0.9)', draw: drawSnowScene },
  { name: '🐱 Chat', css: 'saturate(1.1)', draw: drawCat },
  { name: '🐶 Chien', css: 'saturate(1.1)', draw: drawDog },
];
