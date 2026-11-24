/* game/scene.js — the well, seen in one straight section through its axis.
   The earth is cut by a single vertical plane through the well and looked at face on: the same rock to the left and to the
   right, the oil arriving from both sides. In the cut the well itself is open: cement, casing, packer, tubing, perforations,
   and the oil moving in them at a speed set by the real rate. On top stands the surface equipment of game/parts.js.
   The picture can be turned by dragging, within the front half. Rock surfaces are the photographed Poly Haven sets in hero/tex. */
import * as THREE from 'three';
import { createStage, clamp, sstep } from '../hero/kit.js?v=25';
import { makeParts } from './parts.js?v=2';
import { addBenches } from './bench.js?v=5';

const HW = 11.2, DZ = 6.5, YS = 8, TS = 3.4, TEXDIR = new URL('../hero/tex/', import.meta.url).href;
const fmt = (x, d = 0) => (+x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const WELL = { hole: 0.34, casing: 0.29, casingIn: 0.255, tubing: 0.12, tubingIn: 0.10, packer: [1.32, 1.52], tubingEnd: 1.12, td: -1.45, perf: [-0.62, 0.62] };
// the beds, from the surface down: top contact, how much it undulates, texture set, tint
const BEDS = [
  { top: YS, amp: 0, tex: 'aerial_beach_01', tint: 0xf0dfc0 }, { top: 6.35, amp: 0.10, tex: 'worn_rock_natural_01', tint: 0xe3cfae }, { top: 4.85, amp: 0.13, tex: 'cliff_side', tint: 0xc9a98a },
  { top: 3.45, amp: 0.10, tex: 'marble_cliff_04', tint: 0xe6dfd0 }, { top: 2.15, amp: 0.08, tex: 'rock_face_03', tint: 0xb59a80 }, { top: 1.3, amp: 0.045, tex: 'cliff_side', tint: 0x6e6b69 },
  { top: 0.9, amp: 0.03, tex: 'worn_rock_natural_01', tint: 0xcfae7c }, { top: -0.9, amp: 0.03, tex: 'cliff_side', tint: 0x625f5d }, { top: -1.95, amp: 0 }
];
const dunes = (x, z) => (0.20 * Math.sin(0.5 * x + 0.3 * z + 1) + 0.11 * Math.sin(1.1 * x - 0.7 * z) + 0.05 * Math.sin(2.3 * x + 1.9 * z)) * sstep(-4.3, -5.8, z);
const contact = (i, x, z) => i === 0 ? YS + dunes(x, z) : BEDS[i].top + BEDS[i].amp * (Math.sin(0.35 * x + 1.7 * i + 0.2 * z) + 0.5 * Math.sin(0.83 * x + 2.9 * i));

export function createScene(canvas, labelBox, G) {
  const stage = createStage(canvas, labelBox, { fov: 26, exposure: 0.95, drift: 0.22, hdri: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/textures/equirectangular/royal_esplanade_1k.hdr' });
  const { scene } = stage, P = makeParts(THREE), add = (o) => { scene.add(o); return o; };
  // daylight: a sun with soft shadows over image-based sky light
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.5); sun.position.set(-13, 24, 17); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 16, bottom: -12, near: 1, far: 70 }); sun.shadow.camera.updateProjectionMatrix(); add(sun); add(sun.target); add(new THREE.HemisphereLight(0xdfe9f5, 0x9a8a72, 0.35));

  // ---------- photographed rock ----------
  let pending = 0; const loader = new THREE.TextureLoader(), cache = {};
  const load = (name, srgb) => { if (cache[name]) return cache[name]; pending++; const t = loader.load(TEXDIR + name + '.jpg', () => { pending--; stage.draw(); }, undefined, () => { pending--; }); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return cache[name] = t; };
  const rock = (b) => new THREE.MeshStandardMaterial({ map: load(b.tex + '_diff', true), normalMap: load(b.tex + '_nor'), roughnessMap: load(b.tex + '_arm'), aoMap: load(b.tex + '_arm'), roughness: 1, metalness: 0, color: b.tint, envMapIntensity: 0.55 });
  const rockMat = (tex, tint) => rock({ tex, tint });
  // a vertical strip of one bed along a straight edge of the block; its outward normal is (edge direction) x (up)
  function strip(x0, z0, x1, z1, n, i, mat) {
    const rows = 5, pos = [], uv = [], idx = [], len = Math.hypot(x1 - x0, z1 - z0);
    for (let a = 0; a <= n; a++) { const f = a / n, x = x0 + (x1 - x0) * f, z = z0 + (z1 - z0) * f, yt = contact(i, x, z), yb = contact(i + 1, x, z); for (let r = 0; r <= rows; r++) { const y = yb + (yt - yb) * r / rows; pos.push(x, y, z); uv.push((f * len + (z0 !== z1 ? 7 : 0) + x0 * 0.0) / TS + i * 0.37, y / TS); } }
    for (let a = 0; a < n; a++) for (let r = 0; r < rows; r++) { const p = a * (rows + 1) + r, q = p + rows + 1; idx.push(p, q, q + 1, p, q + 1, p + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.castShadow = true; return add(m);
  }
  for (let i = 0; i < BEDS.length - 1; i++) { const mat = rock(BEDS[i]);
    strip(-HW, 0, -WELL.hole, 0, 70, i, mat); strip(WELL.hole, 0, HW, 0, 70, i, mat); strip(-HW, -DZ, -HW, 0, 24, i, mat); strip(HW, 0, HW, -DZ, 24, i, mat); }
  { // the ground
    const g = new THREE.PlaneGeometry(2 * HW, DZ, 140, 44); g.rotateX(-Math.PI / 2); g.translate(0, 0, -DZ / 2); const p = g.attributes.position, uv = g.attributes.uv;
    for (let k = 0; k < p.count; k++) { const x = p.getX(k), z = p.getZ(k); p.setY(k, contact(0, x, z)); uv.setXY(k, x / (TS * 0.8), z / (TS * 0.8)); } g.computeVertexNormals();
    const m = new THREE.Mesh(g, rock(BEDS[0])); m.receiveShadow = true; add(m);
    const pad = (x, z, w, d) => { const s = P.box(w, 0.1, d, P.M.conc); s.position.set(x, YS + 0.03, z); add(s); return s; }; pad(-5.4, -2.0, 4.2, 2.4); pad(4.3, -2.0, 3.4, 2.0);                   // equipment pads
  }

  // ---------- the well, cut open ----------
  const half = (r, y0, y1, mat) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, y1 - y0, 40, 1, true, Math.PI / 2, Math.PI), mat); m.position.set(0, (y0 + y1) / 2, 0); m.receiveShadow = true; return add(m); };
  const cut = (xa, xb, y0, y1, mat) => { const s = P.box(xb - xa, y1 - y0, 0.02, mat); s.position.set((xa + xb) / 2, (y0 + y1) / 2, -0.01); s.castShadow = false; add(s); return s; };
  const cement = new THREE.MeshStandardMaterial({ color: 0xbdbab2, roughness: 0.95, side: THREE.DoubleSide }), steelIn = new THREE.MeshStandardMaterial({ color: 0x555b62, roughness: 0.45, metalness: 0.8, side: THREE.DoubleSide }), steelCut = new THREE.MeshStandardMaterial({ color: 0xc3c8cd, roughness: 0.3, metalness: 0.9 });
  const top = YS + 0.1; half(WELL.hole, WELL.td - 0.15, top, cement); half(WELL.casing, WELL.td, top, steelIn); half(WELL.tubing, WELL.tubingEnd, top, steelIn);
  [-1, 1].forEach(s => { cut(s * WELL.casing, s * WELL.hole, WELL.td - 0.15, top, cement); cut(s * WELL.casingIn, s * WELL.casing, WELL.td, top, steelCut); cut(s * WELL.tubingIn, s * WELL.tubing, WELL.tubingEnd, top, steelCut);
    const pk = P.box(WELL.casingIn - WELL.tubing, WELL.packer[1] - WELL.packer[0], 0.2, P.M.rubber); pk.position.set(s * (WELL.casingIn + WELL.tubing) / 2, (WELL.packer[0] + WELL.packer[1]) / 2, -0.09); add(pk); });
  cut(-WELL.hole, WELL.hole, WELL.td - 0.15, WELL.td, cement);
  // the fluid in the well: oil below the packer and in the tubing, a still liquid in the annulus above the packer
  const oilMat = () => new THREE.ShaderMaterial({ uniforms: { uPhase: { value: 0 }, uFlow: { value: 0 }, uLanes: { value: 9 } }, vertexShader: 'varying vec2 vP; void main(){ vP = position.xy + vec2(0.0, modelMatrix[3].y); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uPhase, uFlow, uLanes; varying vec2 vP; float h1(float n){ return fract(sin(n * 91.3458) * 47453.5453); } float comet(float s){ float f = fract(s); return smoothstep(0.0, 0.06, f) * pow(1.0 - f, 1.5); }
      void main(){ float lat = vP.x * uLanes + 31.0, cell = floor(lat), x = fract(lat) - 0.5, ra = h1(cell), rb = h1(cell * 1.37 + 11.0); float across = exp(-x * x / 0.035);
        float glow = across * comet(-vP.y * 1.25 + uPhase * (0.75 + 0.5 * ra) + rb * 9.0) * uFlow; vec3 col = mix(vec3(0.060, 0.036, 0.016), vec3(0.52, 0.33, 0.12), glow * 0.9); gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }` });
  const face = (w, y0, y1, mat, z = -0.004) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, y1 - y0), mat); m.position.set(0, (y0 + y1) / 2, z); return add(m); };
  const oilTub = oilMat(), oilCas = oilMat(); oilCas.uniforms.uLanes.value = 5; face(2 * WELL.tubingIn, WELL.tubingEnd, top, oilTub, -0.003); face(2 * WELL.casingIn, WELL.td, WELL.packer[0], oilCas);
  [-1, 1].forEach(s => { const a = new THREE.Mesh(new THREE.PlaneGeometry(WELL.casingIn - WELL.tubing, top - WELL.packer[1]), new THREE.MeshStandardMaterial({ color: 0x4d5a63, roughness: 0.35 })); a.position.set(s * (WELL.casingIn + WELL.tubing) / 2, (top + WELL.packer[1]) / 2, -0.004); add(a); });
  // perforations: tunnels shot through casing and cement into the sand
  { const shp = new THREE.Shape(); shp.moveTo(0, -0.035); shp.lineTo(0.46, 0); shp.lineTo(0, 0.035); const g = new THREE.ShapeGeometry(shp), m = new THREE.MeshBasicMaterial({ color: 0x120c06 });
    for (let k = 0; k < 6; k++) { const y = WELL.perf[0] + (WELL.perf[1] - WELL.perf[0]) * k / 5; [-1, 1].forEach(s => { const t = new THREE.Mesh(g, m); t.position.set(s * WELL.casingIn, y, 0.004); t.scale.x = s; add(t); }); } }
  // the oil moving through the sand toward the well, from both sides: along a lane the coordinate is (distance)^2, so the speed goes as 1/distance
  const sandFlow = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uPhase: { value: 0 }, uFlow: { value: 0 } }, vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uPhase, uFlow; varying vec2 vP; float h1(float n){ return fract(sin(n * 91.3458) * 47453.5453); } float comet(float s){ float f = fract(s); return smoothstep(0.0, 0.05, f) * pow(1.0 - f, 1.6); }
      void main(){ float ax = abs(vP.x); if (ax < ${(WELL.hole + 0.02).toFixed(3)}) discard; float t = smoothstep(0.4, 4.5, ax), yy = vP.y / mix(0.66, 0.84, t); if (abs(yy) > 1.0) discard;
        float lat = yy * 6.5 + 40.0 + step(0.0, vP.x) * 17.0, cell = floor(lat), x = fract(lat) - 0.5, ra = h1(cell), rb = h1(cell * 1.37 + 11.0), rc = h1(cell * 2.11 + 23.0);
        x += (ra - 0.5) * 0.3 + 0.06 * sin(ax * 1.1 + ra * 6.2832); float across = exp(-x * x / 0.024);
        float s = 5.0 * (ax / ${HW.toFixed(1)}) * (ax / ${HW.toFixed(1)}) + uPhase * (0.8 + 0.4 * rc) + rb * 9.0;
        float a = across * (0.16 + 0.84 * comet(s)) * (1.0 - smoothstep(${(HW * 0.9).toFixed(1)}, ${HW.toFixed(1)}, ax)) * smoothstep(1.0, 0.86, abs(yy)) * uFlow;
        gl_FragColor = vec4(0.040, 0.024, 0.012, a * 0.88); }` });
  { const m = new THREE.Mesh(new THREE.PlaneGeometry(2 * HW, 1.7), sandFlow); m.position.set(0, 0, 0.012); m.renderOrder = 3; add(m); }
  // the damaged zone: rock beside the well whose pores are partly blocked; how dark it is says how badly, how wide says how far
  const dmgMat = new THREE.MeshBasicMaterial({ color: 0x1a130c, transparent: true, opacity: 0, depthWrite: false }), dmg = [-1, 1].map(sd => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.76), dmgMat); m.position.set(0, 0, 0.008); m.renderOrder = 2; m.userData.sd = sd; add(m); return m; });
  // the downhole gauge: a tool hanging in the tubing near the bottom
  const tool = new THREE.Group(); tool.add(P.at(P.cyl(0.045, 0.5, P.M.yellow, 14), 0, 0, 0)); tool.add(P.at(P.cyl(0.02, 0.12, P.M.steel, 10), 0, 0.3, 0)); tool.position.set(0, WELL.tubingEnd + 0.42, 0.012); tool.visible = false; add(tool);

  // ---------- the surface ----------
  const cellar = P.box(1.9, 0.16, 1.5, P.M.conc); cellar.position.set(0, YS + 0.08, -0.33); add(cellar);
  const Y1 = YS + 0.16, tree = P.tree(); tree.position.set(0, Y1, 0); add(tree);
  const choke = P.choke(); choke.position.set(-1.05, Y1 + 1.86, 0); add(choke); add(P.at(P.cyl(0.085, 0.14, P.M.red, 20), -0.83, Y1 + 1.86, 0, 0, 0, Math.PI / 2));
  const sep = P.separator(); sep.position.set(-5.4, YS + 1.18, -2.0); add(sep);
  const tank = P.tank(); tank.position.set(-8.9, YS, -3.0); add(tank);
  add(P.pipe([[-1.05, Y1 + 1.40, 0], [-1.05, YS + 0.55, -0.02], [-1.25, YS + 0.32, -0.45], [-2.5, YS + 0.32, -1.7], [-3.1, YS + 0.32, -2.0], [-3.48, YS + 0.5, -2.0], [-3.5, YS + 2.25, -2.0], [-3.95, YS + 2.5, -2.0], [-4.4, YS + 2.36, -2.0], [-4.4, YS + 2.06, -2.0]]));
  add(P.pipe([[-4.95, YS + 0.34, -2.0], [-4.95, YS + 0.24, -1.3], [-6.2, YS + 0.24, -1.0], [-7.7, YS + 0.24, -1.1], [-8.35, YS + 0.36, -1.45], [-8.5, YS + 0.4, -1.52]], 0.075));
  add(P.sleeper(-1.9, 0.24, -1.1), P.sleeper(-2.9, 0.24, -1.88), P.sleeper(-6.2, 0.17, -1.0), P.sleeper(-7.3, 0.17, -1.06));
  const sign = P.sign('WELL 7'); sign.position.set(2.3, YS, -1.2); sign.rotation.y = -0.18; sign.scale.setScalar(1.5); add(sign);
  const cab = P.cabin(); cab.position.set(8.0, YS, -3.4); cab.rotation.y = -0.1; add(cab); const sock = P.windsock(); sock.position.set(10.3, YS, -1.2); add(sock);
  // the wireline unit and its lubricator: on location only while the gauge is being run
  const unit = P.wireline(); unit.position.set(4.3, YS + 0.08, -2.0); unit.rotation.y = 0.12; unit.visible = false; add(unit);
  const lub = P.lubricator(1.7); lub.position.set(0, Y1 + 2.73, 0); lub.visible = false; add(lub);
  const wireGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(3.75, YS + 1.0, -2.0), new THREE.Vector3(0.13, Y1 + 2.73 + 2.0, 0), new THREE.Vector3(0, Y1 + 2.73 + 1.84, 0)]), wire = new THREE.Line(wireGeo, new THREE.LineBasicMaterial({ color: 0x3a3f45 })); wire.visible = false; add(wire);

  // ---------- where things are: for readings, for the tour, for "show me" ----------
  const V = (x, y, z) => new THREE.Vector3(x, y, z), A = {
    reservoir: { name: 'reservoir', pos: V(5.2, 0.25, 0.1), cam: { az: 90, el: 7, dist: 19, tx: 2.6, ty: 0.5, tz: 0 } },
    perforations: { name: 'perforations', pos: V(0.62, 0.0, 0.1), cam: { az: 90, el: 5, dist: 8.5, tx: 0.2, ty: 0.25, tz: 0 } },
    packer: { name: 'packer', pos: V(0.2, 1.42, 0.1), cam: { az: 90, el: 5, dist: 8, tx: 0.2, ty: 1.3, tz: 0 } },
    tubing: { name: 'tubing', pos: V(0, 4.9, 0.1), cam: { az: 86, el: 6, dist: 19, tx: 0.4, ty: 4.4, tz: 0 } },
    casing: { name: 'casing', pos: V(0.28, 3.0, 0.1), cam: { az: 90, el: 6, dist: 11, tx: 0.4, ty: 2.9, tz: 0 } },
    gauge: { name: 'downhole gauge', pos: V(0, WELL.tubingEnd + 0.45, 0.12), cam: { az: 90, el: 5, dist: 8, tx: 0.2, ty: 1.3, tz: 0 } },
    wellhead: { name: 'wellhead', pos: V(0.1, Y1 + 1.5, 0.35), cam: { az: 99, el: 9, dist: 12.5, tx: -0.4, ty: Y1 + 1.6, tz: 0 } },
    choke: { name: 'choke', pos: V(-1.05, Y1 + 2.95, 0), cam: { az: 101, el: 10, dist: 8.2, tx: -0.9, ty: Y1 + 2.2, tz: 0 } },
    flowline: { name: 'flowline', pos: V(-2.5, YS + 0.4, -1.7), cam: { az: 100, el: 20, dist: 15, tx: -2.6, ty: YS + 0.9, tz: -1.2 } },
    separator: { name: 'test separator', pos: V(-5.4, YS + 2.0, -2.0), cam: { az: 96, el: 13, dist: 13.5, tx: -5.1, ty: YS + 1.3, tz: -2 } },
    tank: { name: 'stock tank', pos: V(-8.9, YS + 2.6, -3.0), cam: { az: 93, el: 13, dist: 15, tx: -8.5, ty: YS + 1.3, tz: -3 } }
  };
  const cams = { tour: { az: 90, el: 10, dist: 33, tx: -0.4, ty: 3.1, tz: -1 }, high: { az: 64, el: 27, dist: 50, tx: -1, ty: 4.2, tz: -2 }, play: { az: 90, el: 10, dist: 30.5, tx: -0.4, ty: 4.5, tz: -1 }, surface: { az: 97, el: 13, dist: 20, tx: -3.4, ty: YS + 1.3, tz: -1.6 }, deep: { az: 90, el: 6, dist: 19, tx: 0, ty: 1.9, tz: 0 } };

  // ---------- labels: instrument readings the player owns, and one callout that names a part ----------
  const r = () => G.read, call = { key: null, a: 0, to: 0 }, readings = [], atWell = () => G.set === 'well' ? r().show : 0;
  readings.push(stage.label({ name: 'wellhead gauge', prio: 9, cls: 'num', order: ['ar', 'r', 'a', 'al'], gaps: [14, 34, 56], pos: () => V(0, Y1 + 3.0, 0.05), alpha: atWell, text: () => fmt(r().ptf) + ' <i>psi</i><small>wellhead gauge</small>' }));
  readings.push(stage.label({ name: 'choke', prio: 7, cls: 'num sm', order: ['al', 'l', 'a', 'bl'], gaps: [16, 40, 64], pos: () => V(-1.05, Y1 + 2.95, 0), alpha: () => atWell() * (r().what ? 0 : 1), text: () => (r().S > 0 ? r().S + '/64 <i>in</i>' : 'shut in') + '<small>choke</small>' }));
  readings.push(stage.label({ name: 'rate', prio: 8, cls: 'num blue', order: ['a', 'al', 'ar', 'l'], gaps: [22, 44, 66], pos: () => V(-5.4, YS + 2.1, -2.0), alpha: atWell, text: () => (r().rate == null ? 'settling' : fmt(r().rate) + ' <i>bbl/d</i>') + '<small>test separator</small>' }));
  readings.push(stage.label({ name: 'downhole gauge', prio: 9, cls: 'num red', order: ['r', 'br', 'ar', 'l', 'bl'], gaps: [16, 34, 56], pos: () => V(0.12, WELL.tubingEnd + 0.45, 0.1), alpha: () => atWell() * (r().gauge ? 1 : 0), text: () => fmt(r().kpa) + ' <i>kPa</i><small>downhole gauge</small>' }));
  stage.label({ name: 'depth', prio: 3, cls: 'tag', optional: true, order: ['r', 'br', 'ar'], gaps: [10, 28], pos: () => V(-HW + 0.4, 4.2, 0.05), alpha: atWell, html: fmt(G.spec.depth) + ' ft of rock<small>drawn far thinner than it is</small>' });
  stage.label({ name: 'callout', prio: 10, cls: 'call', order: ['r', 'ar', 'br', 'a', 'l', 'al', 'b'], gaps: [18, 36, 60], pos: () => call.key ? A[call.key].pos : V(0, 0, 0), alpha: () => call.a, text: () => call.key ? (call.text || A[call.key].name) : '' });
  const keep = [[0, Y1 + 1.5, 0, 22], [0, Y1 + 2.6, 0, 16], [-1.05, Y1 + 2.4, 0, 16], [-5.4, YS + 1.2, -2, 30], [-4.5, YS + 1.2, -2, 18], [-6.3, YS + 1.2, -2, 18], [-8.9, YS + 1.2, -3, 36], [-8.1, YS + 1.2, -3, 22], [-9.7, YS + 1.2, -3, 22]];
  const screenKeep = [];                                                                             // rectangles of the page that labels must leave alone, e.g. a caption bar: functions returning {x0,y0,x1,y1} or null
  stage.keepouts((project) => { const out = []; keep.forEach(([x, y, z, s]) => { const p = project(V(x, y, z)); if (p) out.push({ x0: p.x - s, y0: p.y - s, x1: p.x + s, y1: p.y + s }); }); screenKeep.forEach(f => { const q = f(); if (q) out.push(q); }); return out; });

  const bench = addBenches({ THREE, stage, scene, P, rockMat, G }); Object.assign(cams, bench.cams);
  let phaseS = 0, phaseT = 0;
  stage.onUpdate((dt, time) => {
    bench.update(dt, time); const dz = G.read.dmg; dmgMat.opacity += ((dz ? 0.62 * dz.a : 0) - dmgMat.opacity) * (1 - Math.exp(-dt / 0.4)); if (dz) dmg.forEach(m => { const w = 0.25 + 1.9 * Math.log(dz.w / 0.328) / Math.log(6 / 0.328); m.scale.x = Math.max(0.02, w); m.position.x = m.userData.sd * (WELL.hole + w / 2); });
    const q = G.cur ? G.cur.q : 0, R = G.read, amt = clamp(q / 220, 0, 1); phaseS += dt * 0.5 * q / 450; phaseT += dt * (0.25 + 1.6 * q / 1500) * (q > 1 ? 1 : 0);
    sandFlow.uniforms.uPhase.value = phaseS; sandFlow.uniforms.uFlow.value = amt; [oilTub, oilCas].forEach(m => { m.uniforms.uPhase.value = phaseT; m.uniforms.uFlow.value = amt; });
    choke.userData.wheel.rotation.y = -R.turn; choke.userData.stem.position.y = choke.userData.stemY0 + choke.userData.travel * R.S / 64;
    tank.userData.marker.position.y = tank.userData.y0 + (tank.userData.y1 - tank.userData.y0) * clamp(R.level, 0, 1);
    tree.userData.gauge.userData.needle.rotation.z = 2.2 - 4.4 * clamp(R.ptf / 1500, 0, 1); tool.visible = !!R.gauge;
    call.a += (call.to - call.a) * (1 - Math.exp(-dt / 0.45)); if (call.to === 0 && call.a < 0.02) call.key = call.text = null;
    const c = stage.cam.v; c.az = clamp(c.az, 38, 142); c.el = clamp(c.el, 3, 58);
    const wide = c.dist > 27 && !stage.cam.busy; readings.forEach(l => { l.optional = !wide; });               // in a close-up or on the way to one, a reading whose instrument is at the edge may simply be absent
  });
  return { stage, cams, anchors: A, screenKeep, texturesPending: () => pending,
    useSet: (name) => { const x = bench.centers[name] || 0; sun.position.set(x - 13, 24, 17); sun.target.position.set(x, 0, 0); sun.target.updateMatrixWorld(); },
    point: (key, text) => { if (!A[key]) return; call.key = key; call.text = text || null; call.to = 1; }, unpoint: () => { call.to = 0; },
    wireline: (on) => { unit.visible = lub.visible = wire.visible = on; tree.userData.gauge.visible = !on; } };
}
