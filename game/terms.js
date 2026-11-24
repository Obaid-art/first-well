/* game/terms.js — every word of the trade that the game uses, said once in plain words.
   Any text passed through link() has those words marked; touching a marked word opens a card with what it means, its opposite
   where it has one, a small drawing where a drawing says it better, and "Show me" for anything that can be pointed at on the well.
   Definitions follow Chapter 1 of Petroleum Production Systems (2nd ed.): Section 1-2, the components of the system, and 1-4, units. */
const T = {
  shut: { t: 'shut in', re: 'shut[- ]in', d: 'The well is <b>closed at the surface</b>. Nothing moves. The pressure in the well builds up until it matches what the reservoir can hold.', opp: ['flow'], pic: 'shut' },
  flow: { t: 'flowing', re: 'flowing|flowed', d: 'The well is <b>open</b>. Oil travels out of the rock, up the tubing, through the choke and on to the separator and the tank.', opp: ['shut'], pic: 'flow' },
  choke: { t: 'choke', re: 'chokes?', d: 'A valve with a hole whose size you choose. A small hole holds the well back. A larger one lets it flow harder. You use it to control the well.', part: 'choke', rel: ['s64'], pic: 'bore' },
  s64: { t: '64ths of an inch', re: '\\d+/64(?: in)?|64ths(?: of an inch)?', d: 'Chokes are sized by the width of their hole, counted in sixty-fourths of an inch. <b>64/64 is one inch.</b> 32/64 is half an inch, 16/64 a quarter.', rel: ['choke'], pic: 'bore' },
  wellhead: { t: 'wellhead', re: 'wellhead(?! gauge| pressure)', d: 'The stack of steel valves on top of the well, also called the Christmas tree. It is how the well is opened, closed and controlled from the surface.', part: 'wellhead' },
  ptf: { t: 'wellhead pressure', re: 'wellhead gauge|wellhead pressure', d: 'The pressure at the <b>top</b> of the well, read on the gauge on the wellhead.', opp: ['pwf'], part: 'wellhead' },
  pwf: { t: 'bottomhole pressure', re: 'bottomhole pressure|pressure where the oil enters the well', d: 'The pressure at the <b>bottom</b> of the well, where the oil enters it from the rock. It is always higher than at the top: the whole column of fluid in the tubing stands on it.', opp: ['ptf'], part: 'perforations' },
  static: { t: 'static pressure', re: 'static pressure', d: 'The pressure at the bottom of the well after it has been shut in and has stopped changing. With nothing moving, it is the pressure of the reservoir itself.', rel: ['shut'] },
  dgauge: { t: 'downhole gauge', re: 'downhole (?:pressure )?gauge', d: 'A pressure gauge lowered on a wire to the bottom of the well and left there. It reads the pressure where the oil comes in, which no gauge at the surface can see.', part: 'gauge' },
  wireline: { t: 'wireline', re: 'wireline', d: 'A thin steel wire on a drum. A crew uses it to lower tools, such as a gauge, down the inside of the tubing.' },
  tubing: { t: 'tubing', re: 'tubing', d: 'The pipe inside the well that carries the oil from the bottom to the surface. Here it is ' + '8,000' + ' feet long.', part: 'tubing', rel: ['casing'] },
  casing: { t: 'casing', re: 'casing', d: 'The larger steel pipe cemented into the hole. It keeps the hole open and seals the layers of rock from one another. The tubing hangs inside it.', part: 'casing', rel: ['tubing'] },
  packer: { t: 'packer', re: 'packer', d: 'A rubber seal between the tubing and the casing, set just above the reservoir. It leaves the oil only one way up: inside the tubing.', part: 'packer' },
  perfs: { t: 'perforations', re: 'perforations', d: 'Holes shot through the steel casing and the cement, so that oil can pass from the rock into the well.', part: 'perforations' },
  reservoir: { t: 'reservoir', re: 'reservoir', d: 'Rock whose tiny connected pores are full of oil under pressure. It is not an underground lake: the oil lives inside the rock, like water in a sponge made of stone.', part: 'reservoir' },
  flowline: { t: 'flowline', re: 'flowline', d: 'The pipe on the surface that takes the oil from the wellhead to the separator.', part: 'flowline' },
  separator: { t: 'test separator', re: '(?:test )?separator', d: 'A steel vessel where the stream is given room to settle: gas rises and leaves from the top, oil leaves from the bottom. A <b>test</b> separator also measures how much the well is making.', part: 'separator' },
  tank: { t: 'stock tank', re: '(?:stock )?tank', d: 'Where the oil is stored at the pressure of the air around us. Oil is sold by what is measured here, which is why rates are quoted in stock-tank barrels.', part: 'tank' },
  rate: { t: 'rate', re: 'rate', d: 'How much the well produces in a day.', rel: ['bbl'] },
  bbl: { t: 'barrels a day', re: 'barrels a day|bbl/d|barrels', d: 'The oilfield measures oil in barrels. <b>One barrel is 42 US gallons, about 159 litres.</b> A rate is written bbl/d, barrels per day.' },
  psi: { t: 'psi', re: 'psi', d: 'Pounds per square inch, the oilfield unit of pressure. The air around you presses with about 14.7 psi.', opp: ['kpa'] },
  kpa: { t: 'kilopascal', re: 'kilopascals?|kPa', d: 'The SI unit of pressure, a thousand pascals. <b>1 psi = 6.895 kPa.</b> The same pressure, written in kPa, is a number almost seven times larger.', opp: ['psi'] },
  test: { t: 'well test', re: 'a test', d: 'Flowing the well at several choke settings, waiting for it to steady at each, and writing down the pressures and the rate.' },
  drawdown: { t: 'drawdown', re: 'drawdown', d: 'The reservoir pressure minus the pressure at the bottom of the flowing well. It is how hard the well is pulling on the rock.' },
  pi: { t: 'productivity index', re: 'productivity index', d: 'How many barrels a day the well gives for each unit of drawdown. It is written J, and it sums up the rock, the fluid and the condition of the well in one number.', rel: ['drawdown'] }
};
const order = Object.keys(T).sort((a, b) => T[b].re.length - T[a].re.length);
const RE = new RegExp('\\b(?:' + order.map(k => '(' + T[k].re + ')').join('|') + ')(?![\\w-])', 'gi');
// mark the trade words in a piece of HTML (text only, never inside a tag)
export function link(html) { return String(html).split(/(<[^>]+>)/).map(seg => seg.startsWith('<') ? seg : seg.replace(RE, (m, ...g) => { const i = g.findIndex(x => x != null && typeof x === 'string'); return i < 0 || i >= order.length ? m : '<span class="term" data-t="' + order[i] + '" tabindex="0">' + m + '</span>'; })).join(''); }

// small drawings
const frac = (S) => { const g = (a, b) => b ? g(b, a % b) : a, d = g(S, 64); return S === 64 ? '1' : (S / d) + '/' + (64 / d); };
export function bore(S, size = 120) {
  const c = size / 2, R = size * 0.40, r = R * Math.max(0, S) / 64;
  return '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '" aria-label="The hole in the choke, to scale against one inch"><circle cx="' + c + '" cy="' + c + '" r="' + (R + size * 0.07) + '" fill="#3A4046"/><circle cx="' + c + '" cy="' + c + '" r="' + R + '" fill="#8D949B"/>' +
    (S > 0 ? '<circle cx="' + c + '" cy="' + c + '" r="' + r.toFixed(2) + '" fill="#120C06"/>' : '<path d="M' + (c - 7) + ' ' + (c - 7) + 'L' + (c + 7) + ' ' + (c + 7) + 'M' + (c + 7) + ' ' + (c - 7) + 'L' + (c - 7) + ' ' + (c + 7) + '" stroke="#B3261E" stroke-width="3" stroke-linecap="round"/>') +
    '<circle cx="' + c + '" cy="' + c + '" r="' + R + '" fill="none" stroke="#fff" stroke-width="1.2" stroke-dasharray="3 3"/></svg>';
}
export const boreText = (S) => S <= 0 ? 'closed: no hole at all' : S + '/64 in = ' + frac(S) + ' in = ' + (S / 64 * 25.4).toFixed(1) + ' mm';
const valve = (open) => '<svg viewBox="0 0 220 96" width="220" height="96"><rect x="18" y="42" width="184" height="14" rx="3" fill="#8D949B"/><path d="M92 30L128 68M128 30L92 68" stroke="#3A4046" stroke-width="0"/><path d="M90 28L130 70L130 28L90 70Z" fill="' + (open ? '#2E7D5B' : '#B3261E') + '"/><rect x="107" y="10" width="6" height="22" fill="#3A4046"/><rect x="92" y="6" width="36" height="7" rx="3" fill="#3A4046"/>' +
  (open ? [30, 58, 150, 178].map(x => '<path d="M' + x + ' 49h14m-5-5l5 5l-5 5" fill="none" stroke="#120C06" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>').join('') : '<rect x="18" y="42" width="72" height="14" rx="3" fill="#5a3d1c"/>') +
  '<text x="110" y="90" text-anchor="middle" font-family="Inter, sans-serif" font-size="12" font-weight="600" fill="#5B6B80">' + (open ? 'open: oil passes' : 'closed: oil held back, pressure builds') + '</text></svg>';
const PIC = { shut: () => valve(false), flow: () => valve(true), bore: () => '<div class="row3">' + [16, 32, 64].map(S => '<div>' + bore(S, 74) + '<small>' + S + '/64 = ' + frac(S) + ' in</small></div>').join('') + '</div>' };

let card = null, hooks = {};
export function initTerms(h) {
  hooks = h || {}; card = document.createElement('div'); card.className = 'tcard'; card.hidden = true; document.body.appendChild(card);
  const openFrom = (e) => { const el = e.target.closest && e.target.closest('.term'); if (el) { e.preventDefault(); e.stopPropagation(); open(el.dataset.t, el); return true; } return false; };
  document.addEventListener('click', (e) => { if (openFrom(e)) return; if (!card.hidden && !card.contains(e.target)) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); if ((e.key === 'Enter' || e.key === ' ') && document.activeElement && document.activeElement.classList.contains('term')) { e.preventDefault(); open(document.activeElement.dataset.t, document.activeElement); } });
}
export function close() { if (card) card.hidden = true; }
export function open(key, anchor) {
  const t = T[key]; if (!t) return; if (hooks.seen) hooks.seen(key);
  const chips = (list, label) => list && list.length ? '<div class="rel"><span>' + label + '</span>' + list.map(k => '<button data-k="' + k + '">' + T[k].t + '</button>').join('') + '</div>' : '';
  card.innerHTML = '<button class="x" aria-label="Close">×</button><h5>' + t.t + '</h5><p>' + t.d + '</p>' + (t.pic ? '<div class="pic">' + PIC[t.pic]() + '</div>' : '') + chips(t.opp, 'The other side of it') + chips(t.rel, 'Goes with') + (t.part && hooks.show ? '<button class="show">Show me on the well</button>' : '');
  card.hidden = false; card.querySelector('.x').addEventListener('click', close); card.querySelectorAll('.rel button').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); open(b.dataset.k, anchor); }));
  const sh = card.querySelector('.show'); if (sh) sh.addEventListener('click', () => { close(); hooks.show(t.part, t.t); });
  // place it beside the word, inside the window
  const a = anchor && anchor.isConnected ? anchor.getBoundingClientRect() : { left: innerWidth / 2, right: innerWidth / 2, top: innerHeight / 2, bottom: innerHeight / 2 }, w = card.offsetWidth, h = card.offsetHeight;
  let x = Math.min(innerWidth - w - 12, Math.max(12, a.left + (a.right - a.left) / 2 - w / 2)), y = a.bottom + 10; if (y + h > innerHeight - 12) y = Math.max(12, a.top - h - 10);
  card.style.left = x + 'px'; card.style.top = y + 'px';
}
export const TERMS = T;
