// Знаки авторства: рельефная надпись на каждой детали, подиум с надписью, плашка на видео/картинке, метаданные файлов.
import * as THREE from './three/three.module.min.js';
import { Font } from './three/FontLoader.js';
import { mergeGeometries, mergeVertices } from './three/BufferGeometryUtils.js';

export const BRAND = {
  nick: 'sim.play.art', url: 'simplayart.ru/play', href: 'https://simplayart.ru/play/', author: 'Ольга Симонова',
  rights: '© Ольга Симонова (sim.play.art). Сборка создана в 3D-конструкторе PLAY по мотивам работ художницы. ' +
    'Публикуйте с отметкой @sim.play.art или ссылкой на simplayart.ru/play. Коммерческое использование, печать и продажа — только с согласия автора.',
};
const DOTS = ['#3B55C9', '#E27896', '#BFD86A'];
const INK = '#2A2833', INK2 = '#615D6E', COBALT = '#3B55C9';
const V3 = THREE.Vector3;

// ---------------- рельеф sim.play.art на деталях ----------------
// Выпуклые буквы «sim.play.art» и три точки повторяют изгиб поверхности и стоят на каждой стороне детали.
// Это геометрия (а не картинка), поэтому рельеф сохраняется и в 3D-модели .glb.
let FONT = null, UNIT = null;
export function setFont(json) { FONT = json ? new Font(json) : null; UNIT = null; }

// тон рельефа: тот же цвет, что у детали, — заметно темнее или светлее, как надпись по сырой глине под глазурью
export function stampColor(hex) {
  const c = new THREE.Color(hex), hsl = {}; c.getHSL(hsl);
  return hsl.l > 0.52 ? c.offsetHSL(0, 0.05, -0.34) : c.offsetHSL(0, -0.05, 0.32);
}
export function reliefMaterial(hex) {
  return new THREE.MeshPhysicalMaterial({ color: stampColor(hex), roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.15, name: 'рельеф sim.play.art' });
}

// особые детали: вытянутые — надпись вдоль, лестница — по стойкам, звезда — сверху
const HINTS = {
  ladder: { vertical: true, lateral: [0.43, -0.43, 0] },
  wave: { vertical: true },
  star: { top: true }, bead: { min: 0.02 }, ring: { min: 0.03 },
};

// плоская заготовка надписи высотой ~1: z от 0 до 1, центр в нуле
function unitText() {
  if (UNIT) return UNIT;
  const shapes = FONT.generateShapes('sim.play.art', 1);
  for (let i = 0; i < 3; i++) { const s = new THREE.Shape(); s.absarc(-1.05 + i * 0.3, 0.36, 0.12, 0, Math.PI * 2, false); shapes.push(s); }
  const ex = new THREE.ExtrudeGeometry(shapes, { depth: 1, bevelEnabled: false, curveSegments: 3 });
  // нижняя грань букв спрятана в детали — выбрасываем; общие вершины объединяем (файл .glb легче в 3–4 раза)
  const src = ex.attributes.position, nrm = ex.attributes.normal, P = [], Nn = [];
  for (let i = 0; i < src.count; i += 3) {
    if (src.getZ(i) < 1e-6 && src.getZ(i + 1) < 1e-6 && src.getZ(i + 2) < 1e-6) continue;
    for (let q = 0; q < 3; q++) { P.push(src.getX(i + q), src.getY(i + q), src.getZ(i + q)); Nn.push(nrm.getX(i + q), nrm.getY(i + q), nrm.getZ(i + q)); }
  }
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
  g = mergeVertices(g, 1e-5); ex.dispose();
  g.computeBoundingBox();
  const b = g.boundingBox;
  g.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, 0);
  g.computeBoundingBox();
  const bb = g.boundingBox;
  return (UNIT = { g, W: bb.max.x - bb.min.x, H: bb.max.y - bb.min.y });
}

// предрасчёт треугольников детали: центр, радиус, нормаль — чтобы быстро выбирать соседние
function triTable(geom) {
  const pos = geom.attributes.position, idx = geom.index, n = (idx ? idx.count : pos.count) / 3;
  const v = new Float32Array(n * 9), info = new Float32Array(n * 7);
  const a = new V3(), b = new V3(), c = new V3(), e1 = new V3(), e2 = new V3();
  for (let t = 0; t < n; t++) {
    const i = t * 3, ia = idx ? idx.getX(i) : i, ib = idx ? idx.getX(i + 1) : i + 1, ic = idx ? idx.getX(i + 2) : i + 2;
    a.fromBufferAttribute(pos, ia); b.fromBufferAttribute(pos, ib); c.fromBufferAttribute(pos, ic);
    v.set([a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z], t * 9);
    const mx = (a.x + b.x + c.x) / 3, my = (a.y + b.y + c.y) / 3, mz = (a.z + b.z + c.z) / 3;
    const r = Math.sqrt(Math.max((a.x - mx) ** 2 + (a.y - my) ** 2 + (a.z - mz) ** 2, (b.x - mx) ** 2 + (b.y - my) ** 2 + (b.z - mz) ** 2, (c.x - mx) ** 2 + (c.y - my) ** 2 + (c.z - mz) ** 2));
    e1.subVectors(b, a); e2.subVectors(c, a); e1.cross(e2);
    info.set([mx, my, mz, r, e1.x, e1.y, e1.z], t * 7);
  }
  return { v, info, n };
}
// «z-буфер» поверхности по сетке nx×ny в плоскости надписи: глубина до ближайшей наружной поверхности под каждой точкой
const NX = 15, NY = 5;
function raster(T, P, N, X, Y, W, H, nx, ny, rho) {
  const depth = new Float32Array(nx * ny).fill(Infinity), tri = new Int32Array(nx * ny).fill(-1);
  const px = P.x, py = P.y, pz = P.z;
  const gx = i => nx > 1 ? (i / (nx - 1) - 0.5) * W : 0, gy = j => ny > 1 ? (j / (ny - 1) - 0.5) * H : 0;
  const X0 = [0, 0, 0], Y0 = [0, 0, 0], D0 = [0, 0, 0];
  for (let t = 0; t < T.n; t++) {
    const k = t * 7, nl = Math.hypot(T.info[k + 4], T.info[k + 5], T.info[k + 6]);
    if (!nl || (T.info[k + 4] * N.x + T.info[k + 5] * N.y + T.info[k + 6] * N.z) / nl < 0.05) continue;
    if (rho < Infinity) { const dx = T.info[k] - px, dy = T.info[k + 1] - py, dz = T.info[k + 2] - pz, rr = rho + T.info[k + 3]; if (dx * dx + dy * dy + dz * dz > rr * rr) continue; }
    for (let q = 0; q < 3; q++) {
      const o = t * 9 + q * 3, vx = T.v[o] - px, vy = T.v[o + 1] - py, vz = T.v[o + 2] - pz;
      X0[q] = vx * X.x + vy * X.y + vz * X.z; Y0[q] = vx * Y.x + vy * Y.y + vz * Y.z; D0[q] = -(vx * N.x + vy * N.y + vz * N.z);
    }
    const minx = Math.min(X0[0], X0[1], X0[2]), maxx = Math.max(X0[0], X0[1], X0[2]), miny = Math.min(Y0[0], Y0[1], Y0[2]), maxy = Math.max(Y0[0], Y0[1], Y0[2]);
    const i0 = nx > 1 ? Math.max(0, Math.ceil((minx / W + 0.5) * (nx - 1) - 1e-6)) : (minx <= 1e-9 && maxx >= -1e-9 ? 0 : 1);
    const i1 = nx > 1 ? Math.min(nx - 1, Math.floor((maxx / W + 0.5) * (nx - 1) + 1e-6)) : 0;
    const j0 = ny > 1 ? Math.max(0, Math.ceil((miny / H + 0.5) * (ny - 1) - 1e-6)) : (miny <= 1e-9 && maxy >= -1e-9 ? 0 : 1);
    const j1 = ny > 1 ? Math.min(ny - 1, Math.floor((maxy / H + 0.5) * (ny - 1) + 1e-6)) : 0;
    if (i0 > i1 || j0 > j1) continue;
    const den = (Y0[1] - Y0[2]) * (X0[0] - X0[2]) + (X0[2] - X0[1]) * (Y0[0] - Y0[2]);
    if (Math.abs(den) < 1e-14) continue;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = gx(i), y = gy(j);
      const a = ((Y0[1] - Y0[2]) * (x - X0[2]) + (X0[2] - X0[1]) * (y - Y0[2])) / den;
      const b = ((Y0[2] - Y0[0]) * (x - X0[2]) + (X0[0] - X0[2]) * (y - Y0[2])) / den, c = 1 - a - b;
      if (a < -1e-7 || b < -1e-7 || c < -1e-7) continue;
      const d = a * D0[0] + b * D0[1] + c * D0[2], cell = j * nx + i;
      if (d < depth[cell]) { depth[cell] = d; tri[cell] = t; }
    }
  }
  return { depth, tri };
}
const triNormal = (T, t) => new V3(T.info[t * 7 + 4], T.info[t * 7 + 5], T.info[t * 7 + 6]).normalize();
function probe(T, P, N, X, Y, W, H) {
  const { depth, tri } = raster(T, P, N, X, Y, W, H, NX, NY, Math.hypot(W, H) / 2 + 0.05);
  let lo = Infinity, hi = -Infinity;
  for (let k = 0; k < depth.length; k++) {
    if (!Number.isFinite(depth[k]) || triNormal(T, tri[k]).dot(N) < 0.35) return null;
    if (depth[k] < lo) lo = depth[k]; if (depth[k] > hi) hi = depth[k];
  }
  return { depth, spread: (hi - lo) / W };
}
function sample(depth, W, H, x, y) {
  const fx = THREE.MathUtils.clamp((x / W + 0.5) * (NX - 1), 0, NX - 1.0001), fy = THREE.MathUtils.clamp((y / H + 0.5) * (NY - 1), 0, NY - 1.0001);
  const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, k = j * NX + i;
  return (depth[k] * (1 - u) + depth[k + 1] * u) * (1 - v) + (depth[k + NX] * (1 - u) + depth[k + NX + 1] * u) * v;
}
const reliefH = s => THREE.MathUtils.clamp(s * 0.2, 0.006, 0.022);
// заготовку «натягиваем» на поверхность: вершина садится на глубину под ней и поднимается по нормали
function wrap(s, P, N, X, Y, W, H, depth) {
  const U = unitText(), g = U.g.clone(), pos = g.attributes.position, v = new V3(), rel = reliefH(s), sink = rel * 0.7;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) * s, y = pos.getY(i) * s, z = pos.getZ(i);
    v.copy(P).addScaledVector(X, x).addScaledVector(Y, y).addScaledVector(N, -sample(depth, W, H, x, y) + z * (rel + sink) - sink);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
function frame(n, vertical) {
  const N = n.clone().normalize();
  const X = Math.abs(N.y) > 0.95 ? new V3(1, 0, 0) : new V3().crossVectors(new V3(0, 1, 0), N).normalize();
  const Y = new V3().crossVectors(N, X).normalize();
  return vertical ? { N, X: Y, Y: X.negate() } : { N, X, Y };
}

// надпись вдоль изогнутой трубки (червячок): буквы обнимают трубку и идут по её оси
function alongTube(geom, sides = 3) {
  const { points, r } = geom.userData.tube, off = geom.userData.offset || [0, 0, 0];
  const curve = new THREE.CatmullRomCurve3(points.map(p => new V3(p[0] + off[0], p[1] + off[1], p[2] + off[2])));
  const len = curve.getLength(), U = unitText(), s = Math.min(r * 1.0 / U.H, len * 0.6 / U.W), rel = reliefH(s) * 0.8, sink = rel * 0.7;
  const fr = curve.computeFrenetFrames(200, false), parts = [];
  // центр надписи — на самом прямом участке трубки
  const span = U.W * s / len; let mid = 0.5, bestBend = Infinity;
  for (let m = span / 2; m <= 1 - span / 2; m += 0.01) {
    let bend = 0, prev = curve.getTangentAt(m - span / 2);
    for (let q = 1; q <= 16; q++) { const tg = curve.getTangentAt(m - span / 2 + span * q / 16); bend += prev.angleTo(tg); prev = tg; }
    if (bend < bestBend) { bestBend = bend; mid = m; }
  }
  for (let k = 0; k < sides; k++) {
    const g = U.g.clone(), pos = g.attributes.position, v = new V3(), S = new V3(), W = new V3();
    const rot = k / sides * Math.PI * 2;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) * s, y = pos.getY(i) * s, z = pos.getZ(i);
      const t = THREE.MathUtils.clamp(mid + x / len, 0, 1), fi = Math.round(t * 200);
      const a = rot - y / r, Pc = curve.getPointAt(t); // знак «минус» — чтобы буквы не были зеркальными
      S.copy(fr.normals[fi]).multiplyScalar(Math.cos(a)).addScaledVector(fr.binormals[fi], Math.sin(a));
      v.copy(Pc).addScaledVector(S, r - sink + z * (rel + sink));
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals(); parts.push(g);
  }
  return mergeGeometries(parts);
}

const reliefCache = {};
export function reliefGeometry(type, geom) {
  if (type in reliefCache) return reliefCache[type];
  if (!FONT) return null;
  const hint = HINTS[type] || {};
  if (geom.userData.tube && !hint.vertical) return (reliefCache[type] = alongTube(geom));
  const T = triTable(geom), U = unitText();
  geom.computeBoundingBox();
  const b = geom.boundingBox, size = b.getSize(new V3()), c = b.getCenter(new V3()), R = size.length() + 1, parts = [];
  const minSize = hint.min || 0.03, vertical = !!hint.vertical;

  // пробуем размер s0 и меньше, пока надпись не ляжет ровно
  const place = (point, normal, s0) => {
    const f = frame(normal, vertical);
    for (let s = s0; s >= minSize; s *= 0.8) {
      const W = U.W * s + s * 0.3, H = U.H * s + s * 0.3, pr = probe(T, point, f.N, f.X, f.Y, W, H);
      if (pr && pr.spread < 0.42) return { geo: () => wrap(s, point, f.N, f.X, f.Y, W, H, pr.depth), spread: pr.spread, s };
    }
    return null;
  };
  // точка на наружной поверхности, если смотреть на деталь по направлению -N из точки P
  const surf = (P, N) => {
    const X = Math.abs(N.y) > 0.95 ? new V3(1, 0, 0) : new V3().crossVectors(new V3(0, 1, 0), N).normalize(), Y = new V3().crossVectors(N, X);
    const { depth, tri } = raster(T, P, N, X, Y, 0, 0, 1, 1, Infinity);
    return Number.isFinite(depth[0]) ? { point: P.clone().addScaledVector(N, -depth[0]), normal: triNormal(T, tri[0]) } : null;
  };
  const sideHit = (a, frac, lat) => {
    const dir = new V3(Math.sin(a), 0, Math.cos(a)), side = new V3(Math.cos(a), 0, -Math.sin(a));
    const hit = surf(new V3(c.x, b.min.y + size.y * frac, c.z).addScaledVector(side, lat * size.x).addScaledVector(dir, R), dir);
    return hit && hit.normal.dot(dir) > 0.5 ? hit : null;
  };

  if (hint.top) {
    const hit = surf(new V3(c.x, b.max.y + 1, c.z), new V3(0, 1, 0));
    const r = hit && place(hit.point, new V3(0, 1, 0), Math.min(size.x, size.z) * 0.62 / U.W);
    if (r) parts.push(r.geo());
  } else {
    const s0 = vertical ? Math.min(Math.min(size.x, size.z) * 0.6 / U.H, size.y * 0.75 / U.W)
                        : Math.min(size.y * 0.2, Math.min(size.x, size.z) * 0.72 / U.W);
    for (let k = 0; k < 4; k++) {
      let best = null;
      search: for (const off of [0, Math.PI / 12, -Math.PI / 12, Math.PI / 6, -Math.PI / 6]) {
        for (const frac of vertical ? [0.5, 0.4, 0.6] : [0.38, 0.5, 0.28, 0.62, 0.2]) {
          for (const lat of hint.lateral || [0]) {
            const hit = sideHit(k * Math.PI / 2 + off, frac, lat);
            const r = hit && place(hit.point, hit.normal, s0);
            if (!r) continue;
            if (!best || r.s > best.s * 1.05 || (r.s >= best.s * 0.95 && r.spread < best.spread)) best = r;
            if (best.s >= s0 * 0.99 && best.spread < 0.3) break search;
          }
        }
      }
      if (best) parts.push(best.geo());
    }
  }
  return (reliefCache[type] = parts.length ? mergeGeometries(parts) : null);
}

// ---------------- подиум с надписью ----------------
function arc3D(font, text, R, size, center) {
  const { resolution, glyphs } = font.data, parts = [];
  const ws = [...text].map(ch => (glyphs[ch] ? glyphs[ch].ha : 500) * size / resolution * 1.05);
  let a = center - ws.reduce((x, y) => x + y, 0) / R / 2;
  [...text].forEach((ch, i) => {
    const shapes = font.generateShapes(ch, size), m = a + ws[i] / R / 2;
    if (shapes.length) {
      const geo = new THREE.ExtrudeGeometry(shapes, { depth: 0.016, bevelEnabled: false, curveSegments: 6 });
      geo.translate(-ws[i] / 2.1, -size * 0.36, 0);
      geo.rotateX(-Math.PI / 2); geo.rotateY(m);
      geo.translate(R * Math.sin(m), 0, R * Math.cos(m));
      for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
      parts.push(geo);
    }
    a += ws[i] / R;
  });
  return { geo: parts.length ? mergeGeometries(parts) : null, end: a };
}
export function makeStand(fontJson) {
  const g = new THREE.Group(); g.name = 'Подиум sim.play.art';
  const base = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 0.06, 128), new THREE.MeshStandardMaterial({ color: '#F1EAE3', roughness: 0.95 }));
  base.position.y = -0.03; base.receiveShadow = true; base.name = 'Подиум';
  g.add(base);
  if (!fontJson) return g;
  const font = new Font(fontJson), ink = new THREE.MeshStandardMaterial({ color: '#DDD1C5', roughness: 0.75, name: 'надпись sim.play.art' });
  const front = arc3D(font, 'sim.play.art', 2.92, 0.3, -0.09);
  const back = arc3D(font, 'simplayart.ru/play', 2.98, 0.19, Math.PI);
  for (const t of [front, back]) if (t.geo) { const m = new THREE.Mesh(t.geo, ink); m.receiveShadow = true; m.name = 'Надпись sim.play.art'; g.add(m); }
  DOTS.forEach((col, i) => {
    const a = front.end + 0.05 + i * 0.045;
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 24), new THREE.MeshStandardMaterial({ color: col, roughness: 0.3 }));
    d.position.set(2.86 * Math.sin(a), 0.015, 2.86 * Math.cos(a)); d.name = 'Логотип sim.play.art'; g.add(d);
  });
  return g;
}

// ---------------- плашка и финальная карточка ----------------
function dots(g, x, y, r, gap) { DOTS.forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(x + i * gap, y, r, 0, 7); g.fill(); }); }
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }
export function drawPlate(g, W, H) {
  const u = Math.min(W, H) / 1080, h = 66 * u;
  g.save(); g.textBaseline = 'middle';
  g.font = `500 ${30 * u}px Unbounded, Manrope, sans-serif`; const w1 = g.measureText(BRAND.nick).width;
  g.font = `600 ${25 * u}px Manrope, sans-serif`; const w2 = g.measureText(BRAND.url).width;
  // сверху: снизу в Reels кадр закрывают подпись и кнопки Instagram
  const w = 28 * u + 50 * u + 14 * u + w1 + 26 * u + w2 + 28 * u, x = (W - w) / 2, y = H > W * 1.4 ? H * 0.115 : 48 * u;
  g.fillStyle = 'rgba(255,255,255,.82)'; rr(g, x, y, w, h, h / 2); g.fill();
  dots(g, x + 28 * u + 9 * u, y + h / 2, 9 * u, 16 * u);
  let cx = x + 28 * u + 50 * u + 14 * u;
  g.fillStyle = INK; g.font = `500 ${30 * u}px Unbounded, Manrope, sans-serif`; g.textAlign = 'left'; g.fillText(BRAND.nick, cx, y + h / 2 + u);
  cx += w1 + 26 * u;
  g.fillStyle = INK2; g.font = `600 ${25 * u}px Manrope, sans-serif`; g.fillText(BRAND.url, cx, y + h / 2 + u);
  g.restore();
}
function fit(g, text, font, size, maxW) { let s = size; do { g.font = font.replace('#', s); s -= 2; } while (g.measureText(text).width > maxW && s > 10); }
export function drawEndCard(g, W, H, k) {
  if (k <= 0) return;
  const u = Math.min(W, H) / 1080, cy = H / 2;
  g.save(); g.fillStyle = `rgba(251,248,245,${0.95 * k})`; g.fillRect(0, 0, W, H);
  g.globalAlpha = k; g.textAlign = 'center'; g.textBaseline = 'middle';
  dots(g, W / 2 - 36 * u, cy - 170 * u, 18 * u, 36 * u);
  g.fillStyle = INK; fit(g, 'Собрано в 3D-конструкторе', '400 #px Unbounded, sans-serif', 58 * u, W * 0.86); g.fillText('Собрано в 3D-конструкторе', W / 2, cy - 72 * u);
  fit(g, 'PLAY', '500 #px Unbounded, sans-serif', 96 * u, W * 0.86); g.fillText('PLAY', W / 2, cy + 18 * u);
  g.fillStyle = INK2; fit(g, 'по мотивам работ Ольги Симоновой · sim.play.art', '600 #px Manrope, sans-serif', 32 * u, W * 0.86);
  g.fillText('по мотивам работ Ольги Симоновой · sim.play.art', W / 2, cy + 112 * u);
  g.fillStyle = COBALT; fit(g, BRAND.url, '500 #px Unbounded, sans-serif', 44 * u, W * 0.86); g.fillText(BRAND.url, W / 2, cy + 190 * u);
  g.restore();
}

// ---------------- метаданные PNG (iTXt) ----------------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(bytes) { let c = 0xFFFFFFFF; for (const b of bytes) c = CRC[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) {
  const out = new Uint8Array(12 + data.length), dv = new DataView(out.buffer);
  dv.setUint32(0, data.length); out.set(new TextEncoder().encode(type), 4); out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
export async function pngWithMeta(blob, meta) {
  const buf = new Uint8Array(await blob.arrayBuffer()), enc = new TextEncoder();
  const extra = Object.entries(meta).map(([k, v]) => {
    const kw = enc.encode(k), tx = enc.encode(v), d = new Uint8Array(kw.length + 5 + tx.length);
    d.set(kw, 0); d.set(tx, kw.length + 5); // keyword\0 flag(0) method(0) lang\0 translated\0 text
    return chunk('iTXt', d);
  });
  return new Blob([buf.subarray(0, 33), ...extra, buf.subarray(33)], { type: 'image/png' });
}
export const fileMeta = () => ({
  Title: 'Сборка из 3D-конструктора PLAY', Author: `${BRAND.author} (sim.play.art) — формы`, Copyright: BRAND.rights,
  Source: BRAND.href, Software: '3D-конструктор PLAY · simplayart.ru/play', 'Creation Time': new Date().toISOString(),
});
