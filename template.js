// Template della carta: fondo, cornici, nome, frase e QR disegnati dal server.
// L'AI genera solo l'illustrazione che va nel riquadro (PANEL).
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const QRCode = require('qrcode');
const opentype = require('opentype.js');

const W = 1200, H = 1800;
const PANEL = { x: 80, y: 72, w: 1040, h: 1300, r: 26 }; // 4:5, come l'illustrazione generata
const QRBOX = { x: 150, y: 1548, s: 184 };

const ORO = '#d9b45a', CREMA = '#f6ecd6';

function font(file) {
  const b = fs.readFileSync(path.join(__dirname, 'fonts', file));
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
}
const TITOLO = font('Cinzel.ttf');
const CORSIVO = font('CG-MediumItalic.ttf');

// Testo -> tracciato SVG, lettera per lettera (senza legature né kerning automatico, che in alcuni font producono valori non validi)
function avanzamento(f, g, k) {
  const a = Number.isFinite(g.advanceWidth) ? g.advanceWidth : (g.getBoundingBox().x2 || f.unitsPerEm * 0.5);
  return a * k;
}
function larghezza(f, text, size, spacing = 0) {
  const k = size / f.unitsPerEm;
  return [...text].reduce((t, ch) => t + avanzamento(f, f.charToGlyph(ch), k) + spacing * size, 0) - spacing * size;
}
function testoPath(f, text, size, spacing = 0) {
  const k = size / f.unitsPerEm;
  return {
    larghezza: larghezza(f, text, size, spacing),
    d: (x, y) => {
      let cx = x, out = '';
      for (const ch of text) {
        const g = f.charToGlyph(ch);
        const pd = g.getPath(cx, y, size).toPathData(2);
        if (!pd.includes('NaN')) out += pd;
        cx += avanzamento(f, g, k) + spacing * size;
      }
      return out;
    }
  };
}

function aCapo(f, text, size, maxW) {
  // Se possibile spezza su due righe alla punteggiatura (punto, due punti, virgola), scegliendo il taglio più bilanciato
  let migliore = null;
  for (const m of text.matchAll(/[.:,] /g)) {
    const r1 = text.slice(0, m.index + 1), r2 = text.slice(m.index + 2);
    const w1 = larghezza(f, r1, size), w2 = larghezza(f, r2, size);
    if (w1 <= maxW && w2 <= maxW) {
      const diff = Math.abs(w1 - w2) + (m[0][0] === '.' ? 0 : 60);
      if (!migliore || diff < migliore.diff) migliore = { righe: [r1, r2], diff };
    }
  }
  if (migliore) return migliore.righe;
  const righe = []; let riga = '';
  for (const w of text.split(' ')) {
    const prova = riga ? `${riga} ${w}` : w;
    if (larghezza(f, prova, size) > maxW && riga) { righe.push(riga); riga = w; } else riga = prova;
  }
  if (riga) righe.push(riga);
  return righe;
}

// Stelle e costellazioni in posizioni fisse (generatore deterministico)
function cielo() {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let s = '';
  for (let i = 0; i < 70; i++) {
    const x = rnd() * W, y = rnd() * H;
    const dentroPanel = x > PANEL.x - 20 && x < PANEL.x + PANEL.w + 20 && y > PANEL.y - 20 && y < PANEL.y + PANEL.h + 20;
    if (dentroPanel) continue;
    s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.6 + rnd() * 1.6).toFixed(2)}" fill="${ORO}" opacity="${(0.3 + rnd() * 0.6).toFixed(2)}"/>`;
  }
  const cost = (pts) => `<polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="${ORO}" stroke-width="1" opacity="0.45"/>` +
    pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="${ORO}" opacity="0.85"/>`).join('');
  s += cost([[52, 1400], [92, 1440], [130, 1430], [150, 1480]]);
  s += cost([[1050, 1404], [1090, 1438], [1112, 1490], [1150, 1508]]);
  s += cost([[820, 40], [900, 30], [960, 52]]);
  return s;
}

function angolo(x, y, sx, sy) {
  return `<g transform="translate(${x} ${y}) scale(${sx} ${sy})" fill="none" stroke="${ORO}" stroke-width="2">
    <path d="M0 46 Q0 0 46 0"/><path d="M10 40 Q12 12 40 10" stroke-width="1"/>
    <path d="M18 18 l8 -4 l-4 8 z" fill="${ORO}"/></g>`;
}

async function makeQR(url, size) {
  const qr = await QRCode.toBuffer(url, {
    errorCorrectionLevel: 'M', margin: 1, width: Math.round(size * 0.84),
    color: { dark: '#1b1636ff', light: '#f6ecd6ff' }
  });
  return qr;
}

async function componi({ illustrazione, nome, motto, qrUrl }) {
  // Titolo
  let size = 80, t = testoPath(TITOLO, nome, size, 0.14);
  while (t.larghezza > 780) { size -= 4; t = testoPath(TITOLO, nome, size, 0.14); }
  const titolo = t.d((W - t.larghezza) / 2, 1468);

  // Frase
  const mx = QRBOX.x + QRBOX.s + 44, maxW = W - mx - 130, msize = 46, lh = 58;
  const righe = aCapo(CORSIVO, motto, msize, maxW).slice(0, 3);
  const cy = QRBOX.y + QRBOX.s / 2, y0 = cy - ((righe.length - 1) * lh) / 2 + msize * 0.3;
  const frase = righe.map((r, i) => testoPath(CORSIVO, r, msize).d(mx, y0 + i * lh)).join('');

  const P = PANEL;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="75%">
      <stop offset="0" stop-color="#22366a"/><stop offset="0.6" stop-color="#16244d"/><stop offset="1" stop-color="#0a1230"/>
    </radialGradient>
    <filter id="pennellate" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.004 0.018" numOctaves="4" seed="3"/>
      <feColorMatrix values="0 0 0 0 0.55  0 0 0 0 0.68  0 0 0 0 1  0 0 0 0.22 0"/>
    </filter>
    <filter id="grana" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="5"/>
      <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.05 0"/>
    </filter>
    <linearGradient id="oro" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f6dd95"/><stop offset="0.55" stop-color="#c9962f"/><stop offset="1" stop-color="#ebc86b"/>
    </linearGradient>
    <filter id="alone" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="6"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" filter="url(#pennellate)"/>
  <rect width="${W}" height="${H}" filter="url(#grana)"/>
  ${cielo()}
  <rect x="28" y="28" width="${W - 56}" height="${H - 56}" rx="30" fill="none" stroke="${ORO}" stroke-width="2.5"/>
  ${angolo(40, 40, 1, 1)}${angolo(W - 40, 40, -1, 1)}${angolo(40, H - 40, 1, -1)}${angolo(W - 40, H - 40, -1, -1)}
  <rect x="${P.x - 12}" y="${P.y - 12}" width="${P.w + 24}" height="${P.h + 24}" rx="${P.r + 10}" fill="none" stroke="#f3cf73" stroke-width="10" opacity="0.25" filter="url(#alone)"/>
  <rect x="${P.x - 14}" y="${P.y - 14}" width="${P.w + 28}" height="${P.h + 28}" rx="${P.r + 12}" fill="none" stroke="url(#oro)" stroke-width="3"/>
  <rect x="${P.x - 5}" y="${P.y - 5}" width="${P.w + 10}" height="${P.h + 10}" rx="${P.r + 4}" fill="none" stroke="url(#oro)" stroke-width="1.5"/>
  <path d="${titolo}" fill="url(#oro)" stroke="#e2bd62" stroke-width="1.4"/>
  <g stroke="#d4a845" stroke-width="2"><line x1="300" y1="1506" x2="574" y2="1506"/><line x1="626" y1="1506" x2="900" y2="1506"/></g>
  <path d="M600 1486 L605 1501 L620 1506 L605 1511 L600 1526 L595 1511 L580 1506 L595 1501 Z" fill="url(#oro)"/>
  <rect x="${QRBOX.x}" y="${QRBOX.y}" width="${QRBOX.s}" height="${QRBOX.s}" rx="18" fill="${CREMA}" stroke="url(#oro)" stroke-width="3"/>
  <path d="${frase}" fill="${CREMA}"/>
</svg>`;

  // Illustrazione con angoli arrotondati
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${P.w}" height="${P.h}"><rect width="${P.w}" height="${P.h}" rx="${P.r}" fill="#fff"/></svg>`);
  const ill = await sharp(illustrazione).resize(P.w, P.h, { fit: 'cover', position: 'top' })
    .composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();

  const qrSize = Math.round(QRBOX.s * 0.84);
  const qr = await makeQR(qrUrl, QRBOX.s);
  const qrMeta = await sharp(qr).metadata();
  return sharp(Buffer.from(svg))
    .composite([
      { input: ill, left: P.x, top: P.y },
      { input: qr, left: Math.round(QRBOX.x + (QRBOX.s - qrMeta.width) / 2), top: Math.round(QRBOX.y + (QRBOX.s - qrMeta.height) / 2) }
    ])
    .png().toBuffer();
}

// Posizione del riquadro in frazioni della carta: serve alla pagina per sovrapporre il video
const PANEL_FRAZ = { left: PANEL.x / W, top: PANEL.y / H, width: PANEL.w / W, height: PANEL.h / H, radius: PANEL.r / PANEL.w };

module.exports = { componi, PANEL_FRAZ, W, H };
