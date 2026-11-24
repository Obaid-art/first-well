/* game/parts.js — the surface equipment of a wellsite, modelled part by part: turned bodies, flanges with their bolts,
   valves with bonnets and handwheels, a vessel with dished heads and nozzles, a tank with its shell courses, ladder and rail.
   Everything is real geometry lit by the scene; nothing is a flat picture. Sizes are exaggerated against the earth, as in any
   cutaway drawing, but the parts keep their own proportions. Each builder returns a THREE.Group. */
export function makeParts(THREE) {
  const std = (hex, rough = 0.5, metal = 0.2, extra = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: rough, metalness: metal, envMapIntensity: 0.95 }, extra));
  const M = { red: std(0xa1251d, 0.42, 0.35), redDark: std(0x7d1c16, 0.5, 0.35), steel: std(0x8d949b, 0.38, 0.9), dark: std(0x33383e, 0.5, 0.65), black: std(0x16181b, 0.7, 0.2), white: std(0xdcdfe0, 0.42, 0.2), cream: std(0xe7e3d6, 0.55, 0.06),
    yellow: std(0xdba514, 0.5, 0.25), conc: std(0xb4b0a6, 0.92, 0), glass: std(0xcfe6ee, 0.08, 0.1, { transparent: true, opacity: 0.55 }), brass: std(0xb08d3c, 0.35, 0.9), face: std(0xf6f5f0, 0.5, 0), green: std(0x2f6b4b, 0.5, 0.3), wire: std(0x5a6067, 0.4, 0.9), rubber: std(0x101113, 0.85, 0) };
  const mesh = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; return m; };
  const at = (m, x, y, z, rx = 0, ry = 0, rz = 0) => { m.position.set(x, y, z); m.rotation.set(rx, ry, rz); return m; };
  const cyl = (r, h, mat, seg = 28) => mesh(new THREE.CylinderGeometry(r, r, h, seg), mat), box = (w, h, d, mat) => mesh(new THREE.BoxGeometry(w, h, d), mat);
  const lathe = (pts, mat, seg = 40) => mesh(new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg), mat);
  // a flange: a thick disc with a ring of bolts through it (its axis is local y)
  function flange(r, t, mat, bolts = 10) { const g = new THREE.Group(); g.add(cyl(r, t, mat, 36)); for (let i = 0; i < bolts; i++) { const a = i / bolts * Math.PI * 2, b = cyl(r * 0.075, t + r * 0.22, M.dark, 8); b.position.set(Math.cos(a) * r * 0.80, 0, Math.sin(a) * r * 0.80); g.add(b); } return g; }
  // a handwheel: rim, spokes, hub (its axis is local y)
  function handwheel(r, mat, spokes = 5) { const g = new THREE.Group(); g.add(at(mesh(new THREE.TorusGeometry(r, r * 0.11, 10, 36), mat), 0, 0, 0, Math.PI / 2)); for (let i = 0; i < spokes; i++) { const s = cyl(r * 0.055, r, mat, 8); s.rotation.z = Math.PI / 2; const h = new THREE.Group(); h.add(at(s, r / 2, 0, 0, 0, 0, Math.PI / 2)); h.rotation.y = i / spokes * Math.PI * 2; g.add(h); } g.add(cyl(r * 0.2, r * 0.22, M.dark, 14)); return g; }
  // a gate valve in a vertical run: body, two end flanges, a bonnet and a handwheel facing the viewer (+z)
  function gateValve(s, mat) { const g = new THREE.Group(); g.add(box(0.30 * s, 0.30 * s, 0.30 * s, mat)); g.add(at(flange(0.20 * s, 0.045 * s, mat), 0, 0.17 * s, 0)); g.add(at(flange(0.20 * s, 0.045 * s, mat), 0, -0.17 * s, 0));
    g.add(at(cyl(0.085 * s, 0.26 * s, mat, 20), 0, 0, 0.26 * s, Math.PI / 2)); g.add(at(flange(0.13 * s, 0.035 * s, mat, 8), 0, 0, 0.17 * s, Math.PI / 2)); g.add(at(cyl(0.022 * s, 0.2 * s, M.steel, 10), 0, 0, 0.46 * s, Math.PI / 2)); g.add(at(handwheel(0.15 * s, M.dark), 0, 0, 0.55 * s, Math.PI / 2)); return g; }
  // a dial pressure gauge facing the viewer
  function gauge(s) { const g = new THREE.Group(); g.add(at(cyl(0.012 * s, 0.14 * s, M.brass, 8), 0, -0.13 * s, 0)); g.add(at(cyl(0.09 * s, 0.04 * s, M.dark, 30), 0, 0, 0, Math.PI / 2)); g.add(at(cyl(0.078 * s, 0.042 * s, M.face, 30), 0, 0, 0.004 * s, Math.PI / 2)); const n = box(0.008 * s, 0.065 * s, 0.006 * s, M.red); n.position.set(0, 0.022 * s, 0.027 * s); const piv = new THREE.Group(); piv.add(n); g.add(piv); g.userData.needle = piv; return g; }

  // ---------- the wellhead: casing head, tubing head, master valves, cross, swab valve, tree cap and gauge ----------
  function tree() {
    const g = new THREE.Group(), red = M.red;
    g.add(at(lathe([[0, 0], [0.34, 0], [0.34, 0.07], [0.24, 0.10], [0.24, 0.34], [0.33, 0.37], [0.33, 0.44], [0, 0.44]], M.dark), 0, 0, 0));                 // casing head
    g.add(at(flange(0.33, 0.05, M.dark, 12), 0, 0.465, 0));
    g.add(at(lathe([[0, 0], [0.30, 0], [0.30, 0.06], [0.21, 0.09], [0.21, 0.26], [0.27, 0.29], [0.27, 0.35], [0, 0.35]], red), 0, 0.49, 0));                 // tubing head
    g.add(at(cyl(0.05, 0.3, red, 14), 0.30, 0.66, 0, 0, 0, Math.PI / 2)); g.add(at(flange(0.09, 0.03, red, 6), 0.46, 0.66, 0, 0, 0, Math.PI / 2));               // side outlet, blanked
    g.add(at(gateValve(1, red), 0, 1.03, 0)); g.add(at(cyl(0.10, 0.10, red, 20), 0, 1.25, 0)); g.add(at(gateValve(1, red), 0, 1.47, 0));                        // lower and upper master valves
    g.add(at(box(0.36, 0.36, 0.36, red), 0, 1.86, 0)); g.add(at(flange(0.20, 0.045, red), 0, 1.66, 0));                                                        // the cross
    g.add(at(cyl(0.085, 0.34, red, 20), -0.35, 1.86, 0, 0, 0, Math.PI / 2)); g.add(at(flange(0.17, 0.04, red, 8), -0.20, 1.86, 0, 0, 0, Math.PI / 2));            // wing, toward the choke
    const wing = gateValve(0.9, red); wing.rotation.z = Math.PI / 2; g.add(at(wing, -0.62, 1.86, 0, 0, 0, Math.PI / 2));
    g.add(at(cyl(0.085, 0.22, red, 20), 0.29, 1.86, 0, 0, 0, Math.PI / 2)); g.add(at(flange(0.17, 0.045, red, 8), 0.42, 1.86, 0, 0, 0, Math.PI / 2));              // kill side, blanked
    g.add(at(gateValve(0.9, red), 0, 2.27, 0));                                                                                                               // swab valve
    g.add(at(lathe([[0, 0], [0.18, 0], [0.18, 0.05], [0.10, 0.08], [0.10, 0.20], [0.13, 0.22], [0.13, 0.27], [0, 0.27]], red), 0, 2.46, 0));                    // tree cap
    const ga = gauge(1.5); g.add(at(ga, 0, 2.98, 0.02)); g.userData.gauge = ga; g.userData.top = 3.15;
    return g;
  }
  // ---------- the choke: an angle body, a bonnet, a rising stem with a pointer, and the handwheel the player turns ----------
  function choke() {
    const g = new THREE.Group();
    g.add(box(0.34, 0.34, 0.34, M.dark)); g.add(at(flange(0.17, 0.04, M.dark, 8), 0.19, 0, 0, 0, 0, Math.PI / 2)); g.add(at(cyl(0.085, 0.3, M.dark, 20), 0, -0.3, 0)); g.add(at(flange(0.17, 0.04, M.dark, 8), 0, -0.44, 0));
    g.add(at(lathe([[0, 0], [0.13, 0], [0.13, 0.05], [0.085, 0.08], [0.085, 0.26], [0.11, 0.28], [0.11, 0.32], [0, 0.32]], M.dark), 0, 0.17, 0));                // bonnet
    const yoke = new THREE.Group(); [-1, 1].forEach(s => yoke.add(at(cyl(0.014, 0.42, M.steel, 8), 0.075 * s, 0.70, 0))); yoke.add(at(box(0.2, 0.03, 0.05, M.steel), 0, 0.91, 0)); g.add(yoke);
    const stem = new THREE.Group(); stem.add(at(cyl(0.022, 0.62, M.steel, 10), 0, 0.31, 0)); stem.add(at(box(0.13, 0.02, 0.02, M.yellow), 0.05, 0.08, 0.03)); stem.position.y = 0.42; g.add(stem);
    const wheel = handwheel(0.21, M.red, 6); wheel.position.y = 1.08; g.add(wheel);
    // a scale beside the stem: closed at the bottom, full bore at the top
    g.add(at(box(0.035, 0.36, 0.012, M.face), 0.16, 0.72, 0.03)); for (let i = 0; i <= 4; i++) g.add(at(box(0.05, 0.008, 0.014, M.black), 0.16, 0.55 + 0.085 * i, 0.034));
    g.userData = { wheel, stem, stemY0: 0.42, travel: 0.30 };
    return g;
  }
  // ---------- a test separator: a horizontal vessel with dished heads, on saddles, with its nozzles, relief valve and sight glass ----------
  function separator() {
    const g = new THREE.Group(), R = 0.62, L = 2.5, white = M.white;
    const shell = cyl(R, L, white, 44); shell.rotation.z = Math.PI / 2; g.add(shell);
    const head = (s) => { const pts = []; for (let i = 0; i <= 14; i++) { const a = i / 14 * Math.PI / 2; pts.push([R * Math.cos(a), R * 0.5 * Math.sin(a)]); } const h = lathe(pts, white, 44); h.rotation.z = -s * Math.PI / 2; h.position.x = s * L / 2; return h; };
    g.add(head(1), head(-1)); [-0.9, 0, 0.9].forEach(x => g.add(at(mesh(new THREE.TorusGeometry(R + 0.004, 0.012, 6, 44), white), x, 0, 0, 0, Math.PI / 2)));                    // weld seams
    [-0.8, 0.8].forEach(x => { g.add(at(box(0.16, 0.5, 0.95, M.steel), x, -0.72, 0)); g.add(at(box(0.34, 0.14, 1.15, M.conc), x, -1.03, 0)); });               // saddles and plinths
    const nozzle = (x, h, mat = white) => { const n = new THREE.Group(); n.add(at(cyl(0.075, h, mat, 16), 0, h / 2, 0)); n.add(at(flange(0.14, 0.035, mat, 8), 0, h, 0)); n.position.set(x, R - 0.02, 0); return n; };
    g.add(nozzle(1.0, 0.22), nozzle(-0.2, 0.2), nozzle(-0.95, 0.2));                                                                                          // inlet, gas outlet, relief
    g.add(at(lathe([[0, 0], [0.07, 0], [0.07, 0.12], [0.11, 0.16], [0.11, 0.34], [0.05, 0.40], [0, 0.40]], M.green), -0.95, R + 0.2, 0));                     // relief valve
    g.add(at(cyl(0.05, 0.9, M.steel, 14), -0.2, R + 0.65, 0)); g.add(at(cyl(0.05, 2.6, M.steel, 14), -1.5, R + 1.08, -0.3, 0, 0.23, Math.PI / 2));            // gas line leaving
    g.add(at(cyl(0.06, 0.24, white, 14), 0.45, -R - 0.08, 0)); g.add(at(flange(0.12, 0.03, white, 8), 0.45, -R - 0.2, 0));                                    // oil outlet underneath
    g.add(at(cyl(0.022, 0.62, M.glass, 10), 0.55, -0.02, R + 0.07)); [0.28, -0.32].forEach(y => g.add(at(box(0.05, 0.04, 0.1, M.brass), 0.55, y, R + 0.03)));  // sight glass
    g.add(at(cyl(0.2, 0.05, white, 24), L / 2 + R * 0.46, -0.05, 0, 0, 0, Math.PI / 2)); g.add(at(box(0.3, 0.16, 0.012, M.steel), -0.35, 0.12, R + 0.004));     // manway, nameplate
    const meter = new THREE.Group(); meter.add(box(0.3, 0.36, 0.2, M.dark)); meter.add(at(cyl(0.085, 0.03, M.face, 24), 0, 0.04, 0.105, Math.PI / 2)); meter.position.set(0.45, -R - 0.42, 0.42); g.add(meter);   // the oil meter
    g.userData = { R, L };
    return g;
  }
  // ---------- a stock tank: shell courses, a low cone roof, a rim, a caged ladder, a railing, a manway and a gauge board ----------
  function tank() {
    const g = new THREE.Group(), R = 1.55, H = 2.1, c = M.cream;
    g.add(at(cyl(R + 0.14, 0.12, M.conc, 56), 0, 0.06, 0)); g.add(at(cyl(R, H, c, 64), 0, 0.12 + H / 2, 0));
    for (let i = 1; i < 4; i++) g.add(at(mesh(new THREE.TorusGeometry(R + 0.003, 0.012, 6, 64), c), 0, 0.12 + H * i / 4, 0, Math.PI / 2));                      // courses
    g.add(at(mesh(new THREE.TorusGeometry(R + 0.01, 0.035, 8, 64), c), 0, 0.12 + H, 0, Math.PI / 2)); g.add(at(mesh(new THREE.ConeGeometry(R + 0.02, 0.3, 64), c), 0, 0.12 + H + 0.15, 0));
    g.add(at(cyl(0.07, 0.2, M.steel, 14), 0.4, 0.12 + H + 0.3, 0.2)); g.add(at(mesh(new THREE.SphereGeometry(0.1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.steel), 0.4, 0.12 + H + 0.4, 0.2));    // vent
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; g.add(at(cyl(0.014, 0.36, M.yellow, 6), Math.cos(a) * (R - 0.04), 0.12 + H + 0.2, Math.sin(a) * (R - 0.04))); }                  // rail posts
    [0.2, 0.37].forEach(y => g.add(at(mesh(new THREE.TorusGeometry(R - 0.04, 0.012, 6, 64), M.yellow), 0, 0.12 + H + y, 0, Math.PI / 2)));
    const lad = new THREE.Group(), a0 = 0.62; [-0.13, 0.13].forEach(s => lad.add(at(cyl(0.016, H + 0.5, M.yellow, 8), s, (H + 0.5) / 2, 0))); for (let y = 0.2; y < H + 0.4; y += 0.19) lad.add(at(cyl(0.011, 0.26, M.yellow, 6), 0, y, 0, 0, 0, Math.PI / 2));
    lad.position.set(Math.sin(a0) * (R + 0.09), 0.12, Math.cos(a0) * (R + 0.09)); lad.rotation.y = a0; g.add(lad);
    g.add(at(cyl(0.26, 0.06, c, 26), -0.5, 0.55, Math.sqrt(R * R - 0.25) + 0.01, Math.PI / 2)); g.add(at(flange(0.3, 0.03, c, 12), -0.5, 0.55, Math.sqrt(R * R - 0.25) + 0.045, Math.PI / 2));       // manway
    // the gauge board: the red marker follows the level in the tank
    const bx = -1.05, bz = Math.sqrt(R * R - bx * bx) + 0.03; g.add(at(box(0.2, H * 0.86, 0.025, M.face), bx, 0.12 + H * 0.5, bz)); for (let i = 0; i <= 8; i++) g.add(at(box(i % 2 ? 0.07 : 0.12, 0.01, 0.03, M.black), bx - (i % 2 ? 0.045 : 0.02), 0.12 + H * (0.09 + 0.82 * i / 8), bz + 0.002));
    const marker = box(0.3, 0.05, 0.05, M.red); marker.position.set(bx, 0.3, bz + 0.02); g.add(marker);
    g.userData = { marker, y0: 0.12 + H * 0.09, y1: 0.12 + H * 0.91, R, H: 0.12 + H + 0.3 };
    return g;
  }
  // ---------- a wireline unit, and the lubricator it rigs on top of the tree ----------
  function wireline() {
    const g = new THREE.Group(); g.add(at(box(2.3, 0.14, 1.1, M.steel), 0, 0.13, 0)); [-0.9, 0.9].forEach(x => g.add(at(box(0.12, 0.12, 1.2, M.dark), x, 0.03, 0)));
    g.add(at(box(0.95, 0.85, 0.95, M.white), 0.55, 0.62, 0)); g.add(at(box(0.5, 0.3, 0.02, M.black), 0.55, 0.75, 0.48));                                       // the operator's cabin and window
    [-0.42, 0.42].forEach(z => g.add(at(cyl(0.42, 0.04, M.dark, 36), -0.55, 0.62, z, Math.PI / 2))); g.add(at(cyl(0.3, 0.8, M.wire, 36), -0.55, 0.62, 0, Math.PI / 2));   // the drum of wire
    g.add(at(box(0.5, 0.5, 0.6, M.yellow), -1.35, 0.45, 0));
    return g;
  }
  function lubricator(h) { const g = new THREE.Group(); g.add(at(flange(0.16, 0.04, M.steel, 8), 0, 0.02, 0)); g.add(at(cyl(0.065, h, M.steel, 18), 0, h / 2, 0)); g.add(at(cyl(0.09, 0.14, M.dark, 18), 0, h + 0.07, 0)); g.add(at(cyl(0.13, 0.03, M.dark, 24), 0.0, h + 0.3, 0, Math.PI / 2)); g.add(at(box(0.03, 0.2, 0.03, M.dark), 0, h + 0.2, 0)); g.userData.top = h + 0.3; return g; }
  // a pipe along a path, with a flanged joint at each end and sleepers under the low runs
  function pipe(pts, r = 0.085, mat = M.steel) { const g = new THREE.Group(), curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)), false, 'catmullrom', 0.12); g.add(mesh(new THREE.TubeGeometry(curve, 90, r, 16), mat)); return g; }
  function sleeper(x, y, z) { const g = new THREE.Group(); g.add(at(box(0.5, y, 0.26, M.conc), 0, y / 2, 0)); g.add(at(mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 18, Math.PI), M.dark), 0, y, 0, 0, Math.PI / 2)); g.position.set(x, 0, z); return g; }
  // a sign with the well's name, painted on a small board
  function sign(text) { const c = document.createElement('canvas'); c.width = 512; c.height = 256; const x = c.getContext('2d'); x.fillStyle = '#f4f2ea'; x.fillRect(0, 0, 512, 256); x.strokeStyle = '#a1251d'; x.lineWidth = 14; x.strokeRect(12, 12, 488, 232); x.fillStyle = '#16202e'; x.font = '700 104px "Inter", "Segoe UI", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 132);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; const g = new THREE.Group(); g.add(at(mesh(new THREE.BoxGeometry(1.1, 0.55, 0.04), [M.face, M.face, M.face, M.face, new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }), M.face]), 0, 1.05, 0)); [-0.42, 0.42].forEach(s => g.add(at(cyl(0.025, 1.1, M.steel, 8), s, 0.55, -0.03))); return g; }
  // a site cabin on skids, and a windsock: the rest of a working location
  function cabin() { const g = new THREE.Group(); [-0.55, 0.55].forEach(z => g.add(at(box(2.7, 0.12, 0.14, M.dark), 0, 0.06, z))); g.add(at(box(2.5, 1.5, 1.5, M.white), 0, 0.87, 0)); g.add(at(box(2.62, 0.07, 1.64, M.steel), 0, 1.655, 0));
    g.add(at(box(0.55, 1.15, 0.03, M.green), -0.65, 0.72, 0.76)); g.add(at(box(0.7, 0.45, 0.03, M.black), 0.45, 1.05, 0.76)); g.add(at(box(0.42, 0.32, 0.28, M.steel), 1.36, 1.15, 0)); g.add(at(box(0.7, 0.12, 0.35, M.steel), -0.65, 0.08, 0.95)); return g; }
  function windsock() { const g = new THREE.Group(); g.add(at(cyl(0.035, 3.4, M.steel, 10), 0, 1.7, 0)); const sock = mesh(new THREE.ConeGeometry(0.17, 0.95, 18, 1, true), std(0xe2641c, 0.8, 0, { side: THREE.DoubleSide })); g.add(at(sock, 0.5, 3.3, 0, 0, 0, Math.PI / 2 + 0.18)); g.add(at(mesh(new THREE.TorusGeometry(0.17, 0.012, 6, 20), M.steel), 0.04, 3.38, 0, 0, Math.PI / 2)); return g; }
  return { cabin, windsock, M, mesh, at, cyl, box, flange, handwheel, gateValve, gauge, tree, choke, separator, tank, wireline, lubricator, pipe, sleeper, sign };
}
