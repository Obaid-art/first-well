/* game/act1.js — First Well, Act 1: Open it up.
   The story is one async function at the bottom of this file; everything above it is the machinery it speaks through:
   a clock, a chat thread, a dock (choke wheel, bet, job card, law tool) and the notebook. The well itself is game/sim.js.
   Nothing in the story decides a number: rates and pressures come from the model, readings from the instruments. */
import { createScene } from './scene.js?v=5';
import { link, initTerms, bore, boreText, TERMS, open as openTerm } from './terms.js?v=2';
import { createWell, dealWell, intervalScore, KPA, rng, hash } from './sim.js?v=1';

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
  cur: null, log: [], bets: [], events: [], law: null, rep: 0, waiters: [], read: { show: 0, showTo: 0, S: 0, ptf: 0, kpa: 0, rate: 0, level: 0.3, gauge: false, turn: 0 }, pump: false };
let SC = null, stage = null;

// ---------- the clock and the well ----------
const day = () => Math.floor(G.hours / 24) + 1, clock = () => String(Math.floor(G.hours % 24)).padStart(2, '0') + ':00';
const note = (type, data) => G.events.push(Object.assign({ day: day(), hour: +(G.hours % 24).toFixed(1), type }, data || {}));
// what the instruments report for a stabilised setting: a dial to the nearest 5 psi, a gauge to the nearest 10 kPa, a separator repeatable to about 1 %
function reading(S) { const o = G.well.operate(S), u = rng(hash(G.spec.seed + ':' + S))(); return { S, ptf: Math.round(o.ptf / 5) * 5, kpa: Math.round(o.pwf * KPA / 10) * 10, rate: S <= 0 ? 0 : Math.round(o.q * (1 + 0.012 * (2 * u - 1))) }; }
function setChoke(S) { S = clamp(Math.round(S / 2) * 2, 0, 64); if (S === G.S) return; G.S = S; G.logged = false; G.stableFor = 0; note('choke', { S }); paintChoke(); }
function logReading() {
  const r = reading(G.S), old = G.log.find(x => x.S === G.S), row = { day: day(), S: r.S, ptf: r.ptf, kpa: G.gauge ? r.kpa : null, rate: r.rate }; if (G.hideRate) row.wait = true;
  if (old) { if (old.kpa == null && row.kpa != null) { old.kpa = row.kpa; old.day = row.day; } } else G.log.push(row);
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
function paintChoke() { if (!wheelUI || !wheelUI.isConnected) return; wheelUI.querySelector('.wheel g').setAttribute('transform', 'rotate(' + (G.S * 22.5) + ' 56 56)'); wheelUI.querySelector('.rd b').innerHTML = G.S > 0 ? G.S + '<i>/64 in</i>' : 'Shut in'; wheelUI.querySelector('.bore').innerHTML = bore(G.S, 92); wheelUI.querySelector('.bt').textContent = G.S > 0 ? boreText(G.S).split(' = ').slice(1).join(' = ') : 'no hole: the well is closed';
  const [dn, up] = wheelUI.querySelectorAll('.steps button'); dn.disabled = G.locked || G.S <= 0; up.disabled = G.locked || G.S >= G.cap; wheelUI.querySelector('.wheel').classList.toggle('locked', G.locked); wheelUI.querySelector('.rd span').textContent = G.locked ? 'The supervisor has the wheel.' : G.cap < 64 ? 'Up to ' + G.cap + '/64 for now. Drag the wheel.' : 'The dashed ring is one inch: 64/64.';
  const st = wheelUI.querySelector('.st'); st.textContent = G.log.length === 0 && G.S === 0 ? '' : G.logged ? 'Steady. Reading taken.' : 'Settling…'; st.hidden = !st.textContent; st.classList.toggle('ok', G.logged); }
function paintNeed() { if (!need || !wheelUI || !wheelUI.isConnected) return; const flow = G.log.filter(r => r.S > 0 && r.kpa != null).length, shut = G.log.some(r => r.S === 0 && r.kpa != null); [...wheelUI.querySelectorAll('.need span:not(.st)')].forEach(n => n.remove()); wheelUI.querySelector('.need').insertAdjacentHTML('beforeend', '<span class="' + (flow >= need.flow ? 'ok' : '') + '">flowing readings ' + Math.min(flow, need.flow) + ' of ' + need.flow + '</span><span class="' + (shut ? 'ok' : '') + '">shut-in reading ' + (shut ? 'taken' : 'wanted') + '</span>'); }
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
// a forecast, always a range, committed before the answer exists
function dockBet(o) {
  return new Promise(resolve => {
    const max = o.max || 4000, step = 10; dock().innerHTML = '<h4>Your call</h4>' + (o.tool && G.law ? '<div class="tool" id="tool"></div>' : '') + '<div class="bet"><p class="say"></p><div class="dual"><div class="track"></div><div class="fill"></div><input type="range" aria-label="Lowest"><input type="range" aria-label="Highest"></div><div class="scale"><span>0</span><span>' + fmt(max / 2) + '</span><span>' + fmt(max) + ' bbl/d</span></div><button class="pbtn">Lock it in</button></div>';
    const [lo, hi] = dock().querySelectorAll('.dual input'), fill = dock().querySelector('.fill'), sayEl = dock().querySelector('.say');
    [lo, hi].forEach(i => { i.min = 0; i.max = max; i.step = step; }); lo.value = 0; hi.value = max;
    const show = (who) => { let a = +lo.value, b = +hi.value; if (a > b - step) { if (who === lo) { a = b - step; lo.value = a; } else { b = a + step; hi.value = b; } } fill.style.left = (100 * a / max) + '%'; fill.style.width = (100 * (b - a) / max) + '%'; sayEl.innerHTML = 'Between ' + fmt(a) + ' and ' + fmt(b) + ' <i>bbl/d</i>'; };
    lo.addEventListener('input', () => show(lo)); hi.addEventListener('input', () => show(hi)); show();
    if (o.tool && G.law) lawTool($('tool'));
    dock().querySelector('.pbtn').addEventListener('click', () => { const b = { lo: +lo.value, hi: +hi.value }; me('Between ' + fmt(b.lo) + ' and ' + fmt(b.hi) + ' barrels a day.'); dockIdle(); resolve(b); });
  });
}
function dockJob(o) { return new Promise(resolve => { dock().innerHTML = '<h4>A job you can order</h4><div class="job"><b>' + o.title + '</b><p>' + link(o.text) + '</p><div class="cost"><span>$' + fmt(o.cost) + '</span><span>' + o.days + ' days</span></div></div><button class="pbtn">' + o.button + '</button>'; dock().querySelector('.pbtn').addEventListener('click', () => { dockIdle(); resolve(); }); }); }
function dockButton(label) { return new Promise(resolve => { dock().innerHTML = '<button class="pbtn">' + label + '</button>'; dock().querySelector('.pbtn').addEventListener('click', () => { dockIdle(); resolve(); }); }); }
function settleBet(key, asked, b, actual) { const score = intervalScore(b.lo, b.hi, actual), hit = actual >= b.lo && actual <= b.hi; G.bets.push({ key, asked, lo: b.lo, hi: b.hi, actual, hit, score: Math.round(score), day: day() }); G.rep -= score / Math.max(1, actual); note('bet', { key, lo: b.lo, hi: b.hi, actual, hit }); return hit; }

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
  if (G.gauge) el('div', 'card2', link('The service company’s gauge reads in kilopascals. Everything else on this location reads in psi.') + ' <b>1 psi = 6.895 kPa.</b>', L);
  el('h3', null, 'Page 1', Rr);
  if (!testDone()) { el('p', 'locked', 'Nothing to write yet. A page opens when there is a test to read: four flowing settings and one shut-in, with the gauge on bottom.', Rr); return; }
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

// ---------- the cover: who is playing, and at the end what happened ----------
function cover() {
  return new Promise(resolve => {
    const c = $('coverIn'); c.innerHTML = '<div class="k">WellSpring · Chapter 1</div><h1>First Well</h1><p>Your first day as a production engineer. You are given one oil well. Open it and see what it does.</p><label for="pn">Your name</label><input id="pn" autocomplete="off" placeholder="optional"><label for="pid">Student number</label><input id="pid" autocomplete="off" inputmode="numeric" placeholder="optional"><button class="go">Start</button><small>About ten minutes. Best on a laptop. This is a demo: any name and number will do, or none.</small>';
    const n = $('pn'), i = $('pid'); 
    const go = c.querySelector('.go'); go.addEventListener('click', () => { G.name = n.value.trim() || 'Guest'; G.id = i.value.trim() || String(100000 + Math.floor(Math.random() * 900000)); resolve(); });
  });
}
function endCard() {
  const c = $('coverIn'), L = G.law, v = L ? VARS[L.x] : null;
  c.innerHTML = '<div class="k">Act 1 · Open it up</div><h1>Day ' + day() + '</h1><p>' + fmt(G.barrels) + ' barrels to the tank. Here is what you said the well would do, and what it did.</p><table><tr><th>Asked</th><th>Your range, bbl/d</th><th>The well</th></tr>' +
    G.bets.map(b => '<tr><td>' + b.asked + '</td><td>' + fmt(b.lo) + ' to ' + fmt(b.hi) + '</td><td>' + fmt(b.actual) + '</td></tr>').join('') + '</table><label>The law you signed</label><div id="endLaw" style="font-size:19px;margin:4px 0 20px"></div><div class="two"><button class="go" id="dl">Download my log</button><button class="go sec" id="again">Play again</button></div><small>Act 2, Something is wrong, is not built yet.</small>';
  if (L) { $('endLaw').innerHTML = '<span></span> <small style="display:inline;margin-left:10px">c in ' + unitText(L.unit, v) + '</small>'; tex(formTex(L.form, v.sym, sig(L.c)), $('endLaw').querySelector('span')); } else $('endLaw').textContent = 'none';
  $('dl').addEventListener('click', () => { const blob = new Blob([JSON.stringify(exportLog(), null, 1)], { type: 'application/json' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'first-well-act1-' + G.id.replace(/[^a-z0-9]/gi, '') + '.json'; a.click(); });
  $('again').addEventListener('click', () => location.reload());
  const cv = $('cover'); cv.hidden = false; requestAnimationFrame(() => cv.classList.remove('off')); setTimeout(() => cv.classList.remove('off'), 60);
}
const exportLog = () => ({ game: 'First Well', act: 1, version: 1, player: { name: G.name, number: G.id }, well: { kind: G.spec.kind, seed: G.spec.seed }, days: day(), barrels: Math.round(G.barrels), readings: G.log, bets: G.bets, law: G.law && { variable: G.law.x, form: G.law.form, unit: unitText(G.law.unit, VARS[G.law.x]), c: G.law.c, miss: G.law.miss, productivityIndex: stamped(G.law) }, reputation: +G.rep.toFixed(4), events: G.events });
// a slot for a short film: a name listed in FILMS plays game/media/<name>.mp4 here, with a way to skip it
async function cutscene(name) {
  if (!FILMS.includes(name)) return; const c = $('coverIn'); c.innerHTML = '<video src="game/media/' + name + '.mp4" style="width:100%;border-radius:14px" autoplay playsinline></video><button class="go sec" style="margin-top:12px">Skip</button>';
  await new Promise(res => { c.querySelector('video').addEventListener('ended', res); c.querySelector('video').addEventListener('error', res); c.querySelector('button').addEventListener('click', res); }); c.innerHTML = '';
}

// ---------- the well explains itself: its state in words, any part on request, and a tour before the first move ----------
function paintState() { const st = $('state'), flowing = G.S > 0, key = flowing ? 'flow' : 'shut'; if (st._k === key) return; st._k = key; st.className = 'state ' + key; st.innerHTML = link(flowing ? 'flowing' : 'shut in') + '<small>' + (flowing ? 'the choke is open: oil is moving' : 'closed at the surface: nothing moves') + '</small>'; }
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
    const cap = $('cap'); let i = 0; cap.hidden = false; note('tour', { start: true });
    const go = (k) => { i = clamp(k, 0, TOUR.length - 1); const st = TOUR[i]; cap.querySelector('.ct').innerHTML = link(st.text); cap.querySelector('.cn').textContent = (i + 1) + ' of ' + TOUR.length; cap.querySelector('.back').disabled = i === 0; cap.querySelector('.next').textContent = i === TOUR.length - 1 ? 'Start' : 'Next';
      if (st.key) { cam(st.key, 2.6, true); SC.point(st.key); } else { SC.unpoint(); cam(st.cam, 2.6, true); } };
    const end = (skipped) => { cap.hidden = true; SC.unpoint(); note('tour', { finished: !skipped, step: i + 1 }); cap.querySelector('.next').onclick = cap.querySelector('.back').onclick = cap.querySelector('.skip').onclick = null; resolve(); };
    cap.querySelector('.next').onclick = () => { if (i === TOUR.length - 1) end(false); else go(i + 1); }; cap.querySelector('.back').onclick = () => go(i - 1); cap.querySelector('.skip').onclick = () => end(true); go(0);
  });
}
function openWords() {
  const s = $('sheet'), nb = $('nb'); s.hidden = false; N.open = true; requestAnimationFrame(() => s.classList.add('on')); setTimeout(() => s.classList.add('on'), 50);
  nb.innerHTML = '<div class="nh"><h2>Words</h2><span>everything said on this location, in plain words</span><button class="pbtn sec" style="width:auto">Back to the well</button></div><div class="words"></div>'; nb.querySelector('.nh button').addEventListener('click', closeNotebook);
  const box = nb.querySelector('.words'); Object.keys(TERMS).sort((a, b) => TERMS[a].t.localeCompare(TERMS[b].t)).forEach(k => { const t = TERMS[k], d = el('div', 'w', '<b>' + t.t + '</b><p>' + t.d + '</p>' + (t.part ? '<button class="pbtn sec">Show me on the well</button>' : ''), box); const b = d.querySelector('button'); if (b) b.addEventListener('click', () => showPart(t.part, t.t)); });
}

// ---------- Act 1 ----------
async function story() {
  $('av').textContent = WHO.initials; $('whoName').textContent = WHO.name; $('whoRole').textContent = WHO.role + ' · Well 7'; dockIdle();
  await cover();
  G.spec = dealWell(G.id); G.well = createWell(PH, G.spec); const o0 = G.well.operate(0); G.cur = { q: 0, ptf: o0.ptf, pwf: o0.pwf }; note('dealt', { kind: G.spec.kind });
  SC = createScene($('cv'), $('labels'), G); stage = SC.stage; stage.onUpdate((dt) => { tick(dt); paintState(); }); cam('high');
  ['state', 'cap', 'backBtn', 'toast'].forEach(id => SC.screenKeep.push(id === 'toast' ? () => $('toast').classList.contains('on') ? frameRect('toast')() : null : frameRect(id)));
  window.__game = { G, SC, stage, N, cam, showPart, backHome, link, setChoke, openNotebook, closeNotebook, renderNotebook, evalLaw, fitLaw, exportLog, fast: async (sec) => { for (let t = 0; t < sec; t += 0.25) { stage.advance(0.25); await new Promise(r => setTimeout(r, 0)); } } };
  await cutscene('act1_intro');
  $('cover').classList.add('off'); await until((t) => (SC.texturesPending() === 0 && t > 1.2) || t > 9); $('veil').classList.add('off'); setTimeout(() => { $('cover').hidden = true; }, 1700);

  cam('play', 6); await wait(2.2); await tour();
  sys('Day 1 · 06:00'); cam('surface', 5); await wait(1.6);
  await say((G.name === 'Guest' ? 'Good morning' : 'Good morning, ' + G.name.split(' ')[0]) + '. I’m ' + WHO.name + ', the field supervisor.');
  await say('Well 7 is yours from today. It was drilled last month. It has never flowed.');
  await say('It is shut in. The oil is ' + fmt(G.spec.depth) + ' feet below that wellhead.');
  G.read.showTo = 1;
  await say('Open the choke. Carefully: no more than 16 for now. That is a quarter of an inch.', 0.6);
  cam('choke', 4); dockChoke(16); await until(() => G.log.some(r => r.S >= 6));
  cam('play', 7); await say('Oil to the tank. Good.');
  await say('Before you open it further: what will it make at 32? Give me a range.', 0.3);
  G.locked = true; paintChoke(); const b1 = await dockBet({ max: 4000 });
  dockChoke(64, true); setChoke(32); await settledAt(32); await wait(0.8);
  const r32 = reading(32).rate; settleBet('blind', 'Choke 32/64, before any measurement', b1, r32);
  fact('Choke 32/64: <b>' + fmt(r32) + ' bbl/d</b>. Your range was ' + fmt(b1.lo) + ' to ' + fmt(b1.hi) + '.'); await wait(1.2);
  await say('Noted.'); await say('It’s your well. See what it can do.', 0.5);
  dockChoke(64);
  const top = () => { const hi = G.log.filter(r => r.S >= 40).sort((a, b) => a.S - b.S); return hi.length >= 2 && Math.abs(hi[hi.length - 1].rate - hi[hi.length - 2].rate) < 0.03 * hi[hi.length - 1].rate; };
  let hinted = false; await until((t) => { if (!hinted && t > 75 && !top()) { hinted = true; say('Open it all the way. Then back it off a little. I want to see the top.'); } return top(); });
  await say('It has stopped answering the wheel.'); await say('Why?', 1.6);
  await say('You can’t tell from up here. Nobody can. All you have is one gauge at the top of an ' + fmt(G.spec.depth) + '-foot pipe.');
  await dockJob({ title: 'Downhole pressure gauge', text: 'A wireline crew lowers a gauge to the bottom of the well and leaves it there. You will see the pressure where the oil enters the well.', cost: ECON.gauge, days: ECON.gaugeDays, button: 'Order it' });
  me('Order the gauge.'); note('job', { job: 'downhole gauge', cost: ECON.gauge }); G.locked = true; dockChoke(64, true);
  const back = G.hours + ECON.gaugeDays * 24; G.speed = 48; SC.wireline(true); cam('surface', 5); toast('Wireline crew on location. Two days pass.', 6); await until(() => G.hours >= back); G.speed = 1; SC.wireline(false); cam('deep', 5);
  G.gauge = true; G.logged = false; G.stableFor = 0; sys('Day ' + day() + ' · gauge on bottom'); await wait(1.4);
  await say('Gauge is on bottom. The service company reports in kilopascals. Their gauge, their units.');
  await say('Run me a test: four choke settings, and shut it in once. I want the static pressure.', 0.5);
  cam('play', 6); dockChoke(64, false, { flow: 4, shut: 1 }); $('nbBtn').disabled = false;
  await until(testDone);
  await say('That is a test. It’s in your notebook.');
  await say('Something in those numbers sets the rate. Find it, write it down and sign it.', 0.4);
  $('nbBtn').classList.add('new'); await until(() => !!G.law);
  await until(() => !N.open); await wait(0.6);
  await say('Signed. Let’s see what it is worth.');
  const Sx = [20, 28, 12, 36, 44, 24, 30, 18].find(s => !G.log.some(r => r.S === s)) || 26;
  await say('I’m putting the well on ' + Sx + '.', 0.4);
  G.hideRate = true; dockChoke(64, true); setChoke(Sx); await settledAt(Sx); await wait(0.6); const rx = reading(Sx);
  fact('Choke ' + Sx + '/64. Downhole gauge: <b>' + fmt(rx.kpa) + ' kPa</b>. Wellhead: <b>' + fmt(rx.ptf) + ' psi</b>. The test separator needs an hour to settle.'); await wait(1.0);
  await say('What will it read? Give me a range.', 0.3);
  const b2 = await dockBet({ max: 4000, tool: true });
  const hit = settleBet('law', 'Choke ' + Sx + '/64, with your law', b2, rx.rate); await wait(1.4); G.hideRate = false; G.log.forEach(r => { delete r.wait; }); dockChoke(64, true);
  fact('Test separator: <b>' + fmt(rx.rate) + ' bbl/d</b>. Your range was ' + fmt(b2.lo) + ' to ' + fmt(b2.hi) + '.'); await wait(1.4);
  const width = (b2.hi - b2.lo) / Math.max(1, rx.rate);
  await say(hit && width <= 0.12 ? 'Inside, and tight. That is how it is done.' : hit ? 'Inside. A range that wide is safe, and not much use to me.' : 'Outside your range. Find out why before tomorrow.');
  await say('One more thing. Well 6, next lease, same sand, makes ' + fmt(Math.round(3 * G.well.operate(64).q / 50) * 50) + ' barrels a day.');
  await say('Three times yours. Find out why.', 1.2);
  sys('End of Act 1'); await dockButton('Finish'); note('end'); endCard();
}

export function start() {
  initTerms({ show: showPart, seen: (k) => note('word', { k }) }); $('backBtn').addEventListener('click', backHome); $('wordsBtn').addEventListener('click', openWords);
  $('nbBtn').addEventListener('click', openNotebook); $('sheet').addEventListener('click', (e) => { if (e.target === $('sheet')) closeNotebook(); });
  story().catch(e => { console.error(e); bubble('sys', 'Something broke: ' + e.message); });
}
