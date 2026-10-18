// Passenger data for flight GT406: name cleaning, the seeded per-name fields, share URLs and the one clock.
// Pure module: no DOM, no Date at import time, so Node (selftest, og.html) can import it.

export const DERIVE_VERSION = 1;
// FREEZE RULE: CABIN odds, seat maps, PNR alphabet, SIGNS list, salts and the draw order inside each
// stream are frozen for v1. Changing any of them silently re-seats existing share links. Additive changes
// use a NEW salt (a new stream), never a new draw on an existing stream. Golden values live in selftest.

export const ORIGIN = 'https://boardingpass.nichtlegacy.com/';
export const FLIGHT = {
  airline: 'FlyUS', number: 'GT406', slogan: 'Live a little, fly with US',
  disclaimer: ['FlyUS will not be held responsible for any', 'delays which may occur.'],
  from: { code: 'LSX', city: 'LOS SANTOS', date: '18 NOV 2026', time: '16:00', tz: 'PST', iana: 'America/Los_Angeles' },
  to:   { code: 'VCI', city: 'VICE CITY',  date: '19 NOV 2026', time: '00:00', tz: 'EST', iana: 'America/New_York' },
  gate: '6', terminal: '1', block: '5H 00M', julianDep: '322',
  dep: Date.UTC(2026, 10, 19, 0, 0),   // 18 Nov 2026 16:00 PST
  arr: Date.UTC(2026, 10, 19, 5, 0),   // 19 Nov 2026 00:00 EST = release
};
export const THEME_PARAM_DEFAULT = 'night';
export const ZONE_NAMES = ['STARFISH ISLAND', 'LEONIDA KEYS', 'OCEAN BEACH', 'GRASSRIVERS', 'PORT GELLHORN']; // zone 1..5
export const MAX_NAME = 24;

const GHOST = 'Your name here';

// ---------- cleaning (trust boundary: the input field and the URL both go through here) ----------

// Controls, C1, soft hyphen, zero-width/bidi marks, word joiners and invisible operators, BOM.
const STRIP = /[\u0000-\u001F\u007F-\u009F­​-‏‪-‮⁠-⁯﻿]/g;
// Pictographs, regional-indicator flags, skin tones, tag sequences, variation selectors and the keycap mark.
const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}︎️⃣]/gu;
// Allowlist == the Carlito subset in site/fonts (NAME range in scripts/fonts.sh, minus the arrow), so a
// name can never fall back to another font in the preview or the export. Carlito's own gaps are excluded.
const ALLOW = /[ -~ -¬®-ɏ΄-ΊΌΎ-ΡΣ-ώϐ-ϿЀ-ѵѷ-҆҈-ӿḀ-ẛẞẠ-ỹ–—‘’“”•…]/u;

export function cleanName(raw) {
  const s = String(raw ?? '').normalize('NFKC').replace(STRIP, '');
  const noEmoji = s.replace(EMOJI, '');
  let out = '', removedOther = false;
  for (const ch of noEmoji) ALLOW.test(ch) ? (out += ch) : (removedOther = true);
  out = out.replace(/\s+/g, ' ').trim();
  const chars = Array.from(out), cut = chars.length > MAX_NAME;
  if (cut) out = chars.slice(0, MAX_NAME).join('').trim();
  return { name: out, removedEmoji: noEmoji !== s, removedOther, cut };
}

// ---------- seeding ----------

// FNV-1a over code points (not UTF-16 units, not bytes): the golden values depend on it.
const fnv = str => { let h = 0x811c9dc5; for (const c of str) { h ^= c.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h; };
export const mulberry32 = a => () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

const PNR_ABC = 'BCDFGHJKLMNPQRSTVWXZ23456789';   // no vowels (no accidental words), no 0/O/1/I
const SIGNS = ['CORAL', 'MARLIN', 'TIDES', 'LAGUNA', 'PALMS', 'MIRAGE'];
const MAIN_ROWS = Array.from({ length: 23 }, (_, i) => 11 + i).filter(n => n !== 13);   // 22 rows, no row 13
const PALMS = 4;
const EGGS = { 'jason': ['FIRST', 1, 'A'], 'jason duval': ['FIRST', 1, 'A'], 'lucia': ['FIRST', 1, 'C'], 'lucia caminos': ['FIRST', 1, 'C'],
  'michael': ['FIRST', 2, 'F'], 'michael de santa': ['FIRST', 2, 'F'] };
// FlyUS's other in-game lines: the business-class ad, and the one Trevor would print.
const SLOGANS = { 'michael': 'Live a little better, fly with US', 'michael de santa': 'Live a little better, fly with US',
  'trevor': 'Sit back, relax and shut up', 'trevor philips': 'Sit back, relax and shut up' };
const CABIN_LABEL = { FIRST: 'First Class', EXTRA: 'Extra Legroom', MAIN: 'Main Cabin' };
const SEAT_TYPE = { A: 'window', F: 'window', B: 'middle', E: 'middle', C: 'aisle', D: 'aisle' };

function initialsOf(display) {
  // Letters of any allowed script: Carlito prints Greek and Cyrillic, so "Ξενοφών Π." gives "ΞΠ", not a folded guess.
  const w = display.toUpperCase().split(/[\s_.\-]+/).map(x => x.replace(/[^\p{L}]/gu, '')).filter(Boolean);
  if (!w.length) return 'VM';   // the template creator's initials
  return w.length > 1 ? w[0][0] + w.at(-1)[0] : (w[0] + 'X').slice(0, 2);
}

export function derive(raw) {
  const name = cleanName(raw).name, ghost = !name;
  const display = ghost ? GHOST : name, key = display.toLowerCase();
  // One independent stream per field, so a later field never shifts an earlier one.
  const stream = salt => mulberry32(fnv(key + '|' + salt));

  const c = stream('cabin')();
  let cabin = c < 0.03 ? 'FIRST' : c < 0.15 ? 'EXTRA' : 'MAIN', row, letter;
  const s = stream('seat');
  if (cabin === 'FIRST') { row = 1 + Math.floor(s() * 4); letter = pick(s, 'ACDF'); }
  else if (cabin === 'EXTRA') { row = 7 + Math.floor(s() * 4); letter = pick(s, 'ABCDEF'); }
  else { row = pick(s, MAIN_ROWS); letter = pick(s, 'ABCDEF'); }
  const p = stream('pnr'); let pnr = ''; for (let i = 0; i < 6; i++) pnr += pick(p, PNR_ABC);
  const seq = String(1 + Math.floor(stream('seq')() * 172)).padStart(3, '0');
  const a = stream('art');
  const sunT = a(), sunJ = a(), palms = [];
  for (let i = 0; i < PALMS; i++) palms.push([a(), a(), a(), a()]);
  const sign = pick(a, SIGNS);
  if (EGGS[key]) [cabin, row, letter] = EGGS[key];   // after the draws: only cabin/row/letter change

  // Back to front: First, then Extra Legroom, then the main cabin from the tail forward.
  const zone = cabin === 'FIRST' ? 1 : cabin === 'EXTRA' ? 2 : row >= 26 ? 3 : row >= 19 ? 4 : 5;
  const seat = row + letter;
  return {
    v: DERIVE_VERSION,
    ghost, name, display, key,
    cabin, cabinLabel: CABIN_LABEL[cabin],
    row, letter, seat, seatType: SEAT_TYPE[letter],
    zone, zoneName: ZONE_NAMES[zone - 1], boards: '15:' + (20 + (zone - 1) * 5),
    pnr, seq, initials: initialsOf(display), slogan: SLOGANS[key] ?? FLIGHT.slogan,
    // IATA-ish BCBP head: format code, name field (A–Z and space only, Code128-B safe), PNR, route.
    bcbp: ('M1' + display.toUpperCase().replace(/[^A-Z ]/g, '').slice(0, 14).padEnd(14, ' ') + 'E' + pnr + 'LSXVCI').slice(0, 31),
    stubCode: 'GT406 ' + FLIGHT.julianDep + ' ' + pnr + ' ' + cabin[0] + ' ' + seat.padStart(4, '0') + ' ' + seq,
    art: { sunT, sunJ, palms, sign, win: fnv(key + '|win') },
  };
}

// ---------- URLs ----------

const FOLD = { ł: 'l', Ł: 'L', ø: 'o', Ø: 'O', đ: 'd', Đ: 'D', ß: 'ss', æ: 'ae', Æ: 'AE', œ: 'oe', Œ: 'OE', þ: 'th', Þ: 'TH', ı: 'i' };
export function slug(name) {
  const ascii = String(name ?? '').replace(/[łŁøØđĐßæÆœŒþÞı]/g, ch => FOLD[ch]).normalize('NFKD').replace(/[^\x00-\x7F]/g, '');
  return ascii.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32).replace(/-+$/, '') || 'passenger';
}

// Address-bar form: URLSearchParams turns spaces into '+' and percent-encodes the rest.
export function shareUrl(name, theme, format) {
  const q = new URLSearchParams();
  if (name) q.set('name', name);
  if (theme && theme !== THEME_PARAM_DEFAULT) q.set('theme', theme);
  if (format) q.set('format', format);
  const s = q.toString();
  return ORIGIN + (s ? '?' + s : '');
}

// QR form: an IRI in UTF-8 byte mode. Only the characters that would break the query are escaped, so a
// Greek name stays short enough for a version 6 code and phone cameras still show it readable.
const iri = name => name.replace(/[%&#+?]/g, encodeURIComponent).replace(/ /g, '+');
export function qrText(name, theme) {
  if (!name) return ORIGIN;
  return ORIGIN + '?name=' + iri(name) + (theme && theme !== THEME_PARAM_DEFAULT ? '&theme=' + theme : '');
}

// ---------- the one clock (hero digits, days chip, Story days line all read this) ----------

const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR;
export function countdown(now = Date.now()) {
  const ms = Math.max(0, FLIGHT.arr - now);
  const days = Math.floor(ms / DAY), hours = Math.floor(ms / HOUR) % 24, minutes = Math.floor(ms / MIN) % 60, seconds = Math.floor(ms / 1000) % 60;
  const state = now >= FLIGHT.arr ? 'landed' : now >= FLIGHT.dep ? 'inflight'
    : now >= FLIGHT.dep - 15 * MIN ? 'finalcall' : now >= FLIGHT.dep - 40 * MIN ? 'boarding' : 'ontime';
  const n = (v, one, many) => v + ' ' + (v === 1 ? one : many) + ' TO GO';
  const label = ms <= 0 ? 'WHEELS DOWN' : days ? n(days, 'DAY', 'DAYS') : hours ? n(hours, 'HOUR', 'HOURS')
    : minutes ? n(minutes, 'MIN', 'MIN') : n(seconds, 'SEC', 'SEC');
  return { state, ms, days, hours, minutes, seconds, label };
}
