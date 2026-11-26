// Carousel de filtres du photobooth.
// Chaque entrée : { name, css } (filtre CSS appliqué à l'aperçu vidéo et à la capture via ctx.filter)
// et optionnellement { draw(ctx, w, h, t) } pour un overlay dessiné (à refaire un par un).
export const FILTERS = [
  { name: 'Aucun', css: 'none', draw: null },
  { name: 'N&B', css: 'grayscale(1)', draw: null },
  { name: 'Sépia', css: 'sepia(0.85)', draw: null },
  { name: 'Chaud', css: 'sepia(0.35) saturate(1.5) contrast(1.05)', draw: null },
  { name: 'Froid', css: 'saturate(0.55) brightness(1.08) hue-rotate(160deg)', draw: null },
  { name: 'Contraste', css: 'contrast(1.7) saturate(1.3)', draw: null },
  { name: 'Inversé', css: 'invert(1) hue-rotate(180deg)', draw: null },
];
