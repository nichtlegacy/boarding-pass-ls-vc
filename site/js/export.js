// Exports: standalone SVG with embedded fonts, PNG/JPG rasters, the 1× PNG cache behind Copy and Share.
// Import-safe in Node (capabilities are false there); everything else needs a browser.
import { buildTicketSVG, FORMATS } from './ticket.js';
import { photosFor, still } from './art.js';
import { themeOf, DEFAULT_THEME } from './themes.js';
import { slug, shareUrl, countdown, localUnlock } from './passenger.js';

const BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';

export const can = {
  copyImage: BROWSER && 'ClipboardItem' in window && !!navigator.clipboard?.write,
  shareFiles: BROWSER && (() => {
    try { return !!navigator.canShare?.({ files: [new File([new Blob()], 'x.png', { type: 'image/png' })] }); } catch { return false; }
  })(),
};

// ---------- fonts ----------

// An SVG drawn through <img> may not load anything external, so the five ticket faces travel inside it.
const FACES = [
  ['GT406 Sans', 400, 'normal', 'carlito-400.woff2'],
  ['GT406 Sans', 700, 'normal', 'carlito-700.woff2'],
  ['GT406 Sans', 700, 'italic', 'carlito-700i.woff2'],
  ['Archivo Expanded', 900, 'normal', 'archivo-expanded-900.woff2'],
  ['Arimo', 700, 'italic', 'arimo-700i.woff2'],
];
const dataUrl = blob => new Promise((ok, fail) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => fail(r.error); r.readAsDataURL(blob); });
let faces;
export function fontFaceCSS() {
  if (!faces) {
    faces = Promise.all(FACES.map(async ([family, weight, style, file]) => {
      const res = await fetch(new URL(`../fonts/${file}`, import.meta.url));
      if (!res.ok) throw new Error(`font ${file}: HTTP ${res.status}`);
      // Typed blob: the data URL says font/woff2 whatever MIME type the server sent.
      const src = await dataUrl(new Blob([await res.arrayBuffer()], { type: 'font/woff2' }));
      return `@font-face{font-family:"${family}";font-weight:${weight};font-style:${style};src:url(${src}) format("woff2")}`;
    })).then(rules => rules.join('\n'));
    faces.catch(() => { faces = null; });   // a failed fetch must not poison every later export
  }
  return faces;
}

// The photos travel inside the SVG for the same reason. Fetched once per file, then reused.
const photos = new Map();
function photoData(file) {
  if (!photos.has(file)) {
    // Animated stickers export as their fixed `-still` pose: a canvas would only catch whatever frame was showing.
    const p = fetch(new URL(`../img/${still(file)}`, import.meta.url)).then(res => {
      if (!res.ok) throw new Error(`photo ${file}: HTTP ${res.status}`);
      return res.blob();
    }).then(dataUrl);
    p.catch(() => photos.delete(file));
    photos.set(file, p);
  }
  return photos.get(file);
}
async function embedded(format, theme) {
  const files = photosFor(format, themeOf(theme).id), urls = await Promise.all(files.map(photoData));
  return file => urls[files.indexOf(file)];
}

// ---------- files ----------

export function fileName(p, { format, theme, scale } = {}, ext = 'png') {
  const t = themeOf(theme).id;
  return `flyus-gt406-${slug(p.name)}${FORMATS[format] && format !== 'ticket' ? '-' + format : ''}${t !== DEFAULT_THEME ? '-' + t : ''}${scale === 2 && ext !== 'svg' ? '@2x' : ''}.${ext}`;
}

export const shareText = (p, { theme } = {}) => `My seat to Vice City: ${p.seat} on FlyUS GT406. Get yours: ${shareUrl(p.name, themeOf(theme).id)}`;

export async function exportSVG(p, { format, theme, now } = {}) {
  const F = FORMATS[format] || FORMATS.ticket;
  const svg = buildTicketSVG(p, { format: F.id, theme, now, prefix: 'x-', embedFonts: await fontFaceCSS(), src: await embedded(F.id, theme) });
  return new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n', svg], { type: 'image/svg+xml;charset=utf-8' });
}

// rAF stalls in background tabs; the timeout keeps a prepare() running there from hanging forever.
const frame = () => new Promise(ok => { requestAnimationFrame(ok); setTimeout(ok, 50); });
const toBlob = (canvas, type, q) => new Promise((ok, fail) => canvas.toBlob(b => (b ? ok(b) : fail(new Error('toBlob failed'))), type, q));

// One path for every format and browser. Data URL rather than blob URL (Safari), and the second draw
// after two frames is for WebKit, which can paint an SVG image before its embedded fonts are decoded.
export async function exportRaster(p, { format, theme, type = 'png', scale = 1, now } = {}) {
  const F = FORMATS[format] || FORMATS.ticket, jpg = type === 'jpg' || type === 'jpeg';
  const svg = buildTicketSVG(p, { format: F.id, theme, now, prefix: 'x-', embedFonts: await fontFaceCSS(), src: await embedded(F.id, theme) });
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(F.width * scale); canvas.height = Math.round(F.height * scale);
  const ctx = canvas.getContext('2d');
  const paint = () => {
    if (jpg) { ctx.fillStyle = themeOf(theme).mat; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };
  paint(); await frame(); await frame(); paint();
  return toBlob(canvas, jpg ? 'image/jpeg' : 'image/png', jpg ? 0.92 : undefined);
}

// ---------- 1× PNG cache (Copy image and Share need a blob inside the user gesture) ----------

const cache = new Map();   // key -> { promise, blob }
const keyOf = (p, { format, theme } = {}) => [(FORMATS[format] || FORMATS.ticket).id, themeOf(theme).id, p.key, p.display, countdown(Date.now(), localUnlock().at).label].join('|');

export function pngPromise(p, opts = {}) {
  const k = keyOf(p, opts);
  let e = cache.get(k);
  if (!e) {
    e = { blob: null, promise: exportRaster(p, { format: opts.format, theme: opts.theme, type: 'png', scale: 1 }) };
    e.promise.then(b => { e.blob = b; }, () => cache.delete(k));
    cache.set(k, e);
    while (cache.size > 4) cache.delete(cache.keys().next().value);   // Map keeps insertion order: oldest first
  }
  return e.promise;
}

export function prepare(p, opts = {}) {
  if (!BROWSER || p.ghost) return;
  const idle = window.requestIdleCallback || (f => setTimeout(f, 200));
  idle(() => pngPromise(p, opts).catch(() => {}), { timeout: 2000 });
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = filename; a.hidden = true;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10e3);
}

// Safari only lets the clipboard be written inside the click, so the ClipboardItem takes the promise and
// the caller must not await anything before calling this.
export function copyImage(promise) {
  return navigator.clipboard.write([new ClipboardItem({ 'image/png': promise })]);
}

export async function shareImage(p, opts = {}) {
  if (!can.shareFiles) return 'unsupported';
  // A cached blob keeps the share inside the user gesture; awaiting a fresh render can lose it (retry).
  const blob = cache.get(keyOf(p, opts))?.blob || await pngPromise(p, opts);
  const file = new File([blob], fileName(p, { format: opts.format, theme: opts.theme, scale: 1 }, 'png'), { type: 'image/png' });
  try {
    await navigator.share({ files: [file], text: shareText(p, opts) });
    return 'shared';
  } catch (e) {
    if (e.name === 'AbortError') return 'cancelled';
    if (e.name === 'NotAllowedError') return 'retry';
    throw e;
  }
}
