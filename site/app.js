// Flight GT406 — page motion: splash, hero scrub, countdown and days chip, dock, progress, reveals, toast.
// The check-in flow lives in checkin.js. Every hidden state in app.css is gated by the .js class that the
// inline head script sets, so this file only ever reveals; if it fails, the page stays readable.
import { countdown, localUnlock, FLIGHT } from './js/passenger.js';

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const mobile = matchMedia('(max-width: 760px)');
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * clamp(t);

// ---------- toast ----------
let toastTimer = 0;
export function toast(text, action) {
  const el = $('#toast');
  el.textContent = text;
  if (action) {
    const a = document.createElement('a');
    Object.assign(a, { href: action.href, target: '_blank', rel: 'noopener', textContent: action.label });
    el.append(a);
  }
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), action ? 4200 : 2400);
}

// ---------- splash ----------
// Any input during the curtain fast-forwards the intro animations instead of cutting them, so the mark and
// the copy still land where they belong; the curtain never blocks the page (pointer-events: none).
const INTRO = new Set(['intro-end', 'veil', 'curtain-s', 'draw', 'vi-move', 'vi-out', 'photo-in', 'logo-fade', 'logo-in', 'fade-up']);
const intro = $('.intro');
const settled = () => root.classList.add('idle');
if (intro && root.dataset.intro !== 'none' && !reduce.matches) {
  const evs = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
  const off = () => evs.forEach(e => removeEventListener(e, skip, true));
  function skip() {
    root.classList.add('intro-skip');
    for (const a of document.getAnimations()) if (INTRO.has(a.animationName)) a.playbackRate = 8;
    off();
  }
  evs.forEach(e => addEventListener(e, skip, { capture: true, passive: true }));
  // Where the drawn VI has to land: the VI of the logo image, i.e. its object-fit: contain content box.
  // Layout values only (no transformed rects), redone once fonts move the title and on resize.
  const mark = $('.intro-mark'), logo = $('.gta-logo');
  const aim = () => {
    const ir = intro.getBoundingClientRect(), w = mark.clientWidth, h = mark.clientHeight, r = logo.getBoundingClientRect();
    const k = 1200 / 910, cw = Math.min(r.width, r.height * k), ch = cw / k;
    mark.style.setProperty('--mx', `${r.left + (r.width - cw) / 2 - ir.left - (ir.width - w) / 2}px`);
    mark.style.setProperty('--my', `${r.top + (r.height - ch) / 2 - ir.top - (ir.height - h) / 2}px`);
    mark.style.setProperty('--ms', (cw / w).toFixed(4));
  };
  aim();
  document.fonts.ready.then(aim);
  addEventListener('resize', aim);
  intro.addEventListener('animationend', e => { if (e.animationName !== 'intro-end') return;   // not the veil on ::before
    intro.remove(); off(); removeEventListener('resize', aim); settled(); });
} else {
  intro?.remove();
  settled();
}

// ---------- departures board (split flaps) ----------
// Each cell becomes a row of flap tiles (the plain text stays for screen readers). On first view every
// tile flips through 4–9 throwaway glyphs, columns 25 ms and rows 90 ms apart, all settled within 1.4 s;
// GT406's status re-flaps whenever the status machine moves on.
// The blank is a no-break space: a tile holding a collapsible space has no baseline and the row grows 4 px (CLS).
const GLYPHS = '\u00a0ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:-';
const COLS = [5, 5, 13, 1, 10];
const BOARD = { ontime: ['ON TIME', 'ok'], boarding: ['BOARDING', 'ok'], finalcall: ['FINAL CALL', 'warn'], inflight: ['DEPARTED', 'fly'], landed: ['ARRIVED', 'ok'] };
const boardEl = $('#board'), boardSt = $('#board-st'), boardCells = $$('#board td');
let boardSeen = reduce.matches;
function setCell(td, text) {
  td.dataset.text = text;
  const shown = boardSeen ? text.padEnd(COLS[td.cellIndex]) : ' '.repeat(COLS[td.cellIndex]);
  td.innerHTML = `<span class="flaps" aria-hidden="true">${[...shown].map(c => `<i>${c === ' ' ? '&nbsp;' : c}</i>`).join('')}</span><span class="sr-only">${text}</span>`;
}
function flapCells(cells) {
  const jobs = [], t0 = performance.now();
  for (const [td, delay] of cells) {
    const final = [...td.dataset.text.padEnd(COLS[td.cellIndex])];
    $$('.flaps i', td).forEach((i, n) => jobs.push({ i, delay, n: 4 + Math.floor(Math.random() * 6), ch: final[n] === ' ' ? '\u00a0' : final[n], k: -1 }));
  }
  const id = setInterval(() => {
    const t = performance.now() - t0;
    let busy = false;
    for (const j of jobs) {
      if (j.done) continue;
      busy = true;
      const k = Math.floor((t - j.delay) / 45);
      if (k < 0 || k === j.k) continue;
      // A late tick can skip steps, so "at or past the last flip" lands the real glyph, never "exactly at".
      j.k = k;
      j.done = k >= j.n;
      j.i.textContent = j.done ? j.ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      j.i.animate([{ transform: 'scaleY(.55)' }, { transform: 'none' }], { duration: 45 });
    }
    if (!busy) clearInterval(id);
  }, 45);
}
boardCells.forEach(td => setCell(td, td.textContent.trim()));
function boardStatus(state) {
  const [text, cls] = BOARD[state];
  boardSt.className = 'st ' + cls;
  setCell(boardSt, text);
  if (boardSeen && !reduce.matches) flapCells([[boardSt, 0]]);
}
if ('IntersectionObserver' in window && !boardSeen) {
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    boardSeen = true;
    flapCells(boardCells.map(td => [td, td.cellIndex * 25 + td.parentNode.sectionRowIndex * 90]));
  }, { rootMargin: '99999px 0px 0px 0px', threshold: 0.3 });
  io.observe(boardEl);
} else {
  boardSeen = true;
  boardCells.forEach(td => setCell(td, td.dataset.text));
}
const lsClock = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' });

// ---------- countdown, days chip, status machine ----------
const cells = $$('#cd .num'), cdSr = $('#cd-sr');
const two = n => String(n).padStart(2, '0');
let spinning = false, lastMinute = -1, lastState = '';

// Old digit rolls up and out, the new one rolls in from below; under reduced motion the text just swaps.
function setDigits(el, str) {
  while (el.children.length < str.length) {
    const d = document.createElement('span');
    d.className = 'digit';
    d.append(document.createElement('span'));
    el.append(d);
  }
  [...str].forEach((ch, i) => {
    const cell = el.children[i], cur = cell.lastElementChild;
    if (cur.textContent === ch) return;
    if (reduce.matches || !cur.textContent) { cur.textContent = ch; return; }
    cur.className = 'out';
    cur.addEventListener('animationend', () => cur.remove(), { once: true });
    const n = document.createElement('span');
    n.className = 'in';
    n.textContent = ch;
    cell.append(n);
  });
}
const values = c => [c.days, c.hours, c.minutes, c.seconds].map(two);

// On latch every cell rolls through six throwaway values before it lands (60 ms apart, cells 40 ms apart).
function spinUp() {
  if (reduce.matches) return;
  spinning = true;
  cells.forEach((el, i) => {
    for (let k = 0; k < 6; k++) setTimeout(() => setDigits(el, two(Math.floor(Math.random() * 100))), i * 40 + k * 60);
    setTimeout(() => {
      setDigits(el, values(now())[i]);
      if (i === cells.length - 1) spinning = false;
    }, i * 40 + 6 * 60);
  });
}

const zoneFmt = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
const localTime = t => new Intl.DateTimeFormat('en-GB', zoneFmt).format(t);
// The countdown runs to GTA VI's unlock where the visitor is, not to GT406's landing in Vice City.
const UNLOCK = localUnlock(), now = () => countdown(Date.now(), UNLOCK.at);
{
  const z = UNLOCK.zone, at = new Date(UNLOCK.at);
  const date = new Intl.DateTimeFormat('en-GB', { timeZone: z, day: 'numeric', month: 'short', year: 'numeric' }).format(at);
  // en-US knows PST/EST, en-GB knows CET/GMT/BST; each falls back to "GMT+1" style for the other's zones.
  const abbr = l => new Intl.DateTimeFormat(l, { timeZone: z, timeZoneName: 'short' }).formatToParts(at).find(x => x.type === 'timeZoneName').value;
  const name = [abbr('en-US'), abbr('en-GB')].find(n => !n.startsWith('GMT') || n === 'GMT') ?? abbr('en-GB');
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: z, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at) + ' ' + name;
  $('.arrive-main').textContent = `Release ${date} · ${time}`;
  // The browser only knows the zone, not the country or the platform, so the line names the zone's city.
  // A country releases at once, so away from its first zone it is not midnight (21:00 in Los Angeles).
  const city = z.split('/').at(-1).replace(/_/g, ' ');
  const midnight = time.startsWith('00:00') && date.startsWith('19 ');
  $('.arrive-local').textContent = `Your time · ${city}` + (UNLOCK.estimated ? ', estimated' : midnight ? '' : ', same moment across the country');
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  $('#local-time').innerHTML = `In your time zone${zone ? ` (${zone.replace(/_/g, ' ')})` : ''}, GT406 departs <b>${localTime(FLIGHT.dep)}</b> and lands <b>${localTime(FLIGHT.arr)}</b>.`;
}

function applyState(c) {
  if (c.state === lastState) return;
  lastState = c.state;
  root.dataset.flight = c.state;
  boardStatus(c.state);
  $('.cd-cap').hidden = c.state !== 'inflight';
  $('.kicker-st').textContent = c.state === 'inflight' ? 'In flight' : c.state === 'landed' ? 'Arrived' : 'Now boarding';
  if (c.state === 'landed') {
    root.classList.add('after-arrival');
    $('.hero-line').textContent = 'Wheels down. Welcome to Vice City.';
    $('.arrive-main').textContent = 'GTA VI is out. Why are you still here?';
    $('.arrive-local').hidden = true;
  }
}

let heroOn = true;
function tick() {
  const c = now();
  applyState(c);
  // One clock, floor rule everywhere: the chip and the digits can never disagree.
  const [n, ...words] = c.label.split(' '), num = /^\d+$/.test(n);
  $('.days-n').textContent = num ? n : '';
  $('.days-n').hidden = !num;
  const l = $$('.days-l span'), w = num ? words : [n, ...words];
  l[0].textContent = w[0];
  l[1].textContent = w.slice(1).join(' ');
  if (heroOn && !spinning) values(c).forEach((v, i) => setDigits(cells[i], v));
  if (c.minutes !== lastMinute) {
    lastMinute = c.minutes;
    $('#board-clock').textContent = 'Local time ' + lsClock.format(Date.now());
    const parts = [[c.days, 'day'], [c.hours, 'hour'], [c.minutes, 'minute']].filter(([v]) => v).slice(0, 2);
    cdSr.textContent = c.ms ? parts.map(([v, u]) => `${v} ${u}${v === 1 ? '' : 's'}`).join(', ') + ' to go' : 'Landed';
  }
  clearTimeout(tickT);
  tickT = setTimeout(tick, 1000 - (Date.now() % 1000));
}
let tickT = 0;
tick();
// Background tabs throttle timers; a returning visitor gets the right second at once, not up to a minute late.
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });

// ---------- hero scrub (one rAF loop for the hero, progress bar and scroll-ink) ----------
const hero = $('#top'), photo = $('.hero-photo img'), title = $('.hero-title'), shade = $('.hero-shade');
const latches = $$('.latch'), progress = $('#progress');

function scrub(vh) {
  const r = hero.getBoundingClientRect(), p = reduce.matches ? 0 : clamp(-r.top / (r.height - vh || 1));
  if (reduce.matches) return;
  // Slow push into the shot while the copy settles; the splash's own zoom owns the transform until it ends.
  if (!photo.getAnimations().length) photo.style.setProperty('--zoom', lerp(1.02, 1.1, p).toFixed(4));
  shade.style.opacity = lerp(0.9, 1, p / 0.7).toFixed(3);
  title.style.transform = `translateY(${lerp(0, -8, p / 0.52).toFixed(2)}px) scale(${lerp(1, 0.94, p / 0.52).toFixed(4)})`;
  // Latches never un-latch: the arrival line and the countdown stay once they have been earned.
  for (const el of latches) if (!el.classList.contains('on') && p >= +el.dataset.at) {
    el.classList.add('on');
    if (el.id === 'cd') spinUp();
  }
}

const inks = new Set();
let raf = 0, prog = 0;
const kick = () => { raf ||= requestAnimationFrame(frame); };
function frame() {
  raf = 0;
  const vh = innerHeight;
  if (heroOn) scrub(vh);
  const max = root.scrollHeight - vh, target = max > 0 ? clamp(scrollY / max) : 0;
  prog = reduce.matches ? target : prog + (target - prog) * 0.2;
  if (Math.abs(target - prog) < 0.0005) prog = target; else kick();
  progress.style.transform = `scaleX(${prog.toFixed(4)})`;
  for (const el of inks) {
    const b = el.getBoundingClientRect();
    el.style.setProperty('--ink-pos', reduce.matches ? '50%' : (clamp((vh * 0.92 - b.top) / (vh * 0.68 + b.height * 0.2)) * 100).toFixed(1) + '%');
  }
}
addEventListener('scroll', kick, { passive: true });
addEventListener('resize', () => { kick(); placeDot(); });

if ('IntersectionObserver' in window) {
  new IntersectionObserver(([e]) => {
    heroOn = e.isIntersecting;
    if (heroOn) kick();
  }).observe(hero);
  const inkIO = new IntersectionObserver(es => { for (const e of es) e.isIntersecting ? inks.add(e.target) : inks.delete(e.target); kick(); }, { rootMargin: '15% 0px' });
  $$('.ink').forEach(el => inkIO.observe(el));
} else {
  $$('.ink').forEach(el => inks.add(el));
}
if (reduce.matches) latches.forEach(el => el.classList.add('on'));
frame();

// ---------- reveals ----------
{
  const els = $$('.rv-head, .rv-block, .rv-item');
  $$('.rv-item').forEach(el => el.style.setProperty('--i', [...el.parentNode.children].indexOf(el) % 6));
  if (!('IntersectionObserver' in window) || reduce.matches) els.forEach(el => el.classList.add('in'));
  else {
    const show = (es, io) => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    // The huge top margin counts everything above the viewport as seen, so a jump past a section
    // (anchor link, End key) never leaves it hidden behind you.
    const head = new IntersectionObserver(show, { rootMargin: '99999px 0px -6% 0px' });
    const block = new IntersectionObserver(show, { rootMargin: '99999px 0px 0px 0px', threshold: 0.06 });
    els.forEach(el => (el.classList.contains('rv-block') ? block : head).observe(el));
  }
}

// ---------- dock ----------
// The pill behind the active section slides between links; over the hero no section is active.
const dock = $('.dock'), dot = $('.dock-ind'), links = $$('.dock nav a');
let active = null;
function placeDot() {
  links.forEach(l => l === active ? l.setAttribute('aria-current', 'true') : l.removeAttribute('aria-current'));
  dot.classList.toggle('on', !!active);
  if (active) { dot.style.translate = `${active.offsetLeft}px 0`; dot.style.width = `${active.offsetWidth}px`; }
}
setTimeout(() => dock.classList.add('on'), 100);
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    active = links.find(l => l.hash === '#' + e.target.id) || null;
    placeDot();
  }), { rootMargin: '-20% 0px -50% 0px' });
  ['top', ...links.map(l => l.hash.slice(1))].forEach(id => { const t = document.getElementById(id); t && io.observe(t); });
}
