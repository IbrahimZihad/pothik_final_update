import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'public', 'images');
fs.mkdirSync(root, { recursive: true });

const W = 1200;
const H = 800;

function svg(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">${body}</svg>`;
}

function sky(id, top, bottom) {
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>`;
}

function sun(color, x = 880, y = 210, r = 90) {
  return `<circle cx="${x}" cy="${y}" r="${r + 60}" fill="${color}" opacity="0.12"/><circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="0.85"/>`;
}

function ridge(points, color, opacity = 1) {
  return `<polygon points="${points}" fill="${color}" opacity="${opacity}"/>`;
}

function birds(color = '#f8fafc') {
  return `<g stroke="${color}" stroke-width="4" fill="none" opacity="0.8">
    <path d="M300 190 q18 -14 36 0 q18 -14 36 0"/>
    <path d="M380 150 q12 -9 24 0 q12 -9 24 0"/>
    <path d="M250 235 q10 -8 20 0 q10 -8 20 0"/>
  </g>`;
}

function palm(x, baseY, scale = 1, color = '#063f36') {
  return `<g transform="translate(${x} ${baseY}) scale(${scale})" fill="${color}">
    <path d="M0 0 C8 -60 4 -120 -6 -180 L8 -180 C18 -120 20 -60 14 0 Z"/>
    <path d="M0 -180 C-60 -210 -105 -205 -140 -180 C-95 -196 -45 -190 0 -168 Z"/>
    <path d="M0 -180 C50 -220 100 -215 135 -185 C95 -202 48 -196 4 -166 Z"/>
    <path d="M0 -180 C-30 -235 -25 -275 -5 -300 C-12 -260 -2 -220 10 -178 Z"/>
    <path d="M0 -180 C35 -240 70 -255 100 -250 C70 -238 40 -212 14 -172 Z"/>
  </g>`;
}

function beachScene({ top, bottom, sea, sand, sunColor, accent }) {
  return svg(`<rect width="${W}" height="${H}" fill="url(#s)"/>${sky('s', top, bottom)}
    ${sun(sunColor)}
    ${birds()}
    ${ridge(`0,${H * 0.55} 200,${H * 0.48} 430,${H * 0.56} 640,${H * 0.5} 900,${H * 0.56} 1200,${H * 0.49} 1200,${H} 0,${H}`, sea, 0.85)}
    <g opacity="0.5" stroke="#ffffff" stroke-width="3" fill="none">
      <path d="M80 620 q60 -16 120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0"/>
      <path d="M40 680 q60 -16 120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0"/>
    </g>
    <path d="M0 ${H * 0.62} C260 ${H * 0.58} 520 ${H * 0.7} 780 ${H * 0.64} C980 ${H * 0.6} 1100 ${H * 0.66} 1200 ${H * 0.62} L1200 ${H} L0 ${H} Z" fill="${sand}"/>
    <path d="M0 ${H * 0.78} C300 ${H * 0.74} 700 ${H * 0.84} 1200 ${H * 0.78} L1200 ${H} L0 ${H} Z" fill="${accent}" opacity="0.35"/>
    ${palm(180, 760, 1.35)}
    ${palm(300, 720, 1.05)}
    <g transform="translate(880 660)" fill="#0b3d36" opacity="0.9">
      <path d="M0 60 C40 20 120 18 170 58 L150 66 C110 42 60 44 20 68 Z"/>
      <path d="M80 20 L86 -20 L94 -20 L100 20 Z"/>
      <path d="M84 -20 L112 -52 L120 -46 L92 -14 Z"/>
    </g>`);
}

function hillsScene({ top, bottom, layers, accent, kind = 'hills' }) {
  const layerMarkup = layers
    .map((color, index) => {
      const y = 330 + index * 95;
      const offset = index * 90;
      return `<path d="M0 ${y + 60} C${180 + offset} ${y - 100} ${330 + offset} ${y + 10} ${500 + offset} ${y - 40} C${700 + offset} ${y - 120} ${900 + offset} ${y + 20} ${1200} ${y - 60} L1200 ${H} L0 ${H} Z" fill="${color}" opacity="${0.95 - index * 0.12}"/>`;
    })
    .join('');
  const mist = `<g fill="#ffffff" opacity="0.18"><ellipse cx="300" cy="430" rx="230" ry="34"/><ellipse cx="820" cy="490" rx="280" ry="30"/><ellipse cx="560" cy="600" rx="320" ry="26"/></g>`;
  const tea = kind === 'tea'
    ? `<g stroke="${accent}" stroke-width="10" fill="none" opacity="0.55">${Array.from({ length: 9 })
        .map((_, i) => `<path d="M-20 ${640 + i * 22} Q300 ${600 + i * 18} 620 ${650 + i * 20} T1260 ${630 + i * 18}"/>`)
        .join('')}</g>`
    : '';
  const fog = `<rect y="520" width="${W}" height="280" fill="#f8fafc" opacity="0.12"/>`;
  return svg(`<rect width="${W}" height="${H}" fill="url(#s)"/>${sky('s', top, bottom)}${sun('#fde68a', 280, 150, 70)}${birds('#ecfdf5')}${layerMarkup}${mist}${tea}${fog}`);
}

function mangroveScene({ top, bottom, water, foliage }) {
  const roots = Array.from({ length: 9 })
    .map((_, i) => {
      const x = 120 + i * 130;
      return `<g stroke="#0b2e26" stroke-width="7" fill="none" opacity="0.9">
        <path d="M${x} 560 L${x - 14} 690 M${x} 560 L${x + 20} 690 M${x} 560 L${x - 34} 676 M${x} 560 L${x + 40} 676"/>
      </g>
      <ellipse cx="${x}" cy="${520 + (i % 3) * 22}" rx="${90 + (i % 4) * 14}" ry="${54 + (i % 2) * 10}" fill="${foliage}" opacity="${0.75 - (i % 3) * 0.08}"/>`;
    })
    .join('');
  return svg(`<rect width="${W}" height="${H}" fill="url(#s)"/>${sky('s', top, bottom)}${sun('#fb923c', 970, 180, 76)}${birds('#fef3c7')}
    <rect y="560" width="${W}" height="${H - 560}" fill="${water}"/>
    <g opacity="0.35" stroke="#fef3c7" stroke-width="3" fill="none">
      <path d="M60 650 h180 M300 700 h220 M600 740 h260 M760 620 h180 M900 690 h200"/>
    </g>${roots}
    <g transform="translate(150 640)" fill="#08211c">
      <path d="M0 40 C40 8 120 6 170 38 L150 48 C110 26 60 28 22 46 Z"/>
      <path d="M70 4 L74 -26 L82 -26 L86 4 Z"/>
    </g>`);
}

function hotelScene({ sky: skyTop, skyBottom, accent }) {
  return svg(`<rect width="${W}" height="${H}" fill="url(#s)"/>${sky('s', skyTop, skyBottom)}
    ${sun('#fde68a', 930, 180, 82)}${birds('#f8fafc')}
    <path d="M0 520 C260 490 420 540 640 520 C860 500 1030 540 1200 515 L1200 ${H} L0 ${H} Z" fill="#0f766e" opacity="0.4"/>
    <rect x="230" y="260" width="620" height="400" rx="18" fill="#f8fafc" opacity="0.94"/>
    <rect x="230" y="260" width="620" height="52" rx="18" fill="${accent}"/>
    <g fill="#5eead4" opacity="0.9">
      ${Array.from({ length: 5 })
        .map((_, row) =>
          Array.from({ length: 7 })
            .map((__, col) => `<rect x="${270 + col * 80}" y="${350 + row * 54}" width="44" height="32" rx="6"/>`)
            .join('')
        )
        .join('')}
    </g>
    <rect x="500" y="570" width="90" height="90" fill="#134e4a"/>
    <path d="M160 660 C260 600 900 600 1040 660 L1040 690 L160 690 Z" fill="#0b3d36" opacity="0.35"/>
    ${palm(140, 700, 1.1)}
    ${palm(1050, 690, 0.95)}`);
}

function roomScene({ wall, accent, bed }) {
  return svg(`<rect width="${W}" height="${H}" fill="${wall}"/>
    <rect y="520" width="${W}" height="${H - 520}" fill="#0f766e" opacity="0.18"/>
    <rect x="930" y="120" width="180" height="290" rx="14" fill="url(#w)"/>
    <defs><linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${skyTop(wall)}"/><stop offset="1" stop-color="${accent}" stop-opacity="0.55"/></linearGradient></defs>
    <rect x="240" y="470" width="720" height="180" rx="26" fill="${bed}"/>
    <rect x="260" y="380" width="680" height="120" rx="26" fill="#f8fafc"/>
    <rect x="300" y="395" width="250" height="70" rx="18" fill="#e2e8f0"/>
    <rect x="600" y="395" width="250" height="70" rx="18" fill="#e2e8f0"/>
    <rect x="240" y="620" width="720" height="34" rx="16" fill="#0f172a" opacity="0.16"/>
    <circle cx="1060" cy="520" r="70" fill="#fbbf24" opacity="0.45"/>
    <rect x="120" y="300" width="90" height="170" rx="10" fill="#0f172a" opacity="0.16"/>`);
}

function skyTop(color) {
  return color === '#f8fafc' ? '#bae6fd' : color;
}

function vehicleScene(kind) {
  const bus = kind === 'bus';
  const jeep = kind === 'jeep';
  const body = bus
    ? `<rect x="160" y="320" width="900" height="290" rx="52" fill="#0f766e"/><rect x="200" y="350" width="780" height="120" rx="22" fill="#ccfbf1"/><rect x="220" y="500" width="720" height="70" rx="14" fill="#115e59"/>`
    : jeep
      ? `<path d="M190 520 L240 400 Q260 350 330 345 L760 345 Q820 350 860 410 L980 430 Q1050 440 1050 500 L1050 550 L190 550 Z" fill="#b45309"/><rect x="330" y="390" width="180" height="90" rx="10" fill="#fde68a"/><rect x="560" y="390" width="200" height="90" rx="10" fill="#fde68a"/>`
      : `<path d="M150 520 Q150 420 260 410 L360 320 Q400 285 470 285 L880 285 Q950 285 985 330 L1050 420 Q1100 430 1100 500 L1100 550 L150 550 Z" fill="#0d9488"/><rect x="390" y="330" width="220" height="100" rx="14" fill="#ccfbf1"/><rect x="650" y="330" width="220" height="100" rx="14" fill="#ccfbf1"/>`;
  const wheels = `<circle cx="340" cy="560" r="62" fill="#0f172a"/><circle cx="340" cy="560" r="28" fill="#94a3b8"/><circle cx="880" cy="560" r="62" fill="#0f172a"/><circle cx="880" cy="560" r="28" fill="#94a3b8"/>`;
  return svg(`<rect width="${W}" height="${H}" fill="url(#s)"/>${sky('s', '#e0f2fe', '#99f6e4')}
    <path d="M0 600 C300 560 700 620 1200 585 L1200 ${H} L0 ${H} Z" fill="#1f2937" opacity="0.13"/>
    <path d="M0 700 L1200 700" stroke="#f8fafc" stroke-width="12" stroke-dasharray="60 40"/>${body}${wheels}
    <circle cx="940" cy="160" r="78" fill="#fde68a" opacity="0.8"/>`);
}

function guideScene() {
  return svg(`<rect width="${W}" height="${H}" fill="url(#s)"/>${sky('s', '#ede9fe', '#99f6e4')}
    <circle cx="980" cy="200" r="120" fill="#fdba74" opacity="0.55"/>
    <path d="M0 560 C300 500 800 520 1200 560 L1200 ${H} L0 ${H} Z" fill="#0f766e" opacity="0.45"/>
    <circle cx="600" cy="300" r="120" fill="#f5d0a9"/>
    <path d="M480 300 Q480 160 600 160 Q720 160 720 300 L700 300 Q700 200 600 200 Q500 200 500 300 Z" fill="#0f172a"/>
    <path d="M420 720 Q420 430 600 430 Q780 430 780 720 Z" fill="#0d9488"/>
    <rect x="520" y="430" width="160" height="80" fill="#f8fafc" opacity="0.85"/>
    <path d="M380 720 L820 720" stroke="#f8fafc" stroke-width="8" opacity="0.4"/>`);
}

const destinations = [
  { file: 'coxs-bazar', scene: beachScene({ top: '#fb923c', bottom: '#fef3c7', sea: '#0e7490', sand: '#fde68a', sunColor: '#f97316', accent: '#fbbf24' }) },
  { file: 'saint-martin', scene: beachScene({ top: '#38bdf8', bottom: '#ecfeff', sea: '#0891b2', sand: '#fef9c3', sunColor: '#fde68a', accent: '#67e8f9' }) },
  { file: 'kuakata', scene: beachScene({ top: '#f472b6', bottom: '#fef3c7', sea: '#0f766e', sand: '#f5d0a9', sunColor: '#fb7185', accent: '#fda4af' }) },
  { file: 'sajek', scene: hillsScene({ top: '#0ea5e9', bottom: '#ecfdf5', layers: ['#065f46', '#047857', '#059669'], accent: '#34d399' }) },
  { file: 'bandarban', scene: hillsScene({ top: '#38bdf8', bottom: '#f0fdfa', layers: ['#134e4a', '#0f766e', '#0d9488'], accent: '#5eead4' }) },
  { file: 'rangamati', scene: hillsScene({ top: '#22d3ee', bottom: '#ecfeff', layers: ['#115e59', '#0f766e', '#14b8a6'], accent: '#99f6e4' }) },
  { file: 'sylhet', scene: hillsScene({ top: '#7dd3fc', bottom: '#f0fdf4', layers: ['#166534', '#15803d', '#16a34a'], accent: '#86efac', kind: 'tea' }) },
  { file: 'sreemangal', scene: hillsScene({ top: '#60a5fa', bottom: '#f0fdf4', layers: ['#14532d', '#166534', '#22c55e'], accent: '#bbf7d0', kind: 'tea' }) },
  { file: 'sundarbans', scene: mangroveScene({ top: '#fdba74', bottom: '#fef3c7', water: '#0f766e', foliage: '#065f46' }) },
];

for (const item of destinations) {
  fs.mkdirSync(path.join(root, 'destinations'), { recursive: true });
  fs.writeFileSync(path.join(root, 'destinations', `${item.file}.svg`), item.scene);
}

const hotelFiles = {
  'sea-crown': hotelScene({ sky: '#7dd3fc', skyBottom: '#fef3c7', accent: '#0d9488' }),
  'deluxe-sea-view': roomScene({ wall: '#f0fdfa', accent: '#0d9488', bed: '#0f766e' }),
  'family-suite': roomScene({ wall: '#fff7ed', accent: '#f97316', bed: '#b45309' }),
  'standard-double': roomScene({ wall: '#f8fafc', accent: '#0891b2', bed: '#0e7490' }),
};
for (const [file, content] of Object.entries(hotelFiles)) {
  fs.mkdirSync(path.join(root, 'hotels'), { recursive: true });
  fs.writeFileSync(path.join(root, 'hotels', `${file}.svg`), content);
}

for (const kind of ['bus', 'microbus', 'jeep']) {
  fs.mkdirSync(path.join(root, 'vehicles'), { recursive: true });
  fs.writeFileSync(path.join(root, 'vehicles', `${kind}.svg`), vehicleScene(kind));
}

fs.mkdirSync(path.join(root, 'guides'), { recursive: true });
fs.writeFileSync(path.join(root, 'guides', 'nusrat.svg'), guideScene());

// ---------------------------------------------------------------- brand assets
const logo = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96" role="img" aria-label="POTHIK">
  <rect width="96" height="96" rx="26" fill="#034D41"/>
  <path d="M30 70 V26 h20 c12 0 20 7 20 18 s-8 18 -20 18 h-9 v8 z" fill="#ffffff"/>
  <path d="M41 39 h8 c4 0 7 2 7 6 s-3 6 -7 6 h-8 z" fill="#0d9488"/>
  <path d="M20 70 h56" stroke="#f97316" stroke-width="6" stroke-linecap="round"/>
  <circle cx="70" cy="24" r="7" fill="#f97316"/>
</svg>`;
fs.mkdirSync(path.resolve(process.cwd(), 'public'), { recursive: true });
fs.writeFileSync(path.join(path.resolve(process.cwd(), 'public'), 'logo.svg'), logo);

const hero = svg(`<rect width="${W}" height="${H}" fill="url(#s)"/>${sky('s', '#0f766e', '#fef3c7')}
  ${sun('#fdba74', 900, 230, 110)}${birds('#ecfdf5')}
  <path d="M0 520 C220 470 420 540 640 510 C860 480 1000 540 1200 505 L1200 ${H} L0 ${H} Z" fill="#115e59" opacity="0.9"/>
  <path d="M0 610 C260 570 520 640 780 610 C980 588 1090 620 1200 600 L1200 ${H} L0 ${H} Z" fill="#fcd34d"/>
  <g opacity="0.5" stroke="#ffffff" stroke-width="4" fill="none">
    <path d="M80 660 q70 -18 140 0 t140 0 t140 0 t140 0 t140 0 t140 0 t140 0"/>
    <path d="M20 715 q70 -18 140 0 t140 0 t140 0 t140 0 t140 0 t140 0 t140 0"/>
  </g>
  ${palm(150, 780, 1.6)}
  ${palm(1050, 760, 1.35)}
  <g transform="translate(690 600)" fill="#052e26">
    <circle cx="0" cy="-86" r="22"/>
    <path d="M-20 -60 Q0 -76 20 -60 L28 30 L-28 30 Z"/>
    <path d="M-16 30 L-30 100 L-8 100 L4 46 L16 100 L38 100 L22 30 Z"/>
    <rect x="22" y="-44" width="40" height="56" rx="10"/>
  </g>`);
fs.writeFileSync(path.join(path.resolve(process.cwd(), 'public'), 'hero.svg'), hero);

const og = svg(`<rect width="${W}" height="${H}" fill="#034D41"/>
  <circle cx="1020" cy="160" r="220" fill="#0d9488" opacity="0.5"/>
  <circle cx="1080" cy="620" r="260" fill="#f97316" opacity="0.25"/>
  <text x="90" y="330" font-family="Arial, sans-serif" font-weight="700" font-size="96" fill="#f8fafc">POTHIK</text>
  <text x="94" y="410" font-family="Arial, sans-serif" font-size="38" fill="#99f6e4">Bangladesh, planned properly.</text>
  <text x="94" y="480" font-family="Arial, sans-serif" font-size="24" fill="#94a3b8">Hotels · Transport · Guides · Custom trips</text>`);
fs.writeFileSync(path.join(path.resolve(process.cwd(), 'public'), 'og.svg'), og);

console.log('artwork written');
