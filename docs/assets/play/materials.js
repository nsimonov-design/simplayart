// Фактуры (поверхность и блеск), принты (рисунок) и палитра глазурей.
import * as THREE from './three/three.module.min.js';
import { rng } from './shapes.js?v=5a5c0570';

export const COLORS = ['#FFFFFF', '#F3EEE6', '#F6C9D3', '#E98AA8', '#D8CCF0', '#A99BE0', '#BFDDF5', '#6FA8E0', '#3B55C9', '#22307A',
  '#7FD3CF', '#1F8F8A', '#CFE7B0', '#9BC94A', '#3E8E4A', '#FFE27A', '#F7B33B', '#F07A3C', '#E2382F', '#B3122E', '#8A6A4F', '#2A2833'];

// p — параметры MeshPhysicalMaterial, n — рельеф (карта нормалей), ns — сила рельефа
export const TEX = {
  gloss: { name: 'Глянцевая глазурь', p: { roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 } },
  matte: { name: 'Матовая глина', p: { roughness: 0.92 }, n: 'grain', ns: 0.35 },
  grain: { name: 'Зернистая', p: { roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.3 }, n: 'grain', ns: 1.4 },
  bumps: { name: 'Пупырышки', p: { roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.1 }, n: 'bumps', ns: 1.6 },
  crackle: { name: 'Кракелюр', p: { roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.05 }, n: 'crackle', ns: 0.9 },
  ribs: { name: 'Рельеф-полоски', p: { roughness: 0.35, clearcoat: 0.6 }, n: 'ribs', ns: 1.3 },
  glass: { name: 'Стекло', p: { roughness: 0.04, transmission: 1, thickness: 0.6, ior: 1.5 } },
  pearl: { name: 'Перламутр', p: { roughness: 0.15, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [180, 650] } },
  lustre: { name: 'Люстр (металл)', p: { roughness: 0.22, metalness: 0.85 } },
};

export const PRINTS = {
  none: 'Без принта', dots: 'Горошек', stripes: 'Полоски', checker: 'Клетка', speckle: 'Крапинка', blobs: 'Пятна',
  cracks: 'Трещины', zigzag: 'Зигзаг', waves: 'Волны', windows: 'Окошки',
};

function rrect(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

const printCache = new Map();
export function printCanvas(kind, c1, c2) {
  const key = `${kind}|${c1}|${c2}`;
  if (printCache.has(key)) return printCache.get(key);
  const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'), R = rng(kind.length * 977 + kind.charCodeAt(0));
  g.fillStyle = c1; g.fillRect(0, 0, S, S); g.fillStyle = c2; g.strokeStyle = c2;
  const wrap = fn => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { g.save(); g.translate(dx, dy); fn(); g.restore(); } };
  switch (kind) {
    case 'dots':
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
        const x = (i + (j % 2) * 0.5) * S / 4 + S / 8, y = j * S / 4 + S / 8;
        wrap(() => { g.beginPath(); g.arc(x, y, S / 20, 0, 7); g.fill(); });
      } break;
    case 'stripes': for (let i = 0; i < 8; i++) g.fillRect(0, i * S / 8, S, S / 16); break;
    case 'checker': for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) if ((i + j) % 2) g.fillRect(i * S / 8, j * S / 8, S / 8, S / 8); break;
    case 'speckle':
      for (let k = 0; k < 1500; k++) { const x = R() * S, y = R() * S, r = 1.2 + R() * R() * 5; wrap(() => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }); } break;
    case 'blobs':
      for (let k = 0; k < 30; k++) {
        const x = R() * S, y = R() * S, rx = 14 + R() * 32, ry = 8 + R() * 20, a = R() * 3;
        wrap(() => { g.beginPath(); g.ellipse(x, y, rx, ry, a, 0, 7); g.fill(); });
      } break;
    case 'cracks':
      g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round';
      for (let k = 0; k < 28; k++) {
        let x = R() * S, y = R() * S, a = R() * 6.28; const pts = [[x, y]];
        for (let s = 0; s < 10; s++) { a += (R() - 0.5) * 1.3; x += Math.cos(a) * 22; y += Math.sin(a) * 22; pts.push([x, y]); }
        wrap(() => { g.beginPath(); g.moveTo(...pts[0]); pts.forEach(p => g.lineTo(...p)); g.stroke(); });
      } break;
    case 'zigzag':
      g.lineWidth = S / 26;
      for (let j = 0; j < 4; j++) { g.beginPath(); const y0 = j * S / 4 + S / 8; for (let i = -1; i <= 9; i++) g.lineTo(i * S / 8, y0 + (i % 2 ? -1 : 1) * S / 18); g.stroke(); }
      break;
    case 'waves':
      g.lineWidth = S / 34;
      for (let j = 0; j < 6; j++) { g.beginPath(); const y0 = j * S / 6 + S / 12; for (let x = -4; x <= S + 4; x += 4) g.lineTo(x, y0 + Math.sin(x / S * Math.PI * 4) * S / 28); g.stroke(); }
      break;
    case 'windows': for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { rrect(g, i * S / 4 + S / 16, j * S / 4 + S / 16, S / 8, S / 8, 10); g.fill(); } break;
  }
  printCache.set(key, cv);
  return cv;
}

// карта высот → карта нормалей (бесшовная)
function heightCanvas(kind) {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'), R = rng(kind.length * 131 + 5);
  const wrap = fn => { for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { g.save(); g.translate(dx, dy); fn(); g.restore(); } };
  if (kind === 'grain') {
    g.fillStyle = '#808080'; g.fillRect(0, 0, S, S);
    for (let k = 0; k < 2600; k++) {
      const x = R() * S, y = R() * S, r = 0.8 + R() * 2.2, v = R() > 0.5 ? 255 : 0;
      g.fillStyle = `rgba(${v},${v},${v},0.35)`;
      wrap(() => { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); });
    }
  } else if (kind === 'bumps') {
    g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
      const x = (i + (j % 2) * 0.5) * S / 8 + S / 16, y = j * S / 8 + S / 16, r = S / 26;
      wrap(() => { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); });
    }
  } else if (kind === 'crackle') {
    g.fillStyle = '#fff'; g.fillRect(0, 0, S, S); g.strokeStyle = '#000'; g.lineWidth = 1.6; g.lineJoin = 'round';
    for (let k = 0; k < 40; k++) {
      let x = R() * S, y = R() * S, a = R() * 6.28; const pts = [[x, y]];
      for (let s = 0; s < 8; s++) { a += (R() - 0.5) * 1.4; x += Math.cos(a) * 12; y += Math.sin(a) * 12; pts.push([x, y]); }
      wrap(() => { g.beginPath(); g.moveTo(...pts[0]); pts.forEach(p => g.lineTo(...p)); g.stroke(); });
    }
  } else if (kind === 'ribs') {
    for (let y = 0; y < S; y++) { const v = Math.round(127.5 + 127.5 * Math.sin(y / S * Math.PI * 2 * 8)); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, y, S, 1); }
  }
  const src = g.getImageData(0, 0, S, S).data, out = g.createImageData(S, S), m = S - 1;
  const h = (x, y) => src[(((y & m) * S) + (x & m)) * 4] / 255;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = (h(x + 1, y) - h(x - 1, y)) * 2.2, dy = (h(x, y + 1) - h(x, y - 1)) * 2.2;
    const l = Math.hypot(dx, dy, 1), i = (y * S + x) * 4;
    out.data[i] = (-dx / l * 0.5 + 0.5) * 255; out.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; out.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; out.data[i + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  return cv;
}

const texCache = new Map();
function tex(key, make, rep, srgb) {
  const k = `${key}|${rep}`;
  if (!texCache.has(k)) {
    const t = new THREE.CanvasTexture(make());
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    texCache.set(k, t);
  }
  return texCache.get(k);
}
const hCache = new Map();

export function makeMaterial(it, uv) {
  const T = TEX[it.m] || TEX.gloss;
  const m = new THREE.MeshPhysicalMaterial({ ...T.p });
  if (it.q && it.q !== 'none') {
    m.map = tex(`p|${it.q}|${it.a}|${it.b}`, () => printCanvas(it.q, it.a, it.b), uv, true);
    m.color.set('#ffffff');
  } else m.color.set(it.a);
  if (T.n) {
    if (!hCache.has(T.n)) hCache.set(T.n, heightCanvas(T.n));
    m.normalMap = tex(`n|${T.n}`, () => hCache.get(T.n), uv.map(v => v * 2), false);
    m.normalScale.set(T.ns, T.ns);
  }
  if (it.m === 'glass') { m.attenuationColor.set(it.a); m.attenuationDistance = 1.2; m.color.lerp(new THREE.Color('#ffffff'), 0.35); }
  return m;
}
