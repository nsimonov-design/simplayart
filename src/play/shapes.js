// Детали конструктора: формы по мотивам работ Ольги Симоновой (sim.play.art).
// Каждая геометрия нормализована: стоит на y = 0, центр по x/z в нуле. 1 единица ≈ 10 см.
import * as THREE from './three/three.module.min.js';
import { mergeGeometries } from './three/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from './three/RoundedBoxGeometry.js';

export function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const V2 = (x, y) => new THREE.Vector2(x, y);

function profile(pts, n = 120) {
  const c = new THREE.SplineCurve(pts.map(([r, y]) => V2(r, y)));
  const out = c.getPoints(n).map(p => V2(Math.max(0, p.x), p.y));
  out[0].x = 0; out[out.length - 1].x = 0;
  return out;
}
const lathe = (pts, seg = 96) => new THREE.LatheGeometry(profile(pts), seg);

function norm(g) {
  g.computeBoundingBox();
  const b = g.boundingBox;
  const off = [-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2];
  g.translate(...off); g.userData.offset = off;
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}
function clean(g) {
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  return g.index ? g.toNonIndexed() : g;
}
const merge = list => mergeGeometries(list.map(clean));
function flat(g) { g = g.index ? g.toNonIndexed() : g; g.computeVertexNormals(); return g; }

// после смещения вершин усредняем нормали на шве развёртки (u = 0 и u = 1)
function smooth(g) {
  g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  const map = new Map();
  for (let i = 0; i < p.count; i++) {
    const u = uv.getX(i);
    if (u > 0.001 && u < 0.999) continue;
    const k = `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
    (map.get(k) || map.set(k, []).get(k)).push(i);
  }
  const v = new THREE.Vector3();
  for (const ids of map.values()) {
    if (ids.length < 2) continue;
    v.set(0, 0, 0);
    ids.forEach(i => v.add(new THREE.Vector3(n.getX(i), n.getY(i), n.getZ(i))));
    v.normalize();
    ids.forEach(i => n.setXYZ(i, v.x, v.y, v.z));
  }
  n.needsUpdate = true;
  return g;
}

function stem(h = 0.26, y = 0, tilt = 0.25) {
  const s = new THREE.CylinderGeometry(0.028, 0.04, h, 12);
  s.rotateZ(tilt); s.translate(Math.sin(tilt) * h * -0.45, y + h * 0.42, 0);
  return s;
}
function tubeWithCaps(points, r, seg = 160) {
  const c = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
  const t = new THREE.TubeGeometry(c, seg, r, 32, false);
  const a = new THREE.SphereGeometry(r, 32, 16); a.translate(...points[0]);
  const b = new THREE.SphereGeometry(r, 32, 16); b.translate(...points[points.length - 1]);
  const g = merge([t, a, b]);
  g.userData.tube = { points, r }; // для рельефной надписи вдоль трубки
  return g;
}

const BALLOON = [[0, 0], [0.42, 0.06], [0.66, 0.38], [0.72, 0.72], [0.6, 1.1], [0.34, 1.4], [0.12, 1.56], [0.075, 1.64], [0.14, 1.71], [0.11, 1.78], [0.03, 1.77], [0, 1.76]];

const MAKE = {
  // ---------- шарики ----------
  balloon: () => lathe(BALLOON),
  balloonBumps: () => {
    const prof = profile(BALLOON), r = rng(7), parts = [new THREE.LatheGeometry(prof, 96)];
    for (let k = 0; k < 30; k++) {
      const p = prof[Math.floor(prof.length * (0.12 + r() * 0.6))], a = r() * Math.PI * 2;
      const s = new THREE.SphereGeometry(0.045, 16, 10);
      s.translate(Math.sin(a) * p.x, p.y, Math.cos(a) * p.x);
      parts.push(s);
    }
    return merge(parts);
  },
  balloonCrumpled: () => {
    const g = lathe(BALLOON, 128), p = g.attributes.position, r = rng(11);
    const dents = Array.from({ length: 7 }, () => {
      const a = r() * Math.PI * 2, y = 0.3 + r() * 0.9;
      return { c: new THREE.Vector3(Math.sin(a) * 0.7, y, Math.cos(a) * 0.7), s: 0.18 + r() * 0.16, d: 0.07 + r() * 0.08 };
    });
    const v = new THREE.Vector3(), rad = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      if (v.y > 1.45) continue;
      let k = 0;
      for (const d of dents) k += d.d * Math.exp(-v.distanceToSquared(d.c) / (d.s * d.s));
      rad.set(v.x, 0, v.z); const len = rad.length();
      if (len < 1e-4) continue;
      rad.multiplyScalar(Math.max(0, len - k) / len);
      p.setXYZ(i, rad.x, v.y, rad.z);
    }
    return smooth(g);
  },
  drop: () => lathe([[0, 0], [0.4, 0.05], [0.56, 0.3], [0.47, 0.66], [0.22, 1.0], [0.04, 1.26], [0, 1.28]]),

  // ---------- фрукты ----------
  pear: () => merge([lathe([[0, 0], [0.32, 0.03], [0.52, 0.2], [0.56, 0.45], [0.46, 0.72], [0.3, 0.92], [0.22, 1.15], [0.16, 1.34], [0.07, 1.44], [0, 1.45]]), stem(0.26, 1.4)]),
  apple: () => merge([lathe([[0, 0.1], [0.14, 0.04], [0.4, 0.03], [0.63, 0.22], [0.69, 0.5], [0.58, 0.82], [0.36, 0.98], [0.14, 0.93], [0, 0.86]]), stem(0.28, 0.84, 0.15)]),
  core: () => merge([lathe([[0, 0.03], [0.2, 0], [0.37, 0.06], [0.35, 0.17], [0.2, 0.32], [0.14, 0.55], [0.2, 0.78], [0.36, 0.94], [0.41, 1.02], [0.25, 1.08], [0, 1.06]]), stem(0.26, 1.03, 0.1)]),
  lemon: () => { const g = lathe([[0, 0], [0.05, 0.03], [0.09, 0.1], [0.3, 0.24], [0.42, 0.55], [0.3, 0.88], [0.09, 1.0], [0.05, 1.07], [0, 1.1]]); g.rotateZ(Math.PI / 2); return g; },

  // ---------- геометрия ----------
  cone: () => new THREE.ConeGeometry(0.55, 2.6, 96),
  pyramid: () => { const g = new THREE.ConeGeometry(0.95, 1.4, 4); g.rotateY(Math.PI / 4); return flat(g); },
  cube: () => new RoundedBoxGeometry(1.1, 1.1, 1.1, 5, 0.1),
  sphere: () => new THREE.SphereGeometry(0.6, 64, 48),
  frustum: () => { const g = new THREE.CylinderGeometry(0.55, 0.85, 1, 4, 1); g.rotateY(Math.PI / 4); return flat(g); },
  star: () => {
    const s = new THREE.Shape(), n = 6;
    for (let i = 0; i <= n * 2; i++) {
      const a = i / (n * 2) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.3 : 0.72;
      i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 4 });
    g.rotateX(-Math.PI / 2);
    return g;
  },
  ring: () => {
    const t = new THREE.TorusGeometry(0.78, 0.13, 24, 128); t.rotateX(Math.PI / 2);
    const parts = [t];
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2, b = new THREE.SphereGeometry(0.1, 20, 14);
      b.translate(Math.cos(a) * 0.95, 0, Math.sin(a) * 0.95); parts.push(b);
    }
    return merge(parts);
  },
  crown: () => {
    const g = new THREE.CylinderGeometry(0.9, 0.9, 0.3, 160, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (y < 0.1 || Math.hypot(x, z) < 0.5) continue;
      const f = ((Math.atan2(z, x) / (Math.PI * 2) + 1) * 10) % 1;
      p.setY(i, y + 0.38 * (1 - Math.abs(2 * f - 1)));
    }
    return smooth(g);
  },

  // ---------- основания ----------
  base: () => new THREE.CylinderGeometry(1.05, 1.05, 0.65, 128),
  hex: () => flat(new THREE.CylinderGeometry(1.1, 1.1, 0.6, 6)),
  ruffle: () => {
    const h = 0.6, g = new THREE.CylinderGeometry(1.0, 1.2, h, 192, 6), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const a = Math.atan2(z, x), k = 1 + (0.025 + 0.06 * (0.5 - y / h)) * Math.sin(a * 18);
      p.setXYZ(i, x * k, y, z * k);
    }
    return smooth(g);
  },
  pillow: () => new RoundedBoxGeometry(1.5, 0.5, 1.5, 6, 0.24),

  // ---------- детали ----------
  cloud: () => {
    const S = [[0, .45, 0, .5], [.5, .38, .1, .38], [-.5, .36, -.05, .4], [.2, .62, -.25, .36], [-.25, .65, .2, .34], [.85, .28, -.05, .26],
      [-.85, .27, .1, .27], [.1, .3, .42, .3], [-.05, .3, -.45, .3], [.45, .5, .35, .28], [-.45, .5, -.35, .28]];
    const g = merge(S.map(([x, y, z, r]) => { const s = new THREE.SphereGeometry(r, 40, 24); s.translate(x, y, z); return s; }));
    g.scale(1, 0.85, 1);
    return g;
  },
  ladder: () => {
    const parts = [];
    for (const x of [-0.3, 0.3]) { const r = new RoundedBoxGeometry(0.1, 2.4, 0.1, 2, 0.035); r.translate(x, 1.2, 0); parts.push(r); }
    for (let y = 0.2; y < 2.3; y += 0.3) { const c = new THREE.CylinderGeometry(0.038, 0.038, 0.6, 12); c.rotateZ(Math.PI / 2); c.translate(0, y, 0); parts.push(c); }
    return merge(parts);
  },
  wave: () => tubeWithCaps([[0, 0.24, 0], [0.25, 0.6, 0.05], [-0.2, 1.1, -0.05], [0.22, 1.6, 0.05], [-0.15, 2.1, 0], [0.12, 2.55, 0], [0, 2.85, 0]], 0.24),
  worm: () => tubeWithCaps([[0, 0.07, 0], [0.25, 0.25, 0.1], [0.1, 0.5, -0.2], [-0.2, 0.55, 0], [-0.1, 0.8, 0.25], [0.2, 0.95, 0.1]], 0.07, 120),
  bead: () => new THREE.SphereGeometry(0.16, 32, 20),
};

// name, категория, повтор принта по u/v
export const SHAPES = {
  balloon: ['Шарик', 'balloons', [3, 2]],
  balloonBumps: ['Шарик с пупырышками', 'balloons', [3, 2]],
  balloonCrumpled: ['Мятый шарик', 'balloons', [3, 2]],
  drop: ['Капля', 'balloons', [3, 2]],
  pear: ['Груша', 'fruits', [3, 2]],
  apple: ['Яблоко', 'fruits', [3, 2]],
  core: ['Огрызок', 'fruits', [3, 2]],
  lemon: ['Лимон', 'fruits', [3, 2]],
  cone: ['Конус', 'geometry', [3, 3]],
  pyramid: ['Пирамида', 'geometry', [2, 2]],
  cube: ['Куб', 'geometry', [2, 2]],
  sphere: ['Шар', 'geometry', [3, 2]],
  frustum: ['Трапеция', 'geometry', [2, 1.5]],
  star: ['Звезда', 'geometry', [1, 1]],
  ring: ['Кольцо с бусинами', 'geometry', [6, 1]],
  crown: ['Корона', 'geometry', [6, 1]],
  base: ['Цилиндр', 'bases', [4, 1]],
  hex: ['Шестигранник', 'bases', [4, 1]],
  ruffle: ['Основание с воланом', 'bases', [4, 1]],
  pillow: ['Подушка', 'bases', [2, 2]],
  cloud: ['Облако', 'details', [2, 2]],
  ladder: ['Лестница', 'details', [2, 2]],
  wave: ['Волна', 'details', [1, 6]],
  worm: ['Червячок', 'details', [1, 4]],
  bead: ['Бусина', 'details', [2, 1]],
};
export const CATS = [['balloons', 'Шарики'], ['fruits', 'Фрукты'], ['geometry', 'Геометрия'], ['bases', 'Основания'], ['details', 'Детали']];

const cache = {};
export function geometry(type) {
  if (!cache[type]) { const g = norm(MAKE[type]()); g.name = type; cache[type] = g; }
  return cache[type];
}
