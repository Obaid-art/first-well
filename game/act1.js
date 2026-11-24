/* game/act1.js — First Well, Act 1: Open it up.
   The story is one async function at the bottom of this file; everything above it is the machinery it speaks through:
   a clock, a chat thread, a dock (choke wheel, bet, job card, law tool) and the notebook. The well itself is game/sim.js.
   Nothing in the story decides a number: rates and pressures come from the model, readings from the instruments. */
import { createScene } from './scene.js?v=10';
import { buildMissions } from './missions.js?v=1';
import { link, initTerms, bore, boreText, TERMS, open as openTerm } from './terms.js?v=2';
import { createWell, dealWell, intervalScore, KPA } from './sim.js?v=1';

const PH = window.PH, katex = window.katex, Plotly = window.Plotly, fmt = (x, d = 0) => (+x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const $ = (id) => document.getElementById(id);
const el = (tag, cls, html, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; };
const tex = (s, node, display) => { katex.render(s, node, { displayMode: !!display, throwOnError: false }); return node; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

const WHO = { name: 'Latifa', role: 'Field supervisor', initials: 'L' };                         // the voice on the phone
const ECON = { price: 70, gauge: 25000, gaugeDays: 2 };                                            // placeholders, for the instructor to set
const FILMS = [];                                                                                  // short films that exist in game/media, by name, e.g. 'act1_intro'
const TURN = 2 * Math.PI / 16, PACE = 1 / 6;                                                        // game hours per real second: a day passes in about two and a half minutes                                                                     // one full turn of the wheel is 16/64 in

const G = { name: '', id: '', spec: null, well: null, S: 0, cap: 0, locked: true, hours: 6, speed: 1, barrels: 0, stableFor: 0, logged: true, hideRate: false, gauge: false,
  cur: null, log: [], events: [], law: null, rules: [], done: {}, set: 'well', waiters: [],
  bench: { rock: { A: 640, h: 50, phi: 0.2, Sw: 0.3, N: 0 }, cell: { p: 5000, Rsb: 600, pb: 0, gas: 0, oilRel: 1, gasRel: 0 }, core: { dp: 0, mu: 1, k: 200, L: 1, q: 0, fluid: 'water', plug: 1 } }, read: { show: 0, showTo: 0, S: 0, ptf: 0, kpa: 0, rate: 0, level: 0.3, gauge: false, turn: 0 }, pump: false };
let SC = null, stage = null;

// ---------- the clock and the well ----------
const day = () => Math.floor(G.hours / 24) + 1, clock = () => String(Math.floor(G.hours % 24)).padStart(2, '0') + ':00';
const note = (type, data) => G.events.push(Object.assign({ day: day(), hour: +(G.hours % 24).toFixed(1), type }, data || {}));
// what the instruments report for a stabilised setting: the model's own numbers, rounded as an instrument shows them
// (a dial to the nearest 5 psi, a gauge to the nearest 10 kPa, a meter to the nearest barrel a day). Nothing is added or taken away.
function reading(S) { const o = G.well.operate(S); return { S, ptf: Math.round(o.ptf / 5) * 5, kpa: Math.round(o.pwf * KPA / 10) * 10, rate: S <= 0 ? 0 : Math.round(o.q) }; }
function setChoke(S) { S = clamp(Math.round(S / 2) * 2, 0, 64); if (S === G.S) return; G.S = S; G.logged = false; G.stableFor = 0; note('choke', { S }); paintChoke(); }
function logReading() {
  const r = reading(G.S), old = G.log.find(x => x.S === G.S), row = { day: day(), S: r.S, ptf: r.ptf, kpa: G.gauge ? r.kpa : null, rate: r.rate }; if (G.hideRate) row.wait = true;
  if (old) { if (old.kpa == null && row.kpa != null) { old.kpa = row.kpa; old.day = row.day; } } else G.log.push(row);
  const o = G.well.operate(G.S); G.cur.q = o.q; G.cur.ptf = o.ptf; G.cur.pwf = o.pwf;                    // settled: from here the well is exactly at its operating point
  G.logged = true; note('reading', row); paintNeed(); paintChoke();
}
function tick(dt) {
  if (!G.well) return;
  const gh = dt * G.speed * PACE, tgt = G.well.operate(G.S), a = 1 - Math.exp(-dt * Math.min(G.speed, 4) / 0.9), c = G.cur;
  G.hours += gh; c.q += (tgt.q - c.q) * a; c.ptf += (tgt.ptf - c.ptf) * a; c.pwf += (tgt.pwf - c.pwf) * a; G.barrels += c.q * gh / 24;
  const settled = Math.abs(c.q - tgt.q) <= Math.max(3, 0.01 * tgt.q) && Math.abs(c.ptf - tgt.ptf) < 6;
  G.stableFor = settled ? G.stableFor + dt : 0; if (settled && !G.logged && G.stableFor > 1.0) logReading();
  // the tank fills; a transfer pump empties it to the pipeline when it is nearly full
  const R = G.read; if (R.level > 0.86) G.pump = true; if (R.level < 0.24) G.pump = false; R.level = clamp(R.level + (c.q - (G.pump ? 9000 : 0)) * gh / 24 / 2400, 0, 1);
  R.show += (R.showTo - R.show) * (1 - Math.exp(-dt / 0.9)); R.S = G.S; R.gauge = G.gauge; R.turn += (G.S * TURN - R.turn) * (1 - Math.exp(-dt / 0.5));
  R.ptf = Math.round(c.ptf / 5) * 5; R.kpa = Math.round(c.pwf * KPA / 10) * 10; R.rate = G.hideRate ? null : (G.logged ? reading(G.S).rate : Math.round(c.q));
  const h = [day() + ' · ' + clock(), fmt(G.barrels) + ' bbl', '$' + fmt(G.barrels * ECON.price)]; ['hDay', 'hBbl', 'hUsd'].forEach((id, i) => { const n = $(id); if (n._s !== h[i]) { n.textContent = h[i]; n._s = h[i]; } });
  for (let i = G.waiters.length - 1; i >= 0; i--) { const w = G.waiters[i]; w.t += dt; if (w.test(w.t)) { G.waiters.splice(i, 1); w.resolve(); } }
}
const until = (test) => new Promise(resolve => G.waiters.push({ t: 0, test, resolve }));
const wait = (sec) => until((t) => t >= sec);
const settledAt = (S) => until(() => G.S === S && G.logged);

// ---------- the phone: a thread of messages ----------
const thread = () => $('thread');
function bubble(cls, html) { const m = el('div', 'msg ' + cls, html, thread()); requestAnimationFrame(() => m.classList.add('in')); setTimeout(() => m.classList.add('in'), 60); thread().scrollTop = thread().scrollHeight; return m; }
async function say(html, pause) { const m = bubble('them typing', '· · ·'); await wait(0.9 + Math.min(1.1, html.length * 0.008)); m.classList.remove('typing'); m.innerHTML = link(html); thread().scrollTop = thread().scrollHeight; note('said', { text: m.textContent }); await wait(pause != null ? pause : 0.9 + html.length * 0.014); }
const me = (html) => bubble('me', html), sys = (html) => bubble('sys', html), fact = (html) => bubble('fact', link(html));
function toast(text, sec) { const t = $('toast'); t.textContent = text; t.classList.add('on'); wait(sec || 3).then(() => t.classList.remove('on')); }
const cam = (key, dur, visit) => { if (!visit) G.home = key; const k = SC.cams[key] || SC.anchors[key].cam, r = $('frame').getBoundingClientRect(), f = Math.max(1, (16 / 9) / (r.width / Math.max(1, r.height))); const goal = Object.assign({}, k, { dist: k.dist * f }); if (dur) stage.cam.to(goal, dur); else stage.cam.set(goal); };

// ---------- the dock: whatever the player's hands are on ----------
const dock = () => $('dock');
function dockIdle(text) { dock().innerHTML = '<div class="idle">' + (text || '') + '</div>'; }
let wheelUI = null, need = null;
function paintChoke() { if (!wheelUI || !wheelUI.querySelector('.wheel g')) return; wheelUI.querySelector('.wheel g').setAttribute('transform', 'rotate(' + (G.S * 22.5) + ' 56 56)'); wheelUI.querySelector('.rd b').innerHTML = G.S > 0 ? G.S + '<i>/64 in</i>' : 'Shut in'; wheelUI.querySelector('.bore').innerHTML = bore(G.S, 92); wheelUI.querySelector('.bt').textContent = G.S > 0 ? boreText(G.S).split(' = ').slice(1).join(' = ') : 'no hole: the well is closed';
  const [dn, up] = wheelUI.querySelectorAll('.steps button'); dn.disabled = G.locked || G.S <= 0; up.disabled = G.locked || G.S >= G.cap; wheelUI.querySelector('.wheel').classList.toggle('locked', G.locked); wheelUI.querySelector('.rd span').textContent = G.locked ? 'The supervisor has the wheel.' : G.cap <= 0 ? 'Leave it shut in for this one.' : G.cap < 64 ? 'Up to ' + G.cap + '/64 for now. Drag the wheel.' : 'The dashed ring is one inch: 64/64.';
  const st = wheelUI.querySelector('.st'); st.textContent = G.log.length === 0 && G.S === 0 ? '' : G.logged ? 'Steady. Reading taken.' : 'Settling…'; st.hidden = !st.textContent; st.classList.toggle('ok', G.logged); }
function paintNeed() { if (!need || !wheelUI || !wheelUI.querySelector('.need')) return; const flow = G.log.filter(r => r.S > 0 && r.kpa != null).length, shut = G.log.some(r => r.S === 0 && r.kpa != null); [...wheelUI.querySelectorAll('.need span:not(.st)')].forEach(n => n.remove()); wheelUI.querySelector('.need').insertAdjacentHTML('beforeend', '<span class="' + (flow >= need.flow ? 'ok' : '') + '">flowing readings ' + Math.min(flow, need.flow) + ' of ' + need.flow + '</span><span class="' + (shut ? 'ok' : '') + '">shut-in reading ' + (shut ? 'taken' : 'wanted') + '</span>'); }
function dockChoke(cap, locked, needs) {
  G.cap = cap; G.locked = !!locked; need = needs || null;
  dock().innerHTML = '<h4>' + link('The choke') + '</h4><div class="choke"><svg class="wheel" viewBox="0 0 112 112" tabindex="0" aria-label="Choke handwheel"><g><circle cx="56" cy="56" r="46" fill="none" stroke="#A3261E" stroke-width="9"/>' +
    [0, 60, 120].map(a => '<rect x="12" y="52.5" width="88" height="7" rx="3" fill="#A3261E" transform="rotate(' + a + ' 56 56)"/>').join('') + '<circle cx="56" cy="56" r="11" fill="#3A4046"/><circle cx="56" cy="14" r="4.5" fill="#fff"/></g></svg>' +
    '<div class="bore"></div><div class="rd"><b></b><em class="bt"></em><span></span><div class="steps"><button aria-label="Close a little">− close</button><button aria-label="Open a little">+ open</button></div></div></div><div class="need"><span class="st"></span></div>';
  wheelUI = dock(); const w = wheelUI.querySelector('.wheel'), [dn, up] = wheelUI.querySelectorAll('.steps button'); let drag = null;
  const ang = (e) => { const r = w.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI; };
  w.addEventListener('pointerdown', (e) => { if (G.locked) return; drag = { a: ang(e), acc: 0, S0: G.S }; w.setPointerCapture(e.pointerId); });
  w.addEventListener('pointermove', (e) => { if (!drag) return; let d = ang(e) - drag.a; if (d > 180) d -= 360; if (d < -180) d += 360; drag.a = ang(e); drag.acc += d; setChoke(clamp(drag.S0 + drag.acc / 22.5, 0, G.cap)); });
  const endDrag = () => { drag = null; }; w.addEventListener('pointerup', endDrag); w.addEventListener('pointercancel', endDrag);
  w.addEventListener('keydown', (e) => { if (G.locked) return; if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setChoke(Math.min(G.cap, G.S + 2)); if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') setChoke(Math.max(0, G.S - 2)); });
  dn.addEventListener('click', () => setChoke(Math.max(0, G.S - 2))); up.addEventListener('click', () => setChoke(Math.min(G.cap, G.S + 2)));
  paintChoke(); paintNeed();
}
function dockButton(label) { return new Promise(resolve => { dock().innerHTML = '<button class="pbtn">' + label + '</button>'; dock().querySelector('.pbtn').addEventListener('click', () => { dockIdle(); resolve(); }); }); }

// ---------- laws: what the player may write, and what a written law then computes ----------
const VARS = {
  S: { name: 'Choke size', sym: 'S', u: '64ths', one: '64th', get: (r) => r.S, forms: ['lin', 'root', 'pow2', 'inv'] },
  ptf: { name: 'Wellhead pressure', sym: 'p_{tf}', u: 'psi', one: 'psi', get: (r) => r.ptf, forms: ['drop', 'lin', 'inv', 'sq'] },
  kpa: { name: 'Bottomhole pressure', sym: 'p_{wf}', u: 'kPa', one: 'kPa', get: (r) => r.kpa, forms: ['drop', 'lin', 'inv', 'sq'] }
};
const X0 = '_{\\text{shut in}}';
const FORMS = {
  lin: { p: 1, f: (x) => x }, drop: { p: 1, f: (x, x0) => x0 - x }, inv: { p: -1, f: (x) => 1 / x }, sq: { p: 2, f: (x, x0) => (x0 - x) * (x0 - x) }, root: { p: 0.5, f: (x) => Math.sqrt(x) }, pow2: { p: 2, f: (x) => x * x }
};
const formTex = (form, s, c) => { const C = c || 'c', x0 = s.replace(/_\{[^}]*\}$/, '') + X0; return { lin: 'q = ' + C + '\\,' + s, drop: 'q = ' + C + '\\left(' + x0 + ' - ' + s + '\\right)', inv: 'q = \\dfrac{' + C + '}{' + s + '}', sq: 'q = ' + C + '\\left(' + x0 + ' - ' + s + '\\right)^{2}', root: 'q = ' + C + '\\sqrt{' + s + '}', pow2: 'q = ' + C + '\\,' + s + '^{2}' }[form]; };
// the units a constant may be given: a = power of the rate, b = power of the variable's unit; "other" means the other pressure unit
const UNITS = { 'r/u': { a: 1, b: -1 }, 'r/v': { a: 1, b: -1, other: true }, 'u/r': { a: -1, b: 1 }, 'r*u': { a: 1, b: 1 }, 'r/u2': { a: 1, b: -2 }, 'r/ur': { a: 1, b: -0.5 } };
const otherU = (u) => u === 'kPa' ? 'psi' : 'kPa', conv = (x, from, to) => from === to ? x : from === 'psi' ? x * KPA : x / KPA;
const pw = (u, b) => b === 1 ? u : b === 2 ? u + '²' : b === 0.5 ? '√' + u : b === 1.5 ? u + '^1.5' : b === 3 ? u + '³' : u + '^' + b;
const dimText = (a, b, u) => a === 1 ? (b === 0 ? 'bbl/d' : b > 0 ? 'bbl/d × ' + pw(u, b) : 'bbl/d per ' + pw(u, -b)) : (b === 0 ? 'd/bbl' : b > 0 ? pw(u, b) + ' per bbl/d' : '1 per (bbl/d × ' + pw(u, -b) + ')');
const unitText = (id, v) => { const U = UNITS[id], u = U.other ? otherU(v.u) : v.one; return dimText(U.a, U.b, u); };
const unitChoices = (x) => x === 'S' ? ['r/u', 'r/u2', 'r/ur', 'r*u', 'u/r'] : ['r/u', 'r/v', 'u/r', 'r*u', 'r/u2'];
function points(x) { const v = VARS[x]; return G.log.filter(r => !r.wait).map(r => ({ x: v.get(r), q: r.rate, S: r.S })).filter(p => p.x != null); }
function fitLaw(x, form) {
  const pts = points(x), shut = pts.find(p => p.S === 0), x0 = x === 'S' ? 0 : (shut ? shut.x : Math.max(...pts.map(p => p.x))), f = FORMS[form].f;
  const use = pts.map(p => ({ q: p.q, f: f(p.x, x0), x: p.x })).filter(p => isFinite(p.f)); let n = 0, d = 0; use.forEach(p => { n += p.q * p.f; d += p.f * p.f; }); const c = d > 0 ? n / d : 0;
  const flow = use.filter(p => p.q > 0), mean = flow.reduce((s, p) => s + p.q, 0) / Math.max(1, flow.length), miss = flow.reduce((s, p) => s + Math.abs(p.q - c * p.f), 0) / Math.max(1, flow.length) / Math.max(1, mean);
  return { c, x0, miss, pts };
}
// a signed law computes exactly what its author wrote, units included
function evalLaw(L, X, U) {
  const v = VARS[L.x], Uc = UNITS[L.unit], cu = Uc.other ? otherU(v.u) : v.u, Xc = L.x === 'S' ? X : conv(X, U, cu), x0 = L.x === 'S' ? 0 : conv(L.x0, v.u, cu), q = L.c * FORMS[L.form].f(Xc, x0), b = Uc.b + FORMS[L.form].p;
  return { q, isRate: Uc.a === 1 && Math.abs(b) < 1e-9, unit: dimText(Uc.a, b, Uc.other ? otherU(v.u) : v.one) };
}
const stamped = (L) => L && L.x === 'kpa' && L.form === 'drop' && L.unit === 'r/u' && L.miss < 0.03;
const sig = (x) => x === 0 ? '0' : Math.abs(x) >= 100 ? fmt(x, 0) : Math.abs(x) >= 10 ? fmt(x, 1) : Math.abs(x) >= 1 ? fmt(x, 2) : Math.abs(x) >= 0.1 ? fmt(x, 3) : Math.abs(x) >= 0.01 ? fmt(x, 4) : x.toExponential(2);
function lawTool(box) {
  const L = G.law, v = VARS[L.x];
  box.innerHTML = '<div class="eq"></div><div class="row"><input type="number" inputmode="decimal" placeholder="' + v.name.toLowerCase() + '">' + (L.x === 'S' ? '<select><option>64ths</option></select>' : '<select><option>kPa</option><option>psi</option></select>') + '</div><div class="res">&nbsp;</div>';
  box.querySelector('.eq').innerHTML = '<span></span> <small style="color:var(--muted);font-size:12px;white-space:nowrap">c in ' + unitText(L.unit, v) + '</small>'; tex(formTex(L.form, v.sym, sig(L.c)), box.querySelector('.eq span'));
  const inp = box.querySelector('input'), sel = box.querySelector('select'), res = box.querySelector('.res');
  const run = () => { if (inp.value === '') { res.innerHTML = '&nbsp;'; return; } const r = evalLaw(L, +inp.value, sel.value); res.innerHTML = '= ' + (isFinite(r.q) ? fmt(r.q) : 'no answer') + ' ' + (r.isRate ? 'bbl/d' : r.unit) + (r.isRate ? '' : '<small>With the units you gave the constant, this is not a rate.</small>'); };
  inp.addEventListener('input', run); sel.addEventListener('change', run); inp.addEventListener('change', () => { if (inp.value !== '') note('tool', { X: +inp.value, U: sel.value, q: Math.round(evalLaw(L, +inp.value, sel.value).q) }); });
}

// ---------- the notebook ----------
const N = { x: null, form: null, unit: null, open: false };
const testDone = () => G.log.filter(r => r.S > 0 && r.kpa != null).length >= 4 && G.log.some(r => r.S === 0 && r.kpa != null);
function openNotebook() { const s = $('sheet'); s.hidden = false; N.open = true; renderNotebook(); requestAnimationFrame(() => s.classList.add('on')); setTimeout(() => s.classList.add('on'), 50); $('nbBtn').classList.remove('new'); note('notebook', { open: true }); }
function closeNotebook() { const s = $('sheet'); s.classList.remove('on'); N.open = false; setTimeout(() => { if (!N.open) s.hidden = true; }, 520); }
function renderNotebook() {
  const nb = $('nb'); nb.innerHTML = '<div class="nh"><h2>Notebook</h2><span>' + G.name + ' · Well 7</span><button class="pbtn sec" style="width:auto">Back to the well</button></div><div class="cols"><div class="l"></div><div class="r"></div></div>';
  nb.querySelector('.nh button').addEventListener('click', closeNotebook);
  const L = nb.querySelector('.l'), Rr = nb.querySelector('.r'), rows = G.log.slice().sort((a, b) => a.S - b.S);
  el('h3', null, 'Test log', L);
  el('table', null, '<tr><th>Choke<small>64ths of an inch</small></th><th>Wellhead<small>psi</small></th><th>Bottomhole<small>kPa</small></th><th>Rate<small>bbl/d</small></th></tr>' + rows.map(r => '<tr><td>' + (r.S > 0 ? r.S + '/64' : 'shut in') + '</td><td>' + fmt(r.ptf) + '</td><td class="' + (r.kpa == null ? 'na' : '') + '">' + (r.kpa == null ? 'no gauge' : fmt(r.kpa)) + '</td><td>' + (r.wait ? 'settling' : fmt(r.rate)) + '</td></tr>').join(''), L);
  if (G.rules.length) { el('h3', 'gap', 'Rules you have found', L); G.rules.forEach(r => { const d = el('div', 'rulecard', '<b>' + r.name + '</b><div class="k"></div><small>' + r.ref + '</small>', L); if (r.tex) tex(r.tex, d.querySelector('.k')); }); }
  if (G.gauge) el('div', 'card2', link('The service company’s gauge reads in kilopascals. Everything else on this location reads in psi.') + ' <b>1 psi = 6.895 kPa.</b>', L);
  el('h3', null, 'Page 1', Rr);
  if (!testDone()) { el('p', 'locked', 'Nothing to write here yet. This page opens when the well has been tested: four flowing settings and one shut-in, with the gauge on bottom.', Rr); return; }
  el('p', 'q', link('Something in the log sets the rate. Which reading does the rate follow?'), Rr);
  const px = el('div', 'pick', null, Rr); Object.keys(VARS).forEach(k => { const b = el('button', N.x === k ? 'on' : '', VARS[k].name, px); b.addEventListener('click', () => { N.x = k; N.form = null; N.unit = null; renderNotebook(); }); });
  if (!N.x) return; const v = VARS[N.x], plot = el('div', 'plot', null, Rr), fit = N.form ? fitLaw(N.x, N.form) : null, pts = points(N.x), xs = pts.map(p => p.x);
  const data = [{ x: xs, y: pts.map(p => p.q), mode: 'markers', marker: { size: 11, color: '#0047BA' }, hovertemplate: '%{x} → %{y} bbl/d<extra></extra>' }];
  if (fit) { const lo = Math.min(...xs), hi = Math.max(...xs), cx = [], cy = []; for (let i = 0; i <= 80; i++) { const x = lo + (hi - lo) * i / 80, y = fit.c * FORMS[N.form].f(x, fit.x0); if (isFinite(y) && Math.abs(y) < 1e5) { cx.push(x); cy.push(y); } } data.unshift({ x: cx, y: cy, mode: 'lines', line: { color: '#B3261E', width: 2.5 }, hoverinfo: 'skip' }); }
  Plotly.newPlot(plot, data, { font: { family: '"Inter", "Segoe UI", sans-serif', size: 13, color: '#121A26' }, margin: { l: 62, r: 12, t: 8, b: 46 }, paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: '#fff', showlegend: false,
    xaxis: { title: { text: v.name + ', ' + v.u }, gridcolor: '#ECE9E1', linecolor: '#C9C4B8', zeroline: false }, yaxis: { title: { text: 'rate, bbl/d' }, gridcolor: '#ECE9E1', linecolor: '#C9C4B8', rangemode: 'tozero', range: [0, Math.max(...pts.map(p => p.q)) * 1.25 + 50] } }, { displayModeBar: false, responsive: true });
  el('p', 'q', 'Write it as a law. The red line is your law, with the constant that fits your own readings best.', Rr);
  const pf = el('div', 'pick forms', null, Rr); v.forms.forEach(k => { const b = el('button', N.form === k ? 'on' : '', null, pf); tex(formTex(k, v.sym), b); b.addEventListener('click', () => { N.form = k; N.unit = null; renderNotebook(); }); });
  if (!fit) return;
  el('p', 'fit', 'Best constant: <b>c = ' + sig(fit.c) + '</b>. On your flowing readings this law misses by <b>' + fmt(100 * fit.miss, 1) + ' %</b> of the rate on average.' + (N.x !== 'S' ? ' The shut-in value is ' + fmt(fit.x0) + ' ' + v.u + '.' : ''), Rr);
  el('p', 'q', 'A constant without a unit is not a number. What unit does c carry?', Rr);
  const pu = el('div', 'pick', null, Rr); unitChoices(N.x).forEach(id => { const b = el('button', N.unit === id ? 'on' : '', unitText(id, v), pu); b.addEventListener('click', () => { N.unit = id; renderNotebook(); }); });
  if (!N.unit) return;
  const cand = { x: N.x, form: N.form, unit: N.unit, c: fit.c, x0: fit.x0, miss: fit.miss, u: v.u }, same = G.law && G.law.x === cand.x && G.law.form === cand.form && G.law.unit === cand.unit;
  const sign = el('div', 'sign', '<button class="pbtn" style="width:auto">' + (same ? 'Signed' : G.law ? 'Sign this one instead' : 'Sign this law') + '</button><span>' + (same ? 'It is beside the well now, as a tool. You can change it whenever you like.' : 'A signed law becomes a tool you can use at the well. It computes exactly what you wrote.') + '</span>', Rr);
  sign.querySelector('button').disabled = same; sign.querySelector('button').addEventListener('click', () => { G.law = cand; note('law', { x: cand.x, form: cand.form, unit: cand.unit, c: +cand.c.toPrecision(5), miss: +cand.miss.toFixed(4), stamped: stamped(cand) }); renderNotebook(); });
  if (same && stamped(G.law)) { const st = el('div', 'stamp', '<b>This law has a name: the productivity index.</b><span>Petroleum Production Systems, 2nd edition, Section 1-3, Equation 1-6. The constant is written J, and what it multiplies is the drawdown.</span><div class="k"></div><span>J = ' + sig(G.law.c) + ' bbl/d per kPa = ' + sig(G.law.c) + ' × 6.895 = <b style="display:inline;font-size:inherit">' + sig(G.law.c * KPA) + ' bbl/d per psi</b></span>', Rr); tex('q = J\\,(\\bar p - p_{wf})', st.querySelector('.k')); }
}

// ---------- the cover, and the card at the end of the level ----------
function cover() {
  return new Promise(resolve => {
    const c = $('coverIn'); c.innerHTML = '<div class="k">Petroleum production · Chapter 1</div><h1>First Well</h1><p>Your first day as a production engineer. Eight short missions, one for each idea in the chapter. Each asks you for a number. You work the equipment until you have it.</p><label for="pn">Your name</label><input id="pn" autocomplete="off" placeholder="optional"><label for="pid">Student number</label><input id="pid" autocomplete="off" inputmode="numeric" placeholder="optional"><button class="go">Start</button><small>About forty minutes for all eight. Best on a laptop. This is a demo: any name and number will do, or none.</small>';
    const n = $('pn'), i = $('pid'); try { const p = JSON.parse(localStorage.getItem('fw1') || '{}'); if (p.name && p.name !== 'Guest') n.value = p.name; if (p.id) i.value = p.id; } catch (e) { }
    c.querySelector('.go').addEventListener('click', () => { G.name = n.value.trim() || 'Guest'; G.id = i.value.trim() || String(100000 + Math.floor(Math.random() * 900000)); resolve(); });
  });
}
function endCard() {
  return new Promise(resolve => {
    const c = $('coverIn'); c.innerHTML = '<div class="k">Chapter 1 · complete</div><h1>Eight of eight</h1><p>These are the rules you found. They are in your notebook.</p><div id="endRules"></div><div class="two"><button class="go" id="dl">Download my log</button><button class="go sec" id="again">Back to the missions</button></div><small>Chapter 2 is not built yet.</small>';
    G.rules.forEach(r => { const d = el('div', 'endrule', '<b>' + r.name + '</b><span class="eq"></span>', $('endRules')); if (r.tex) tex(r.tex, d.querySelector('.eq')); });
    $('dl').addEventListener('click', () => { const blob = new Blob([JSON.stringify(exportLog(), null, 1)], { type: 'application/json' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'first-well-chapter1-' + G.id.replace(/[^a-z0-9]/gi, '') + '.json'; a.click(); });
    const cv = $('cover'); $('again').addEventListener('click', () => { cv.classList.add('off'); setTimeout(() => { cv.hidden = true; }, 1700); resolve(); });
    cv.hidden = false; requestAnimationFrame(() => cv.classList.remove('off')); setTimeout(() => cv.classList.remove('off'), 60);
  });
}
const exportLog = () => ({ game: 'First Well', chapter: 1, version: 2, player: { name: G.name, number: G.id }, well: { kind: G.spec.kind, seed: G.spec.seed }, missionsDone: Object.keys(G.done), rules: G.rules.map(r => r.name), readings: G.log, law: G.law && { variable: G.law.x, form: G.law.form, unit: unitText(G.law.unit, VARS[G.law.x]), c: G.law.c, miss: G.law.miss, productivityIndex: stamped(G.law) }, events: G.events });

// ---------- the well explains itself: its state in words, any part on request, and a tour before the first move ----------
function paintState() { const st = $('state'), flowing = G.S > 0, key = G.set !== 'well' ? 'none' : flowing ? 'flow' : 'shut'; if (st._k === key) return; if (key === 'none') { st._k = key; st.innerHTML = ''; return; } st._k = key; st.className = 'state ' + key; st.innerHTML = link(flowing ? 'flowing' : 'shut in') + '<small>' + (flowing ? 'the choke is open: oil is moving' : 'closed at the surface: nothing moves') + '</small>'; }
function showPart(key, name) { if (!SC || !SC.anchors[key]) return; if (N.open) closeNotebook(); cam(key, 2.4, true); SC.point(key, name || SC.anchors[key].name); $('backBtn').hidden = false; note('show', { part: key }); }
function backHome() { SC.unpoint(); $('backBtn').hidden = true; cam(G.home || 'play', 2.4); }
const frameRect = (id) => () => { const n = $(id); if (!n || n.hidden || n.offsetWidth === 0) return null; const a = n.getBoundingClientRect(), f = $('labels').getBoundingClientRect(); return { x0: a.left - f.left - 6, y0: a.top - f.top - 6, x1: a.right - f.left + 6, y1: a.bottom - f.top + 6 }; };
const TOUR = [
  { cam: 'tour', text: 'This is your well, cut open so you can see inside. We will follow the oil from the rock to the tank. Tap any word with a dotted line to see what it means.' },
  { key: 'reservoir', text: 'The reservoir: rock, 8,000 feet down, with oil in its pores. The oil is under high pressure.' },
  { key: 'perforations', text: 'Perforations: holes shot through the steel so the oil can enter the well. It comes in from every side.' },
  { key: 'casing', text: 'The casing is the steel pipe cemented to the rock. It keeps the hole open. A packer near the bottom seals the gap around the tubing.' },
  { key: 'tubing', text: 'The tubing carries the oil to the surface. A column of oil that long is heavy, and the well has to lift it.' },
  { key: 'wellhead', text: 'At the top, the wellhead: valves that open and close the well, and a gauge that reads the pressure up here.' },
  { key: 'choke', text: 'The choke controls the well. It is a hole whose size you set, counted in 64ths of an inch. 64/64 is one inch.' },
  { key: 'separator', text: 'The flowline leads to the test separator. Gas leaves from the top, oil from the bottom, and the oil is measured: that is your rate, in barrels a day.' },
  { key: 'tank', text: 'The oil ends in the stock tank. The red marker on its side follows the level.' },
  { cam: 'tour', text: 'Right now the well is shut in: closed at the top, nothing moving. When it is flowing you will see the oil move.' }
];
function tour() {
  return new Promise(resolve => {
    const cap = $('cap'); let i = 0; cap.hidden = false; G.read.showTo = 0; note('tour', { start: true });
    const go = (k) => { i = clamp(k, 0, TOUR.length - 1); const st = TOUR[i]; cap.querySelector('.ct').innerHTML = link(st.text); cap.querySelector('.cn').textContent = (i + 1) + ' of ' + TOUR.length; cap.querySelector('.back').disabled = i === 0; cap.querySelector('.next').textContent = i === TOUR.length - 1 ? 'Start' : 'Next';
      if (st.key) { cam(st.key, 2.6, true); SC.point(st.key); } else { SC.unpoint(); cam(st.cam, 2.6, true); } };
    const end = (skipped) => { cap.hidden = true; SC.unpoint(); G.read.showTo = 1; cam('play', 2.4); note('tour', { finished: !skipped, step: i + 1 }); cap.querySelector('.next').onclick = cap.querySelector('.back').onclick = cap.querySelector('.skip').onclick = null; resolve(); };
    cap.querySelector('.next').onclick = () => { if (i === TOUR.length - 1) end(false); else go(i + 1); }; cap.querySelector('.back').onclick = () => go(i - 1); cap.querySelector('.skip').onclick = () => end(true); go(0);
  });
}
function openWords() {
  const s = $('sheet'), nb = $('nb'); s.hidden = false; N.open = true; requestAnimationFrame(() => s.classList.add('on')); setTimeout(() => s.classList.add('on'), 50);
  nb.innerHTML = '<div class="nh"><h2>Words</h2><span>everything said on this location, in plain words</span><button class="pbtn sec" style="width:auto">Back to the well</button></div><div class="words"></div>'; nb.querySelector('.nh button').addEventListener('click', closeNotebook);
  const box = nb.querySelector('.words'); Object.keys(TERMS).sort((a, b) => TERMS[a].t.localeCompare(TERMS[b].t)).forEach(k => { const t = TERMS[k], d = el('div', 'w', '<b>' + t.t + '</b><p>' + t.d + '</p>' + (t.part ? '<button class="pbtn sec">Show me on the well</button>' : ''), box); const b = d.querySelector('button'); if (b) b.addEventListener('click', () => showPart(t.part, t.t)); });
}

// ---------- the target: one known number, reached with the player's own hands ----------
const stepRound = (c, v) => { const n = Math.round((clamp(v, c.min, c.max) - c.min) / c.step); return +(c.min + n * c.step).toFixed(6); };
function control(c, box) {
  const d = el('div', 'ctl ' + c.kind + (c.locked ? ' locked' : ''), null, box);
  if (c.kind === 'slider') {
    d.innerHTML = '<div class="top"><label>' + link(c.label) + '</label><output></output></div><input type="range">'; const inp = d.querySelector('input'), out = d.querySelector('output'); inp.min = c.min; inp.max = c.max; inp.step = c.step; inp.disabled = !!c.locked;
    c.paint = () => { const v = c.get(); inp.value = v; out.innerHTML = fmt(v, c.dec) + (c.unit ? ' <i>' + c.unit + '</i>' : '') + (c.locked ? ' <em>fixed</em>' : ''); inp.style.setProperty('--p', (100 * (v - c.min) / (c.max - c.min)).toFixed(1) + '%'); };
    c.apply = (v) => { c.set(stepRound(c, v)); c.paint(); note('ctl', { id: c.id, v: c.get() }); }; inp.addEventListener('input', () => c.apply(+inp.value));
  } else {
    d.innerHTML = '<div class="top"><label>' + link(c.label) + '</label>' + (c.locked ? '<em>fixed</em>' : '') + '</div><div class="chs"></div>'; const row = d.querySelector('.chs');
    c.options.forEach(([lab, val]) => { const b = el('button', null, lab, row); b.disabled = !!c.locked; b._v = val; b.addEventListener('click', () => c.apply(val)); });
    c.paint = () => { [...row.children].forEach(b => b.classList.toggle('on', b._v === c.get())); }; c.apply = (v) => { c.set(v); c.paint(); note('ctl', { id: c.id, v }); };
  }
  c.paint(); return c;
}
function target(o) {
  return new Promise(resolve => {
    const e0 = G.events.length; let held = 0, last = 0, done = false; G.round = o; note('ask', { title: o.title, goal: +(+o.goal).toFixed(4) });
    if (o.wheel) dockChoke(o.wheel.cap, false); else { dock().innerHTML = ''; wheelUI = null; }
    dock().insertAdjacentHTML('afterbegin', '<div class="tg"><h4>' + link(o.title) + '</h4><div class="tgrow"><div class="now"><b></b><span>now</span></div><div class="bar"><i class="band"></i><i class="pin"></i></div><div class="want"><b>' + o.goalText + '</b><span>wanted</span></div></div>' + (o.constraint ? '<p class="con"></p>' : '') + '</div>');
    const tg = dock().querySelector('.tg'), now = tg.querySelector('.now b'), pin = tg.querySelector('.pin'), band = tg.querySelector('.band'), con = tg.querySelector('.con'), [lo, hi] = o.range, pos = (v) => clamp((v - lo) / (hi - lo), 0, 1) * 100;
    if (o.entry) { tg.querySelector('.tgrow').hidden = true; } else { band.style.left = pos(o.goal - o.tol) + '%'; band.style.width = Math.max(1.2, pos(o.goal + o.tol) - pos(o.goal - o.tol)) + '%'; }
    const box = el('div', 'ctls', null, dock()); (o.controls || []).forEach(c => control(c, box));
    const finish = (res) => { if (done) return; done = true; G.round = null; note('reached', Object.assign({ title: o.title, moves: G.events.slice(e0).filter(x => x.type === 'ctl' || x.type === 'choke').length }, res || {})); dockIdle(); resolve(res || {}); };
    if (o.entry) { const en = el('div', 'entry', '<input type="number" inputmode="decimal" placeholder="your number"><select>' + o.entry.units.map(u => '<option>' + u[0] + '</option>').join('') + '</select><button class="pbtn" style="width:auto">Check</button>', dock()); const inp = en.querySelector('input'), sel = en.querySelector('select');
      o.check = () => { if (inp.value === '') return; const v = +inp.value * o.entry.units.find(u => u[0] === sel.value)[1]; note('answer', { v: +inp.value, unit: sel.value }); me(fmt(+inp.value) + ' ' + sel.value + '.'); if (Math.abs(v - o.goal) <= o.tol) finish({ entry: +inp.value }); else say(v < o.goal ? o.entry.low : o.entry.high, 0.2); };
      en.querySelector('button').addEventListener('click', o.check); o.fill = (v, u) => { inp.value = v; sel.value = u; }; }
    if (!o.entry) { const cant = el('button', 'cant', 'It cannot be done', dock()); cant.addEventListener('click', () => { note('cant', { right: !!o.impossible }); if (o.impossible) { me('It cannot be done.'); finish({ cant: true }); } else say('It can. Keep going.', 0.2); }); o.cant = () => cant.click(); }
    const paint = () => { if (o.entry) return false; const v = o.metric(), cOk = !o.constraint || o.constraint.ok(), ok = Math.abs(v - o.goal) <= o.tol && (!o.steady || o.steady()) && cOk; now.innerHTML = o.show(v); pin.style.left = pos(v) + '%'; tg.classList.toggle('ok', ok); if (con) { con.innerHTML = (cOk ? '✓ ' : '✗ ') + link(o.constraint.text); con.classList.toggle('bad', !cOk); } return ok; };
    G.waiters.push({ t: 0, test: (t) => { if (done) return true; const ok = paint(); held = ok ? held + (t - last) : 0; last = t; if (ok && held >= 0.9 && !o.impossible) { finish(); return true; } return false; }, resolve: () => { } });
  });
}
// apply the settings that reach the present target (the scripted play-test uses this; a player never sees it)
function solveRound() { const o = G.round; if (!o) return false; const sol = o.solution || {}; if (sol.ctl) (o.controls || []).forEach(c => { if (sol.ctl[c.id] != null && !c.locked) c.apply(sol.ctl[c.id]); }); if (sol.S != null) setChoke(sol.S); if (sol.entry) { o.fill(sol.entry[0], sol.entry[1]); o.check(); } if (sol.cant) o.cant(); return true; }
function ask(o) {
  return new Promise(resolve => {
    dock().innerHTML = '<h4>What did you find?</h4><p class="askq">' + link(o.q) + '</p><div class="asks"></div>'; G.asking = o; const row = dock().querySelector('.asks');
    o.options.forEach((t, i) => { const b = el('button', null, t, row); b.addEventListener('click', async () => { note('said', { q: o.q, pick: i, right: i === o.right }); if (i !== o.right) { b.classList.add('no'); b.disabled = true; say('Not that. Think about what you actually changed.', 0.2); return; } G.asking = null; me(t); dockIdle(); await say(o.why); resolve(); }); });
    o.pick = () => row.children[o.right].click();
  });
}
async function rule(o) { G.rules = G.rules.filter(r => r.name !== o.name); G.rules.push(o); note('rule', { name: o.name }); const m = bubble('fact rulemsg', '<small>The rule · ' + o.ref + '</small><b>' + o.name + '</b><div class="k"></div><p>' + link(o.text) + '</p>'); if (o.tex) tex(o.tex, m.querySelector('.k'), true); thread().scrollTop = thread().scrollHeight; $('nbBtn').classList.add('new'); await wait(2.2); }
function useSet(name, camKey, dur) { G.set = name; SC.useSet(name); G.read.showTo = 1; $('backBtn').hidden = true; SC.unpoint(); cam(camKey || name, dur); document.querySelector('.hud').style.visibility = name === 'well' ? 'visible' : 'hidden'; }
// a different well (other rock, other pipe) starts a clean test log: readings from two wells never share a page
function setWell(mod) { if (!mod && G.well === G.well0) return; G.well = mod ? createWell(PH, Object.assign({}, G.spec, mod)) : G.well0; G.logged = false; G.stableFor = 0; G.log = []; G.law = null; N.x = N.form = N.unit = null; }
// the law page: wait until the signed law is the one the readings support, with a nudge after each one that is not
async function lawWatch() { $('nbBtn').classList.add('new'); let seen = null; await until(() => { if (G.law && G.law !== seen && !N.open) { seen = G.law; if (!stamped(G.law)) say(G.law.x !== 'kpa' ? 'Try your law on the next reading before you trust it. Does another column fit better?' : G.law.unit !== 'r/u' ? 'The shape is right. Look again at the unit of your constant, and at the unit the gauge reads in.' : 'Close. Try another shape on the same column.', 0.2); } return !!G.law && stamped(G.law) && !N.open; }); await say('Signed, and it holds. That constant is worth remembering.'); }
// the list of missions: the next one is offered; finished ones can be played again
function hub(list) {
  return new Promise(resolve => {
    const next = list.findIndex(m => !G.done[m.id]); document.querySelector('.gtop .brand small').textContent = 'Chapter 1 · ' + Object.keys(G.done).length + ' of ' + list.length + ' missions';
    dock().innerHTML = '<h4>Missions</h4><div class="hub"></div>'; const box = dock().querySelector('.hub');
    list.forEach((m, i) => { const st = G.done[m.id] ? 'done' : i === next ? 'next' : 'later', b = el('button', st, '<i>' + (G.done[m.id] ? '✓' : i + 1) + '</i><span><b>' + m.title + '</b><small>' + m.ref + '</small></span>', box); b.disabled = st === 'later'; b.addEventListener('click', () => { dockIdle(); resolve(i); }); });
    const nx = box.querySelector('.next'); if (nx) nx.scrollIntoView({ block: 'nearest' });
  });
}
const save = () => { try { localStorage.setItem('fw1', JSON.stringify({ name: G.name, id: G.id, done: G.done })); } catch (e) { } };

// ---------- Chapter 1 ----------
async function level() {
  $('av').textContent = WHO.initials; $('whoName').textContent = WHO.name; $('whoRole').textContent = WHO.role + ' · Well 7'; dockIdle();
  await cover();
  try { const p = JSON.parse(localStorage.getItem('fw1') || '{}'); if (p.id === G.id && p.done) G.done = p.done; } catch (e) { }
  G.spec = dealWell(G.id); G.well = G.well0 = createWell(PH, G.spec); const o0 = G.well.operate(0); G.cur = { q: 0, ptf: o0.ptf, pwf: o0.pwf }; note('dealt', { kind: G.spec.kind });
  SC = createScene($('cv'), $('labels'), G); stage = SC.stage; stage.onUpdate((dt) => { tick(dt); paintState(); }); cam('high');
  ['state', 'cap', 'backBtn', 'toast'].forEach(id => SC.screenKeep.push(id === 'toast' ? () => $('toast').classList.contains('on') ? frameRect('toast')() : null : frameRect(id)));
  const api = { G, PH, SC, say, sys, fact, me, wait, until, cam, useSet, target, ask, rule, tour, setChoke, reading, setWell, fmt, link, KPA, testDone, stamped, lawWatch, dockChokeOnly: (needs) => dockChoke(64, false, needs) };
  const L = buildMissions(api);
  window.__game = { G, SC, stage, N, cam, showPart, backHome, link, setChoke, openNotebook, closeNotebook, renderNotebook, evalLaw, fitLaw, exportLog, solveRound, missions: L, fast: async (sec) => { for (let t = 0; t < sec; t += 0.25) { stage.advance(0.25); await new Promise(r => setTimeout(r, 0)); } } };
  $('cover').classList.add('off'); await until((t) => (SC.texturesPending() === 0 && t > 1.2) || t > 9); $('veil').classList.add('off'); setTimeout(() => { $('cover').hidden = true; }, 1700);
  $('nbBtn').disabled = false; cam('play', 5); await wait(1.5);
  if (!Object.keys(G.done).length) { await say((G.name === 'Guest' ? 'Good morning' : 'Good morning, ' + G.name.split(' ')[0]) + '. I’m ' + WHO.name + ', the field supervisor.'); await say('Well 7 is yours from today. First you learn what you are looking at.'); }
  else await say('Welcome back. Pick up where you left off.');
  for (;;) {
    const i = await hub(L), m = L[i]; document.querySelector('.gtop .brand small').textContent = 'Chapter 1 · mission ' + (i + 1) + ' of ' + L.length; sys('Mission ' + (i + 1) + ' · ' + m.title); note('mission', { id: m.id, start: true });
    await m.run(); const first = !G.done[m.id]; G.done[m.id] = true; save(); note('mission', { id: m.id, done: true }); sys('Mission ' + (i + 1) + ' complete');
    if (first && Object.keys(G.done).length === L.length) { await say('That is the whole of Chapter 1. Not bad for a first day.'); await endCard(); }
    if (G.set !== 'well') useSet('well', 'play', 3);
  }
}

export function start() {
  initTerms({ show: showPart, seen: (k) => note('word', { k }) }); $('backBtn').addEventListener('click', backHome); $('wordsBtn').addEventListener('click', openWords);
  $('nbBtn').addEventListener('click', openNotebook); $('sheet').addEventListener('click', (e) => { if (e.target === $('sheet')) closeNotebook(); });
  level().catch(e => { console.error(e); bubble('sys', 'Something broke: ' + e.message); });
}
