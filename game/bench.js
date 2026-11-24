/* game/bench.js — three laboratory benches for the parts of Chapter 1 that are not at the wellsite.
     rock: a block of reservoir and a glass cube showing what one cubic foot of it is made of (grains, water, oil)   Section 1-2.1
     cell: a pressure cell with a piston; lower the pressure and gas comes out of the oil at the bubble point          Section 1-2.1
     core: Darcy's experiment; a pump, a rock sample in a holder, and a measuring glass                                Section 1-2.2
   Each bench stands far from the well in the same scene and has its own camera. They draw what G.bench says; the numbers in
   G.bench are computed by the missions from physics.js. Nothing here decides a value. */
export function addBenches({ THREE, stage, scene, P, rockMat, G }) {
  const M = P.M, add = (o, X) => { o.position.x += X; scene.add(o); return o; }, V = (x, y, z) => new THREE.Vector3(x, y, z), fmt = (x, d = 0) => (+x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const glass = new THREE.MeshStandardMaterial({ color: 0xe6f1f5, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.17, envMapIntensity: 1.4, side: THREE.DoubleSide, depthWrite: false });
  const liquid = (hex, op = 0.92) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.15, metalness: 0, transparent: op < 1, opacity: op });
  const table = (X, w = 11, d = 5) => { const t = P.box(w, 0.3, d, new THREE.MeshStandardMaterial({ color: 0x6f6a62, roughness: 0.8 })); t.position.set(0, -0.15, 0); add(t, X); const top = P.box(w - 0.3, 0.04, d - 0.3, new THREE.MeshStandardMaterial({ color: 0xd8d5cc, roughness: 0.55 })); top.position.set(0, 0.02, 0); add(top, X); };
  const B = G.bench, set = () => G.set, on = (name) => () => set() === name ? G.read.show : 0;

  // ---------- rock: how much oil is in the ground ----------
  const XR = 100; table(XR, 12, 6);
  const block = P.box(1, 1, 1, rockMat('worn_rock_natural_01', 0xcfae7c)); add(block, XR);
  const cube = new THREE.Group(), grains = P.box(1.9, 1, 1.9, rockMat('rock_face_03', 0xb9a48c)), water = P.box(1.9, 1, 1.9, liquid(0x3f86c9, 0.85)), oil = P.box(1.9, 1, 1.9, liquid(0x1a1008, 1)); cube.add(grains, water, oil);
  const shell = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), glass); shell.position.y = 1; cube.add(shell); cube.position.set(4.2, 0.05, 0.6); add(cube, XR);
  stage.label({ name: 'oil in place', prio: 9, cls: 'num blue', order: ['a', 'al', 'ar'], gaps: [16, 36, 60], pos: () => V(XR - 1.6, 0.2 + block.scale.y, 0), alpha: on('rock'), text: () => fmt(B.rock.N / 1e6, 2) + ' <i>million bbl</i><small>oil in place</small>' });
  stage.label({ name: 'cube', prio: 6, cls: 'tag', order: ['a', 'ar', 'al'], gaps: [12, 30, 50], pos: () => V(XR + 4.2, 2.2, 0.6), alpha: on('rock'), text: () => 'one cubic foot of this rock<small>' + fmt(100 * (1 - B.rock.phi), 0) + ' % grains · ' + fmt(100 * B.rock.phi * B.rock.Sw, 1) + ' % water · ' + fmt(100 * B.rock.phi * (1 - B.rock.Sw), 1) + ' % oil</small>' });
  stage.label({ name: 'block', prio: 5, cls: 'tag', order: ['b', 'bl', 'br', 'l'], gaps: [14, 34], pos: () => V(XR - 1.6, 0.1, 2.4), alpha: on('rock'), text: () => fmt(B.rock.A) + ' acres · ' + fmt(B.rock.h, 1) + ' ft thick' });

  // ---------- cell: oil, gas, or both ----------
  const XC = 200; table(XC, 9, 5);
  const R = 0.7, HC = 4.2; add(P.at(P.cyl(1.1, 0.16, M.dark, 40), 0, 0.12, 0), XC); [-1, 1].forEach(s => add(P.at(P.cyl(0.05, HC + 0.7, M.steel, 12), s * 0.95, (HC + 0.7) / 2 + 0.1, 0), XC)); add(P.at(P.box(2.2, 0.14, 0.5, M.dark), 0, HC + 0.75, 0), XC);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(R, R, HC, 48, 1, true), glass); tube.position.set(0, 0.2 + HC / 2, 0); add(tube, XC);
  const oilC = P.cyl(R - 0.03, 1, liquid(0x5a3410, 0.96), 48), gasC = P.cyl(R - 0.03, 1, liquid(0xf2e6b0, 0.28), 48), piston = new THREE.Group(); piston.add(P.at(P.cyl(R - 0.02, 0.16, M.steel, 48), 0, 0.08, 0), P.at(P.cyl(0.07, HC, M.steel, 14), 0, HC / 2 + 0.16, 0)); [oilC, gasC, piston].forEach(o => add(o, XC));
  const bubbles = []; for (let i = 0; i < 18; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.035 + 0.02 * ((i * 7) % 5) / 5, 12, 8), liquid(0xfff3c4, 0.9)); b.userData = { a: i * 2.4, r: 0.12 + 0.45 * ((i * 37) % 10) / 10, ph: (i * 0.61) % 1 }; add(b, XC); bubbles.push(b); }
  const cg = P.gauge(2.2); cg.position.set(1.5, HC * 0.62, 0.1); add(cg, XC); add(P.at(P.cyl(0.03, 0.75, M.brass, 8), 1.1, HC * 0.62 - 0.3, 0, 0, 0, Math.PI / 2), XC);
  stage.label({ name: 'cell pressure', prio: 9, cls: 'num', order: ['r', 'ar', 'br', 'a', 'al', 'b'], gaps: [22, 44, 66], pos: () => V(XC + 1.5, HC * 0.62, 0.1), alpha: on('cell'), text: () => fmt(B.cell.p) + ' <i>psi</i><small>pressure in the cell</small>' });
  stage.label({ name: 'cell state', prio: 8, cls: 'num sm', order: ['l', 'al', 'bl'], gaps: [22, 44], pos: () => V(XC - 0.7, 0.2 + oilC.scale.y + gasC.scale.y * 0.5, 0.2), alpha: on('cell'), text: () => B.cell.gas > 0.0005 ? fmt(100 * B.cell.gas, 1) + ' % <i>gas</i><small>of the volume in the cell</small>' : 'all liquid<small>the gas is dissolved in the oil</small>' });

  // ---------- core: Darcy's experiment ----------
  const XD = 300; table(XD, 12, 5);
  add(P.at(P.box(1.5, 1.2, 1.2, M.dark), -4.2, 0.64, 0), XD); add(P.at(P.handwheel(0.3, M.red, 5), -4.2, 1.3, 0), XD); add(P.at(P.box(0.6, 0.3, 0.02, M.face), -4.2, 0.8, 0.62), XD);                    // the pump
  add(P.pipe([[XD - 3.45, 0.9, 0], [XD - 2.9, 0.9, 0], [XD - 2.2, 0.9, 0]], 0.06), 0); const dg = P.gauge(2.0); dg.position.set(-2.75, 1.55, 0.06); add(dg, XD); add(P.at(P.cyl(0.025, 0.4, M.brass, 8), -2.75, 1.12, 0), XD);
  const capL = new THREE.Group(), capR = new THREE.Group(); [capL, capR].forEach((c, i) => { c.add(P.at(P.cyl(0.62, 0.22, M.steel, 40), 0, 0, 0, 0, 0, Math.PI / 2), P.at(P.flange(0.7, 0.07, M.steel, 12), (i ? -1 : 1) * 0.1, 0, 0, 0, 0, Math.PI / 2)); c.position.y = 0.9; add(c, XD); });
  const plugMats = [rockMat('cliff_side', 0x9c8f82), rockMat('worn_rock_natural_01', 0xcfae7c), rockMat('marble_cliff_04', 0xe6dfd0)], plug = P.at(P.cyl(0.46, 1, plugMats[1], 40), 0, 0.9, 0, 0, 0, Math.PI / 2); add(plug, XD);
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 1, 40, 1, true), glass); sleeve.rotation.z = Math.PI / 2; sleeve.position.y = 0.9; add(sleeve, XD);
  [[-1.2, 0.45], [1.2, 0.45]].forEach(([x, h]) => add(P.at(P.box(0.5, h * 2 - 0.5, 0.9, M.dark), x, h - 0.25 + 0.05, 0), XD));
  const outPipe = new THREE.Group(); add(outPipe, XD); const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.9, 40, 1, true), glass); jar.position.set(4.3, 1.0, 0); add(jar, XD); add(P.at(P.cyl(0.55, 0.08, M.dark, 40), 4.3, 0.08, 0), XD);
  const liq = P.cyl(0.39, 1, liquid(0x3f86c9, 0.9), 40); add(liq, XD); const stream = P.cyl(1, 1, liquid(0x3f86c9, 0.9), 12); add(stream, XD); let lineOut = null, lastL = -1, lvl = 0.15;
  for (let i = 0; i <= 8; i++) add(P.at(P.box(i % 2 ? 0.1 : 0.16, 0.012, 0.02, M.black), 4.3 - 0.36, 0.2 + i * 0.2, 0.25), XD);
  stage.label({ name: 'pump pressure', prio: 9, cls: 'num', order: ['a', 'al', 'ar'], gaps: [22, 44], pos: () => V(XD - 2.75, 1.6, 0.06), alpha: on('core'), text: () => fmt(B.core.dp, 1) + ' <i>psi</i><small>pressure pushing in</small>' });
  stage.label({ name: 'core rate', prio: 9, cls: 'num blue', order: ['a', 'ar', 'r'], gaps: [20, 44], pos: () => V(XD + 4.3, 2.1, 0), alpha: on('core'), text: () => fmt(B.core.q, 2) + ' <i>bbl/d</i><small>measured coming out</small>' });
  stage.label({ name: 'plug', prio: 6, cls: 'tag', order: ['b', 'bl', 'br'], gaps: [34, 56], pos: () => V(XD + 0, 0.9, 0.6), alpha: on('core'), text: () => 'rock sample: ' + fmt(B.core.k) + ' md, ' + fmt(B.core.L, 2) + ' ft long<small>' + B.core.fluid + ', ' + fmt(B.core.mu, B.core.mu < 10 ? 1 : 0) + ' cp</small>' });

  const COL = { water: 0x3f86c9, 'light oil': 0xb07a2a, 'heavy oil': 0x2a1a0c };
  function update(dt, time) {
    // rock: the block's footprint follows the area, its thickness the pay; the cube is one cubic foot, by volume fractions
    const r = B.rock, side = 4.6 * Math.sqrt(r.A / 640); block.scale.set(side, Math.max(0.05, r.h / 50 * 0.9), side * 0.62); block.position.set(XR - 1.6, 0.05 + block.scale.y / 2, 0);
    const g = 2 * (1 - r.phi), w = 2 * r.phi * r.Sw, o = 2 * r.phi * (1 - r.Sw); grains.scale.y = Math.max(0.001, g); grains.position.y = g / 2; water.scale.y = Math.max(0.001, w); water.position.y = g + w / 2; oil.scale.y = Math.max(0.001, o); oil.position.y = g + w + o / 2;
    // cell: liquid below, free gas above it, the piston on top; bubbles rise while gas is coming out
    const c = B.cell, ho = 1.7 * c.oilRel, hg = Math.min(HC - ho - 0.3, 1.7 * c.gasRel); oilC.scale.y = ho; oilC.position.set(XC, 0.2 + ho / 2, 0); gasC.scale.y = Math.max(0.001, hg); gasC.position.set(XC, 0.2 + ho + hg / 2, 0); gasC.visible = hg > 0.004; piston.position.set(XC, 0.2 + ho + hg, 0);
    const act = c.gas > 0 ? Math.min(1, 0.25 + c.gas * 6) : 0; bubbles.forEach(b => { const u = b.userData, f = (u.ph + time * 0.18) % 1; b.visible = act > 0 && (u.ph * 1.0 < act); b.position.set(XC + Math.cos(u.a) * u.r, 0.25 + f * (ho - 0.1), Math.sin(u.a) * u.r); });
    cg.userData.needle.rotation.z = 2.2 - 4.4 * Math.min(1, c.p / 6000);
    // core: the holder closes on a sample of the chosen length; what comes out falls into the glass at the real rate
    const d = B.core; if (d.L !== lastL) { lastL = d.L; const Ld = 1.1 * d.L + 0.5; plug.scale.y = Ld; sleeve.scale.y = Ld; capL.position.x = XD - Ld / 2 - 0.11; capR.position.x = XD + Ld / 2 + 0.11; if (lineOut) scene.remove(lineOut);
      lineOut = P.pipe([[XD + Ld / 2 + 0.2, 0.9, 0], [XD + 2.6, 0.9, 0], [XD + 3.6, 1.6, 0], [XD + 4.1, 2.35, 0], [XD + 4.3, 2.3, 0]], 0.05); scene.add(lineOut); }
    plug.material = plugMats[d.plug]; const col = COL[d.fluid] || COL.water; liq.material.color.setHex(col); stream.material.color.setHex(col);
    lvl += dt * 0.11 * Math.min(4, d.q); if (lvl > 1.75) lvl = 0.15; liq.scale.y = lvl; liq.position.set(XD + 4.3, 0.12 + lvl / 2, 0);
    const sw = Math.min(0.05, 0.012 + 0.012 * Math.sqrt(d.q)); stream.visible = d.q > 0.005; stream.scale.set(sw, Math.max(0.01, 2.28 - 0.12 - lvl), sw); stream.position.set(XD + 4.3, (2.28 + 0.12 + lvl) / 2, 0);
    dg.userData.needle.rotation.z = 2.2 - 4.4 * Math.min(1, d.dp / 400);
  }
  return { update, centers: { well: 0, rock: XR, cell: XC, core: XD },
    cams: { rock: { az: 76, el: 18, dist: 16.5, tx: XR + 1.2, ty: 1.1, tz: 0 }, cell: { az: 80, el: 9, dist: 12.5, tx: XC + 0.5, ty: 2.5, tz: 0 }, core: { az: 84, el: 13, dist: 14, tx: XD, ty: 1.1, tz: 0 } } };
}
