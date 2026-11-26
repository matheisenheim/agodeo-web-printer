// Carousel de filtres du photobooth : filtres CSS uniquement.
// Chaque entrée : { name, css } — appliqué à l'aperçu (video) et à la capture (ctx.filter).
export const FILTERS = [
  { name: 'Aucun', css: 'none' },
  { name: 'N&B', css: 'grayscale(1)' },
  { name: 'Sépia', css: 'sepia(0.85)' },
  { name: 'Chaud', css: 'sepia(0.35) saturate(1.5) contrast(1.05)' },
  { name: 'Froid', css: 'saturate(0.55) brightness(1.08) hue-rotate(160deg)' },
  { name: 'Contraste', css: 'contrast(1.7) saturate(1.3)' },
  { name: 'Inversé', css: 'invert(1) hue-rotate(180deg)' },
];
