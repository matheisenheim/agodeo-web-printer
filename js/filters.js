function drawFrame(c, w, h, color, lw, inset = 0) {
  c.strokeStyle = color;
  c.lineWidth = lw;
  c.strokeRect(inset + lw / 2, inset + lw / 2, w - 2 * (inset + lw / 2), h - 2 * (inset + lw / 2));
}

function drawSnowflake(c, x, y, r) {
  c.save();
  c.strokeStyle = 'rgba(255,255,255,0.95)';
  c.lineWidth = Math.max(1, r * 0.22);
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    c.stroke();
  }
  c.restore();
}

function drawSantaHat(c, cx, cy, s) {
  c.save();
  c.fillStyle = '#d62828';
  c.beginPath();
  c.moveTo(cx - 3.2 * s, cy + 1.1 * s);
  c.quadraticCurveTo(cx - 1.2 * s, cy - 3.6 * s, cx + 2.6 * s, cy - 2.8 * s);
  c.quadraticCurveTo(cx + 3.8 * s, cy - 1.8 * s, cx + 3.2 * s, cy + 1.1 * s);
  c.closePath();
  c.fill();
  c.fillStyle = '#fff';
  c.beginPath();
  c.ellipse(cx, cy + 1.15 * s, 3.7 * s, 1.05 * s, 0, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.arc(cx + 2.9 * s, cy - 2.7 * s, 0.95 * s, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function drawBalloon(c, x, y, r, color) {
  c.save();
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(x, y, r, r * 1.25, 0, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.moveTo(x - r * 0.2, y + r * 1.25);
  c.lineTo(x + r * 0.2, y + r * 1.25);
  c.lineTo(x, y + r * 1.55);
  c.closePath();
  c.fill();
  c.strokeStyle = 'rgba(0,0,0,0.35)';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(x, y + r * 1.55);
  c.quadraticCurveTo(x + r * 0.4, y + r * 2.2, x - r * 0.2, y + r * 2.8);
  c.stroke();
  c.restore();
}

function drawLeaf(c, x, y, r, angle, color) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(0, 0, r, r * 0.45, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = 'rgba(0,60,0,0.5)';
  c.lineWidth = Math.max(1, r * 0.08);
  c.beginPath();
  c.moveTo(-r, 0);
  c.lineTo(r, 0);
  c.stroke();
  c.restore();
}

function drawFlower(c, x, y, r, petal) {
  c.save();
  for (let i = 0; i < 5; i++) {
    const a = (Math.PI * 2 / 5) * i;
    c.fillStyle = petal;
    c.beginPath();
    c.ellipse(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.55, r * 0.55, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = '#f1c40f';
  c.beginPath();
  c.arc(x, y, r * 0.45, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function drawXmas(c, w, h, t) {
  const lw = Math.max(5, w * 0.022);
  drawFrame(c, w, h, '#c0392b', lw);
  drawFrame(c, w, h, 'rgba(255,255,255,0.9)', Math.max(2, w * 0.008), lw * 1.4);
  drawSantaHat(c, w * 0.30, h * 0.10, w * 0.045);
  for (let i = 0; i < 22; i++) {
    const x = (((i * 137.5) % 997) / 997) * w;
    const speed = (18 + (i % 5) * 9) * (h / 600);
    const y = ((((t || 0) / 1000) * speed + ((i * 61.8) % h)) % h + h) % h;
    drawSnowflake(c, x, y, 2.5 + (i % 4) * 1.8);
  }
}

function drawFestive(c, w, h, t) {
  const lw = Math.max(5, w * 0.02);
  drawFrame(c, w, h, '#d4af37', lw);
  drawBalloon(c, w * 0.12, h * 0.14, w * 0.035, '#e74c3c');
  drawBalloon(c, w * 0.88, h * 0.12, w * 0.035, '#3498db');
  const colors = ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#ffffff'];
  for (let i = 0; i < 30; i++) {
    const x = (((i * 89.3) % 991) / 991) * w;
    const speed = (25 + (i % 6) * 10) * (h / 600);
    const y = ((((t || 0) / 1000) * speed + ((i * 47.7) % h)) % h + h) % h;
    c.save();
    c.translate(x, y);
    c.rotate((i * 0.7 + (t || 0) / 500) % Math.PI);
    c.fillStyle = colors[i % colors.length];
    c.fillRect(-w * 0.006, -w * 0.003, w * 0.012, w * 0.006);
    c.restore();
  }
}

function drawBirthday(c, w, h) {
  const lw = Math.max(4, w * 0.016);
  drawFrame(c, w, h, '#e84393', lw);
  const cx = w / 2;
  const baseY = h * 0.92;
  const s = w * 0.09;
  c.fillStyle = '#f8c8dc';
  c.fillRect(cx - s * 1.6, baseY - s * 0.9, s * 3.2, s * 0.9);
  c.fillStyle = '#fff';
  c.fillRect(cx - s * 1.6, baseY - s * 0.9, s * 3.2, s * 0.18);
  c.fillStyle = '#f8c8dc';
  c.fillRect(cx - s * 1.1, baseY - s * 1.7, s * 2.2, s * 0.8);
  c.fillStyle = '#fff';
  c.fillRect(cx - s * 1.1, baseY - s * 1.7, s * 2.2, s * 0.16);
  const candleColors = ['#3498db', '#f1c40f', '#e74c3c'];
  for (let i = -1; i <= 1; i++) {
    const bx = cx + i * s * 0.7;
    c.fillStyle = candleColors[i + 1];
    c.fillRect(bx - s * 0.07, baseY - s * 2.15, s * 0.14, s * 0.45);
    c.fillStyle = '#ff9f1a';
    c.beginPath();
    c.ellipse(bx, baseY - s * 2.32, s * 0.09, s * 0.16, 0, 0, Math.PI * 2);
    c.fill();
  }
  drawBalloon(c, w * 0.14, h * 0.15, w * 0.035, '#f1c40f');
  drawBalloon(c, w * 0.86, h * 0.13, w * 0.035, '#2ecc71');
}

function drawNature(c, w, h) {
  const lw = Math.max(4, w * 0.016);
  drawFrame(c, w, h, '#2d6a4f', lw);
  const corners = [
    [w * 0.08, h * 0.08, 0.5],
    [w * 0.92, h * 0.08, -0.5],
    [w * 0.08, h * 0.92, 2.6],
    [w * 0.92, h * 0.92, -2.6],
  ];
  for (const [x, y, baseA] of corners) {
    for (let i = 0; i < 4; i++) {
      drawLeaf(c, x, y, w * (0.02 + i * 0.008), baseA + i * 0.55, i % 2 ? '#40916c' : '#74c69d');
    }
  }
  drawFlower(c, w * 0.5, h * 0.09, w * 0.022, '#ffafcc');
  drawFlower(c, w * 0.2, h * 0.9, w * 0.018, '#ffc8dd');
  drawFlower(c, w * 0.8, h * 0.9, w * 0.018, '#ffc8dd');
}

function drawAnimal(c, w, h) {
  const s = w * 0.075;
  const topY = h * 0.02;
  for (const side of [-1, 1]) {
    const cx = w / 2 + side * s * 1.1;
    c.fillStyle = '#8d6e63';
    c.beginPath();
    c.moveTo(cx - s * 0.9, topY + s * 0.9);
    c.lineTo(cx, topY - s * 0.2);
    c.lineTo(cx + s * 0.9, topY + s * 0.9);
    c.closePath();
    c.fill();
    c.fillStyle = '#ffb3c1';
    c.beginPath();
    c.moveTo(cx - s * 0.45, topY + s * 0.6);
    c.lineTo(cx, topY + s * 0.15);
    c.lineTo(cx + s * 0.45, topY + s * 0.6);
    c.closePath();
    c.fill();
  }
  c.strokeStyle = 'rgba(0,0,0,0.55)';
  c.lineWidth = Math.max(1.5, w * 0.004);
  const wy = h * 0.16;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const y = wy + i * s * 0.28;
      c.beginPath();
      c.moveTo(w / 2 + side * w * 0.06, y);
      c.lineTo(w / 2 + side * (w * 0.06 + s * 1.3), y - (i - 1) * s * 0.12 * side);
      c.stroke();
    }
  }
}

export const FILTERS = [
  { name: 'Aucun', css: 'none', draw: null },
  { name: 'N&B', css: 'grayscale(1)', draw: null },
  { name: 'Sépia', css: 'sepia(0.85)', draw: null },
  { name: 'Chaud', css: 'sepia(0.35) saturate(1.5) contrast(1.05)', draw: null },
  { name: 'Froid', css: 'saturate(0.55) brightness(1.08) hue-rotate(160deg)', draw: null },
  { name: 'Contraste', css: 'contrast(1.7) saturate(1.3)', draw: null },
  { name: 'Inversé', css: 'invert(1) hue-rotate(180deg)', draw: null },
  { name: '🎄 Noël', css: 'saturate(1.1)', draw: drawXmas },
  { name: '🎉 Festif', css: 'saturate(1.2)', draw: drawFestive },
  { name: '🎂 Anniversaire', css: 'saturate(1.15)', draw: drawBirthday },
  { name: '🌿 Nature', css: 'saturate(1.1) brightness(1.03)', draw: drawNature },
  { name: '🐱 Animaux', css: 'saturate(1.1)', draw: drawAnimal },
];
