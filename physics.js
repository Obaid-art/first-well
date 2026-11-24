/* physics.js — every equation comes from Economides, Hill & Ehlig-Economides,
   Petroleum Production Systems (Prentice Hall, 1994). Oilfield units throughout:
   q STB/d, k md, h ft, p psi, mu cp, B res bbl/STB, t hours unless said otherwise.
   Each function names the equation it implements. Runs in Node and in the browser. */
(function (root) {
  const PH = {};

  // ---------- the book's example well (Appendix A) ----------
  PH.wellA = { name: 'Appendix A well', k: 8.2, kv: 0.9, h: 53, pi: 5651, pb: 1323, ct: 1.29e-5,
    mu: 1.7, B: 1.1, Rs: 150, phi: 0.19, Sw: 0.34, API: 28, rw: 0.328, re: 2980 };

  // ---------- special function ----------
  // E1(x) = -Ei(-x), x > 0. Abramowitz & Stegun 5.1.53 (x<1) and 5.1.56 (x>=1).
  PH.E1 = function (x) {
    if (x <= 0) return Infinity;
    if (x < 1) {
      return -Math.log(x) - 0.57721566 + x * (0.99999193 + x * (-0.24991055 + x * (0.05519968 + x * (-0.00976004 + x * 0.00107857))));
    }
    const num = (((x + 8.5733287401) * x + 18.0590169730) * x + 8.6347608925) * x + 0.2677737343;
    const den = (((x + 9.5733223454) * x + 25.6329561486) * x + 21.0996530827) * x + 3.9584969228;
    return Math.exp(-x) / x * num / den;
  };

  // ---------- Chapter 2: undersaturated oil inflow ----------
  // Eq. 2-3 in oilfield units: p(r,t) = pi - 70.6 q B mu/(k h) E1(948 phi mu ct r^2/(k t)), t in hours
  PH.pTransient = function (w, q, r, tHours) {
    const x = 948 * w.phi * w.mu * w.ct * r * r / (w.k * tHours);
    return w.pi - 70.6 * q * w.B * w.mu / (w.k * w.h) * PH.E1(x);
  };
  // Eq. 2-7 (+0.87 s, Problem 2-2): rate at constant pwf while infinite acting, t in hours
  PH.qTransient = function (w, pwf, tHours, s) {
    s = s || 0;
    const bracket = Math.log10(tHours) + Math.log10(w.k / (w.phi * w.mu * w.ct * w.rw * w.rw)) - 3.23 + 0.87 * s;
    return w.k * w.h * (w.pi - pwf) / (162.6 * w.B * w.mu) / bracket;
  };
  // Eq. 2-15 steady state (constant pressure pe at re)
  PH.qSteady = function (w, pe, pwf, s) {
    return w.k * w.h * (pe - pwf) / (141.2 * w.B * w.mu * (Math.log(w.re / w.rw) + (s || 0)));
  };
  // Eq. 2-30 pseudo-steady state with average pressure pbar
  PH.qPSS = function (w, pbar, pwf, s) {
    return w.k * w.h * (pbar - pwf) / (141.2 * w.B * w.mu * (Math.log(0.472 * w.re / w.rw) + (s || 0)));
  };
  // Eq. 2-37 general shape-factor form
  PH.qPSSshape = function (w, pbar, pwf, s, A_ft2, CA) {
    return w.k * w.h * (pbar - pwf) / (141.2 * w.B * w.mu * (0.5 * Math.log(4 * A_ft2 / (1.781 * CA * w.rw * w.rw)) + (s || 0)));
  };
  // Eq. 2-11 steady-state pressure profile from the sandface outward (no skin step)
  PH.pProfileSteady = function (w, q, pwf, r) {
    return pwf + 141.2 * q * w.B * w.mu / (w.k * w.h) * Math.log(r / w.rw);
  };
  // Eq. 2-24 pseudo-steady-state profile
  PH.pProfilePSS = function (w, q, pwf, r) {
    return pwf + 141.2 * q * w.B * w.mu / (w.k * w.h) * (Math.log(r / w.rw) - r * r / (2 * w.re * w.re));
  };
  // Eq. 2-12 pressure drop across the skin
  PH.dpSkin = function (w, q, s) { return 141.2 * q * w.B * w.mu * s / (w.k * w.h); };
  // Eq. 2-18 effective wellbore radius
  PH.rwEff = function (rw, s) { return rw * Math.exp(-s); };
  // Eq. 2-19 productivity index (steady state)
  PH.J = function (w, s) { return w.k * w.h / (141.2 * w.B * w.mu * (Math.log(w.re / w.rw) + (s || 0))); };
  // Eq. 2-35 onset of pseudo-steady state, hours (circle, tDA = 0.1)
  PH.tPSS = function (w) { return 1200 * w.phi * w.mu * w.ct * w.re * w.re / w.k; };
  PH.reFromAcres = function (A) { return Math.sqrt(A * 43560 / Math.PI); };
  // Eqs. 2-46 to 2-48 horizontal well (Joshi, augmented by Economides et al.)
  PH.qHorizontal = function (w, L, reH, dp, h, kv, seq) {
    h = h || w.h; kv = kv || w.kv; seq = seq || 0;
    const Iani = Math.sqrt(w.k / kv);
    const a = (L / 2) * Math.sqrt(0.5 + Math.sqrt(0.25 + Math.pow(2 * reH / L, 4)));
    const t1 = Math.log((a + Math.sqrt(a * a - (L / 2) * (L / 2))) / (L / 2));
    const t2 = (Iani * h / L) * (Math.log(Iani * h / (w.rw * (Iani + 1))) + seq);
    return { q: w.k * h * dp / (141.2 * w.B * w.mu * (t1 + t2)), a, Iani, t1, t2 };
  };
  // Eq. 2-53 equivalent vertical-well effective radius of a horizontal well
  PH.rwEffHorizontal = function (w, L, reH, h, kv) {
    h = h || w.h; kv = kv || w.kv;
    const r = PH.qHorizontal(w, L, reH, 1, h, kv);
    return reH / (Math.exp(r.t1) * Math.pow(r.Iani * h / (w.rw * (r.Iani + 1)), r.Iani * h / L));
  };

  // ---------- Chapter 5: skin ----------
  // Eq. 5-4 Hawkins
  PH.hawkins = function (kOverKs, rs, rw) { return (kOverKs - 1) * Math.log(rs / rw); };
  // Table 5-3 constants, Karakas & Tariq (1988)
  PH.perfConst = {
    0:   { a: 0.250, a1: -2.091, a2: 0.0453, b1: 5.1313, b2: 1.8672, c1: 1.6e-1, c2: 2.675 },
    180: { a: 0.500, a1: -2.025, a2: 0.0943, b1: 3.0373, b2: 1.8115, c1: 2.6e-2, c2: 4.532 },
    120: { a: 0.648, a1: -2.018, a2: 0.0634, b1: 1.6136, b2: 1.7770, c1: 6.6e-3, c2: 5.320 },
    90:  { a: 0.726, a1: -1.905, a2: 0.1038, b1: 1.5674, b2: 1.6935, c1: 1.9e-3, c2: 6.155 },
    60:  { a: 0.813, a1: -1.898, a2: 0.1023, b1: 1.3654, b2: 1.6490, c1: 3.0e-4, c2: 7.509 },
    45:  { a: 0.860, a1: -1.788, a2: 0.2398, b1: 1.1915, b2: 1.6392, c1: 4.6e-5, c2: 8.791 }
  };
  // Eqs. 5-9 to 5-18 perforation skin. rw, rperf, lperf in ft; spf shots per foot; theta deg; kHkV anisotropy
  PH.perfSkin = function (rw, rperf, lperf, spf, theta, kHkV) {
    const c = PH.perfConst[theta];
    const hperf = 1 / spf;
    const rwEff = c.a * (rw + lperf); // Eq. 5-11 with a_0 = 0.25 from Table 5-3 (reproduces Example 5-4 for 0 degrees)
    const sH = Math.log(rw / rwEff);
    const hD = (hperf / lperf) * Math.sqrt(kHkV);
    const rD = (rperf / (2 * hperf)) * (1 + Math.sqrt(1 / kHkV));
    const a = c.a1 * Math.log10(rD) + c.a2;
    const b = c.b1 * rD + c.b2;
    const sV = Math.pow(10, a) * Math.pow(hD, b - 1) * Math.pow(rD, b);
    const rwD = rw / (lperf + rw);
    const swb = c.c1 * Math.exp(c.c2 * rwD);
    return { sH, sV, swb, sp: sH + sV + swb, hD, rD, a, b, rwD, hperf };
  };
  // Tables 5-1 and 5-2 (Cinco-Ley et al., 1975). key hw/h|zw/h ; rows theta 0,15,30,45,60,75 ; [s_c+theta, s_c, s_theta]
  const T51 = {
    '0.1|0.95': [[20.810, 20.810, 0], [20.385, 20.810, -0.425], [18.948, 20.810, -1.861], [16.510, 20.810, -4.299], [12.662, 20.810, -8.147], [6.735, 20.810, -14.074]],
    '0.1|0.8': [[15.809, 15.809, 0], [15.449, 15.809, -0.36], [14.185, 15.809, -1.623], [12.127, 15.809, -3.682], [8.944, 15.809, -6.864], [4.214, 15.809, -11.594]],
    '0.1|0.6': [[15.257, 15.257, 0], [14.898, 15.257, -0.359], [13.636, 15.257, -1.621], [11.583, 15.257, -3.674], [8.415, 15.257, -6.842], [3.739, 15.257, -11.517]],
    '0.1|0.5': [[15.213, 15.213, 0], [14.854, 15.213, -0.359], [13.592, 15.213, -1.620], [11.540, 15.213, -3.673], [8.372, 15.213, -6.841], [3.699, 15.213, -11.514]],
    '0.25|0.875': [[8.641, 8.641, 0], [8.359, 8.641, -0.282], [7.487, 8.641, -1.154], [5.968, 8.641, -2.673], [3.717, 8.641, -4.924], [0.464, 8.641, -8.177]],
    '0.25|0.75': [[7.002, 7.002, 0], [6.750, 7.002, -0.251], [5.969, 7.002, -1.032], [4.613, 7.002, -2.388], [2.629, 7.002, -4.372], [-0.203, 7.002, -7.206]],
    '0.25|0.6': [[6.658, 6.658, 0], [6.403, 6.658, -0.249], [5.633, 6.658, -1.024], [4.290, 6.658, -2.447], [2.337, 6.658, -4.32], [0.418, 6.658, -7.076]],
    '0.25|0.5': [[6.611, 6.611, 0], [6.361, 6.611, -0.249], [5.587, 6.611, -1.023], [4.245, 6.611, -2.365], [2.295, 6.611, -4.315], [-0.451, 6.611, -7.062]],
    '0.5|0.75': [[3.067, 3.067, 0], [2.878, 3.067, -0.189], [2.308, 3.067, -0.759], [1.338, 3.067, -1.729], [-0.082, 3.067, -3.150], [-2.119, 3.067, -5.187]],
    '0.5|0.6': [[2.430, 2.430, 0], [2.254, 2.430, -0.176], [1.730, 2.430, -0.700], [0.838, 2.430, -1.592], [-0.466, 2.430, -2.897], [-2.341, 2.430, -4.772]],
    '0.5|0.5': [[2.369, 2.369, 0], [2.149, 2.369, -0.175], [1.672, 2.369, -0.697], [0.785, 2.369, -1.584], [-0.509, 2.369, -2.879], [-2.368, 2.369, -4.738]],
    '0.75|0.625': [[0.924, 0.924, 0], [0.778, 0.924, -0.145], [0.337, 0.924, -0.587], [-0.411, 0.924, -1.336], [-1.507, 0.924, -2.432], [-3.099, 0.924, -4.024]],
    '0.75|0.5': [[0.694, 0.694, 0], [0.554, 0.694, -0.139], [0.134, 0.694, -0.560], [-0.581, 0.694, -1.275], [-1.632, 0.694, -2.326], [-3.170, 0.694, -3.864]],
    '1|0.5': [[0, 0, 0], [-0.128, 0, -0.128], [-0.517, 0, -0.517], [-1.178, 0, -1.178], [-2.149, 0, -2.149], [-3.577, 0, -3.577]]
  };
  const T52 = {
    '0.1|0.95': [[41.521, 41.521, 0], [40.343, 41.521, -1.178], [36.798, 41.521, -4.722], [30.844, 41.521, -10.677], [22.334, 41.521, -19.187], [10.755, 41.521, -30.766]],
    '0.1|0.8': [[35.840, 35.840, 0], [34.744, 35.840, -1.095], [31.457, 35.840, -4.382], [25.973, 35.840, -9.867], [18.261, 35.840, -17.599], [8.003, 35.840, -27.837]],
    '0.1|0.6': [[35.290, 35.290, 0], [34.195, 35.290, -1.095], [30.910, 35.290, -4.380], [25.430, 35.290, -9.860], [17.710, 35.290, -17.580], [7.522, 35.290, -27.768]],
    '0.1|0.5': [[35.246, 35.246, 0], [34.151, 35.246, -1.095], [30.866, 35.246, -4.380], [25.386, 35.246, -9.860], [17.667, 35.246, -17.579], [7.481, 35.246, -27.765]],
    '0.25|0.875': [[15.733, 15.733, 0], [15.136, 15.733, -0.597], [13.344, 15.733, -2.389], [10.366, 15.733, -5.367], [6.183, 15.733, -9.550], [0.632, 15.733, -15.101]],
    '0.25|0.75': [[14.040, 14.040, 0], [13.471, 14.040, -0.569], [11.770, 14.040, -2.270], [8.959, 14.040, -5.081], [5.047, 14.040, -8.993], [-0.069, 14.040, -14.109]],
    '0.25|0.6': [[13.701, 13.701, 0], [13.133, 13.701, -0.568], [11.437, 13.701, -2.264], [8.638, 13.701, -5.063], [4.753, 13.701, -8.948], [-0.288, 13.701, -13.989]],
    '0.25|0.5': [[13.655, 13.655, 0], [13.087, 13.655, -0.568], [11.391, 13.655, -2.264], [8.593, 13.655, -5.062], [4.711, 13.655, -8.944], [-0.321, 13.655, -13.976]],
    '0.5|0.75': [[5.467, 5.467, 0], [5.119, 5.467, -0.348], [4.080, 5.467, -1.387], [2.363, 5.467, -3.104], [-0.031, 5.467, -5.498], [-3.203, 5.467, -8.670]],
    '0.5|0.6': [[4.837, 4.837, 0], [4.502, 4.837, -0.335], [3.503, 4.837, -1.334], [1.858, 4.837, -2.979], [-0.424, 4.837, -5.261], [-3.431, 4.837, -8.268]],
    '0.5|0.5': [[4.777, 4.777, 0], [4.443, 4.777, -0.334], [3.446, 4.777, -1.331], [1.806, 4.777, -2.971], [-0.467, 4.777, -5.244], [-3.458, 4.777, -8.235]],
    '0.75|0.625': [[1.735, 1.735, 0], [1.483, 1.735, -0.252], [0.731, 1.735, -1.004], [-0.512, 1.735, -2.247], [-2.253, 1.735, -3.988], [-4.595, 1.735, -6.330]],
    '0.75|0.5': [[1.508, 1.508, 0], [1.262, 1.508, -0.246], [0.528, 1.508, -0.980], [-0.683, 1.508, -2.191], [-2.380, 1.508, -3.888], [-4.665, 1.508, -6.173]],
    '1|0.5': [[0, 0, 0], [-0.206, 0, -0.206], [-0.824, 0, -0.824], [-1.850, 0, -1.850], [-3.298, 0, -3.298], [-5.282, 0, -5.282]]
  };
  PH.partialTable = { 100: T51, 1000: T52 };
  PH.partialOptions = function (hwh) {
    return Object.keys(T51).filter(k => k.split('|')[0] === String(hwh)).map(k => +k.split('|')[1]);
  };
  PH.partialSkin = function (hD, hwh, zwh, theta) {
    const tab = PH.partialTable[hD]; const row = tab[hwh + '|' + zwh]; if (!row) return null;
    const i = [0, 15, 30, 45, 60, 75].indexOf(theta); if (i < 0) return null;
    return { sct: row[i][0], sc: row[i][1], st: row[i][2] };
  };

  // ---------- Chapter 5, §5-7 / §5-8: damage mechanisms ----------
  // Example 5-8: capillary model, pores plugged when the throat is smaller than `factor` times the particle. r in cm. Returns kd/k.
  PH.poreThroatPlugging = function (rParticle, factor, Amin, Amax) { factor = factor || 7; Amin = Amin || 1e-10; Amax = Amax || 1e-4; const Ad = Math.PI * Math.pow(factor * rParticle, 2); return Math.max(0, (Amax - Ad) / (Amax - Amin)); };
  // Eq. 5-49 depth of filtrate invasion. C in in/hr^0.5 (in3/in2-hr^0.5), t hours, b cm3/cm2, gamma 1/s, rw in, phi. Returns rp in inches.
  PH.filtrateRadius = function (C, t, b, gamma, phi, rw) { return Math.sqrt(rw * rw + (2 * rw / phi) * (2 * C * Math.sqrt(t) + 3600 * b * gamma * t / 2.54)); };

  // ---------- Chapter 16: hydraulic fracturing ----------
  // Eqs. 16-2 to 16-5. H ft, rho lb/ft3, alpha Biot, nu Poisson, p reservoir psi, tect psi
  PH.stresses = function (H, rho, alpha, nu, p, tect) {
    const sv = rho * H / 144, svE = sv - alpha * p;
    const shE = nu / (1 - nu) * svE, sh = shE + alpha * p;
    return { sv, svE, shE, sh, sH: sh + (tect || 0) };
  };
  PH.pHydrostatic = function (H, rhoW) { return (rhoW || 55) * H / 144; };
  // Eq. 16-6 Terzaghi breakdown pressure, vertical well
  PH.pBreakdown = function (sh, sH, T0, p) { return 3 * sh - sH + T0 - p; };
  // Eq. 16-28
  PH.G = function (E, nu) { return E / (2 * (1 + nu)); };
  // Eq. 16-30 PKN Newtonian, inches; qi bpm, mu cp, xf ft, G psi; gamma = 0.75
  PH.pknWidth = function (qi, mu, nu, xf, G) {
    const wmax = 0.3 * Math.pow(qi * mu * (1 - nu) * xf / G, 0.25);
    return { wmax, wavg: wmax * Math.PI / 4 * 0.75 };
  };
  // Eq. 16-38 KGD Newtonian, inches
  PH.kgdWidth = function (qi, mu, nu, xf, G, hf) {
    const wmax = 0.29 * Math.pow(qi * mu * (1 - nu) * xf * xf / (G * hf), 0.25);
    return { wmax, wavg: wmax * Math.PI / 4 };
  };
  // Eq. 16-35 PKN non-Newtonian maximum width, inches; K' lbf s^n'/ft2, E psi
  PH.pknWidthPL = function (qi, Kp, np, xf, hf, E) {
    const e = 1 / (2 * np + 2);
    const c = Math.pow(128 / (3 * Math.PI) * (np + 1) * Math.pow((2 * np + 1) / np, np) * (0.9775 / 144) * Math.pow(5.61 / 60, np), e);
    const wmax = 12 * c * Math.pow(Math.pow(qi, np) * Kp * xf * Math.pow(hf, 1 - np) / E, e);
    return { wmax, wavg: wmax * Math.PI / 4 * 0.75 };
  };
  // Eqs. 16-56 / 16-57 net pressure, psi
  PH.netPressurePKN = function (G, qi, mu, nu, xf, hf) {
    return 0.0254 * Math.pow(Math.pow(G, 3) * qi * mu * xf / (Math.pow(1 - nu, 3) * Math.pow(hf, 4)), 0.25);
  };
  PH.netPressureKGD = function (G, qi, mu, nu, xf, hf) {
    return 0.050 * Math.pow(Math.pow(G, 3) * qi * mu / (Math.pow(1 - nu, 3) * hf * xf * xf), 0.25);
  };
  // Eq. 16-80
  PH.KL = function (eta) { return 0.5 * ((8 / 3) * eta + Math.PI * (1 - eta)); };
  // Eq. 16-79 material balance solved for injection time. xf, hf ft; w_in inches; CL ft/sqrt(min); rp = h/hf; qi bpm.
  // KLfixed: pass 1.5 to reproduce the book's shortcut (Example 16-10 does not iterate KL); omit to iterate Eq. 16-80.
  PH.fluidVolume = function (xf, hf, w_in, CL, rp, qi, KLfixed) {
    const Af = 2 * xf * hf, Vf = Af * w_in / 12; // ft3
    let KL = KLfixed || 1.5, ti = 0, eta = 0.5;
    for (let it = 0; it < (KLfixed ? 1 : 8); it++) {
      const a = qi * 5.615, b = -KL * CL * 2 * Af * rp, c = -Vf; // a t + b sqrt(t) + c = 0 in sqrt(t)
      const sq = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
      ti = sq * sq; eta = Vf / (a * ti); if (!KLfixed) KL = PH.KL(eta);
    }
    const Vi = qi * 42 * ti; // gal
    const Vpad = Vi * (1 - eta) / (1 + eta); // Eq. 16-77
    return { ti, Vi, eta, KL, Vpad, tpad: Vpad / (qi * 42), Vf_gal: Vf * 7.48, Af };
  };
  // xf(t) for a PKN Newtonian fracture with leakoff: march in xf, solve t with Eq. 16-79, invert. Returns t(min) -> state
  PH.pknGrowth = function (qi, mu, nu, E, hf, h, CL, xfMax) {
    const G = PH.G(E, nu), rp = h / hf, table = [];
    for (let i = 1; i <= 240; i++) {
      const xf = xfMax * i / 240; const w = PH.pknWidth(qi, mu, nu, xf, G);
      const r = PH.fluidVolume(xf, hf, w.wavg, CL, rp, qi);
      table.push({ xf, t: r.ti, w, eta: r.eta, dp: PH.netPressurePKN(G, qi, mu, nu, xf, hf), Vi: r.Vi });
    }
    const f = function (t) {
      if (t <= 0) return { xf: 0, w: { wmax: 0, wavg: 0 }, eta: 1, dp: 0, t: 0, Vi: 0 };
      let i = table.findIndex(e => e.t >= t);
      if (i < 0) return Object.assign({}, table[table.length - 1], { t, ended: true });
      if (i === 0) return Object.assign({}, table[0], { t });
      const a = table[i - 1], b = table[i], fr = (t - a.t) / (b.t - a.t);
      const L = (u, v) => u + (v - u) * fr;
      return { xf: L(a.xf, b.xf), w: { wmax: L(a.w.wmax, b.w.wmax), wavg: L(a.w.wavg, b.w.wavg) }, eta: L(a.eta, b.eta), dp: L(a.dp, b.dp), Vi: L(a.Vi, b.Vi), t };
    };
    f.table = table; f.tEnd = table[table.length - 1].t;
    return f;
  };
  // Eqs. 16-74 / 16-75 Simonson & Newberry height migration: net pressure to reach hu or hd (ft).
  // Constants 0.0217, 0.515, 0.0069; the inverse cosine in degrees; reproduces Example 16-9.
  PH.netPressureUp = function (hu, h, KIc, dsig, rho) {
    const deg = Math.acos(h / hu) * 180 / Math.PI;
    return (0.0217 / Math.sqrt(hu)) * (KIc * (1 - Math.sqrt(hu / h)) + 0.515 * dsig * Math.sqrt(hu) * deg) + 0.0069 * rho * (hu - 0.5 * h);
  };
  PH.netPressureDown = function (hd, h, KIc, dsig, rho) {
    const deg = Math.acos(h / hd) * 180 / Math.PI;
    return (0.0217 / Math.sqrt(hd)) * (KIc * (1 - Math.sqrt(hd / h)) + 0.515 * dsig * Math.sqrt(hd) * deg) - 0.0069 * rho * (hd - 0.5 * h);
  };
  PH.heightForNetPressure = function (dpf, h, KIc, dsig, rho, up) {
    // the downward curve is not monotone (gravity helps), so walk out from h to the first crossing, then bisect
    const f = up ? PH.netPressureUp : PH.netPressureDown;
    let lo = h * 1.0001, hi = lo; const step = h * 0.01, max = h * 50;
    while (hi < max && f(hi, h, KIc, dsig, rho) < dpf) { lo = hi; hi += step; }
    if (hi >= max) return max;
    for (let i = 0; i < 40; i++) { const m = 0.5 * (lo + hi); if (f(m, h, KIc, dsig, rho) < dpf) lo = m; else hi = m; }
    return 0.5 * (lo + hi);
  };
  // Eqs. 16-95, 16-96 proppant ramp
  PH.epsilon = function (eta) { return (1 - eta) / (1 + eta); };
  PH.cpRamp = function (t, tpad, ti, cf, eps) { return t <= tpad ? 0 : cf * Math.pow((t - tpad) / (ti - tpad), eps); };
  // Eqs. 16-99 to 16-104 propped width. cf ppg, Vslurry gal, phip, rhop lb/ft3
  PH.proppedWidth = function (cf, eps, Vslurry, xf, hf, phip, rhop) {
    const cbar = cf / (eps + 1), Mp = cbar * Vslurry, Cp = Mp / (2 * xf * hf);
    return { cbar, Mp, Cp, wp_ft: Cp / ((1 - phip) * rhop), wp_in: 12 * Cp / ((1 - phip) * rhop) };
  };
  // Eq. 16-17 dimensionless conductivity; Cinco-Ley & Samaniego (1981) correlation for sf + ln(xf/rw) (Fig. 16-6)
  PH.CfD = function (kfw, k, xf) { return kfw / (k * xf); };
  PH.fCfD = function (CfD) {
    const u = Math.log(CfD);
    return (1.65 - 0.328 * u + 0.116 * u * u) / (1 + 0.18 * u + 0.064 * u * u + 0.005 * u * u * u);
  };
  PH.fractureSkin = function (kfw, k, xf, rw) { const C = PH.CfD(kfw, k, xf); return { CfD: C, sf: PH.fCfD(C) - Math.log(xf / rw) }; };
  // Eq. 16-26 folds of increase, steady state
  PH.folds = function (re, rw, s0, sf) { return (Math.log(re / rw) + s0) / (Math.log(re / rw) + sf); };

  // ---------- Chapter 3: two-phase reservoirs ----------
  // the book's Appendix B well (saturated oil: pi = pb)
  PH.wellB = { name: 'Appendix B well', k: 13, h: 115, pi: 4350, pb: 4350, mu: 1.7, B: 1.37, API: 32, gg: 0.71, T: 180, Sw: 0.3, phi: 0.21, rw: 0.406, re: 1490, Rsb: 850, Bob: 1.43 };
  // smooth fits to Fig. B-1 (Bo, Bg, Rs against pressure) and Fig. B-2 (kro, krg against Sg); the fits pass through the values the book reads off the figures
  PH.figB1 = function (p) {
    const pb = 4350; const f = Math.min(p, pb) / pb;
    const Rs = 850 * Math.pow(f, 1.17);                 // 850 at pb, 550 at 3000
    const Bo = p <= pb ? 1 + 0.43 * Math.pow(f, 0.95) : 1.43 * Math.exp(-1.2e-5 * (p - pb)); // 1.43 at pb, 1.31 at 3000
    const z = 1 - 0.06 * (p / 1000) + 0.004 * Math.pow(p / 1000, 2);
    const Bg = 0.0283 * z * 640 / Math.max(p, 50);     // ft3/SCF at 180 F; 5e-3 at 3000
    return { Rs, Bo, Bg, z };
  };
  PH.figB2 = function (Sg) { return { kro: Math.exp(-19.5 * Sg), krg: Sg <= 0.01 ? 1e-4 : Math.pow(10, -4 + 27 * (Sg - 0.01)) }; };
  // Eq. 3-1 total formation volume factor (Bg in ft3/SCF)
  PH.Bt = function (Bo, Bg, Rsb, Rs) { return Bo + Bg / 5.615 * (Rsb - Rs); };
  // Vasquez & Beggs, Eqs. 3-6 to 3-14 (p psia, T F, API, gas gravity at 100 psig separator)
  PH.vbRs = function (p, T, API, ggs) { const A = API / (T + 460); return API <= 30 ? ggs * Math.pow(p, 1.0937) / 27.64 * Math.pow(10, 11.172 * A) : ggs * Math.pow(p, 1.187) / 56.06 * Math.pow(10, 10.393 * A); };
  PH.vbPb = function (Rs, T, API, ggs) { const A = API / (T + 460); return API <= 30 ? Math.pow(Rs * 27.64 / (ggs * Math.pow(10, 11.172 * A)), 1 / 1.0937) : Math.pow(Rs * 56.06 / (ggs * Math.pow(10, 10.393 * A)), 1 / 1.187); };
  PH.vbBo = function (Rs, T, API, ggs) { const F = (T - 60) * API / ggs; return API <= 30 ? 1 + 4.677e-4 * Rs + 1.751e-5 * F - 1.811e-8 * Rs * F : 1 + 4.67e-4 * Rs + 0.11e-4 * F + 0.1337e-8 * Rs * F; };
  PH.vbCo = function (Rs, T, API, ggs, p) { return (-1433 + 5 * Rs + 17.2 * T - 1180 * ggs + 12.61 * API) / (p * 1e5); };
  PH.vbBoAbove = function (Bob, co, pb, p) { return Bob * Math.exp(co * (pb - p)); };
  // Eq. 3-15 oil density below the bubble point, lb/ft3 (ggd dissolved-gas gravity)
  PH.rhoOil = function (API, ggd, Rs, Bo) { return (8830 / (131.5 + API) + 0.01361 * ggd * Rs) / Bo; };
  // Beggs & Robinson, Eqs. 3-17 to 3-25
  PH.muDead = function (T, API) { const c = 3.0324 - 0.02023 * API; const B = Math.pow(10, c); const A = B * Math.pow(T, -1.163); return Math.pow(10, A) - 1; };
  PH.muLive = function (muod, Rs) { const a = 10.715 * Math.pow(Rs + 100, -0.515), b = 5.44 * Math.pow(Rs + 150, -0.338); return a * Math.pow(muod, b); };
  PH.muAbove = function (muob, p, pb) { const m = 2.6 * Math.pow(p, 1.187) * Math.exp(-11.513 - 8.98e-5 * p); return muob * Math.pow(p / pb, m); };
  // Eq. 3-47 oil rate with relative permeability, steady state
  PH.qoRelperm = function (w, kro, pe, pwf, s) { return kro * w.k * w.h * (pe - pwf) / (141.2 * w.B * w.mu * (Math.log(w.re / w.rw) + (s || 0))); };
  // Eq. 3-48 with Problem 3-4's rule (each 0.02 of Sg per 200 psi below pb): integral of kro/(mu Bo) dp
  PH.qoIntegral = function (w, pwf, s, nSteps) {
    const n = nSteps || 200; let sum = 0; const dp = (w.pb - pwf) / n;
    for (let i = 0; i < n; i++) { const p = pwf + (i + 0.5) * dp; const Sg = 0.02 * (w.pb - p) / 200; const B = PH.figB1(p).Bo; const mu = w.mu; sum += PH.figB2(Sg).kro / (mu * B) * dp; }
    return w.k * w.h / (141.2 * (Math.log(w.re / w.rw) + (s || 0))) * sum;
  };
  // Eqs. 3-51 to 3-53 Vogel, pseudo-steady state
  PH.vogelQmax = function (w, pbar, s) { return w.k * w.h * pbar / (1.8 * 141.2 * w.B * w.mu * (Math.log(0.472 * w.re / w.rw) + (s || 0))); };
  PH.vogel = function (qmax, pwf, pbar) { const r = pwf / pbar; return qmax * (1 - 0.2 * r - 0.8 * r * r); };
  // Eqs. 3-55 to 3-58 generalized Vogel: straight line above pb, Vogel below. pD = ln(re/rw) steady, ln(0.472 re/rw) pseudo-steady
  PH.genVogel = function (w, pi, pb, pwf, s, pD) {
    const J = w.k * w.h / (141.2 * w.B * w.mu * (pD + (s || 0))); const qb = J * (pi - pb); const qV = pb * J / 1.8;
    if (pwf >= pb) return { q: J * (pi - pwf), qb, qV, J, above: J * (pi - pwf), below: 0 };
    const r = pwf / pb; const v = qV * (1 - 0.2 * r - 0.8 * r * r); return { q: qb + v, qb, qV, J, above: qb, below: v };
  };
  // Eq. 3-60 Fetkovich
  PH.fetkovich = function (qmax, n, pwf, pbar) { return qmax * Math.pow(1 - Math.pow(pwf / pbar, 2), n); };
  // two stabilized tests -> n and qmax (Section 3-6)
  PH.fetkovichFit = function (pbar, q1, pwf1, q2, pwf2) { const x1 = pbar * pbar - pwf1 * pwf1, x2 = pbar * pbar - pwf2 * pwf2; const n = Math.log(q2 / q1) / Math.log(x2 / x1); const C = q1 / Math.pow(x1, n); return { n, C, qmax: C * Math.pow(pbar * pbar, n) }; };

  // ---------- Chapter 4: natural gas ----------
  // the book's Appendix C well
  PH.wellC = { name: 'Appendix C well', k: 0.17, h: 78, pi: 4613, Zi: 0.945, mui: 0.0244, T: 180, TR: 640, Sw: 0.27, Sg: 0.73, phi: 0.14, gg: 0.65, rw: 0.328, re: 1490, Tpc: 378, Ppc: 671, MW: 18.92 };
  // Table 4-1
  PH.gasComponents = {
    C1: { name: 'methane', MW: 16.04, Pc: 673, Tc: 344 }, C2: { name: 'ethane', MW: 30.07, Pc: 709, Tc: 550 }, C3: { name: 'propane', MW: 44.09, Pc: 618, Tc: 666 },
    iC4: { name: 'iso-butane', MW: 58.12, Pc: 530, Tc: 733 }, nC4: { name: 'n-butane', MW: 58.12, Pc: 551, Tc: 766 }, iC5: { name: 'iso-pentane', MW: 72.15, Pc: 482, Tc: 830 }, nC5: { name: 'n-pentane', MW: 72.15, Pc: 485, Tc: 847 },
    nC6: { name: 'n-hexane', MW: 86.17, Pc: 434, Tc: 915 }, nC7: { name: 'n-heptane', MW: 100.2, Pc: 397, Tc: 973 }, nC8: { name: 'n-octane', MW: 114.2, Pc: 361, Tc: 1024 },
    N2: { name: 'nitrogen', MW: 28.02, Pc: 492, Tc: 227 }, CO2: { name: 'carbon dioxide', MW: 44.01, Pc: 1072, Tc: 548 }, H2S: { name: 'hydrogen sulfide', MW: 34.08, Pc: 1306, Tc: 673 }
  };
  PH.appendixCgas = { C1: 0.875, C2: 0.083, C3: 0.021, iC4: 0.006, nC4: 0.002, iC5: 0.003, nC5: 0.008, nC6: 0.001, nC8: 0.001 };
  // Eq. 4-1 and Kay's rule (Example 4-2, Table 4-2)
  PH.gasMixture = function (comp) {
    let MW = 0, Ppc = 0, Tpc = 0, sum = 0;
    for (const k in comp) { const c = PH.gasComponents[k], y = comp[k]; if (!c || !y) continue; MW += y * c.MW; Ppc += y * c.Pc; Tpc += y * c.Tc; sum += y; }
    return { MW: MW / sum, gg: MW / sum / 28.97, Ppc: Ppc / sum, Tpc: Tpc / sum, yH2S: (comp.H2S || 0) / sum, yCO2: (comp.CO2 || 0) / sum, yN2: (comp.N2 || 0) / sum };
  };
  // Fig. 4-2 from gas gravity (Standing's fit to Brown et al.)
  PH.pseudoFromGravity = function (gg) { return { Tpc: 168 + 325 * gg - 12.5 * gg * gg, Ppc: 677 + 15 * gg - 37.5 * gg * gg }; };
  // Wichert & Aziz, Eqs. 4-6, 4-7 with the Fig. 4-3 factor in closed form
  PH.wichertAziz = function (Tpc, Ppc, yH2S, yCO2) {
    const A = yH2S + yCO2, B = yH2S; const e3 = 120 * (Math.pow(A, 0.9) - Math.pow(A, 1.6)) + 15 * (Math.pow(B, 0.5) - Math.pow(B, 4));
    const Tpc2 = Tpc - e3; const Ppc2 = Ppc * Tpc2 / (Tpc + B * (1 - B) * e3); return { Tpc: Tpc2, Ppc: Ppc2, e3 };
  };
  // Standing–Katz chart (Fig. 4-1) as the Dranchuk–Abou-Kassem equation of state
  PH.Zfactor = function (Ppr, Tpr) {
    const A = [0.3265, -1.0700, -0.5339, 0.01569, -0.05165, 0.5475, -0.7361, 0.1844, 0.1056, 0.6134, 0.7210];
    let Z = 1;
    for (let i = 0; i < 200; i++) {
      const r = 0.27 * Ppr / (Z * Tpr), r2 = r * r;
      const Znew = 1 + (A[0] + A[1] / Tpr + A[2] / Math.pow(Tpr, 3) + A[3] / Math.pow(Tpr, 4) + A[4] / Math.pow(Tpr, 5)) * r + (A[5] + A[6] / Tpr + A[7] / (Tpr * Tpr)) * r2 - A[8] * (A[6] / Tpr + A[7] / (Tpr * Tpr)) * Math.pow(r, 5) + A[9] * (1 + A[10] * r2) * (r2 / Math.pow(Tpr, 3)) * Math.exp(-A[10] * r2);
      const next = 0.5 * (Z + Znew); if (Math.abs(next - Z) < 1e-7) { Z = next; break; } Z = next;
    }
    return Z;
  };
  // Lee, Gonzalez & Eakin viscosity (stands in for the Carr et al. charts, Figs. 4-4, 4-5); MW, p psia, T R, Z
  PH.gasViscosity = function (MW, p, TR, Z) {
    const rho = 1.4935e-3 * p * MW / (Z * TR); const K = (9.4 + 0.02 * MW) * Math.pow(TR, 1.5) / (209 + 19 * MW + TR); const X = 3.5 + 986 / TR + 0.01 * MW, Y = 2.4 - 0.2 * X;
    return 1e-4 * K * Math.exp(X * Math.pow(rho, Y));
  };
  // Eq. 4-13 (res ft3/SCF) and Eq. 4-19 (1/psi, numerical slope)
  PH.Bg = function (Z, TR, p) { return 0.0283 * Z * TR / p; };
  PH.cg = function (p, Tpr, Ppc) { const Z = PH.Zfactor(p / Ppc, Tpr), dp = Math.max(1, p * 1e-3); const dZ = (PH.Zfactor((p + dp) / Ppc, Tpr) - PH.Zfactor((p - dp) / Ppc, Tpr)) / (2 * dp); return 1 / p - dZ / Z; };
  // gas in place, SCF: Eq. 1-4 with Bg in ft3/SCF
  PH.OGIP = function (A, h, phi, Sw, Bg) { return 43560 * A * h * phi * (1 - Sw) / Bg; };
  // Table 4-5: the Appendix C fluid; p psi, mu cp, Z, m(p) psi2/cp
  PH.table45 = [[100, 0.0113, 0.991, 8.917e5], [200, 0.0116, 0.981, 3.548e6], [300, 0.0118, 0.972, 7.931e6], [400, 0.0120, 0.964, 1.401e7], [500, 0.0123, 0.955, 2.174e7], [600, 0.0125, 0.947, 3.108e7], [700, 0.0127, 0.939, 4.202e7], [800, 0.0130, 0.931, 5.450e7], [900, 0.0132, 0.924, 6.849e7], [1000, 0.0135, 0.917, 8.396e7],
    [1100, 0.0137, 0.910, 1.009e8], [1200, 0.0140, 0.904, 1.192e8], [1300, 0.0142, 0.899, 1.389e8], [1400, 0.0145, 0.894, 1.598e8], [1500, 0.0147, 0.889, 1.821e8], [1600, 0.0150, 0.885, 2.056e8], [1700, 0.0153, 0.881, 2.303e8], [1800, 0.0155, 0.878, 2.562e8], [1900, 0.0158, 0.876, 2.831e8], [2000, 0.0161, 0.874, 3.111e8],
    [2100, 0.0163, 0.872, 3.401e8], [2200, 0.0166, 0.872, 3.700e8], [2300, 0.0169, 0.871, 4.009e8], [2400, 0.0171, 0.871, 4.326e8], [2500, 0.0174, 0.872, 4.651e8], [2600, 0.0177, 0.873, 4.984e8], [2700, 0.0180, 0.875, 5.324e8], [2800, 0.0183, 0.877, 5.670e8], [2900, 0.0185, 0.879, 6.023e8], [3000, 0.0188, 0.882, 6.381e8],
    [3100, 0.0191, 0.885, 6.745e8], [3200, 0.0194, 0.889, 7.114e8], [3300, 0.0197, 0.893, 7.487e8], [3400, 0.0200, 0.897, 7.864e8], [3500, 0.0203, 0.902, 8.245e8], [3600, 0.0206, 0.907, 8.630e8], [3700, 0.0208, 0.912, 9.018e8], [3800, 0.0211, 0.917, 9.408e8], [3900, 0.0214, 0.923, 9.802e8], [4000, 0.0217, 0.929, 1.020e9],
    [4100, 0.0220, 0.935, 1.059e9], [4200, 0.0223, 0.941, 1.099e9], [4300, 0.0226, 0.947, 1.139e9], [4400, 0.0229, 0.954, 1.180e9], [4500, 0.0232, 0.961, 1.220e9], [4600, 0.0235, 0.967, 1.260e9], [4700, 0.0238, 0.974, 1.301e9], [4800, 0.0241, 0.982, 1.342e9], [4900, 0.0244, 0.989, 1.382e9], [5000, 0.0247, 0.996, 1.423e9]];
  PH.fluidC = function (p) { // linear interpolation in Table 4-5 (below 100 psi: m ~ p^2 scaling of the first row)
    const t = PH.table45; if (p <= 100) { const f = p / 100; return { mu: t[0][1], Z: t[0][2], m: t[0][3] * f * f }; }
    if (p >= 5000) { const a = t[t.length - 1], b = t[t.length - 2]; const f = (p - a[0]) / 100; return { mu: a[1] + (a[1] - b[1]) * f, Z: a[2] + (a[2] - b[2]) * f, m: a[3] + (a[3] - b[3]) * f }; }
    const i = Math.floor(p / 100) - 1; const a = t[i], b = t[i + 1]; const f = (p - a[0]) / 100;
    return { mu: a[1] + (b[1] - a[1]) * f, Z: a[2] + (b[2] - a[2]) * f, m: a[3] + (b[3] - a[3]) * f };
  };
  // Eq. 4-51 from any mu(p), Z(p): m(p) = 2 ∫ p/(mu Z) dp
  PH.pseudoPressure = function (p, muZ, n) { n = n || 200; let s = 0; const dp = p / n; for (let i = 0; i < n; i++) { const x = (i + 0.5) * dp; s += 2 * x / muZ(x) * dp; } return s; };
  // Eqs. 4-23 / 4-24: pressure-squared deliverability, MSCF/d; mu cp, Z, TR degrees R
  PH.qGasP2 = function (w, pe, pwf, mu, Z, s, pss) { const L = pss ? Math.log(0.472 * w.re / w.rw) : Math.log(w.re / w.rw); return w.k * w.h * (pe * pe - pwf * pwf) / (1424 * mu * Z * w.TR * (L + (s || 0))); };
  // Eqs. 4-32 / 4-33 non-Darcy: a q + b q^2 = pbar^2 - pwf^2 ; returns q (MSCF/d) and the coefficients
  PH.gasDeliverability = function (w, pbar, pwf, mu, Z, s, D) {
    const a = 1424 * mu * Z * w.TR / (w.k * w.h) * (Math.log(0.472 * w.re / w.rw) + (s || 0)); const b = 1424 * mu * Z * w.TR * (D || 0) / (w.k * w.h);
    const dp2 = pbar * pbar - pwf * pwf; const q = b > 0 ? (-a + Math.sqrt(a * a + 4 * b * dp2)) / (2 * b) : dp2 / a;
    return { q, a, b, qDarcy: dp2 / a };
  };
  // Eqs. 4-30 / 4-31 time to stabilized flow (rd = 0.472 re), hours
  PH.tStabilized = function (w, mu, ct) { return Math.pow(0.472 * w.re / (1.5 * w.rw), 2) * w.phi * mu * ct * w.rw * w.rw / (0.000264 * w.k); };
  // Eq. 4-34 non-Darcy coefficient, 1/(MSCF/d)
  PH.nonDarcyD = function (gg, ks, h, mu, rw, hperf) { return 6e-5 * gg * Math.pow(ks, -0.1) * h / (mu * rw * hperf * hperf); };
  // Eq. 4-60 transient gas rate with pseudo-pressure, MSCF/d; t hours; mu_i, ct at initial conditions
  PH.qGasTransient = function (w, mpi, mpwf, tHours, mui, ct, s) {
    const bracket = Math.log10(tHours) + Math.log10(w.k / (w.phi * mui * ct * w.rw * w.rw)) - 3.23 + 0.87 * (s || 0);
    return w.k * w.h * (mpi - mpwf) / (1638 * w.TR) / bracket;
  };
  // Eq. 4-54 stabilized rate with pseudo-pressure, pss
  PH.qGasM = function (w, mpbar, mpwf, s, D) { const L = Math.log(0.472 * w.re / w.rw) + (s || 0); const A = w.k * w.h * (mpbar - mpwf) / (1424 * w.TR); if (!D) return A / L; return (-L + Math.sqrt(L * L + 4 * D * A)) / (2 * D); };
  // Eq. 4-65 horizontal gas well, steady state, p^2 form (D q term inside the second brace)
  PH.qGasHorizontal = function (w, L, reH, pe, pwf, mu, Z, Iani, s, D) {
    const a = (L / 2) * Math.sqrt(0.5 + Math.sqrt(0.25 + Math.pow(2 * reH / L, 4)));
    const t1 = Math.log((a + Math.sqrt(a * a - (L / 2) * (L / 2))) / (L / 2)); const f = Iani * w.h / L; const base = Math.log(Iani * w.h / (w.rw * (Iani + 1))) + (s || 0);
    const num = w.k * w.h * (pe * pe - pwf * pwf) / (1424 * mu * Z * w.TR);
    if (!D) return { q: num / (t1 + f * base), a, t1 }; // with D: q (t1 + f base) + f D q^2 = num
    const A = f * D, B = t1 + f * base; return { q: (-B + Math.sqrt(B * B + 4 * A * num)) / (2 * A), a, t1 };
  };

  // ---------- Chapter 1 helpers ----------
  PH.OOIP = function (A, h, phi, Sw, Bo) { return 7758 * A * h * phi * (1 - Sw) / Bo; };
  PH.gammaOil = function (API) { return 141.5 / (131.5 + API); };

  // ---------- Chapter 7: wellbore flow performance ----------
  // Tubing inside diameters, in (API sizes named by OD and weight)
  PH.tubingID = { '2 3/8 in, 4.7 lb/ft': 1.995, '2 7/8 in, 6.5 lb/ft': 2.441, '2 7/8 in, 8.6 lb/ft': 2.259, '3 1/2 in, 9.3 lb/ft': 2.992, '3 1/2 in, 12.7 lb/ft': 2.750, '4 1/2 in, 12.75 lb/ft': 3.958, '7 in casing, 32 lb/ft': 6.094 };
  PH.pipeArea = function (Din) { return Math.PI / 4 * Math.pow(Din / 12, 2); };                    // ft2
  PH.velocity = function (qbbl, Din) { return qbbl * 5.615 / 86400 / PH.pipeArea(Din); };           // Eq. 7-4, ft/s
  // Eq. 7-7 Reynolds number: q bbl/d, rho lb/ft3, D in, mu cp
  PH.reynolds = function (qbbl, rho, Din, mu) { return 1.48 * qbbl * rho / (Din * mu); };
  // Eq. 7-55 Reynolds number of a gas from the standard-condition rate, q MSCF/d
  PH.reynoldsGas = function (gg, qMSCF, Din, mu) { return 20.09 * gg * qMSCF / (Din * mu); };
  // Eqs. 7-8 and 7-12: u/umax against r/R for laminar and turbulent flow
  PH.profileLaminar = function (x) { return 1 - x * x; };
  PH.profileTurbulent = function (x) { return Math.pow(Math.max(0, 1 - Math.abs(x)), 1 / 7); };
  // Fanning friction factor: Eq. 7-32 (laminar) and the Chen equation, Eq. 7-35 (turbulent); eps = relative roughness k/D
  PH.fanning = function (NRe, eps) {
    if (NRe < 2100) return 16 / Math.max(NRe, 1e-9);
    const A = Math.pow(eps, 1.1098) / 2.8257 + Math.pow(7.149 / NRe, 0.8981);
    const x = eps / 3.7065 - 5.0452 / NRe * Math.log10(A);
    return Math.pow(-4 * Math.log10(x), -2);
  };
  // Eq. 7-34 Colebrook–White, iterated from the Chen value (the Moody chart itself)
  PH.colebrook = function (NRe, eps) { let f = PH.fanning(NRe, eps); if (NRe < 2100) return f; for (let i = 0; i < 40; i++) { const g = -4 * Math.log10(eps / 3.7065 + 1.2613 / (NRe * Math.sqrt(f))); f = 1 / (g * g); } return f; };
  // Eq. 7-19 potential-energy pressure drop, psi: rho lb/ft3, L ft along the pipe, theta deg from horizontal (+90 = flowing up). Positive = pressure falls along the flow.
  PH.dpPE = function (rho, L, thetaDeg) { return rho * L * Math.sin(thetaDeg * Math.PI / 180) / 144; };
  // Eq. 7-27 kinetic-energy drop for a change of diameter, psi: q bbl/d, D in. The constant that follows from Eq. 7-27 is 1.53e-8 (the book prints 1.3e-8, and 0.28 psi for Example 7-3; the equation gives 0.21).
  PH.dpKE = function (qbbl, rho, D1, D2) { return 1.53e-8 * qbbl * qbbl * rho * (1 / Math.pow(D2, 4) - 1 / Math.pow(D1, 4)); };
  // Eq. 7-31 Fanning frictional drop, psi: u ft/s, L ft, D in
  PH.dpFriction = function (f, rho, u, L, Din) { return 2 * f * rho * u * u * L / (32.17 * Din / 12) / 144; };
  // A single-phase liquid in a pipe (Examples 7-2, 7-4): {q bbl/d, rho, mu, D in, L ft, theta deg, eps, p1}
  PH.liquidPipe = function (o) {
    const u = PH.velocity(o.q, o.D), NRe = PH.reynolds(o.q, o.rho, o.D, o.mu), f = PH.fanning(NRe, o.eps || 0);
    const dpPE = PH.dpPE(o.rho, o.L, o.theta), dpF = PH.dpFriction(f, o.rho, u, o.L, o.D), dp = dpPE + dpF;
    return { u, NRe, f, laminar: NRe < 2100, dpPE, dpF, dp, p2: o.p1 != null ? o.p1 - dp : null };
  };
  // Eq. 7-44 gas density, lb/ft3 (p psia, T R)
  PH.rhoGas = function (gg, p, Z, TR) { return 28.97 * gg * p / (Z * 10.73 * TR); };
  // Eqs. 7-52 to 7-56: a gas in a pipe with average Z, T and mu. {q MSCF/d, D in, L ft, theta deg (+ = flowing up), gg, Z, TR, mu, eps, p1 or p2}.
  // Given the downstream p2 returns the upstream p1 (Eq. 7-56, bottomhole from wellhead); given p1 returns p2 (Eq. 7-52). Horizontal: Eq. 7-54.
  PH.gasPipe = function (o) {
    const sin = Math.sin(o.theta * Math.PI / 180), NRe = PH.reynoldsGas(o.gg, o.q, o.D, o.mu), f = PH.fanning(NRe, o.eps || 0);
    const s = -0.0375 * o.gg * sin * o.L / (o.Z * o.TR), K = 2.685e-3 * f * Math.pow(o.Z * o.TR * o.q, 2) / Math.pow(o.D, 5);
    let p1 = o.p1, p2 = o.p2;
    if (Math.abs(sin) < 1e-6) { const dpF2 = 1.007e-4 * o.gg * f * o.Z * o.TR * o.q * o.q * o.L / Math.pow(o.D, 5); if (p2 != null) p1 = Math.sqrt(p2 * p2 + dpF2); else p2 = Math.sqrt(Math.max(0, p1 * p1 - dpF2)); }
    else if (p2 != null) p1 = Math.sqrt(Math.exp(-s) * p2 * p2 - K * (1 - Math.exp(-s)) / sin);
    else p2 = Math.sqrt(Math.max(0, Math.exp(s) * p1 * p1 + K * (Math.exp(s) - 1) / sin));
    const p1h = Math.abs(sin) < 1e-6 ? p2 : Math.sqrt(Math.exp(-s) * p2 * p2); // the hydrostatic part alone (f = 0), for display
    return { s, NRe, f, p1, p2, dpHydro: p1h - p2, dpFric: p1 - p1h };
  };
  // A gas well in n segments with a linear temperature; Z and mu from the correlations at each segment's mean p and T (Example 7-5 done in segments).
  // {q, D, L measured ft, theta, gg, Tpc, Ppc, Tsurf F, Tbh F, ptf, eps, n}
  PH.gasWellTraverse = function (o) {
    const n = o.n || 1, dL = o.L / n, prof = [{ L: 0, p: o.ptf, T: o.Tsurf }]; let p = o.ptf;
    for (let i = 0; i < n; i++) {
      const T1 = o.Tsurf + (o.Tbh - o.Tsurf) * i / n, T2 = o.Tsurf + (o.Tbh - o.Tsurf) * (i + 1) / n, TR = (T1 + T2) / 2 + 460;
      let pm = p, Z = 1, mu = 0.013, pin = p;
      for (let it = 0; it < 8; it++) { Z = o.fixZ || PH.Zfactor(pm / o.Ppc, TR / o.Tpc); mu = o.fixMu || PH.gasViscosity(28.97 * o.gg, pm, TR, Z); pin = PH.gasPipe({ q: o.q, D: o.D, L: dL, theta: o.theta, gg: o.gg, Z, TR, mu, eps: o.eps, p2: p }).p1; pm = (p + pin) / 2; }
      p = pin; prof.push({ L: dL * (i + 1), p, T: T2, Z, mu });
    }
    return { pwf: p, profile: prof };
  };
  // Problem 7-2: the gas rate that a wellhead pressure and a bottomhole pressure allow (bisection on Eq. 7-56)
  PH.gasRateForPwf = function (o, pwf) { let lo = 1, hi = 2e5; for (let i = 0; i < 60; i++) { const m = Math.sqrt(lo * hi); const p1 = PH.gasWellTraverse(Object.assign({}, o, { q: m })).pwf; if (p1 < pwf) lo = m; else hi = m; } return Math.sqrt(lo * hi); };
  // Eqs. 7-64 to 7-67: the kinetic-energy drop in a gas well, psi (average density; the book calls it approximate)
  PH.dpKEgas = function (q, D, gg, p1, Z1, T1R, p2, Z2, T2R) {
    const A = PH.pipeArea(D), u = (p, Z, T) => Z * (14.7 / p) * (T / 520) * q * 1000 / 86400 / A;
    const u1 = u(p1, Z1, T1R), u2 = u(p2, Z2, T2R), rho = PH.rhoGas(gg, (p1 + p2) / 2, (Z1 + Z2) / 2, (T1R + T2R) / 2);
    return rho * (u2 * u2 - u1 * u1) / (2 * 32.17) / 144;
  };

  // ----- two-phase flow -----
  // Eq. 7-81: holdup of the denser phase from the slip velocity and the two superficial velocities (any consistent units)
  PH.holdupFromSlip = function (us, usg, usl) { if (us < 1e-9) return usl / (usl + usg); const b = us - usg - usl; return (b + Math.sqrt(b * b + 4 * us * usl)) / (2 * us); };
  // Eq. 7-80: slip velocity from the holdup
  PH.slipFromHoldup = function (usg, usl, yl) { return usg / (1 - yl) - usl / yl; };
  // Eqs. 7-86, 7-87 Duns & Ros velocity numbers (u ft/s, rho lb/ft3, sigma dyn/cm) and the region of Fig. 7-10 (boundaries read off the figure: I/II at N_vg = 2 + 1.4 N_vl; II/transition at 50 + 36 N_vl; transition/III at 75 + 84 N_vl^0.75)
  PH.dunsRos = function (usl, usg, rhol, sigma) {
    const k = 1.938 * Math.pow(rhol / sigma, 0.25), Nvl = k * usl, Nvg = k * usg;
    const b12 = 2 + 1.4 * Nvl, b2t = 50 + 36 * Nvl, bt3 = 75 + 84 * Math.pow(Nvl, 0.75);
    const region = Nvg < b12 ? 'I' : Nvg < b2t ? 'II' : Nvg < bt3 ? 'transition' : 'III';
    return { Nvl, Nvg, region, b12, b2t, bt3, name: { I: 'Region I · bubble and slow slug', II: 'Region II · fast slug and churn', transition: 'transition to mist', III: 'Region III · annular mist' }[region] };
  };
  // Hagedorn & Brown chart fits (Figs. 7-12 to 7-14)
  PH.hbCNL = function (NL) { return (0.0019 + 0.0322 * NL - 0.6642 * NL * NL + 4.9951 * Math.pow(NL, 3)) / (1 - 10.0147 * NL + 33.8696 * NL * NL + 277.2817 * Math.pow(NL, 3)); };
  PH.hbHoldupPsi = function (H) { return Math.min(1, Math.sqrt((0.0047 + 1123.32 * H + 729489.64 * H * H) / (1 + 1097.1566 * H + 722153.97 * H * H))); };
  PH.hbPsi = function (B) { if (B <= 0.01) return 1; B = Math.min(B, 0.09); const v = (1.0886 - 69.9473 * B + 2334.3497 * B * B - 12896.683 * Math.pow(B, 3)) / (1 - 53.4401 * B + 1517.9369 * B * B - 8419.8115 * Math.pow(B, 3)); return Math.max(1, v); };
  // The modified Hagedorn & Brown pressure gradient (§7-4.3), vertical upward flow. In-situ rates ql, qg ft3/s; rho lb/ft3; mu cp; sigma dyn/cm; D in; p psia; eps relative roughness.
  PH.hagedornBrown = function (o) {
    const A = PH.pipeArea(o.D), Dft = o.D / 12, usl = o.ql / A, usg = o.qg / A, um = usl + usg, lamL = um > 0 ? usl / um : 1, lamG = 1 - lamL;
    const LB = Math.max(0.13, 1.071 - 0.2218 * um * um / Dft), bubble = lamG < LB;
    const k = Math.pow(o.rhol / o.sigma, 0.25), Nvl = 1.938 * usl * k, Nvg = 1.938 * usg * k, ND = 120.872 * Dft * Math.sqrt(o.rhol / o.sigma), NL = 0.15726 * o.mul * Math.pow(1 / (o.rhol * Math.pow(o.sigma, 3)), 0.25);
    const ml = A * usl * o.rhol * 86400, mg = A * usg * o.rhog * 86400, m = ml + mg;
    let yl, f, NRe, dpdzF, CNL = null, H = null, B = null, psi = null, ylRaw = null, regime;
    if (usg <= 1e-9) { regime = 'single-phase liquid'; yl = 1; NRe = 1488 * o.rhol * usl * Dft / o.mul; f = PH.fanning(Math.max(NRe, 1), o.eps || 0); dpdzF = 2 * f * o.rhol * usl * usl / (32.17 * Dft) / 144; }
    else if (bubble) { // Griffith correlation, Eqs. 7-106 to 7-111
      regime = 'bubble (Griffith)'; const us = 0.8, r = um / us; ylRaw = 1 - 0.5 * (1 + r - Math.sqrt(Math.max(0, (1 + r) * (1 + r) - 4 * usg / us))); yl = Math.max(ylRaw, lamL);
      NRe = 2.2e-2 * ml / (Dft * o.mul); f = PH.fanning(Math.max(NRe, 1), o.eps || 0);
      dpdzF = f * ml * ml / (7.413e10 * Math.pow(Dft, 5) * o.rhol * yl * yl) / 144;
    } else { // the original correlation, Eqs. 7-93 to 7-105
      regime = 'Hagedorn–Brown'; CNL = PH.hbCNL(NL); H = Nvl * Math.pow(o.p / 14.7, 0.1) * CNL / (Math.pow(Nvg, 0.575) * ND); B = Nvg * Math.pow(NL, 0.38) / Math.pow(ND, 2.14); psi = PH.hbPsi(B);
      ylRaw = Math.min(1, PH.hbHoldupPsi(H) * psi); yl = Math.max(ylRaw, lamL);
      NRe = 2.2e-2 * m / (Dft * Math.pow(o.mul, yl) * Math.pow(o.mug, 1 - yl)); f = PH.fanning(Math.max(NRe, 1), o.eps || 0);
      const rho = yl * o.rhol + (1 - yl) * o.rhog; dpdzF = f * m * m / (7.413e10 * Math.pow(Dft, 5) * rho) / 144;
    }
    const rho = yl * o.rhol + (1 - yl) * o.rhog, dpdzPE = rho / 144;
    return { usl, usg, um, lamL, lamG, LB, bubble, Nvl, Nvg, ND, NL, CNL, H, B, psi, ylRaw, yl, rho, m, ml, NRe, f, dpdzPE, dpdzF, dpdz: dpdzPE + dpdzF, regime };
  };
  // The Beggs & Brill pressure gradient (§7-4.3), any inclination: {ql, qg ft3/s, rhol, rhog, mul, mug, sigma, D in, theta deg (+90 vertical up, 0 horizontal), p psia}. No-slip friction factor from the smooth-pipe Chen equation, as in the book.
  PH.bbConst = { base: { segregated: [0.98, 0.4846, 0.0868], intermittent: [0.845, 0.5351, 0.0173], distributed: [1.065, 0.5824, 0.0609] }, up: { segregated: [0.011, -3.768, 3.539, -1.614], intermittent: [2.96, 0.305, -0.4473, 0.0978], distributed: null }, down: [4.70, -0.3692, 0.1244, -0.5056] };
  PH.beggsBrill = function (o) {
    const A = PH.pipeArea(o.D), Dft = o.D / 12, usl = o.ql / A, usg = o.qg / A, um = usl + usg, lamL = um > 0 ? usl / um : 1, lamG = 1 - lamL;
    const NFR = um * um / (32.17 * Dft), L1 = 316 * Math.pow(lamL, 0.302), L2 = 0.0009252 * Math.pow(lamL, -2.4684), L3 = 0.10 * Math.pow(lamL, -1.4516), L4 = 0.5 * Math.pow(lamL, -6.738);
    let regime;
    if ((lamL < 0.01 && NFR < L1) || (lamL >= 0.01 && NFR < L2)) regime = 'segregated';
    else if (lamL >= 0.01 && NFR >= L2 && NFR <= L3) regime = 'transition';
    else if ((lamL >= 0.01 && lamL < 0.4 && NFR > L3 && NFR <= L1) || (lamL >= 0.4 && NFR > L3 && NFR <= L4)) regime = 'intermittent';
    else regime = 'distributed';
    if (lamL > 0.9999) regime = 'single-phase liquid';
    const th = o.theta * Math.PI / 180, Nvl = 1.938 * usl * Math.pow(o.rhol / o.sigma, 0.25);
    const hold = (rg) => { const a = PH.bbConst.base[rg] || PH.bbConst.base.distributed; const y0 = Math.min(1, Math.max(lamL, a[0] * Math.pow(lamL, a[1]) / Math.pow(NFR, a[2]))); const cc = o.theta >= 0 ? (PH.bbConst.up[rg] || null) : PH.bbConst.down; let C = 0; if (cc && lamL < 1) C = Math.max(0, (1 - lamL) * Math.log(cc[0] * Math.pow(lamL, cc[1]) * Math.pow(Nvl, cc[2]) * Math.pow(NFR, cc[3]))); const psi = 1 + C * (Math.sin(1.8 * th) - 0.333 * Math.pow(Math.sin(1.8 * th), 3)); return { y0, C, psi, yl: Math.min(1, y0 * psi) }; };
    let h, yl;
    if (regime === 'transition') { const Aw = (L3 - NFR) / (L3 - L2), hs = hold('segregated'), hi = hold('intermittent'); yl = Aw * hs.yl + (1 - Aw) * hi.yl; h = { y0: null, C: null, psi: null }; }
    else { h = hold(regime); yl = h.yl; }
    const rho = yl * o.rhol + (1 - yl) * o.rhog, rhom = lamL * o.rhol + lamG * o.rhog, mum = lamL * o.mul + lamG * o.mug;
    const NRe = 1488 * rhom * um * Dft / mum, fn = PH.fanning(Math.max(NRe, 1), 0);
    const x = lamL / (yl * yl); let S; if (x > 1 && x < 1.2) S = Math.log(2.2 * x - 1.2); else if (Math.abs(x - 1) < 1e-9) S = 0; else { const l = Math.log(x); S = l / (-0.0523 + 3.182 * l - 0.8725 * l * l + 0.01853 * Math.pow(l, 4)); }
    const ftp = fn * Math.exp(S), dpdzPE = rho * Math.sin(th) / 144, dpdzF = 2 * ftp * rhom * um * um / (32.17 * Dft) / 144, Ek = um * usg * rhom / (32.17 * o.p * 144);
    return { usl, usg, um, lamL, lamG, NFR, L1, L2, L3, L4, regime, Nvl, y0: h.y0, C: h.C, psi: h.psi, yl, rho, rhom, mum, NRe, fn, x, S, ftp, dpdzPE, dpdzF, Ek, dpdz: (dpdzPE + dpdzF) / (1 - Ek) };
  };
  // Black-oil wellbore fluids at p, T for a traverse. Surface rates: qo STB/d, WOR, GLR scf per STB of liquid. Vasquez–Beggs, Beggs–Robinson, DAK Z, Lee–Gonzalez–Eakin; gas in water neglected.
  // {qo, WOR, GLR, API, gg, gw, sigO, sigW}
  PH.wellboreFluids = function (p, TF, o) {
    const TR = TF + 460, qw = o.qo * (o.WOR || 0), ql0 = o.qo + qw, Gsc = o.GLR * ql0, Rsmax = o.qo > 0 ? Gsc / o.qo : 0;
    const Rs = Math.min(PH.vbRs(p, TF, o.API, o.gg), Rsmax), pb = Rsmax > 0 ? PH.vbPb(Rsmax, TF, o.API, o.gg) : 0;
    const Bob = PH.vbBo(Rsmax, TF, o.API, o.gg), Bo = p < pb ? PH.vbBo(Rs, TF, o.API, o.gg) : PH.vbBoAbove(Bob, PH.vbCo(Rsmax, TF, o.API, o.gg, p), pb, p);
    const mud = PH.muDead(TF, o.API), muo = p < pb ? PH.muLive(mud, Rs) : (Rsmax > 0 ? PH.muAbove(PH.muLive(mud, Rsmax), p, pb) : mud);
    const rhoo = PH.rhoOil(o.API, o.gg, Rs, Bo), rhow = 62.4 * (o.gw || 1), muw = Math.exp(1.003 - 1.479e-2 * TF + 1.982e-5 * TF * TF);
    const pc = PH.pseudoFromGravity(o.gg), Z = PH.Zfactor(p / pc.Ppc, TR / pc.Tpc), Bg = 0.0283 * Z * TR / p, rhog = PH.rhoGas(o.gg, p, Z, TR), mug = PH.gasViscosity(28.97 * o.gg, p, TR, Z);
    const qoIn = o.qo * Bo * 5.615 / 86400, qwIn = qw * 5.615 / 86400, ql = qoIn + qwIn, free = Math.max(0, Gsc - Rs * o.qo), qg = free * Bg / 86400;
    const fo = ql > 0 ? qoIn / ql : 1, rhol = fo * rhoo + (1 - fo) * rhow, mul = fo * muo + (1 - fo) * muw, sigma = fo * (o.sigO || 30) + (1 - fo) * (o.sigW || 70);
    return { Rs, Rsmax, pb, Bo, rhoo, muo, rhow, muw, Z, Bg, rhog, mug, ql, qg, rhol, mul, sigma, fo, free, twoPhase: free > 0 };
  };
  // Pressure traverse (§7-4.4), fixed length increment, marching down from the wellhead: {method 'HB'|'BB', depth, dL, ptf psia, Tsurf F, Tbh F (omit for isothermal), theta deg, D in, eps, fluid}
  PH.traverse = function (o) {
    const n = Math.max(1, Math.round(o.depth / (o.dL || 200))), dL = o.depth / n, th = o.theta == null ? 90 : o.theta; const prof = [{ z: 0, p: o.ptf }]; let p = o.ptf;
    const Tat = (z) => o.Tbh != null ? o.Tsurf + (o.Tbh - o.Tsurf) * z / o.depth : o.Tsurf;
    const grad = (pm, Tm) => { const F = PH.wellboreFluids(pm, Tm, o.fluid); const inp = { ql: F.ql, qg: F.qg, rhol: F.rhol, rhog: F.rhog, mul: F.mul, mug: F.mug, sigma: F.sigma, D: o.D, p: pm, eps: o.eps || 0, theta: th }; const g = o.method === 'BB' ? PH.beggsBrill(inp) : PH.hagedornBrown(inp); return { g, F }; };
    for (let i = 0; i < n; i++) {
      const z1 = i * dL, Tm = Tat(z1 + dL / 2); let r = grad(p, Tm), dp = r.g.dpdz * dL;
      for (let it = 0; it < 4; it++) { r = grad(p + dp / 2, Tm); dp = r.g.dpdz * dL; }
      p += dp; prof.push({ z: z1 + dL, p, T: Tat(z1 + dL), regime: r.g.regime, yl: r.g.yl, lamL: r.g.lamL, dpdz: r.g.dpdz, dpdzPE: r.g.dpdzPE, dpdzF: r.g.dpdzF, twoPhase: r.F.twoPhase, F: r.F });
    }
    return { pwf: p, profile: prof };
  };

  // ---------- Flow through chokes (Section 8-3 of the second edition, 10-3 of the first) ----------
  // Eq. 8-75 (10-75 in the first edition) with Table 8-2: critical gas-liquid flow, p1 = A ql GLR^B / D64^C.
  // ql bbl/d, GLR SCF/bbl, D64 in 64ths of an inch. The upstream pressure p1 is in psig for Gilbert and in psia for Ros.
  PH.chokeConst = { gilbert: { A: 10.0, B: 0.546, C: 1.89 }, ros: { A: 17.4, B: 0.5, C: 2.0 } };
  PH.chokeP1 = function (ql, GLR, D64, corr) { const c = PH.chokeConst[corr || 'gilbert']; return c.A * ql * Math.pow(GLR, c.B) / Math.pow(D64, c.C); };
  PH.chokeSize = function (ql, GLR, p1, corr) { const c = PH.chokeConst[corr || 'gilbert']; return Math.pow(c.A * ql * Math.pow(GLR, c.B) / p1, 1 / c.C); };
  PH.chokeRate = function (p1, GLR, D64, corr) { const c = PH.chokeConst[corr || 'gilbert']; return p1 * Math.pow(D64, c.C) / (c.A * Math.pow(GLR, c.B)); };

  root.PH = PH;
})(typeof window !== 'undefined' ? window : globalThis);
