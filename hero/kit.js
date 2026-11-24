/* hero/kit.js — the scene kit: a physically lit WebGL stage (image-based daylight, a sun with soft shadows,
   no glow), a camera rig that moves between keyframes, timed tweens, and labels that are PLACED, not pinned:
   every label tries its allowed positions in order and takes the first one that touches no other label and no
   protected part of the picture. A label that cannot be placed is hidden; nothing ever overlaps. audit() re-measures
   the page and reports any overlap, so a scene can be gated on zero. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, f) => a + (b - a) * f;
export const ease = (s) => { s = clamp(s, 0, 1); return s * s * s * (s * (6 * s - 15) + 10); }; // smootherstep
export const sstep = (a, b, x) => { const s = clamp((x - a) / (b - a), 0, 1); return s * s * (3 - 2 * s); };

// Timed tweens. goals: { key: number | { to, dur, delay, log } }.
export class Tweener {
  constructor(init) { this.v = Object.assign({}, init); this.tw = {}; }
  to(goals, dur = 2.2, delay = 0) {
    for (const k in goals) {
      const g = typeof goals[k] === 'object' ? goals[k] : { to: goals[k] };
      this.tw[k] = { from: this.v[k], to: g.to, t: -(g.delay != null ? g.delay : delay), dur: g.dur != null ? g.dur : dur, log: !!g.log };
    }
  }
  set(vals) { for (const k in vals) { this.v[k] = vals[k]; delete this.tw[k]; } }
  cancel(keys) { keys.forEach(k => delete this.tw[k]); }
  get busy() { return Object.keys(this.tw).length > 0; }
  update(dt) {
    for (const k in this.tw) {
      const w = this.tw[k]; w.t += dt; if (w.t <= 0) { w.from = this.v[k]; continue; }
      const e = ease(w.dur > 0 ? w.t / w.dur : 1);
      this.v[k] = w.log ? Math.exp(lerp(Math.log(w.from), Math.log(w.to), e)) : lerp(w.from, w.to, e);
      if (w.t >= w.dur) { this.v[k] = w.to; delete this.tw[k]; }
    }
  }
}

const hit = (a, b, pad) => a.x0 < b.x1 + pad && a.x1 > b.x0 - pad && a.y0 < b.y1 + pad && a.y1 > b.y0 - pad;

export function createStage(canvas, labelBox, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = opts.exposure || 1.0; renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(opts.fov || 26, 16 / 9, 0.1, 600);
  const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  let envReady = !opts.hdri;
  if (opts.hdri) new RGBELoader().load(opts.hdri, (tex) => { tex.mapping = THREE.EquirectangularReflectionMapping; scene.environment = pmrem.fromEquirectangular(tex).texture; tex.dispose(); envReady = true; draw(); }, undefined, () => { envReady = true; });

  // ----- camera rig: spherical coordinates about a target, tweened between keyframes, with a slow idle drift -----
  const cam = new Tweener({ az: 110, el: 25, dist: 40, tx: 0, ty: 1.5, tz: 0 });
  let drift = opts.drift != null ? opts.drift : 0.6, time = 0;
  function placeCamera() {
    const c = cam.v, az = (c.az + drift * 1.2 * Math.sin(time * 0.11)) * Math.PI / 180, el = (c.el + drift * 0.4 * Math.sin(time * 0.17 + 1.0)) * Math.PI / 180;
    camera.position.set(c.tx + c.dist * Math.cos(el) * Math.cos(az), c.ty + c.dist * Math.sin(el), c.tz + c.dist * Math.cos(el) * Math.sin(az));
    camera.lookAt(c.tx, c.ty, c.tz);
  }
  let drag = null;
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, az: cam.v.az, el: cam.v.el }; cam.cancel(['az', 'el']); canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; });
  canvas.addEventListener('pointermove', e => { if (!drag) return; cam.v.az = drag.az + (e.clientX - drag.x) * 0.25; cam.v.el = clamp(drag.el + (e.clientY - drag.y) * 0.2, 3, 85); });
  const end = () => { drag = null; canvas.style.cursor = 'grab'; }; canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end); canvas.style.cursor = 'grab';

  // ----- labels: placed without overlap -----
  let W = 4, H = 4; const labels = []; const v3 = new THREE.Vector3(); let keepFn = null, obstacles = [];
  const project = (p) => { v3.copy(p).project(camera); if (v3.z > 1 || v3.z < -1) return null; return { x: (v3.x * 0.5 + 0.5) * W, y: (-v3.y * 0.5 + 0.5) * H }; };
  // o: { name, pos(), alpha(), text() | html, order: ['r','ar','br','a','b','l','al','bl'], gap, prio, cls }
  function label(o) { const el = document.createElement('div'); el.className = 'lbl ' + (o.cls || ''); if (o.html) el.innerHTML = o.html; labelBox.appendChild(el); const it = Object.assign({ el, order: ['r', 'ar', 'br', 'a', 'b', 'l', 'al', 'bl'], gap: 10, prio: 0 }, o); labels.push(it); labels.sort((a, b) => b.prio - a.prio); return it; }
  const rectFor = (c, p, w, h, g) => { let x = p.x - w / 2, y = p.y - h / 2; if (c.includes('r')) x = p.x + g; if (c.includes('l')) x = p.x - g - w; if (c.includes('a')) y = p.y - g - h; if (c.includes('b')) y = p.y + g; if (c === 'r' || c === 'l') y = p.y - h / 2; if (c === 'a' || c === 'b') x = p.x - w / 2; return { x0: x, y0: y, x1: x + w, y1: y + h }; };
  function placeLabels() {
    obstacles = keepFn ? keepFn(project) : []; const placed = [], M = 8;
    for (const it of labels) {
      const a = it.alpha ? it.alpha() : 1; it.want = a > 0.5; it.rect = null;
      if (it.text) { const s = it.text(); if (s !== it._s) { it.el.innerHTML = s; it._s = s; it.w = 0; } }
      if (a < 0.02) { it.el.style.opacity = 0; continue; }
      if (!it.w) { it.w = it.el.offsetWidth; it.h = it.el.offsetHeight; }
      const p = project(it.pos()); if (!p) { it.want = false; it.el.style.opacity = 0; continue; }
      if (p.x < 40 || p.y < 40 || p.x > W - 40 || p.y > H - 40) { it.want = false; it.el.style.opacity = 0; continue; }   // its subject is out of the picture, or at its very edge: nothing to label
      let ok = null;
      it.why = ''; const tries = []; if (it._last) tries.push(it._last); for (const g of (it.gaps || [it.gap])) for (const c of it.order) tries.push([c, g]);   // every allowed side at every allowed distance; the last good one first, so labels do not jump
      for (const [c, g] of tries) { const r = rectFor(c, p, it.w, it.h, g); if (r.x0 < M || r.y0 < M || r.x1 > W - M || r.y1 > H - M) { it.why += c + g + ':frame '; continue; } if (obstacles.some(o => hit(r, o, 2))) { it.why += c + g + ':picture '; continue; } if (placed.some(o => hit(r, o, 5))) { it.why += c + g + ':label '; continue; } ok = r; it._last = [c, g]; break; }
      if (!ok) { it.el.style.opacity = 0; continue; }
      it.el.style.transform = `translate(${ok.x0.toFixed(1)}px, ${ok.y0.toFixed(1)}px)`; it.el.style.opacity = a.toFixed(2); it.rect = ok; placed.push(ok);
    }
  }
  // An independent check, from the page as rendered: label against label, label against the frame, label against the protected picture.
  function audit() {
    const fr = labelBox.getBoundingClientRect(); const vis = labels.filter(it => +it.el.style.opacity > 0.05).map(it => { const r = it.el.getBoundingClientRect(); return { name: it.name || it.el.textContent.slice(0, 28), x0: r.left - fr.left, y0: r.top - fr.top, x1: r.right - fr.left, y1: r.bottom - fr.top }; });
    const overlaps = [], outside = [], onPicture = [];
    for (let i = 0; i < vis.length; i++) { const a = vis[i]; if (a.x0 < 0 || a.y0 < 0 || a.x1 > fr.width || a.y1 > fr.height) outside.push(a.name); if (obstacles.some(o => hit(a, o, 0))) onPicture.push(a.name); for (let j = i + 1; j < vis.length; j++) if (hit(a, vis[j], 0)) overlaps.push(a.name + ' × ' + vis[j].name); }
    const missing = labels.filter(it => it.want && !it.rect && !it.optional).map(it => (it.name || it.el.textContent.slice(0, 28)) + ' [' + (it.why || 'not projected') + ']');
    return { shown: vis.length, overlaps, outside, onPicture, missing };
  }

  function resize() {
    const r = canvas.getBoundingClientRect(); if (r.width < 4) return false;
    const w = Math.round(r.width), h = Math.round(r.height); if (w === W && h === H) return true;
    W = w; H = h; renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix(); return true;
  }
  new ResizeObserver(() => { if (resize()) draw(); }).observe(canvas);

  const updaters = [];
  function step(dt) { time += dt; cam.update(dt); for (const f of updaters) f(dt, time); }
  function draw() { if (!resize()) return; placeCamera(); camera.updateMatrixWorld(); renderer.render(scene, camera); placeLabels(); }
  let last = null, visible = true;
  new IntersectionObserver(es => es.forEach(e => { visible = e.isIntersecting; last = null; }), { threshold: 0.02 }).observe(canvas);
  function loop(now) { if (visible) { const dt = last == null ? 0 : Math.min(0.05, (now - last) / 1000); last = now; step(dt); draw(); } requestAnimationFrame(loop); }
  requestAnimationFrame(loop);

  return {
    THREE, renderer, scene, camera, cam, label, project, audit,
    get time() { return time; }, get envReady() { return envReady; }, size: () => ({ w: W, h: H }),
    onUpdate: (f) => updaters.push(f), keepouts: (f) => { keepFn = f; },
    // advance the scene by a fixed amount without waiting for animation frames (used to check a step in a hidden tab)
    advance: (seconds) => { const n = Math.ceil(seconds * 30); for (let i = 0; i < n; i++) step(1 / 30); draw(); },
    draw
  };
}
