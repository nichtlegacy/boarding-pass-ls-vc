// Flight GT406 — check-in: name field, live preview (printer feed, double buffer, split flaps), livery and
// format switchers, export buttons, URL sync, shared-pass banner, full-screen viewer and embed snippets.
// The ticket engine (ticket.js, export.js and the art) and the five ticket faces load lazily: on idle after
// the splash, when #checkin comes within 600 px, or at once on a deep link.
import { cleanName, derive, shareUrl, ORIGIN } from './js/passenger.js';
import { THEME_IDS, themeOf } from './js/themes.js';
import { toast } from './app.js';

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const narrow = matchMedia('(max-width: 760px)');
const touch = matchMedia('(hover: none)');
const fine = matchMedia('(hover: hover) and (pointer: fine)');
const idle = window.requestIdleCallback || (f => setTimeout(f, 200));

const input = $('#name'), stage = $('#stage'), paper = $('.paper'), bufs = $$('.buf'), banner = $('#banner');
const msgEl = $('#name-msg'), countEl = $('#count'), stageSr = $('#stage-sr');
const dl = $('#dl'), copyBtn = $('#copy'), shareBtn = $('#share'), linkBtn = $('#link'), viewBtn = $('#view');
const dockDl = $('#dock-dl'), dockLink = $('#dock-link'), viewer = $('#viewer'), embedBox = $('#embed');

const S = { theme: 'night', format: null, type: 'png', scale: fine.matches ? 2 : 1 };
let E = null, engineP = null;             // ticket.js exports + { exp: export.js } once loaded
let p = derive(''), shown = null, cur = 0, armed = false, sharedName = '';
const fmt = () => S.format || (narrow.matches ? 'story' : 'ticket');
const opts = () => ({ format: fmt(), theme: S.theme });
const state = () => stage.dataset.state;
const escAttr = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

// ---------- engine ----------
function engine() {
  engineP ||= Promise.all([import('./js/ticket.js'), import('./js/export.js')]).then(async ([ticket, exp]) => {
    await ticket.fontsReady();   // never measure or paint a name in a fallback face
    E = { ...ticket, exp };
    for (const l of $$('.lv')) l.hidden = !THEME_IDS.includes($('input', l).value);
    for (const c of $$('.lv-card')) c.hidden = !THEME_IDS.includes(c.dataset.livery);
    for (const r of $$('input[name=format]')) r.closest('label').hidden = !E.FORMAT_IDS.includes(r.value);
    copyBtn.hidden = !exp.can.copyImage;
    shareBtn.hidden = !exp.can.shareFiles;
    labelPrimary();
    if (!shown) commit(true);
  }).catch(() => { engineP = null; });   // the stage keeps its placeholder; the next trigger retries
  return engineP;
}

// ---------- render: build into the hidden buffer, then cross-fade ----------
function render({ flaps = false } = {}) {
  const next = 1 - cur, b = bufs[next], f = fmt();
  b.innerHTML = E.buildTicketSVG(p, { format: f, theme: S.theme, prefix: next ? 'tb-' : 'ta-' });
  stage.dataset.format = f;
  b.classList.add('on'); b.removeAttribute('aria-hidden'); b.inert = false;
  bufs[cur].classList.remove('on'); bufs[cur].setAttribute('aria-hidden', 'true'); bufs[cur].inert = true;
  cur = next;
  shown = { key: p.key, ghost: p.ghost, theme: S.theme, format: f };
  stage.classList.toggle('first', p.cabin === 'FIRST' && !p.ghost);
  if (flaps) flap(b.firstElementChild);
}
const visibleSvg = () => bufs[cur].firstElementChild;

// Split flaps on commit: every 35 ms each code character cycles; they settle left to right, 40 ms apart.
const ABC = 'BCDFGHJKLMNPQRSTVWXZ23456789';
let flapT = 0;
function flap(svg) {
  clearInterval(flapT);
  if (reduce.matches || !svg) return;
  const els = $$('[data-flap]', svg).filter(e => !e.firstElementChild), finals = els.map(e => e.textContent), t0 = performance.now();
  flapT = setInterval(() => {
    const t = performance.now() - t0;
    els.forEach((e, k) => {
      const f = [...finals[k]], n = f.length;
      e.textContent = f.map((ch, i) => (t >= 420 - (n - 1 - i) * 40 || !/[A-Z0-9]/.test(ch) ? ch : ABC[(Math.random() * ABC.length) | 0])).join('');
    });
    if (t >= 420) clearInterval(flapT);
  }, 35);
}

// ---------- states: empty → printing → ready → empty ----------
let printT = 0, sheenT = 0;
function setState(s) {
  clearTimeout(printT);
  if (s !== 'printing') stage.classList.remove('sheening');
  stage.dataset.state = s;
  enable(s === 'ready');
}
function print() {
  if (reduce.matches) return setState('ready');
  setState('printing');
  stage.classList.add('sheening');
  clearTimeout(sheenT);
  sheenT = setTimeout(() => stage.classList.remove('sheening'), 2800);
  // Controls come alive when the paper is out (feed 1.3 s); the state flips once it has settled.
  printT = setTimeout(() => {
    enable(true);
    printT = setTimeout(() => { if (state() === 'printing') { stage.dataset.state = 'ready'; } }, 500);
  }, 1300);
}

const actions = [dl, copyBtn, shareBtn, linkBtn, dockDl, dockLink];
function enable(on) {
  armed = on;
  for (const b of actions) {
    if (on) { b.removeAttribute('aria-disabled'); if (!b.dataset.tip) b.removeAttribute('title'); }
    else { b.setAttribute('aria-disabled', 'true'); if (!b.dataset.tip) b.title = 'Type a name first'; }
  }
}

// ---------- typing and commit ----------
const MSG = {
  none: 'This printer knows Latin, Greek and Cyrillic letters. Try a Latin spelling or your gamertag.',
  emoji: "Emoji don't fit through the ticket printer, so they were left out.",
  other: "Some characters can't be printed on a FlyUS ticket and were left out.",
  cut: 'Names stop at 24 characters on FlyUS tickets.',
};
function onType() {
  const c = cleanName(input.value), n = [...c.name].length;
  msgEl.textContent = !c.name && input.value.trim() && c.removedOther ? MSG.none
    : c.removedEmoji ? MSG.emoji : c.removedOther ? MSG.other : c.cut ? MSG.cut : '';
  countEl.hidden = n < 18;
  countEl.textContent = `${n}/24`;
  countEl.classList.toggle('full', n >= 24);
  if (sharedName && c.name !== sharedName) banner.hidden = true;
  // Per keystroke only the name text changes; the full render waits for the 350 ms commit.
  if (E && visibleSvg()) E.patchName(visibleSvg(), derive(c.name), fmt());
  clearTimeout(commitT);
  commitT = setTimeout(commit, 350);
}

let commitT = 0, urlT = 0, srT = 0;
function commit(force = false) {
  clearTimeout(commitT);
  const next = derive(cleanName(input.value).name), view = { theme: S.theme, format: fmt() };
  const same = shown && shown.key === next.key && shown.ghost === next.ghost && shown.theme === view.theme && shown.format === view.format;
  if (same && !force) return;
  const renamed = !shown || shown.key !== next.key || shown.ghost !== next.ghost;
  p = next;
  if (!E) { engine(); return; }
  const was = state(), flaps = renamed && !p.ghost && was === 'ready';
  // A format change reshapes the stage: a view transition morphs the old frame into the new one.
  if (shown && shown.format !== view.format && document.startViewTransition && !reduce.matches) document.startViewTransition(() => render({ flaps }));
  else render({ flaps });
  if (p.ghost) { if (was !== 'empty') setState('empty'); }
  else if (was === 'empty') print();
  if (renamed) status();
  embed();
  liveries();
  clearTimeout(urlT);
  urlT = setTimeout(syncUrl, 350);
  if (!p.ghost) setTimeout(() => E.exp.prepare(p, opts()), 600);
}

function status() {
  clearTimeout(srT);
  if (!p.ghost) srT = setTimeout(() => { stageSr.textContent = `Boarding pass updated: seat ${p.seat}, reference ${p.pnr}`; }, 800);
}

// The address bar mirrors the ticket (replaceState only: the back button should leave the page, not undo letters).
function syncUrl() {
  const u = new URL(shareUrl(p.name, S.theme, S.format || undefined));
  history.replaceState(history.state, '', location.pathname + u.search);
}

input.addEventListener('input', onType);
input.addEventListener('blur', () => commit());
$('#ci-form').addEventListener('submit', e => {
  e.preventDefault();
  commit();
  if (!p.ghost) {
    dl.focus();
    dl.classList.remove('pulse'); void dl.offsetWidth; dl.classList.add('pulse');
  }
});
const cast = $$('[data-try]');
const markCast = () => { const v = input.value.trim().toLowerCase(); cast.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.try.toLowerCase() === v))); };
for (const b of cast) b.addEventListener('click', () => { input.value = b.dataset.try; onType(); commit(); markCast(); });
input.addEventListener('input', markCast);

// ---------- livery and format ----------
const glow = () => root.style.setProperty('--stage-glow', themeOf(S.theme).pageGlow);
for (const r of $$('input[name=theme]')) r.addEventListener('change', () => { S.theme = r.value; glow(); commit(); });
for (const r of $$('input[name=format]')) r.addEventListener('change', () => { S.format = r.value; commit(); });
narrow.addEventListener('change', () => {
  if (S.format) return;
  $(`input[name=format][value=${fmt()}]`).checked = true;
  stage.dataset.format = fmt();
  if (E) commit();
});

// ---------- export ----------
function labelPrimary() {
  $$('input[name=scale]').forEach(r => { r.disabled = S.type === 'svg'; });
  $('.dl-label', dl).textContent = touch.matches ? 'Save or share'
    : S.type === 'svg' ? 'Download SVG' : `Download ${S.type.toUpperCase()} · ${S.scale}×`;
}
for (const r of $$('input[name=type]')) r.addEventListener('change', () => { S.type = r.value; labelPrimary(); });
for (const r of $$('input[name=scale]')) r.addEventListener('change', () => { S.scale = +r.value; labelPrimary(); });
// Set from state, not from the markup: browsers restore radio choices on reload and would desync the label.
$(`input[name=type][value=${S.type}]`).checked = true;
$(`input[name=scale][value="${S.scale}"]`).checked = true;
labelPrimary();
touch.addEventListener('change', labelPrimary);

// Download and Copy link while EMPTY lead to the field instead of failing silently.
function needName() {
  document.getElementById('checkin').scrollIntoView({ behavior: reduce.matches ? 'instant' : 'smooth' });
  input.focus({ preventScroll: true });
  toast('Check in first: type a name.');
}
const jammed = () => toast('The printer jammed. Try PNG at 1× or another browser.');
const blocked = () => toast('Your browser kept the ticket to itself. Use Download instead.');

async function save(type = S.type, scale = S.scale) {
  const o = opts(), x = E.exp;
  dl.setAttribute('aria-busy', 'true');
  try {
    const blob = type === 'svg' ? await x.exportSVG(p, o) : await x.exportRaster(p, { ...o, type, scale });
    const name = x.fileName(p, { ...o, scale }, type);
    x.download(blob, name);
    toast(type === 'svg' ? 'Saved as SVG, fonts included.' : type === 'jpg' ? 'Saved as JPG.' : `Saved ${name}. Enjoy the flight.`);
  } catch { jammed(); }
  dl.removeAttribute('aria-busy');
}
async function share() {
  try {
    const r = await E.exp.shareImage(p, opts());
    if (r === 'retry') toast('Your ticket is ready. Tap Share again.');
    else if (r === 'unsupported') save('png', 1);
  } catch { jammed(); }
}
function primary() {
  if (!armed) return needName();
  touch.matches ? share() : save();
}
function copyLink() {
  if (!armed) return needName();
  navigator.clipboard.writeText(shareUrl(p.name, S.theme, S.format || undefined)).then(() => toast('Link copied. Same name, same seat.'), blocked);
}
dl.addEventListener('click', primary);
dockDl.addEventListener('click', () => (armed && touch.matches ? share() : armed ? save() : needName()));
linkBtn.addEventListener('click', copyLink);
dockLink.addEventListener('click', copyLink);
shareBtn.addEventListener('click', () => (armed ? share() : needName()));
// Safari only writes the clipboard inside the click, so the PNG promise goes in synchronously.
copyBtn.addEventListener('click', () => {
  if (!armed) return needName();
  const post = fine.matches ? { href: 'https://x.com/intent/post?text=' + encodeURIComponent(E.exp.shareText(p, opts())), label: 'Post on X ↗' } : null;
  E.exp.copyImage(E.exp.pngPromise(p, opts())).then(() => toast('Ticket copied. Paste it anywhere.', post), blocked);
});

addEventListener('keydown', e => {
  const typing = e.target.matches?.('input:not([type=radio]), textarea, [contenteditable]');
  if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); input.focus(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && armed && !p.ghost) { e.preventDefault(); save(); }
});

// ---------- tilt, glare, holo (fine pointers only; never during the feed or under reduced motion) ----------
if (fine.matches && !reduce.matches) {
  const tilt = $('.tilt');
  let pt = null, tiltRaf = 0;
  const apply = () => {
    tiltRaf = 0;
    if (!pt || state() !== 'ready') return;
    const r = paper.getBoundingClientRect(), x = clamp01((pt.x - r.left) / r.width), y = clamp01((pt.y - r.top) / r.height);
    // Big surfaces swing further for the same angle, so Story and Post tilt half as much as the ticket.
    const k = stage.dataset.format === 'ticket' ? 5 : 2.4;
    tilt.style.cssText = `--rx:${((0.5 - y) * k).toFixed(2)}deg;--ry:${((x - 0.5) * k).toFixed(2)}deg;--gx:${(x * 100).toFixed(1)}%;--gy:${(y * 100).toFixed(1)}%;--hx:${(x * 100).toFixed(1)}%;--hy:${(y * 100).toFixed(1)}%`;
    tilt.classList.add('live');
  };
  paper.addEventListener('pointermove', e => { pt = e; tiltRaf ||= requestAnimationFrame(apply); });
  paper.addEventListener('pointerleave', () => { pt = null; tilt.classList.remove('live'); tilt.style.cssText = ''; });
}
function clamp01(v) { return Math.min(1, Math.max(0, v)); }

// ---------- viewer ----------
function openViewer() {
  if (!armed) return;
  const art = $('.viewer-art', viewer), f = fmt();
  art.innerHTML = E.buildTicketSVG(p, { format: f, theme: S.theme, prefix: 'v-' });
  // A landscape ticket on a portrait phone is turned on its side, like holding the real thing.
  const rot = f === 'ticket' && innerHeight > innerWidth;
  art.classList.toggle('rot', rot);
  $('.viewer-hint', viewer).hidden = !rot;
  viewer.showModal();
}
viewBtn.addEventListener('click', openViewer);
paper.addEventListener('click', () => { if (touch.matches) openViewer(); });
$('.viewer-close', viewer).addEventListener('click', () => viewer.close());
$('.viewer-save', viewer).addEventListener('click', share);
viewer.addEventListener('click', e => { if (e.target === viewer) viewer.close(); });
viewer.addEventListener('close', () => { $('.viewer-art', viewer).textContent = ''; });

// ---------- embed snippets ----------
function embed() {
  if (!embedBox.open || !E) return;
  const f = fmt(), F = E.FORMATS[f], alt = E.altText(p, f), name = p.name;
  const q = new URLSearchParams(name ? { name } : {});
  q.set('theme', 'auto');
  if (f !== 'ticket') q.set('format', f);
  const size = f === 'story' ? 'aspect-ratio:1080/1920;max-width:360px' : `max-width:640px;aspect-ratio:${F.width}/${F.height}`;
  $('#em-iframe').value = `<iframe src="${ORIGIN}embed.html?${q}" title="FlyUS boarding pass${name ? ' for ' + escAttr(name) : ''}" loading="lazy" style="border:0;width:100%;${size}"></iframe>`;
  $('#em-md').value = `[![${alt.replace(/[[\]]/g, '\\$&')}](${E.exp.fileName(p, { format: f, theme: S.theme }, 'png')})](${shareUrl(name)})`;
  const file = t => E.exp.fileName(p, { format: f, theme: t }, 'png');
  $('#em-html').value = `<picture>\n  <source media="(prefers-color-scheme: dark)" srcset="${file('night')}">\n  <img src="${file('keys')}" width="${F.width}" height="${F.height}" alt="${escAttr(alt)}">\n</picture>`;
}
embedBox.addEventListener('toggle', embed);
for (const b of $$('[data-copy]', embedBox)) b.addEventListener('click', () => {
  const text = b.dataset.copy === 'alt' ? E?.altText(p, fmt()) : $('#' + b.dataset.copy).value;
  if (text) navigator.clipboard.writeText(text).then(() => toast('Snippet copied.'), blocked);
});

// ---------- liveries strip: the current name in all four liveries, as small rasters ----------
const strip = $('#liveries'), cards = $$('.lv-card', strip);
let stripSeen = false, stripKey = '', stripT = 0;
function liveries() {
  cards.forEach(c => c.setAttribute('aria-pressed', String(c.dataset.livery === S.theme)));
  if (!stripSeen || !E || stripKey === p.key + p.ghost) return;
  stripKey = p.key + p.ghost;
  clearTimeout(stripT);
  stripT = setTimeout(() => idle(async () => {
    const q = p;
    for (const c of cards) {
      if (c.hidden) continue;
      const img = $('img', c);
      try {
        const blob = await E.exp.exportRaster(q, { format: 'ticket', theme: c.dataset.livery, type: 'png', scale: 0.4 });
        if (q !== p) return;   // a newer name is on its way; it renders its own set
        if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
        img.src = URL.createObjectURL(blob);
        img.classList.add('on');
      } catch { /* a failed thumbnail leaves the tile empty; the stage above still works */ }
    }
  }), 400);
}
for (const c of cards) c.addEventListener('click', () => {
  $(`input[name=theme][value=${c.dataset.livery}]`).click();
  stage.scrollIntoView({ behavior: reduce.matches ? 'instant' : 'smooth', block: 'center' });
});
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); stripSeen = true; engine().then(liveries); } }, { rootMargin: '400px 0px' });
  io.observe(strip);
}

// ---------- start: URL in, stage reserved, engine on the right trigger ----------
{
  const q = new URLSearchParams(location.search);
  if (THEME_IDS.includes(q.get('theme'))) S.theme = q.get('theme');
  if (['ticket', 'story', 'post'].includes(q.get('format'))) S.format = q.get('format');   // FORMAT_IDS; ticket.js loads lazily
  $(`input[name=theme][value=${S.theme}]`).checked = true;
  $(`input[name=format][value=${fmt()}]`).checked = true;
  stage.dataset.format = fmt();
  glow();
  enable(false);
  if (q.get('name')) {
    // Deep link (same test as the head script, which skipped the splash): jump straight to the gate, then
    // print once the fonts are in.
    input.value = sharedName = cleanName(q.get('name')).name;
    banner.hidden = !sharedName;
    root.classList.remove('shared');   // the head script showed it early; from here the attribute decides
    onType();
    markCast();
    clearTimeout(commitT);
    history.scrollRestoration = 'manual';
    document.getElementById('checkin').scrollIntoView({ behavior: 'instant' });
    input.focus({ preventScroll: true });
    input.select();
    engine();
  } else {
    const delay = { full: 2600, short: 1000 }[root.dataset.intro] || 0;
    setTimeout(() => idle(engine, { timeout: 4000 }), delay);
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); engine(); } }, { rootMargin: '600px 0px' });
      io.observe(stage);
    }
  }
}
