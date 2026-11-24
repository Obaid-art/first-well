/* game/sim.js — the well of the game. Nothing here is scripted: the rate is where three tested pieces of physics.js meet.
     reservoir  q = J (p_e − p_wf)                         the productivity index, Eq. 1-6 of the second edition
     tubing     p_wf needed to lift q against p_tf         Hagedorn and Brown pressure traverse, Chapter 7
     choke      p_tf = 10 q GLR^0.546 / S^1.89 (psig)      Gilbert, Eq. 8-75, while the choke controls
   Declared simplifications: the well is stabilised at each setting (no transient); with the choke wide enough that Gilbert
   asks for less than the flowline pressure, the wellhead simply sits at the flowline pressure; the shut-in column is oil
   at its local density. Works in the browser and in node. */
export function createWell(PH, w) {
  const ln = Math.log(w.re / w.rw), J = w.k * w.h / (141.2 * w.B * w.mu * (ln + w.s));          // STB/d/psi
  const fluid = (q) => ({ qo: q / (1 + w.WOR), WOR: w.WOR, GLR: w.GLR, API: w.API, gg: w.gg, gw: 1.07, sigO: 30, sigW: 70 });
  const N = 40, bhp = (q, ptf) => PH.traverse({ method: 'HB', depth: w.depth, dL: w.depth / N, ptf, Tsurf: w.T, D: w.D, eps: 0.0006, fluid: fluid(q) }).pwf;
  const pwfOf = (q) => w.pe - q / J;
  // shut in: reservoir pressure at the bottom, a standing column of oil above it
  let ptfShut = w.pe; { const n = 80, dz = w.depth / n; for (let i = 0; i < n; i++) { const F = PH.wellboreFluids(Math.max(ptfShut, 50), w.T, fluid(1)); ptfShut -= F.rhol * dz / 144; } ptfShut = Math.max(ptfShut, 14.7); }
  const pb = PH.vbPb(w.GLR * (1 + w.WOR), w.T, w.API, w.gg);
  // the stabilised state at a choke of S sixty-fourths of an inch (0 = shut in): the rate at which the pressure the tubing needs
  // at the bottom, to lift q against what the choke holds at the top, is exactly what the reservoir still has there
  const cache = {};
  function operate(S) {
    if (S <= 0) return { S: 0, q: 0, pwf: w.pe, ptf: ptfShut, critical: true, shut: true };
    if (cache[S]) return cache[S];
    const need = (q) => Math.max(PH.chokeP1(q, w.GLR, S) + 14.7, w.pline), g = (q) => bhp(q, need(q)) - pwfOf(q);
    let a = 0.5, b = J * w.pe * 0.999; if (g(a) > 0) b = a; else for (let i = 0; i < 34; i++) { const m = (a + b) / 2; if (g(m) > 0) b = m; else a = m; }
    const q = (a + b) / 2, ptf = need(q);
    return cache[S] = { S, q, pwf: pwfOf(q), ptf, critical: PH.chokeP1(q, w.GLR, S) + 14.7 > w.pline, shut: false };
  }
  return { spec: w, J, pb, ptfShut, operate, pwfOf, bhp };
}

// A small deterministic generator, so that a student number always gives the same well and the same gauge noise.
export function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
export function hash(str) { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

/* The two kinds of well a class is dealt. They look alike in Act 1 and come apart in Act 2.
   'damaged': decent rock behind a ring of damage, in 2 7/8-in tubing. 'strangled': good clean rock behind 1.9-in tubing (1.61 in inside). */
export function dealWell(id) {
  const h = hash(id || 'well 7'), r = rng(h), kind = (h % 2) ? 'strangled' : 'damaged', v = (x, f) => x * (1 + f * (2 * r() - 1));
  const common = { h: 60, B: 1.2, mu: 1.0, re: 1490, rw: 0.328, depth: 8000, GLR: 250, WOR: 0, API: 35, gg: 0.65, T: 150, pline: 300 };
  const spec = kind === 'damaged' ? Object.assign({ kind, k: v(60, 0.10), s: 8, pe: v(3700, 0.04), D: 2.441 }, common)
    : Object.assign({ kind, k: v(120, 0.10), s: 0, pe: v(3700, 0.04), D: 1.61 }, common);
  spec.k = +spec.k.toFixed(1); spec.pe = Math.round(spec.pe / 5) * 5; spec.seed = h; return spec;
}

// What the instruments report. The truth stays in the model; a reading has a resolution and, for the rate, a repeatability.
export const KPA = 6.894757;                                                                       // kPa in one psi
export function instruments(seed) {
  const r = rng(seed ^ 0x9e3779b9);
  return { wellhead: (psi) => Math.round(psi / 5) * 5,                                           // dial gauge, psi, to the nearest 5
    downhole: (psi) => Math.round(psi * KPA / 10) * 10,                                            // the service company's gauge, kPa, to the nearest 10
    rate: (q) => q <= 0 ? 0 : Math.round(q * (1 + 0.012 * (2 * r() - 1))) };                       // test separator, bbl/d, repeatable to about 1 %
}

// The interval score (Gneiting and Raftery, 2007) for a forecast range [lo, hi] at 80 % coverage: its width plus a penalty for a miss. Lower is better.
export function intervalScore(lo, hi, x, alpha = 0.2) { return (hi - lo) + (2 / alpha) * Math.max(0, lo - x) + (2 / alpha) * Math.max(0, x - hi); }
