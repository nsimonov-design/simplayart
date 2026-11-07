// Конструктор PLAY — sim.play.art. Three.js (MIT), без сборщика.
import * as THREE from './three/three.module.min.js';
import { OrbitControls } from './three/OrbitControls.js';
import { TransformControls } from './three/TransformControls.js';
import { GLTFExporter } from './three/GLTFExporter.js';
import { RoomEnvironment } from './three/RoomEnvironment.js';
import { SHAPES, CATS, geometry, rng } from './shapes.js?v=5a5c0570';
import { COLORS, TEX, PRINTS, makeMaterial, printCanvas } from './materials.js?v=370f040d';
import { BRAND, setFont, makeStand, drawPlate, drawEndCard, pngWithMeta, fileMeta } from './brand.js?v=2319d31c';

// Ограничения: сцена и ссылка на сборку не должны вешать браузер
const MAX_ITEMS = 50, MAX_HASH = 12000;
const LOW = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;

// шрифты для клейма и плашки + контуры букв для надписи на подиуме
const fontJson = await fetch(new URL('./three/sim-font.json?v=3fde0340', import.meta.url)).then(r => r.json()).catch(() => null);
try {
  await Promise.race([Promise.all(['800 27px Manrope', '600 25px Manrope', '500 30px Unbounded', '400 30px Unbounded'].map(f => document.fonts.load(f))),
    new Promise(r => setTimeout(r, 2000))]);
} catch {}
setFont(fontJson);

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, attrs = {}, kids = []) => { const e = document.createElement(tag); Object.assign(e, attrs); kids.forEach(k => e.append(k)); return e; };
const r3 = v => Math.round(v * 1000) / 1000;
const BG = '#FBF8F5';
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };

// ---------------- сцена ----------------
const stageBox = $('#paStage'), canvas = $('#paCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, LOW ? 1.5 : 2));
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.75;

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 300);
camera.position.set(7, 6, 11);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.495; controls.minDistance = 2; controls.maxDistance = 60;
controls.target.set(0, 2, 0);

const sun = new THREE.DirectionalLight('#ffffff', 1.7);
sun.castShadow = true; sun.shadow.mapSize.setScalar(LOW ? 1024 : 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target, new THREE.HemisphereLight('#ffffff', '#efe6dd', 0.35));

const podium = makeStand(fontJson);
const catcher = new THREE.Mesh(new THREE.CircleGeometry(40, 64).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.1 }));
catcher.position.y = -0.059; catcher.receiveShadow = true;
scene.add(podium, catcher);

const model = new THREE.Group(); model.name = 'Сборка sim.play.art'; scene.add(model);
model.userData = { author: `${BRAND.author} (sim.play.art)`, source: BRAND.href, rights: BRAND.rights };

const tc = new TransformControls(camera, canvas);
tc.setSize(0.85);
const gizmo = tc.getHelper(); scene.add(gizmo);
tc.addEventListener('dragging-changed', e => { controls.enabled = !e.value; if (!e.value) commit(); });
tc.addEventListener('objectChange', () => { if (sel) { readMesh(sel); fillSliders(); } });

function resize() {
  const w = stageBox.clientWidth, h = stageBox.clientHeight;
  if (!w || !h || recording) return;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stageBox);

// ---------------- состояние ----------------
let items = [], sel = null, nextId = 1, lastSnap = null, recording = false;
const hist = []; let hi = -1;

const defaults = type => {
  const cat = SHAPES[type][1];
  const c = { balloons: '#E98AA8', fruits: '#9BC94A', geometry: '#6FA8E0', bases: '#FFFFFF', details: '#FFFFFF' }[cat];
  return { t: type, p: [0, 0, 0], r: [0, 0, 0], s: 1, m: 'gloss', q: 'none', a: c, b: '#FFFFFF' };
};

function makeItem(spec) {
  const it = { ...defaults(spec.t), ...spec, id: nextId++ };
  const mesh = new THREE.Mesh(geometry(it.t), makeMaterial(it, SHAPES[it.t][2]));
  mesh.name = SHAPES[it.t][0]; mesh.castShadow = mesh.receiveShadow = true; mesh.rotation.order = 'YXZ';
  mesh.userData.id = it.id; it.mesh = mesh;
  writeMesh(it); model.add(mesh); items.push(it);
  return it;
}

// данные из ссылки или из памяти браузера — только известные значения и в разумных пределах
const HEX = /^#[0-9a-f]{6}$/i, clamp = (v, a, b, d) => Number.isFinite(+v) ? Math.min(b, Math.max(a, +v)) : d;
function sanitize(x) {
  if (!x || typeof x !== 'object' || !SHAPES[x.t]) return null;
  const d = defaults(x.t), p = Array.isArray(x.p) ? x.p : [], r = Array.isArray(x.r) ? x.r : [];
  return {
    t: x.t, p: [clamp(p[0], -30, 30, 0), clamp(p[1], -5, 40, 0), clamp(p[2], -30, 30, 0)],
    r: [0, 1, 2].map(i => clamp(r[i], -7, 7, 0)), s: clamp(x.s, 0.3, 3, 1),
    m: TEX[x.m] ? x.m : 'gloss', q: PRINTS[x.q] ? x.q : 'none', a: HEX.test(x.a) ? x.a : d.a, b: HEX.test(x.b) ? x.b : d.b,
  };
}
const full = () => { if (items.length < MAX_ITEMS) return false; toast(`Не больше ${MAX_ITEMS} деталей в одной сборке`); return true; };
function writeMesh(it) { it.mesh.position.set(...it.p); it.mesh.rotation.set(...it.r); it.mesh.scale.setScalar(it.s); it.mesh.updateMatrixWorld(); }
function readMesh(it) { const m = it.mesh; it.p = m.position.toArray(); it.r = [m.rotation.x, m.rotation.y, m.rotation.z]; it.s = m.scale.x; }
function refreshMaterial(it) {
  it.mesh.material.dispose(); it.mesh.material = makeMaterial(it, SHAPES[it.t][2]);
}
function removeItem(it) { model.remove(it.mesh); it.mesh.material.dispose(); items = items.filter(x => x !== it); }

const serialize = () => JSON.stringify(items.map(({ t, p, r, s, m, q, a, b }) => ({ t, p: p.map(r3), r: r.map(r3), s: r3(s), m, q, a, b })));
function load(str, keepSel) {
  const selIdx = sel ? items.indexOf(sel) : -1;
  select(null);
  [...items].forEach(removeItem);
  try { const arr = JSON.parse(str); if (Array.isArray(arr)) arr.slice(0, MAX_ITEMS).map(sanitize).filter(Boolean).forEach(makeItem); } catch {}
  if (keepSel && items[selIdx]) select(items[selIdx]);
  renderLayers(); updateShadow();
}
function commit() {
  const s = serialize();
  if (hist[hi] === s) return;
  hist.splice(hi + 1); hist.push(s); if (hist.length > 80) hist.shift(); hi = hist.length - 1;
  store.set('simplayart-play', s); updateUndo(); updateShadow();
}
const undo = () => { if (hi > 0) { load(hist[--hi], true); store.set('simplayart-play', hist[hi]); updateUndo(); } };
const redo = () => { if (hi < hist.length - 1) { load(hist[++hi], true); store.set('simplayart-play', hist[hi]); updateUndo(); } };
function updateUndo() { $('#paUndo').disabled = hi <= 0; $('#paRedo').disabled = hi >= hist.length - 1; }

// ---------------- расстановка ----------------
const box = obj => { obj.updateMatrixWorld(true); return new THREE.Box3().setFromObject(obj); };
function moveBy(it, d) { it.mesh.position.add(d); readMesh(it); it.mesh.updateMatrixWorld(); }

function placeOnTop(it, overlap = 0) {
  const others = items.filter(x => x !== it);
  const b = box(it.mesh), c = b.getCenter(new THREE.Vector3());
  if (!others.length) { moveBy(it, new THREE.Vector3(-c.x, -b.min.y, -c.z)); return; }
  let top = null, tb = null;
  for (const o of others) { const ob = box(o.mesh); if (!tb || ob.max.y > tb.max.y) { top = o; tb = ob; } }
  const tc2 = tb.getCenter(new THREE.Vector3());
  const h = b.max.y - b.min.y;
  moveBy(it, new THREE.Vector3(tc2.x - c.x, tb.max.y - b.min.y - h * overlap, tc2.z - c.z));
  lastSnap = { id: it.id, dir: new THREE.Vector3(0, -1, 0) };
}
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function placeBeside(it) {
  const others = items.filter(x => x !== it);
  if (!others.length) return;
  const b = box(it.mesh), c = b.getCenter(new THREE.Vector3());
  let ref = null, best = Infinity;
  for (const o of others) { const d = box(o.mesh).getCenter(new THREE.Vector3()).distanceTo(c); if (d < best) { best = d; ref = o; } }
  const rb = box(ref.mesh), rc = rb.getCenter(new THREE.Vector3());
  const k = lastSnap && lastSnap.id === it.id && lastSnap.side !== undefined ? (lastSnap.side + 1) % 4 : 0;
  const [sx, sz] = SIDES[k], gap = 0.04;
  const tx = sx ? (sx > 0 ? rb.max.x + (c.x - b.min.x) + gap : rb.min.x - (b.max.x - c.x) - gap) : rc.x;
  const tz = sz ? (sz > 0 ? rb.max.z + (c.z - b.min.z) + gap : rb.min.z - (b.max.z - c.z) - gap) : rc.z;
  moveBy(it, new THREE.Vector3(tx - c.x, rb.min.y - b.min.y, tz - c.z));
  lastSnap = { id: it.id, side: k, dir: new THREE.Vector3(-sx, 0, -sz) };
}
function placeOnFloor(it) { const b = box(it.mesh); moveBy(it, new THREE.Vector3(0, -b.min.y, 0)); lastSnap = { id: it.id, dir: new THREE.Vector3(0, -1, 0) }; }
function pushIn(it) {
  const b = box(it.mesh), size = b.getSize(new THREE.Vector3());
  const dir = lastSnap && lastSnap.id === it.id ? lastSnap.dir : new THREE.Vector3(0, -1, 0);
  const step = Math.abs(dir.x) * size.x + Math.abs(dir.y) * size.y + Math.abs(dir.z) * size.z;
  moveBy(it, dir.clone().multiplyScalar(step * 0.12));
}

function addShape(type) {
  if (full()) return;
  const it = makeItem({ t: type });
  if ($('#paMagnet').checked && items.length > 1) placeOnTop(it, 0.03);
  else if (items.length > 1) {
    const all = new THREE.Box3(); items.filter(x => x !== it).forEach(o => all.expandByObject(o.mesh));
    const b = box(it.mesh), c = b.getCenter(new THREE.Vector3());
    moveBy(it, new THREE.Vector3(all.max.x + (c.x - b.min.x) + 0.15 - c.x, -b.min.y, -c.z));
  } else placeOnFloor(it);
  select(it); renderLayers(); commit();
  if (matchMedia('(max-width: 899px)').matches) toast(`Добавлено: ${SHAPES[type][0]}`);
}

// ---------------- выбор ----------------
function select(it) {
  sel = it;
  if (it) tc.attach(it.mesh); else tc.detach();
  $('#paSel').hidden = !it; $('#paEmpty').hidden = !!it;
  if (it) { $('#paSelName').textContent = SHAPES[it.t][0]; fillProps(); }
  $('#paGo').hidden = !it || !matchMedia('(max-width: 899px)').matches;
  document.querySelectorAll('#paLayers li').forEach(li => li.classList.toggle('on', it && +li.dataset.id === it.id));
}
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
let down = null;
canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, gizmo: tc.axis !== null }; });
canvas.addEventListener('pointerup', e => {
  if (!down || down.gizmo || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { down = null; return; }
  down = null;
  const r = canvas.getBoundingClientRect();
  ptr.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  ray.setFromCamera(ptr, camera);
  const hit = ray.intersectObjects(model.children, false)[0];
  select(hit ? items.find(x => x.mesh === hit.object) : null);
});

// ---------------- панели ----------------
function buildLibrary() {
  const tabs = $('#paCats'), grid = $('#paLib');
  const thumbs = renderThumbs();
  CATS.forEach(([key, label], i) => {
    const b = el('button', { type: 'button', textContent: label, className: i ? '' : 'on' });
    b.setAttribute('role', 'tab');
    b.onclick = () => { tabs.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); showCat(key); };
    tabs.append(b);
  });
  function showCat(cat) {
    grid.replaceChildren(...Object.entries(SHAPES).filter(([, s]) => s[1] === cat).map(([type, s]) => {
      const b = el('button', { type: 'button', className: 'pa-piece', title: `Добавить: ${s[0]}` }, [el('img', { src: thumbs[type], alt: '', width: 96, height: 96 }), el('span', { textContent: s[0] })]);
      b.onclick = () => addShape(type);
      return b;
    }));
  }
  showCat(CATS[0][0]);
}

function renderThumbs() {
  const S = 192, r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(S, S); r.toneMapping = THREE.NeutralToneMapping;
  const sc = new THREE.Scene(), pm = new THREE.PMREMGenerator(r);
  sc.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  const l = new THREE.DirectionalLight('#fff', 1.4); l.position.set(3, 5, 4); sc.add(l);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100), out = {};
  const tint = { balloons: '#F2A3BC', fruits: '#B6D86E', geometry: '#8DB8EA', bases: '#D9CFF3', details: '#F7C25E' };
  for (const [type, s] of Object.entries(SHAPES)) {
    const m = new THREE.Mesh(geometry(type), new THREE.MeshPhysicalMaterial({ color: tint[s[1]], roughness: 0.2, clearcoat: 1 }));
    sc.add(m);
    const sph = geometry(type).boundingSphere, d = sph.radius / Math.sin(15 * Math.PI / 180) * 1.02;
    cam.position.copy(sph.center).add(new THREE.Vector3(0.55, 0.42, 0.72).normalize().multiplyScalar(d)); cam.lookAt(sph.center);
    r.render(sc, cam); out[type] = r.domElement.toDataURL('image/png');
    sc.remove(m); m.material.dispose();
  }
  pm.dispose(); r.dispose(); r.forceContextLoss();
  return out;
}

function swatches(holder, key) {
  holder.replaceChildren(...COLORS.map(c => {
    const b = el('button', { type: 'button', className: 'pa-sw', title: c });
    b.style.background = c; b.dataset.c = c;
    b.onclick = () => setProp(key, c);
    return b;
  }), (() => {
    const lab = el('label', { className: 'pa-sw pa-sw-custom', title: 'Свой цвет' });
    const inp = el('input', { type: 'color' });
    inp.oninput = () => setProp(key, inp.value, true); inp.onchange = () => commit();
    lab.append(inp); return lab;
  })());
}
function setProp(key, v, live) {
  if (!sel) return;
  sel[key] = v; refreshMaterial(sel); fillProps(); renderLayers();
  if (!live) commit();
}
function fillProps() {
  const it = sel; if (!it) return;
  $('#paTex').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.k === it.m));
  $('#paPrint').querySelectorAll('button').forEach(b => {
    b.classList.toggle('on', b.dataset.k === it.q);
    const cv = b.querySelector('canvas'), g = cv.getContext('2d');
    g.drawImage(printCanvas(b.dataset.k === 'none' ? 'none' : b.dataset.k, it.a, it.b), 0, 0, 512, 512, 0, 0, cv.width, cv.height);
  });
  $('#paC1').querySelectorAll('.pa-sw').forEach(b => b.classList.toggle('on', b.dataset.c === it.a));
  $('#paC2').querySelectorAll('.pa-sw').forEach(b => b.classList.toggle('on', b.dataset.c === it.b));
  $('#paC2Box').classList.toggle('dim', it.q === 'none');
  fillSliders();
}
const SL = [['paY', 'Высота', -1, 12, 0.01], ['paX', 'Влево — вправо', -6, 6, 0.01], ['paZ', 'Назад — вперёд', -6, 6, 0.01],
  ['paRot', 'Поворот', 0, 360, 1], ['paTilt', 'Наклон', -90, 90, 1], ['paScale', 'Размер', 0.3, 3, 0.01]];
function buildSliders() {
  $('#paSliders').replaceChildren(...SL.map(([id, label, min, max, step]) => {
    const inp = el('input', { type: 'range', id, min, max, step });
    const out = el('output', { htmlFor: id });
    inp.oninput = () => { applySliders(); };
    inp.onchange = () => commit();
    return el('label', { className: 'pa-sl' }, [el('span', { textContent: label }), out, inp]);
  }));
}
function applySliders() {
  if (!sel) return;
  const v = id => +$('#' + id).value, D = Math.PI / 180;
  sel.p = [v('paX'), v('paY'), v('paZ')];
  sel.r = [v('paTilt') * D, v('paRot') * D, sel.r[2]];
  sel.s = v('paScale');
  writeMesh(sel); fillSliders(true);
}
function fillSliders(outputsOnly) {
  if (!sel) return;
  const D = 180 / Math.PI, rot = ((sel.r[1] * D) % 360 + 360) % 360;
  const vals = { paY: sel.p[1], paX: sel.p[0], paZ: sel.p[2], paRot: rot, paTilt: sel.r[0] * D, paScale: sel.s };
  for (const [id, v] of Object.entries(vals)) {
    const inp = $('#' + id);
    if (!outputsOnly) inp.value = v;
    inp.previousElementSibling.textContent = id === 'paRot' || id === 'paTilt' ? `${Math.round(v)}°` : id === 'paScale' ? `×${(+v).toFixed(2)}` : `${(v * 10).toFixed(0)} см`;
  }
}

function buildProps() {
  $('#paTex').replaceChildren(...Object.entries(TEX).map(([k, t]) => {
    const b = el('button', { type: 'button', className: 'pa-chip', textContent: t.name }); b.dataset.k = k; b.onclick = () => setProp('m', k); return b;
  }));
  $('#paPrint').replaceChildren(...Object.entries(PRINTS).map(([k, name]) => {
    const b = el('button', { type: 'button', className: 'pa-print', title: name }, [el('canvas', { width: 56, height: 56 }), el('span', { textContent: name })]);
    b.dataset.k = k; b.onclick = () => setProp('q', k); return b;
  }));
  swatches($('#paC1'), 'a'); swatches($('#paC2'), 'b');
  buildSliders();
  const act = (id, fn) => { $(id).onclick = () => { if (!sel) return; fn(sel); fillSliders(); commit(); }; };
  act('#paTop', it => placeOnTop(it));
  act('#paBeside', placeBeside);
  act('#paPush', pushIn);
  act('#paFloor', placeOnFloor);
  $('#paDup').onclick = () => {
    if (!sel || full()) return;
    const { t, p, r, s, m, q, a, b } = sel;
    const it = makeItem({ t, p: [...p], r: [...r], s, m, q, a, b });
    placeBeside(it); select(it); renderLayers(); commit();
  };
  $('#paDel').onclick = () => { if (!sel) return; removeItem(sel); select(null); renderLayers(); commit(); };
  document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => {
    tc.setMode(b.dataset.mode);
    document.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('on', x === b));
  });
}

function renderLayers() {
  $('#paLayers').replaceChildren(...[...items].reverse().map(it => {
    const dot = el('i'); dot.style.background = it.a;
    const li = el('li', {}, [dot, el('span', { textContent: SHAPES[it.t][0] })]);
    li.dataset.id = it.id; li.tabIndex = 0;
    if (sel === it) li.classList.add('on');
    li.onclick = () => select(it); li.onkeydown = e => { if (e.key === 'Enter') select(it); };
    return li;
  }));
  $('#paCount').textContent = items.length;
}

// ---------------- камера и свет ----------------
function modelBounds() {
  const b = new THREE.Box3();
  items.forEach(it => b.expandByObject(it.mesh));
  if (b.isEmpty()) b.set(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 2, 1));
  return b;
}
function fitView(dir) {
  const s = modelBounds().getBoundingSphere(new THREE.Sphere());
  const v = camera.fov * Math.PI / 180, vh = 2 * Math.atan(Math.tan(v / 2) * camera.aspect);
  const d = s.radius / Math.sin(Math.min(v, vh) / 2) * 1.05;
  const dv = dir || camera.position.clone().sub(controls.target).normalize();
  controls.target.copy(s.center); camera.position.copy(s.center).addScaledVector(dv, d); controls.update();
}
// кадр для видео: сборка занимает кадр по высоте и ширине (с запасом на вращение), подиум с надписью внизу
function fitVideo() {
  const b = modelBounds(), size = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
  const v = camera.fov * Math.PI / 180, vh = 2 * Math.atan(Math.tan(v / 2) * camera.aspect);
  const hw = Math.hypot(size.x, size.z) / 2, hh = size.y / 2 * 1.36 + 0.2;
  const d = Math.max(hh / Math.tan(v / 2), hw * 1.12 / Math.tan(vh / 2)) + hw;
  const dir = new THREE.Vector3(0, 0.26, 1).normalize();
  controls.target.set(c.x, c.y + size.y * 0.055, c.z); // сборка чуть ниже центра — сверху место для плашки
  camera.position.copy(controls.target).addScaledVector(dir, d); controls.update();
}
function updateShadow() {
  const s = modelBounds().getBoundingSphere(new THREE.Sphere());
  const R = Math.max(3.5, s.radius * 1.3);
  sun.target.position.set(s.center.x, 0, s.center.z);
  sun.position.set(s.center.x + 4, 9 + s.radius, s.center.z + 5);
  Object.assign(sun.shadow.camera, { left: -R, right: R, top: R, bottom: -R, near: 0.5, far: 40 + s.radius * 3 });
  sun.shadow.camera.updateProjectionMatrix();
  const span = Math.max(Math.abs(s.center.x), Math.abs(s.center.z)) + s.radius;
  podium.scale.setScalar(Math.max(1, span / 3.2));
}

// ---------------- готовые сборки ----------------
const DEMO = [
  { t: 'ruffle', a: '#FFFFFF', m: 'gloss' },
  { t: 'ring', a: '#CFE7B0', m: 'gloss', s: 0.95 },
  { t: 'base', a: '#BFDDF5', q: 'waves', b: '#FFFFFF', m: 'matte', s: 0.62 },
  { t: 'crown', a: '#CFE7B0', q: 'zigzag', b: '#3E8E4A', m: 'gloss', s: 0.85 },
  { t: 'cloud', a: '#FFFFFF', m: 'matte', s: 0.95 },
  { t: 'balloon', a: '#9BC94A', q: 'cracks', b: '#E9F5D6', m: 'gloss', r: [0, 0, 1.45] },
  { t: 'core', a: '#F3EEE6', m: 'gloss', s: 0.85 },
];
function buildStack(list, overlap = 0.04) {
  select(null); [...items].forEach(removeItem);
  list.forEach((spec, i) => { const it = makeItem(spec); i ? placeOnTop(it, spec.o ?? overlap) : placeOnFloor(it); });
  lastSnap = null; renderLayers(); updateShadow(); fitView(); commit();
}
function randomStack() {
  const R = Math.random, pick = a => a[Math.floor(R() * a.length)];
  const by = cat => Object.keys(SHAPES).filter(k => SHAPES[k][1] === cat);
  const mids = [...by('geometry').filter(k => k !== 'cone'), 'cloud', 'pillow', 'drop', 'balloonBumps'];
  const tops = [...by('fruits'), 'balloon', 'balloonBumps', 'balloonCrumpled', 'cone', 'drop', 'star'];
  const texs = ['gloss', 'gloss', 'gloss', 'matte', 'grain', 'bumps', 'crackle', 'ribs', 'glass', 'pearl', 'lustre'];
  const prints = Object.keys(PRINTS);
  const spec = t => {
    const a = pick(COLORS), q = R() < 0.45 ? pick(prints) : 'none';
    let b = pick(COLORS); while (b === a) b = pick(COLORS);
    return { t, a, b, q, m: pick(texs), s: 0.75 + R() * 0.35, r: [0, R() * Math.PI * 2, t === 'balloon' || t === 'balloonBumps' ? (R() < 0.4 ? 1.45 : 0) : 0] };
  };
  const list = [spec(pick(by('bases')))];
  list[0].s = 1;
  for (let i = 0, n = 2 + Math.floor(R() * 3); i < n; i++) list.push(spec(pick(mids)));
  list.push(spec(pick(tops)));
  buildStack(list);
}

// ---------------- экспорт ----------------
function download(blob, name) {
  const a = el('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');

async function exportGLB() {
  if (!items.length) return toast('Сначала добавьте детали');
  select(null);
  const ex = new GLTFExporter();
  ex.register(writer => ({
    afterParse() {
      Object.assign(writer.json.asset, {
        generator: '3D-конструктор PLAY · simplayart.ru/play', copyright: BRAND.rights,
        extras: { author: `${BRAND.author} (sim.play.art)`, source: BRAND.href, created: new Date().toISOString() },
      });
    },
  }));
  const res = await ex.parseAsync([model, podium], { binary: true, onlyVisible: true });
  download(new Blob([res], { type: 'model/gltf-binary' }), `simplayart-play-${stamp()}.glb`);
  toast('3D-модель сохранена (.glb)');
}
function exportPNG() {
  if (!items.length) return toast('Сначала добавьте детали');
  select(null); gizmo.visible = false;
  const pr = renderer.getPixelRatio(); renderer.setPixelRatio(Math.min(3, pr * 1.5)); resize();
  renderer.render(scene, camera);
  const src = renderer.domElement, out = el('canvas', { width: src.width, height: src.height }), g = out.getContext('2d');
  g.drawImage(src, 0, 0); drawPlate(g, out.width, out.height);
  renderer.setPixelRatio(pr); resize(); gizmo.visible = true;
  out.toBlob(async b => { download(await pngWithMeta(b, fileMeta()), `simplayart-play-${stamp()}.png`); toast('Картинка сохранена'); }, 'image/png');
}

function pickMime() {
  const list = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return list.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m));
}
async function recordVideo(fmt) {
  if (recording) return;
  if (!items.length) return toast('Сначала добавьте детали');
  const mime = pickMime();
  if (!mime || !HTMLCanvasElement.prototype.captureStream) return toast('Этот браузер не умеет записывать видео — попробуйте Chrome или Safari');
  const [W, H] = fmt === 'reels' ? [1080, 1920] : [1080, 1080];
  select(null); gizmo.visible = false; recording = true;
  const ov = $('#paRec'), bar = $('#paRecBar'); ov.hidden = false;
  const saved = { pos: camera.position.clone(), tgt: controls.target.clone(), pr: renderer.getPixelRatio() };
  renderer.setPixelRatio(1); renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
  fitVideo();
  const out = el('canvas', { width: W, height: H }), g = out.getContext('2d');
  const stream = out.captureStream(30), chunks = [];
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 10_000_000 });
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const stopped = new Promise(res => rec.onstop = res);
  // 8 с — полный оборот, затем 1,8 с — карточка «Собрано в 3D-конструкторе PLAY»
  const SPIN = 8000, END = 1800, DUR = SPIN + END, base = model.rotation.y;
  const frame = t => {
    model.rotation.y = base + Math.min(1, t / SPIN) * Math.PI * 2;
    model.updateMatrixWorld(true);
    renderer.render(scene, camera);
    g.drawImage(renderer.domElement, 0, 0, W, H);
    drawPlate(g, W, H);
    drawEndCard(g, W, H, Math.min(1, Math.max(0, (t - SPIN) / 450)));
  };
  frame(0); rec.start(250);
  const t0 = performance.now();
  await new Promise(res => {
    const tick = () => {
      const t = Math.min(DUR, performance.now() - t0);
      frame(t); bar.value = t / DUR;
      t < DUR ? requestAnimationFrame(tick) : res();
    };
    requestAnimationFrame(tick);
  });
  rec.stop(); await stopped;
  model.rotation.y = base; model.updateMatrixWorld(true);
  recording = false; ov.hidden = true; gizmo.visible = true;
  renderer.setPixelRatio(saved.pr); resize();
  camera.position.copy(saved.pos); controls.target.copy(saved.tgt); controls.update();
  const ext = mime.includes('mp4') ? 'mp4' : 'webm';
  const blob = new Blob(chunks, { type: mime.split(';')[0] });
  const dlg = $('#paVideoDlg'), v = $('#paVideo'), a = $('#paVideoSave');
  if (v.src) URL.revokeObjectURL(v.src);
  v.src = URL.createObjectURL(blob); a.href = v.src; a.download = `simplayart-play-${fmt}-${stamp()}.${ext}`;
  $('#paVideoNote').textContent = ext === 'mp4' ? 'Формат MP4 — можно сразу публиковать в Instagram, Telegram и VK.' : 'Формат WebM. Для Instagram откройте сайт в Safari или свежем Chrome — там видео сохранится в MP4.';
  dlg.showModal ? dlg.showModal() : dlg.setAttribute('open', '');
}

async function shareLink() {
  if (!items.length) return toast('Сначала добавьте детали');
  const data = btoa(unescape(encodeURIComponent(serialize()))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const url = `${location.origin}${location.pathname}#m=${data}`;
  history.replaceState(null, '', `#m=${data}`);
  try { await navigator.clipboard.writeText(url); toast('Ссылка на вашу пирамиду скопирована'); }
  catch { prompt('Скопируйте ссылку:', url); }
}
function fromHash() {
  const m = location.hash.match(/^#m=([\w-]+)/);
  if (!m) return null;
  if (m[1].length > MAX_HASH) { setTimeout(() => toast('Ссылка на сборку слишком длинная — её не открыть'), 500); return null; }
  try { const s = decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')))); JSON.parse(s); return s; } catch { return null; }
}

let toastT;
function toast(msg) { const t = $('#paToast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2600); }

// ---------------- запуск ----------------
buildLibrary(); buildProps();
$('#paUndo').onclick = undo; $('#paRedo').onclick = redo;
$('#paFit').onclick = () => fitView();
$('#paRandom').onclick = randomStack;
$('#paDemo').onclick = () => buildStack(DEMO);
$('#paClear').onclick = () => { if (!items.length || confirm('Убрать все детали со сцены?')) { select(null); [...items].forEach(removeItem); renderLayers(); commit(); } };
$('#paGLB').onclick = exportGLB; $('#paPNG').onclick = exportPNG;
$('#paVidSq').onclick = () => recordVideo('square'); $('#paVidReels').onclick = () => recordVideo('reels');
$('#paShare').onclick = shareLink;
$('#paGo').onclick = () => $('#paSel').scrollIntoView({ behavior: 'smooth', block: 'start' });
$('#paVideoClose').onclick = () => $('#paVideoDlg').close();

addEventListener('keydown', e => {
  if (e.target.closest?.('input, textarea, select') || recording) return;
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { e.preventDefault(); $('#paDel').click(); }
  else if (e.key === 'Escape') select(null);
});

resize();
const initial = fromHash() || store.get('simplayart-play');
if (initial && initial !== '[]') { load(initial); fitView(new THREE.Vector3(0.55, 0.38, 0.75).normalize()); commit(); }
else { camera.position.set(6, 4.4, 8.5); buildStack(DEMO); }
document.body.classList.add('pa-ready');

renderer.setAnimationLoop(() => { if (recording) return; controls.update(); renderer.render(scene, camera); });
window.__play = { items: () => items, scene, renderer, camera, controls, geometry, SHAPES };
