/* game/missions.js — Chapter 1 as one level of eight missions (Petroleum Production Systems, 2nd ed., Sections 1-2 to 1-4).
   Every mission is built the same way: a number that is known in advance is asked for; the player works the equipment until
   they have it; the same number, or the same idea, is then asked for again in a different way with different controls free,
   so that no single recipe can be learnt by heart; the player says what they did; and only then the rule is given its name
   and its equation. Nothing is predicted blind. Every target is computed from physics.js and is reachable: each round carries
   the settings that reach it (`solution`), which is also what the scripted play-test uses. */
export function buildMissions(a) {
  const { G, PH, SC, say, sys, wait, until, cam, useSet, target, ask, rule, interrogate, tour, setChoke, reading, setWell, fmt, KPA, testDone, stamped, dockChokeOnly, lawWatch } = a;
  const ok = ['Good.', 'That is it.', 'There.', 'Right.'], good = (i) => ok[i % ok.length];
  const sl = (id, label, unit, min, max, step, dec, o, k, after) => ({ kind: 'slider', id, label, unit, min, max, step, dec, get: () => o[k], set: (v) => { o[k] = v; if (after) after(); } });
  const ch = (id, label, options, o, k, after) => ({ kind: 'choice', id, label, options, get: () => o[k], set: (v) => { o[k] = v; if (after) after(); } });
  const lock = (list, ids) => list.map(c => Object.assign({}, c, { locked: ids.includes(c.id) }));
  async function rounds(list) { for (let i = 0; i < list.length; i++) { const r = list[i]; if (r.setup) r.setup(); await say(r.ask, 0.4); await target(r); await say(r.after || good(i)); } }

  // ---------- 1. Meet your well ----------
  const meet = { id: 'meet', title: 'Meet your well', ref: 'Section 1-2', run: async () => {
    useSet('well', 'play', 3); await tour(); await say('Now tell me what you saw.');
    const Q = [
      { key: 'tubing', q: 'What is this?', o: ['The tubing', 'The casing', 'The flowline', 'The packer'], r: 0, why: 'The tubing: the pipe that carries the oil to the surface.' },
      { q: 'Where does the oil enter the well?', o: ['Through the choke', 'Through the perforations', 'Through the wellhead', 'Through the stock tank'], r: 1, why: 'Through the perforations, the holes shot through the casing.', show: 'perforations' },
      { key: 'separator', q: 'What happens in this vessel?', o: ['The oil is stored for sale', 'The well is opened and closed', 'Gas and oil part, and the oil is measured', 'The oil is pushed back down'], r: 2, why: 'It is the test separator: gas off the top, oil off the bottom, and a meter on the oil.' },
      { q: 'Which part do you use to control how hard the well flows?', o: ['The packer', 'The casing', 'The stock tank', 'The choke'], r: 3, why: 'The choke: a hole whose size you set.', show: 'choke' },
      { key: 'packer', q: 'What is this for?', o: ['It seals the gap between tubing and casing', 'It measures the pressure', 'It holds the rock open', 'It separates the gas'], r: 0, why: 'The packer seals that gap, so the oil can only go up the tubing.' },
      { q: 'The well is shut in. Which of these is true?', o: ['Oil is flowing slowly', 'Nothing is flowing, and pressure has built up in the well', 'The tank is filling', 'The choke is wide open'], r: 1, why: 'Shut in means closed at the surface. Nothing moves.' }
    ];
    for (const x of Q) { if (x.key) { cam(x.key, 2.4, true); SC.point(x.key, '?'); } await ask({ q: x.q, options: x.o, right: x.r, why: x.why }); SC.unpoint(); if (x.show) { cam(x.show, 2.2, true); SC.point(x.show); await wait(2.4); SC.unpoint(); } }
    cam('play', 2.4);
    await rule({ name: 'The production system', ref: 'Section 1-2, Figure 1-6', text: 'Reservoir, perforations, tubing, wellhead, choke, flowline, separator, stock tank. One path, and the oil takes all of it.' });
  } };

  // ---------- 2. How much oil is there? ----------
  const R = G.bench.rock, BO = 1.2, calcN = () => { R.N = PH.OOIP(R.A, R.h, R.phi, R.Sw, R.Bo || BO); }, N6 = () => R.N / 1e6;
  const rockCtl = () => [sl('phi', 'Porosity', '', 0.05, 0.35, 0.001, 3, R, 'phi', calcN), sl('h', 'Thickness of the pay', 'ft', 10, 150, 0.1, 1, R, 'h', calcN), sl('Sw', 'Water saturation', '', 0.1, 0.7, 0.005, 3, R, 'Sw', calcN), sl('A', 'Area', 'acres', 40, 1280, 1, 0, R, 'A', calcN)];
  const tN = (goal, locks, solution) => ({ title: 'Oil in place', goalText: fmt(goal, 1) + ' million bbl', metric: N6, show: (v) => fmt(v, 2) + ' <i>million bbl</i>', goal, tol: goal * 0.008, range: [0, 60], controls: lock(rockCtl(), locks), solution: { ctl: solution } });
  const oil = { id: 'oil', title: 'How much oil is there?', ref: 'Section 1-2.1', run: async () => {
    Object.assign(R, { A: 640, h: 50, phi: 0.12, Sw: 0.3 }); calcN(); useSet('rock', 'rock', 3);
    await say('Before anyone drills, somebody has to say how much oil is down there.');
    await say('The glass cube is one cubic foot of the reservoir: grains of rock, and in the gaps between them, water and oil.');
    await rounds([
      Object.assign({ ask: 'This reservoir covers 640 acres and is 50 feet thick. It should hold 30 million barrels. What porosity does that take?' }, tN(30, ['h', 'Sw', 'A'], { phi: 30e6 * BO / (7758 * 640 * 50 * 0.7) })),
      Object.assign({ setup: () => { Object.assign(R, { phi: 0.12, h: 50 }); calcN(); }, ask: 'Same 30 million barrels, but the rock is tighter: porosity 12 %. How thick must the pay be?' }, tN(30, ['phi', 'Sw', 'A'], { h: 30e6 * BO / (7758 * 640 * 0.12 * 0.7) })),
      Object.assign({ setup: () => { Object.assign(R, { phi: 0.2, h: 50, Sw: 0.45, A: 640 }); calcN(); }, ask: 'Bad news from the logs: the water saturation is 45 %, not 30. Get the oil in place back to 30 million barrels, any way you can.' }, tN(30, ['Sw'], { phi: 0.2, A: 640, h: 30e6 * BO / (7758 * 640 * 0.2 * 0.55) })),
      Object.assign({ setup: () => { Object.assign(R, { phi: 0.2, h: 50, Sw: 0.3, A: 640 }); calcN(); }, ask: 'A smaller field has the same rock, 50 feet of it. It holds 8 million barrels. How many acres is it?' }, tN(8, ['phi', 'h', 'Sw'], { A: 8e6 * BO / (7758 * 50 * 0.2 * 0.7) }))
    ]);
    await ask({ q: 'You reached 30 million barrels three different ways. What did all three have in common?', options: ['The area was always the largest number', 'The product of area, thickness, porosity and oil saturation came out the same', 'The porosity was always 20 %', 'Nothing: it was luck'], right: 1, why: 'Oil in place is a product. Lose some in one factor and you must find it in another.' });
    await rule({ name: 'Oil in place', tex: 'N = \\frac{7758\\,A\\,h\\,\\phi\\,(1 - S_w)}{B_o}', ref: 'Section 1-2.1, Equation 1-3', text: 'A in acres, h in feet, N in stock-tank barrels. 7758 is the number of barrels in one acre-foot. B<sub>o</sub> turns barrels in the reservoir into barrels in the tank.' });
    await Q.oil();
  } };

  // ---------- 3. Oil, gas, or both? ----------
  const C = G.bench.cell, OILP = { T: G.spec ? G.spec.T : 150, API: 35, gg: 0.65 }, RS1 = G.spec ? G.spec.GLR : 250, RS2 = 600, pc = PH.pseudoFromGravity(OILP.gg);
  const pbOf = (Rsb) => PH.vbPb(Rsb, OILP.T, OILP.API, OILP.gg);
  function cellCalc() { const pb = pbOf(C.Rsb), Rs = C.p >= pb ? C.Rsb : PH.vbRs(C.p, OILP.T, OILP.API, OILP.gg), Bo = PH.vbBo(Rs, OILP.T, OILP.API, OILP.gg), Bob = PH.vbBo(C.Rsb, OILP.T, OILP.API, OILP.gg);
    const Z = PH.Zfactor(C.p / pc.Ppc, (OILP.T + 460) / pc.Tpc), Vg = Math.max(0, C.Rsb - Rs) * 0.0283 * Z * (OILP.T + 460) / C.p / 5.615; C.pb = pb; C.gas = Vg / (Vg + Bo); C.oilRel = Bo / Bob; C.gasRel = Vg / Bob; }
  const pFor = (Rsb, frac) => { let lo = 200, hi = pbOf(Rsb); const keep = Object.assign({}, C); C.Rsb = Rsb; for (let i = 0; i < 40; i++) { C.p = (lo + hi) / 2; cellCalc(); if (C.gas > frac) lo = C.p; else hi = C.p; } const p = C.p; Object.assign(C, keep); return p; };
  const pCtl = (label) => [sl('p', label || 'Pressure', 'psi', 200, 5000, 5, 0, C, 'p', cellCalc)];
  const tBub = (Rsb, label) => ({ title: 'Lowest pressure with no gas', goalText: 'no gas, lowest pressure', metric: () => C.p, show: (v) => fmt(v) + ' <i>psi</i>', goal: pbOf(Rsb) + 0.006 * pbOf(Rsb), tol: 0.006 * pbOf(Rsb), range: [200, 5000], constraint: { text: 'no gas in the cell', ok: () => C.gas < 1e-6 }, controls: pCtl(label), solution: { ctl: { p: Math.ceil(pbOf(Rsb) / 5) * 5 } } });
  const phase = { id: 'phase', title: 'Oil, gas, or both?', ref: 'Section 1-2.1', run: async () => {
    Object.assign(C, { p: 5000, Rsb: RS1 }); cellCalc(); useSet('cell', 'cell', 3);
    await say('This is a sample of the oil in your reservoir, held in a steel and glass cell. The piston sets the pressure.');
    await say('At this pressure it is one liquid. The gas is in there, dissolved, the way gas is dissolved in a closed bottle of soda.');
    await rounds([
      { ask: 'Take the pressure down until one tenth of the cell is gas.', title: 'Gas in the cell', goalText: '10 % gas', metric: () => 100 * C.gas, show: (v) => fmt(v, 1) + ' <i>% gas</i>', goal: 10, tol: 0.6, range: [0, 40], controls: pCtl(), solution: { ctl: { p: Math.round(pFor(RS1, 0.10) / 5) * 5 } }, after: 'You went a long way down before any gas showed. Then it came fast.' },
      Object.assign({ ask: 'Now squeeze it back until the last bubble is gone, and no further.' }, tBub(RS1), { after: 'That pressure has a name: the bubble point.' }),
      Object.assign({ setup: () => { Object.assign(C, { p: 5000, Rsb: RS2 }); cellCalc(); }, ask: 'A different oil, holding more than twice as much gas. Find its bubble point.' }, tBub(RS2), { after: 'More gas in the oil, higher bubble point.' }),
      { setup: () => { Object.assign(C, { p: G.spec.pe, Rsb: RS1 }); cellCalc(); }, ask: 'Back to the first oil, the one in your reservoir. Your reservoir is at ' + fmt(G.spec.pe) + ' psi. How low can the pressure at the bottom of your well go before gas forms in the rock?', title: 'Lowest bottomhole pressure, no gas', goalText: 'your answer', entry: { units: [['psi', 1], ['kPa', 1 / KPA]], low: 'Lower than that and gas is already forming. You found this number two rounds ago.', high: 'You could go lower than that with no gas forming.' }, metric: () => 0, show: () => '', goal: pbOf(RS1), tol: 0.015 * pbOf(RS1), range: [0, 5000], controls: pCtl('Pressure (try it in the cell)'), solution: { entry: [Math.round(pbOf(RS1)), 'psi'] }, after: 'The same number. In the cell it is a bubble; in a reservoir it is the limit of single-phase flow.' }
    ]);
    const pb = pbOf(RS1);
    await ask({ q: 'Three reservoirs hold this first oil. Which one is undersaturated: all liquid, no free gas?', options: ['The one at ' + fmt(G.spec.pe) + ' psi, like yours', 'The one at ' + fmt(Math.round((pb - 300) / 100) * 100) + ' psi', 'The one at ' + fmt(Math.round((pb - 800) / 100) * 100) + ' psi', 'All three'], right: 0, why: 'Only the one above the bubble point, ' + fmt(pb) + ' psi for this oil. Your reservoir is undersaturated. The other two already have free gas: they are saturated, or two-phase, reservoirs.' });
    await rule({ name: 'The bubble point', ref: 'Section 1-2.1, Figure 1-3', text: 'Above its bubble-point pressure an oil is one liquid and the reservoir is <b>undersaturated</b>. At or below it, gas comes out of the oil and the reservoir is <b>saturated</b>, or two-phase. Which side you are on decides how the well must be treated, starting in Chapters 2 and 3.' });
  } };

  // ---------- 4. What lets it flow? ----------
  const D = G.bench.core, AREA = 0.1, KS = [50, 200, 800], MU = { water: 1, 'light oil': 5, 'heavy oil': 50 };
  const coreCalc = () => { if (D.kFree != null) D.plug = D.kFree < 125 ? 0 : D.kFree < 500 ? 1 : 2; D.k = D.kFree != null ? D.kFree : KS[D.plug]; D.mu = D.muFree != null ? D.muFree : MU[D.fluid]; D.q = 1.127e-3 * D.k * AREA * D.dp / (D.mu * D.L); };
  const coreCtl = () => [sl('dp', 'Pressure from the pump', 'psi', 0, 400, 0.2, 1, D, 'dp', coreCalc), ch('fluid', 'Fluid', [['water, 1 cp', 'water'], ['light oil, 5 cp', 'light oil'], ['heavy oil, 50 cp', 'heavy oil']], D, 'fluid', coreCalc), ch('plug', 'Rock sample', [['50 md', 0], ['200 md', 1], ['800 md', 2]], D, 'plug', coreCalc), sl('L', 'Length of the sample', 'ft', 0.25, 2, 0.01, 2, D, 'L', coreCalc)];
  const tQ = (goal, locks, solution) => ({ title: 'Rate through the rock', goalText: fmt(goal, 2) + ' bbl/d', metric: () => D.q, show: (v) => fmt(v, 2) + ' <i>bbl/d</i>', goal, tol: goal * 0.012, range: [0, 4], controls: lock(coreCtl(), locks), solution: { ctl: solution } });
  const dpFor = (q, k, mu, L) => Math.round(q * mu * L / (1.127e-3 * k * AREA) * 5) / 5;
  const darcy = { id: 'darcy', title: 'What lets it flow?', ref: 'Section 1-2.2', run: async () => {
    Object.assign(D, { dp: 0, fluid: 'water', plug: 1, L: 1 }); coreCalc(); useSet('core', 'core', 3);
    await say('Henry Darcy did this in 1856 with sand and water. A pump, a sample of rock, and a glass to catch what comes through.');
    await rounds([
      Object.assign({ ask: 'Push 1.00 barrel a day of water through the 200-millidarcy sample.' }, tQ(1, ['fluid', 'plug', 'L'], { dp: dpFor(1, 200, 1, 1) })),
      Object.assign({ setup: () => { D.fluid = 'light oil'; coreCalc(); }, ask: 'Same sample, same rate, but now it is light oil, five times as viscous as water.' }, tQ(1, ['fluid', 'plug', 'L'], { dp: dpFor(1, 200, 5, 1) }), { after: 'Five times the viscosity, five times the pressure.' }),
      Object.assign({ setup: () => { Object.assign(D, { dp: 60, fluid: 'light oil', plug: 1, L: 1 }); coreCalc(); }, ask: 'The pump can only hold 60 psi. I still want 1.00 barrel a day of that light oil. Find a way.' }, tQ(1, ['dp', 'fluid'], { plug: 2, L: Math.round(1.127e-3 * 800 * AREA * 60 / 5 * 100) / 100 }), { after: 'You changed the rock, because you could not change the pump.' }),
      Object.assign({ ask: 'Now twice that, 2.00 barrels a day. Still 60 psi, still light oil.' }, tQ(2, ['dp', 'fluid'], { plug: 2, L: Math.round(1.127e-3 * 800 * AREA * 60 / 5 / 2 * 100) / 100 }))
    ]);
    await ask({ q: 'You just doubled the rate without more pressure. Which of these would also have done it?', options: ['A fluid twice as viscous', 'A sample half as long', 'A rock of half the permeability', 'None of them'], right: 1, why: 'Half the length, or twice the permeability, or half the viscosity: each one doubles the rate. That is what proportional means.' });
    await rule({ name: 'Darcy’s law', tex: 'q = 1.127\\times10^{-3}\\,\\frac{k\\,A\\,\\Delta p}{\\mu\\,L}', ref: 'Section 1-2.2, Figure 1-4', text: 'q in bbl/d, k in millidarcies, A in ft², Δp in psi, μ in centipoise, L in feet. The rock gives k, the fluid gives μ, and what matters is their ratio k/μ, the <b>mobility</b>.' });
    await Q.darcy();
  } };

  // ---------- 5. The last few feet ----------
  const S5 = { kr: 0.2, rs: 3.3 }, W5 = { k: 60, D: 2.441 }, RW = 0.328;
  const skinOf = (kr, rs) => PH.hawkins(1 / kr, rs, RW), apply5 = () => { setWell(Object.assign({}, W5, { s: skinOf(S5.kr, S5.rs) })); G.read.dmg = { a: 1 - S5.kr, w: S5.rs }; };
  const q5 = (kr, rs) => { setWell(Object.assign({}, W5, { s: skinOf(kr, rs) })); const q = reading(32).rate; return q; };
  const skinCtl = () => [sl('kr', 'Permeability left in the damaged rock', '× the reservoir’s', 0.05, 1, 0.01, 2, S5, 'kr', apply5), sl('rs', 'How far the damage reaches from the well’s axis', 'ft', 0.33, 6, 0.01, 2, S5, 'rs', apply5)];
  const tS = (goal, locks, solution) => ({ title: 'Rate, choke at 32/64', goalText: fmt(goal) + ' bbl/d', metric: () => G.read.rate || 0, show: (v) => fmt(v) + ' <i>bbl/d</i>', goal, tol: Math.max(4, goal * 0.006), range: [0, 2200], steady: () => G.logged, controls: lock(skinCtl(), locks), solution: { ctl: solution } });
  const skin = { id: 'skin', title: 'The last few feet', ref: 'Section 1-2.3', run: async () => {
    useSet('well', 'deep', 3); G.gauge = true; const qa = q5(0.5, 3.3), qc = q5(1, 3.3); Object.assign(S5, { kr: 0.2, rs: 3.3 }); apply5(); setChoke(32);
    await say('This is Well 5, next door. Drilling mud has soaked into the rock around it and half-blocked the pores. The dark band beside the well is that damage.');
    await say('Its choke stays at 32. The only thing you can change is the damage.');
    const rsB = Math.round(RW * Math.exp(Math.log(3.3 / RW) / 4) * 100) / 100;
    await rounds([
      Object.assign({ ask: 'An acid job can dissolve some of what blocks the pores. Bring this well up to ' + fmt(qa) + ' barrels a day.' }, tS(qa, ['rs'], { kr: 0.5 })),
      Object.assign({ setup: () => { Object.assign(S5, { kr: 0.2, rs: 3.3 }); apply5(); }, ask: 'Start again. This time the acid cannot improve the rock it reaches, but it can remove the outer part of the damage. Same ' + fmt(qa) + ' barrels a day.' }, tS(qa, ['kr'], { rs: rsB }), { after: 'To match a mild repair of three feet, you had to clear the damage almost to the wall of the well.' }),
      Object.assign({ setup: () => { Object.assign(S5, { kr: 0.2, rs: 3.3 }); apply5(); }, ask: 'Now give me everything this rock can do: ' + fmt(qc) + ' barrels a day.' }, tS(qc, [], { kr: 1 }))
    ]);
    await ask({ q: 'Which hurts a well more?', options: ['Mild damage reaching ten feet out', 'Severe damage in the first few inches', 'They hurt the same'], right: 1, why: 'All the oil has to squeeze through the rock nearest the well, so that rock decides. Engineers put the whole effect into one number, the skin, written s.' });
    await rule({ name: 'Skin: the zone near the well', tex: 'J_D = \\frac{1}{\\ln(r_e / r_w) + s}', ref: 'Section 1-2.3; Equations 1-6 and 1-7', text: 'A damaged zone adds a positive skin s and lowers what the well can give. Removing the damage takes s back toward zero. This is the part of a well an engineer can change.' });
    await Q.skin();
    G.read.dmg = null; setWell(null); setChoke(0);
  } };

  // ---------- 6. Up the well ----------
  const wheelT = (title, goalText, metric, show, goal, tol, range, S, extra) => Object.assign({ title, goalText, metric, show, goal, tol, range, steady: () => G.logged, wheel: { cap: 64 }, solution: { S } }, extra || {});
  const up = { id: 'up', title: 'Up the well', ref: 'Sections 1-2.4 and 1-2.5', run: async () => {
    useSet('well', 'play', 3); G.gauge = true; setWell(null); const r24 = reading(24), r16 = reading(16), r0 = reading(0), col = r0.kpa / KPA - r0.ptf;
    await say('Back on Well 7, your own. A gauge has been run to the bottom on wireline. It reads in kilopascals: the service company works in SI.');
    await rounds([
      Object.assign({ ask: 'Bring the wellhead pressure down to ' + fmt(r24.ptf) + ' psi.' }, wheelT('Wellhead pressure', fmt(r24.ptf) + ' psi', () => G.read.ptf, (v) => fmt(v) + ' <i>psi</i>', r24.ptf, 2.5, [200, 1300], 24)),
      Object.assign({ ask: 'The service company asks for ' + fmt(r16.kpa) + ' kilopascals at the bottom of the well.' }, wheelT('Bottomhole pressure', fmt(r16.kpa) + ' kPa', () => G.read.kpa, (v) => fmt(v) + ' <i>kPa</i>', r16.kpa, 5, [10000, 27000], 16)),
      Object.assign({ ask: 'Now shut it in, and let it settle.' }, wheelT('Rate', '0 bbl/d', () => G.read.rate || 0, (v) => fmt(v) + ' <i>bbl/d</i>', 0, 0.5, [0, 2000], 0)),
      { ask: 'Nothing is moving, and still the bottom reads far more than the top. The difference is the weight of the oil standing in the tubing. How much is it?', title: 'Weight of the column', goalText: 'your answer', entry: { units: [['psi', 1], ['kPa', 1 / KPA]], low: 'More than that. Bottom minus top, and both in the same unit.', high: 'Less than that. Check the units: one gauge reads psi, the other kilopascals.' }, metric: () => 0, show: () => '', goal: col, tol: col * 0.012, range: [0, 1], wheel: { cap: 0 }, solution: { entry: [Math.round(col), 'psi'] }, after: fmt(Math.round(col)) + ' psi, from ' + fmt(G.spec.depth) + ' feet of oil. About a third of a psi for every foot.' }
    ]);
    await ask({ q: 'When the well is flowing, the bottom still reads more than the top. Why?', options: ['The choke adds pressure at the bottom', 'The fluid in the tubing has weight, and rubbing along the pipe costs a little more', 'The gauges disagree', 'It does not'], right: 1, why: 'Weight first, friction second. The reservoir has to pay for both before any oil reaches the surface.' });
    await rule({ name: 'Up the well', tex: 'p_{wf} = p_{tf} + \\Delta p_{\\text{weight of the column}} + \\Delta p_{\\text{friction}}', ref: 'Section 1-2.4', text: 'The pressure at the bottom of a flowing well is the pressure at the top, plus the weight of the fluid in the tubing, plus friction. Lighten the column or widen the pipe and the bottom of the well feels less pressure.' });
    await Q.up();
  } };

  // ---------- 7. Make the rate ----------
  const best = () => { const base = G.spec, a0 = (mod) => { setWell(mod); return reading(64).rate; }, qAcid = base.s > 0 ? a0({ s: 0 }) : 0, qTub = a0({ D: 2.992 }), q0 = a0(null), lever = qAcid >= qTub ? { acid: 1, tub: base.D } : { acid: 0, tub: 2.992 }, mod = lever.acid ? { s: 0 } : { D: 2.992 }, other = Math.max(q0, lever.acid ? qTub : qAcid);
    setWell(mod); let S = 64; for (const s of [40, 44, 48, 52, 56, 64]) if (reading(s).rate > 1.08 * other) { S = s; break; } const goal = reading(S).rate; setWell(null); return { q0, lever, S, goal }; };
  const L7 = { acid: 0, tub: 0 }, apply7 = () => setWell(L7.acid || L7.tub !== G.spec.D ? { s: L7.acid ? 0 : G.spec.s, D: L7.tub } : null);
  const rate = { id: 'rate', title: 'Make the rate', ref: 'Section 1-3', run: async () => {
    useSet('well', 'play', 3); G.gauge = true; setWell(null); Object.assign(L7, { acid: 0, tub: G.spec.D });
    const r20 = reading(20), r28 = reading(28), r0 = reading(0), dd = (r) => (r0.kpa - r.kpa) / KPA; let Sc = 2; for (let s = 2; s <= 64; s += 2) if (reading(s).ptf >= 500) Sc = s; const rc = reading(Sc), B7 = best(), big = Math.round(1.5 * B7.q0 / 50) * 50;
    await say('The office does not care how you do it. They ask for a number.');
    await rounds([
      Object.assign({ ask: 'Give me ' + fmt(r20.rate) + ' barrels a day.' }, wheelT('Rate', fmt(r20.rate) + ' bbl/d', () => G.read.rate || 0, (v) => fmt(v) + ' <i>bbl/d</i>', r20.rate, 1.5, [0, 2200], 20)),
      Object.assign({ ask: 'The reservoir engineer asks it another way. A drawdown of ' + fmt(dd(r28)) + ' psi: reservoir pressure minus the pressure at the bottom of the well.' }, wheelT('Drawdown', fmt(dd(r28)) + ' psi', () => (r0.kpa - G.read.kpa) / KPA, (v) => fmt(v) + ' <i>psi</i>', dd(r28), 2.5, [0, 1400], 28), { after: 'More drawdown, more rate. You pull harder on the rock and it gives more.' }),
      Object.assign({ ask: 'The separator needs at least 500 psi at the wellhead to work. Keep that, and give me all the oil you can.' }, wheelT('Rate', 'the most you can', () => G.read.rate || 0, (v) => fmt(v) + ' <i>bbl/d</i>', rc.rate, 1.5, [0, 2200], Sc, { constraint: { text: 'wellhead at 500 psi or more', ok: () => G.read.ptf >= 500 } })),
      Object.assign({ ask: 'Forget the 500. I want ' + fmt(big) + ' barrels a day.' }, wheelT('Rate', fmt(big) + ' bbl/d', () => G.read.rate || 0, (v) => fmt(v) + ' <i>bbl/d</i>', big, 1.5, [0, Math.max(2200, big * 1.2)], 64, { impossible: true, solution: { S: 64, cant: true } }), { after: 'Right. Wide open, and the well has no more to give. Past a point the choke changes nothing.' })
    ]);
    await say('Two things can change that. Clean up the rock around the well, or change the pipe that brings the oil up. Each costs money, and only one of them is what this well needs.');
    await rounds([Object.assign({ ask: 'Get me ' + fmt(B7.goal) + ' barrels a day.' }, wheelT('Rate', fmt(B7.goal) + ' bbl/d', () => G.read.rate || 0, (v) => fmt(v) + ' <i>bbl/d</i>', B7.goal, 1.5, [0, Math.max(2600, B7.goal * 1.25)], B7.S, { controls: [ch('acid', 'The rock near the well', [['as it is', 0], ['cleaned with acid', 1]], L7, 'acid', apply7), ch('tub', 'Tubing, inside diameter', [['1.61 in', 1.61], ['1.995 in', 1.995], ['2.441 in', 2.441], ['2.992 in', 2.992]], L7, 'tub', apply7)], solution: { S: B7.S, ctl: { acid: B7.lever.acid, tub: B7.lever.tub } } }), { after: B7.lever.acid ? 'The acid did it. This well was held back by the rock beside it, not by its pipe.' : 'The larger tubing did it. This rock was fine. The well was held back by its own pipe.' })]);
    await say('Ask the person next to you which one their well needed.');
    if (!testDone()) { await say('One more thing before the rule. Run me a test on the well as it is now: four choke settings, and one shut in.', 0.4); dockChokeOnly({ flow: 4, shut: 1 }); await until(testDone); }
    await say('Your readings are in the notebook. One of them sets the rate. Find which, write it as a law, and sign it.', 0.4); await lawWatch();
    await ask({ q: 'So an engineer has two ways to get more oil from a well. Which two?', options: ['A bigger tank, or a longer flowline', 'Raise the productivity index, or lower the pressure at the bottom of the well', 'Raise the wellhead pressure, or shut the well in', 'Open the choke, or wait'], right: 1, why: 'Improve what the rock and the near-well zone give for each psi, or pull harder by lowering the bottomhole pressure. Everything else in this course is one or the other.' });
    await rule({ name: 'The productivity index', tex: 'q = J\\,(\\bar p - p_{wf})', ref: 'Section 1-3, Equation 1-6', text: 'J is what the well gives for each psi of drawdown. The job of a production engineer is to get the most from a well at sensible cost: raise J, or lower p<sub>wf</sub>.' });
    await Q.rate();
  } };

  // ---------- 8. Units ----------
  const U = { q: 2, mu: 1, k: 1, h: 1, c: 0 }, SI = { q: 0.001, B: 1.1, mu: 2e-3, k: 1e-14, h: 10, re: 575, rw: 0.1 }, LN = Math.log(SI.re / SI.rw);
  const OPT = { q: [['× 543,400', 543400], ['× 6.29', 6.29], ['× 86,400', 86400]], mu: [['× 1,000', 1000], ['× 1', 1], ['÷ 1,000', 0.001]], k: [['÷ 9.869×10⁻¹⁶', 1 / 9.869e-16], ['× 9.869×10⁻¹⁶', 9.869e-16], ['÷ 9.869×10⁻¹³', 1 / 9.869e-13]], h: [['× 3.281', 3.281], ['÷ 3.281', 1 / 3.281], ['× 0.3048', 0.3048]] };
  const dpField = () => 141.2 * (SI.q * U.q) * SI.B * (SI.mu * U.mu) * LN / ((SI.k * U.k) * (SI.h * U.h)) * 6894.757 / 1e6, CS = [141.2, 0.1592, 6.283], dpSI = () => CS[U.c] * SI.q * SI.B * SI.mu * LN / (SI.k * SI.h) / 1e6;
  const GOAL = 141.2 * (SI.q * 543400) * SI.B * (SI.mu * 1000) * LN / ((SI.k / 9.869e-16) * (SI.h * 3.281)) * 6894.757 / 1e6;
  const uc = (id, label) => ch(id, label, OPT[id], U, id);
  const units = { id: 'units', title: 'Units', ref: 'Section 1-4', run: async () => {
    useSet('well', 'play', 3); Object.assign(U, { q: 6.29, mu: 1, k: 9.869e-16, h: 0.3048, c: 0 });
    await say('A well test has come in from a company that works in SI units. Our equation wants oilfield units.');
    await say('The rate is 0.001 m³/s, the viscosity 0.002 Pa·s, the permeability 10⁻¹⁴ m², the thickness 10 m. The right drawdown is ' + fmt(GOAL, 1) + ' million pascals.');
    await rounds([
      { ask: 'Choose how to convert each number, so that the equation gives that drawdown.', title: 'Drawdown', goalText: fmt(GOAL, 1) + ' MPa', metric: dpField, show: (v) => (v > 9999 || v < 0.01 ? v.toExponential(2) : fmt(v, 1)) + ' <i>MPa</i>', goal: GOAL, tol: GOAL * 0.004, range: [0, 60], controls: [uc('q', 'Rate, m³/s to barrels a day'), uc('mu', 'Viscosity, Pa·s to centipoise'), uc('k', 'Permeability, m² to millidarcies'), uc('h', 'Thickness, metres to feet')], solution: { ctl: { q: 543400, mu: 1000, k: 1 / 9.869e-16, h: 3.281 } }, after: 'One wrong factor and the answer is off by thousands. Nothing warns you.' },
      { setup: () => { U.c = 0; }, ask: 'There is a second way. Leave every number in SI and change the constant in the equation instead. Which constant gives the same ' + fmt(GOAL, 1) + ' million pascals?', title: 'Drawdown', goalText: fmt(GOAL, 1) + ' MPa', metric: dpSI, show: (v) => (v > 9999 || v < 0.01 ? v.toExponential(2) : fmt(v, 1)) + ' <i>MPa</i>', goal: GOAL, tol: GOAL * 0.004, range: [0, 60], controls: [ch('c', 'The constant in front', [['141.2', 0], ['0.159', 1], ['6.28', 2]], U, 'c')], solution: { ctl: { c: 1 } }, after: '0.159 is 1 over 2π. In a consistent set of units the constant is pure geometry.' }
    ]);
    await ask({ q: 'The same equation needed a different constant. Why?', options: ['SI wells flow differently', 'The constant carries the units: change the units and it must change with them', '141.2 was wrong all along', 'It was a coincidence'], right: 1, why: '141.2 is not physics. It is the price of using barrels, psi, centipoise, millidarcies and feet in one equation.' });
    await rule({ name: 'Units', tex: 'p_e - p_{wf} = \\frac{141.2\\,q\\,B\\,\\mu}{k\\,h}\\left[\\ln\\frac{r_e}{r_w} + s\\right]', ref: 'Section 1-4, Example 1-1', text: 'Oilfield units: q in STB/d, μ in cp, k in md, h in ft, p in psi. In SI the constant becomes 1/2π = 0.159. With the data of Example 1-1 the equation gives ' + fmt(GOAL, 2) + '×10⁶ Pa; the book prints 30.43×10⁶.' });
  } };

  // ---------- questioning each equation: when is it zero, and what does each term do alone ----------
  const v = (id, s) => '\\htmlClass{iv-' + id + '}{' + s + '}', Q = {};
  Q.oil = async () => {
    const base = () => { Object.assign(R, { A: 640, h: 50, phi: 0.2, Sw: 0.3, Bo: 1.2 }); calcN(); };
    await say('You have the equation. Now do not trust it: question it. Start with the hardest question you can ask an equation.');
    await interrogate({ tex: 'N = \\frac{7758\\;' + v('A', 'A') + '\\,' + v('h', 'h') + '\\,' + v('phi', '\\phi') + '\\,(1 - ' + v('Sw', 'S_w') + ')}{' + v('Bo', 'B_o') + '}', resultName: 'oil in place', metric: N6, show: (x) => fmt(x, 2) + ' <i>million bbl</i>', eps: 0.005, reset: base,
      zeroAsk: 'Make the oil in place exactly zero. There are four separate ways. Find all four.', zeroDone: 'Four ways to have no oil, and each is a different kind of bad news. That is what a product means: any one factor at zero kills the whole.',
      vars: [
        { id: 'phi', sym: '\\phi', name: 'porosity', ctl: sl('phi', 'Porosity', '', 0, 0.35, 0.005, 3, R, 'phi', calcN), zeroAt: 0, zeroWhy: 'Solid rock, no pores. There is nowhere for oil to be.', tells: 'Porosity is the fraction of the rock that is empty space. Oil in place is proportional to it.', sweep: [0, 0.35] },
        { id: 'Sw', sym: 'S_w', name: 'water saturation', ctl: sl('Sw', 'Water saturation', '', 0, 1, 0.01, 2, R, 'Sw', calcN), zeroAt: 1, zeroWhy: 'Every pore is full of water. The rock is good; there is simply no oil in it.', tells: 'Water saturation is the share of the pore space taken by water. What is left, 1 − S<sub>w</sub>, holds the oil. That is why it enters with a minus sign.', sweep: [0, 1] },
        { id: 'h', sym: 'h', name: 'thickness', ctl: sl('h', 'Thickness of the pay', 'ft', 0, 150, 1, 0, R, 'h', calcN), zeroAt: 0, zeroWhy: 'No thickness: there is no layer of rock at all.', tells: 'Thickness is the height of rock that holds oil. Twice as thick, twice the oil.', sweep: [0, 150] },
        { id: 'A', sym: 'A', name: 'area', ctl: sl('A', 'Area', 'acres', 0, 1280, 10, 0, R, 'A', calcN), zeroAt: 0, zeroWhy: 'No area: no reservoir.', tells: 'Area is how far the reservoir spreads. Twice the area, twice the oil.', sweep: [0, 1280] },
        { id: 'Bo', sym: 'B_o', name: 'formation volume factor', ctl: sl('Bo', 'Formation volume factor', '', 1, 2, 0.01, 2, R, 'Bo', calcN), tells: 'B<sub>o</sub> is underneath. A barrel in the reservoir shrinks on its way to the tank, because its gas leaves it. B<sub>o</sub> is never below 1, so it can reduce the count but can never make it zero.', sweep: [1, 2] }
      ] });
  };
  Q.darcy = async () => {
    const base = () => { Object.assign(D, { dp: 60, kFree: 200, muFree: 1, L: 1, fluid: 'water' }); coreCalc(); };
    await say('Now question Darcy’s law. Some of its terms can stop the flow completely. Others can only slow it.');
    await interrogate({ tex: 'q = 1.127\\times10^{-3}\\,\\frac{' + v('k', 'k') + '\\,A\\,' + v('dp', '\\Delta p') + '}{' + v('mu', '\\mu') + '\\,' + v('L', 'L') + '}', resultName: 'rate', metric: () => D.q, show: (x) => fmt(x, 2) + ' <i>bbl/d</i>', eps: 0.0005, reset: base,
      zeroAsk: 'Stop the flow completely. There are two ways. Find both.', zeroDone: 'Only the terms on top can stop the flow. Watch what the ones underneath do.',
      vars: [
        { id: 'dp', sym: '\\Delta p', name: 'pressure difference', ctl: sl('dp', 'Pressure from the pump', 'psi', 0, 400, 1, 0, D, 'dp', coreCalc), zeroAt: 0, zeroWhy: 'No pressure difference, no flow. Fluid moves only from higher pressure to lower, however good the rock is.', tells: 'Δp is the push. The rate is proportional to it: a straight line through zero.', sweep: [0, 400] },
        { id: 'k', sym: 'k', name: 'permeability', ctl: sl('kFree', 'Permeability of the rock', 'md', 0, 1000, 10, 0, D, 'kFree', coreCalc), zeroAt: 0, zeroWhy: 'Pores that do not connect. A rock can be full of oil and give none of it. That is what a seal is.', tells: 'Permeability is how easily the rock lets fluid through. It belongs to the rock alone.', sweep: [0, 1000] },
        { id: 'mu', sym: '\\mu', name: 'viscosity', ctl: sl('muFree', 'Viscosity of the fluid', 'cp', 0.5, 100, 0.5, 1, D, 'muFree', coreCalc), tells: 'Viscosity is underneath. The thicker the fluid, the slower it moves: the curve falls fast, then flattens. It fades toward zero and never reaches it.', sweep: [0.5, 100] },
        { id: 'L', sym: 'L', name: 'length', ctl: sl('L', 'Length of the sample', 'ft', 0.25, 2, 0.01, 2, D, 'L', coreCalc), tells: 'Length is underneath too. What counts is the pressure drop per foot, so the same push over a longer path moves less.', sweep: [0.25, 2] }
      ] });
    D.kFree = D.muFree = null; coreCalc();
  };
  Q.skin = async () => {
    const K = { s: 0 }, LNR = Math.log(G.spec.re / G.spec.rw), paint = () => { G.read.dmg = K.s > 0.05 ? { a: Math.min(1, K.s / 14), w: 3.3 } : null; };
    await say('This one has no way to reach zero. Watch what the skin does instead.');
    await interrogate({ tex: 'J_D = \\frac{1}{\\ln(r_e / r_w) + ' + v('s', 's') + '}', resultName: 'dimensionless productivity index', metric: () => 1 / (LNR + K.s), show: (x) => fmt(x, 3), eps: 0, reset: () => { K.s = 0; paint(); },
      vars: [{ id: 's', sym: 's', name: 'skin', ctl: sl('s', 'Skin', '', -3, 40, 0.1, 1, K, 's', paint), tells: 'The skin is added to the logarithm underneath, which is about ' + fmt(LNR, 1) + ' for this well. Zero is clean rock. Positive is damage. Negative means the rock beside the well is better than the rest, as after a fracture.', sweep: [-3, 40] }] });
    await ask({ q: 'However large the skin becomes, does the well ever give exactly nothing?', options: ['Yes, once the skin is large enough', 'No: it keeps falling and never reaches zero', 'Yes, at any positive skin'], right: 1, why: 'One divided by a number that keeps growing gets small, but never zero. A badly damaged well is a poor well, not a dead one.' });
  };
  Q.up = async () => {
    const U6 = { S: 32 }, T = {}, at = (S) => T[S] || (T[S] = G.well.split(S)), apply = () => { const t = at(U6.S); G.over = { q: t.q, ptf: t.ptf, pwf: t.pwf, choke: true }; G.S = U6.S; };
    await say('Three terms add up to the pressure at the bottom. Question each one.');
    await interrogate({ tex: 'p_{wf} = ' + v('ptf', 'p_{tf}') + ' + ' + v('col', '\\Delta p_{\\text{column}}') + ' + ' + v('fr', '\\Delta p_{\\text{friction}}'), resultName: 'friction term', metric: () => at(U6.S).friction, eps: 0.01, reset: () => { U6.S = 32; apply(); },
      show: () => { const t = at(U6.S); return fmt(t.ptf) + ' + ' + fmt(t.column) + ' + ' + fmt(t.friction) + ' = ' + fmt(t.pwf) + ' <i>psi</i>'; },
      tellsFor: { ptf: 'The pressure at the top of the well, held there by the choke and the separator.', col: 'The weight of the fluid standing in the tubing. It is there whether the well flows or not, and it is by far the largest part.', fr: 'What rubbing along the pipe costs. It exists only while the fluid moves.' },
      zeroAsk: 'One of these three terms can be made exactly zero. Work out which, and do it.', zeroDone: 'The other two never vanish. A well always has to carry its own column.',
      vars: [{ id: 'fr', sym: '\\Delta p_{\\text{friction}}', name: 'choke opening', ctl: sl('S', 'Choke', '/64 in', 0, 64, 2, 0, U6, 'S', apply), zeroAt: 0, zeroWhy: 'Shut in, nothing moves, so nothing rubs. Friction is zero. The column is still there, pressing down.', tells: 'Open the choke and read the three numbers. The top pressure falls. Friction grows from nothing. The weight of the column changes only a little.', sweep: [0, 64] }] });
    G.over = null; G.S = 0; G.logged = false; G.stableFor = 0;
  };
  Q.rate = async () => {
    const I = { J: 1, pbar: 3700, pwf: 2700 }, J0 = +G.well0.J.toFixed(2), apply = () => { if (I.pwf > I.pbar) I.pwf = I.pbar; G.over = { q: I.J * (I.pbar - I.pwf), pwf: I.pwf, ptf: G.cur.ptf }; };
    await say('Last one, and the one you will use every day. Question it.');
    await interrogate({ tex: 'q = ' + v('J', 'J') + '\\,(' + v('pbar', '\\bar p') + ' - ' + v('pwf', 'p_{wf}') + ')', resultName: 'rate', metric: () => I.J * (I.pbar - I.pwf), show: (x) => fmt(x) + ' <i>bbl/d</i>', eps: 0.5, reset: () => { Object.assign(I, { J: J0, pbar: G.spec.pe, pwf: G.spec.pe - 1000 }); apply(); },
      zeroAsk: 'Make this well give nothing. There are two different ways. Find both.', zeroDone: 'No difference in pressure, or a rock that gives nothing. Either one is enough.',
      vars: [
        { id: 'pwf', sym: 'p_{wf}', name: 'bottomhole pressure', ctl: sl('pwf', 'Pressure at the bottom of the well', 'psi', 0, 5000, 10, 0, I, 'pwf', apply), zeroAt: () => I.pbar, zeroWhy: 'The well is at the same pressure as the rock. With no difference, nothing flows, however good the rock is.', tells: 'p<sub>wf</sub> is the pressure at the bottom of the well. Lower it and the rate rises in a straight line. At zero pressure you have the most this well could ever give.', sweep: [() => I.pbar, 0] },
        { id: 'J', sym: 'J', name: 'productivity index', ctl: sl('J', 'Productivity index', 'bbl/d per psi', 0, 4, 0.01, 2, I, 'J', apply), zeroAt: 0, zeroWhy: 'A rock that gives nothing for any drawdown.', tells: 'J is the barrels a day you get for each psi of drawdown. It is the steepness of the line.', sweep: [0, 4] },
        { id: 'pbar', sym: '\\bar p', name: 'reservoir pressure', ctl: sl('pbar', 'Reservoir pressure', 'psi', 1000, 5000, 10, 0, I, 'pbar', apply), tells: 'p̄ is the pressure of the reservoir. As a reservoir is produced it falls, and the rate falls with it, down to nothing when it meets the pressure in the well.', sweep: [5000, () => I.pwf] }
      ] });
    G.over = null; G.logged = false; G.stableFor = 0;
  };

  return [meet, phase, oil, darcy, skin, up, rate, units];
}
