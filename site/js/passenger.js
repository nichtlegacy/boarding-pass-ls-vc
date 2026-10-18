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
// `at` is the visitor's unlock (localUnlock().at on the page); the flight states keep the LSX schedule,
// but the game being out wins: Europe and Asia land before GT406 has even left.
export function countdown(now = Date.now(), at = FLIGHT.arr) {
  const ms = Math.max(0, at - now);
  const days = Math.floor(ms / DAY), hours = Math.floor(ms / HOUR) % 24, minutes = Math.floor(ms / MIN) % 60, seconds = Math.floor(ms / 1000) % 60;
  const state = now >= at ? 'landed' : now >= FLIGHT.dep ? 'inflight'
    : now >= FLIGHT.dep - 15 * MIN ? 'finalcall' : now >= FLIGHT.dep - 40 * MIN ? 'boarding' : 'ontime';
  const n = (v, one, many) => v + ' ' + (v === 1 ? one : many) + ' TO GO';
  const label = ms <= 0 ? 'WHEELS DOWN' : days ? n(days, 'DAY', 'DAYS') : hours ? n(hours, 'HOUR', 'HOURS')
    : minutes ? n(minutes, 'MIN', 'MIN') : n(seconds, 'SEC', 'SEC');
  return { state, ms, days, hours, minutes, seconds, label };
}

// ---------- regional unlock ----------
// PlayStation Store unlock windows for 19 Nov 2026 (15 waves over 63 storefronts), as collected by
// gtavicentre.com; Rockstar has only confirmed the date. Mostly midnight local, but each country unlocks at
// once (the US at 00:00 Eastern, so 21:00 on the West Coast). Zones not listed get local midnight, flagged
// as an estimate.
const WAVES = [
  ['2026-11-18T11:00Z', 'New Zealand|Pacific/Auckland,Pacific/Chatham'],
  ['2026-11-18T13:00Z', 'Australia|Australia/Sydney,Australia/Melbourne,Australia/Hobart,Australia/Brisbane,Australia/Adelaide,Australia/Darwin,Australia/Perth,Australia/Broken_Hill,Australia/Lord_Howe,Australia/Lindeman'],
  ['2026-11-18T15:00Z', 'Japan|Asia/Tokyo;South Korea|Asia/Seoul'],
  ['2026-11-18T16:00Z', 'Hong Kong|Asia/Hong_Kong;Malaysia|Asia/Kuala_Lumpur,Asia/Kuching;Singapore|Asia/Singapore;Taiwan|Asia/Taipei'],
  ['2026-11-18T17:00Z', 'Indonesia|Asia/Jakarta,Asia/Pontianak,Asia/Makassar,Asia/Jayapura;Thailand|Asia/Bangkok'],
  ['2026-11-18T18:30Z', 'India|Asia/Kolkata,Asia/Calcutta'],
  ['2026-11-18T20:00Z', 'the United Arab Emirates|Asia/Dubai'],
  ['2026-11-18T21:00Z', 'Saudi Arabia|Asia/Riyadh;Turkey|Europe/Istanbul,Asia/Istanbul'],
  ['2026-11-18T22:00Z', 'Bulgaria|Europe/Sofia;Cyprus|Asia/Nicosia,Europe/Nicosia,Asia/Famagusta;Finland|Europe/Helsinki;Greece|Europe/Athens;Israel|Asia/Jerusalem;Romania|Europe/Bucharest;South Africa|Africa/Johannesburg;Ukraine|Europe/Kyiv,Europe/Kiev,Europe/Uzhgorod,Europe/Zaporozhye'],
  ['2026-11-18T23:00Z', 'Austria|Europe/Vienna;Belgium|Europe/Brussels;Croatia|Europe/Zagreb;Czechia|Europe/Prague;Denmark|Europe/Copenhagen;France|Europe/Paris;Germany|Europe/Berlin,Europe/Busingen;Hungary|Europe/Budapest;Italy|Europe/Rome;Luxembourg|Europe/Luxembourg;Malta|Europe/Malta;the Netherlands|Europe/Amsterdam;Norway|Europe/Oslo;Poland|Europe/Warsaw;Slovakia|Europe/Bratislava;Slovenia|Europe/Ljubljana;Spain|Europe/Madrid,Atlantic/Canary,Africa/Ceuta;Sweden|Europe/Stockholm;Switzerland|Europe/Zurich'],
  ['2026-11-19T00:00Z', 'Iceland|Atlantic/Reykjavik;Ireland|Europe/Dublin;Portugal|Europe/Lisbon,Atlantic/Azores,Atlantic/Madeira;the UK|Europe/London,GB,GB-Eire'],
  ['2026-11-19T03:00Z', 'Argentina|America/Argentina/Buenos_Aires,America/Buenos_Aires;Brazil|America/Sao_Paulo,America/Manaus,America/Belem,America/Fortaleza,America/Recife,America/Maceio,America/Bahia,America/Santarem,America/Porto_Velho,America/Boa_Vista,America/Campo_Grande,America/Cuiaba,America/Rio_Branco,America/Eirunepe,America/Noronha;Chile|America/Santiago,America/Punta_Arenas,Pacific/Easter;Paraguay|America/Asuncion;Uruguay|America/Montevideo'],
  ['2026-11-19T04:00Z', 'Bolivia|America/La_Paz'],
  ['2026-11-19T05:00Z', 'Canada|America/Toronto,America/Vancouver,America/Edmonton,America/Winnipeg,America/Halifax,America/St_Johns,America/Regina,America/Whitehorse,America/Dawson,America/Dawson_Creek,America/Fort_Nelson,America/Creston,America/Moncton,America/Glace_Bay,America/Goose_Bay,America/Iqaluit,America/Rankin_Inlet,America/Resolute,America/Cambridge_Bay,America/Inuvik,America/Yellowknife,America/Rainy_River,America/Thunder_Bay,America/Montreal,America/Atikokan,America/Blanc-Sablon,America/Swift_Current;Colombia|America/Bogota;Ecuador|America/Guayaquil,Pacific/Galapagos;Panama|America/Panama;Peru|America/Lima;the US|America/New_York,America/Chicago,America/Denver,America/Los_Angeles,America/Phoenix,America/Anchorage,America/Adak,Pacific/Honolulu,America/Detroit,America/Boise,America/Juneau,America/Sitka,America/Metlakatla,America/Yakutat,America/Nome,US/Eastern,US/Central,US/Mountain,US/Pacific,US/Alaska,US/Hawaii'],
  ['2026-11-19T06:00Z', 'Costa Rica|America/Costa_Rica;El Salvador|America/El_Salvador;Guatemala|America/Guatemala;Honduras|America/Tegucigalpa;Mexico|America/Mexico_City,America/Cancun,America/Merida,America/Monterrey,America/Matamoros,America/Chihuahua,America/Ciudad_Juarez,America/Ojinaga,America/Hermosillo,America/Mazatlan,America/Bahia_Banderas,America/Tijuana;Nicaragua|America/Managua'],
];
const ZONES = new Map();
for (const [at, list] of WAVES) for (const c of list.split(';')) {
  const [country, zones] = c.split('|');
  for (const z of zones.split(',')) ZONES.set(z, { at: Date.parse(at), country });
}

// 00:00 on 19 Nov 2026 in `zone`: guess UTC midnight, then correct by the zone's wall-clock offset (twice
// covers a DST edge; there is none that night anywhere, but the loop costs nothing).
function localMidnight(zone) {
  const want = Date.UTC(2026, 10, 19);
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' });
  let t = want;
  for (let i = 0; i < 2; i++) {
    const p = Object.fromEntries(fmt.formatToParts(t).map(x => [x.type, +x.value]));
    t += want - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  }
  return t;
}

export function unlockFor(zone) {
  const hit = ZONES.get(zone) ?? (/^America\/(Indiana|Kentucky|North_Dakota)\//.test(zone) ? ZONES.get('America/New_York')
    : zone.startsWith('America/Argentina/') ? ZONES.get('America/Buenos_Aires') : null);
  if (hit) return { zone, ...hit, estimated: false };
  try { return { zone, at: localMidnight(zone), country: null, estimated: true }; }
  catch { return { zone, at: FLIGHT.arr, country: null, estimated: true }; }   // unknown zone name
}
let mine;
export const localUnlock = () => mine ??= unlockFor(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
