// The one runnable check: node scripts/selftest.mjs
// Golden values freeze the v1 derive (every share link depends on them); the SVG checks enforce the
// output rules of spec C.1 for every format, livery and awkward name.
import assert from 'node:assert/strict';
import { derive, cleanName, slug, shareUrl, qrText, countdown, unlockFor, FLIGHT, ORIGIN, DERIVE_VERSION } from '../site/js/passenger.js';
import { THEMES, THEME_IDS, themeOf } from '../site/js/themes.js';
import { code128, qrMatrix, C128_PATTERNS } from '../site/js/codes.js';
import { buildTicketSVG, FORMATS, FORMAT_IDS, altText, measure } from '../site/js/ticket.js';
import { fileName, can } from '../site/js/export.js';
import { storyStickers } from '../site/js/art.js';
import { frameAt, SPAN } from '../site/js/video.js';
import { FRAMES } from '../site/js/sticker-frames.js';

let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const eq = (a, b, msg) => { assert.deepEqual(a, b, msg); checks++; };

// ---------- golden table (spec D.4) ----------

const GOLDEN = [
  // input, display, cabin, seat, seatType, zone, boards, zoneName, pnr, seq, initials, sign
  ['Fixate', 'Fixate', 'MAIN', '15D', 'aisle', 5, '15:40', 'PORT GELLHORN', 'CWKFW6', '116', 'FI', 'LAGUNA'],
  ['Luther West', 'Luther West', 'MAIN', '33C', 'aisle', 3, '15:30', 'OCEAN BEACH', '37DZKV', '029', 'LW', 'MIRAGE'],
  ['VINEWOOD MOTORS', 'VINEWOOD MOTORS', 'MAIN', '33A', 'window', 3, '15:30', 'OCEAN BEACH', 'GCWQP9', '099', 'VM', 'PALMS'],
  ['Jason Duval', 'Jason Duval', 'FIRST', '1A', 'window', 1, '15:20', 'STARFISH ISLAND', 'BC6DJM', '165', 'JD', 'LAGUNA'],
  ['Lucia Caminos', 'Lucia Caminos', 'FIRST', '1C', 'aisle', 1, '15:20', 'STARFISH ISLAND', 'MT5HV8', '157', 'LC', 'LAGUNA'],
  ['', 'Your name here', 'MAIN', '12F', 'window', 5, '15:40', 'PORT GELLHORN', 'JVGCSV', '025', 'YH', 'MIRAGE'],
];
for (const [input, display, cabin, seat, seatType, zone, boards, zoneName, pnr, seq, initials, sign] of GOLDEN) {
  const p = derive(input);
  eq({ display: p.display, cabin: p.cabin, seat: p.seat, seatType: p.seatType, zone: p.zone, boards: p.boards, zoneName: p.zoneName, pnr: p.pnr, seq: p.seq, initials: p.initials, sign: p.art.sign },
    { display, cabin, seat, seatType, zone, boards, zoneName, pnr, seq, initials, sign }, `golden ${JSON.stringify(input)}`);
}
const lw = derive('Luther West');
eq(lw.stubCode, 'GT406 322 37DZKV M 033C 029', 'stub code');
eq(lw.bcbp, 'M1LUTHER WEST   E37DZKVLSXVCI', 'bcbp');
eq([lw.art.sunT.toFixed(3), lw.art.sunJ.toFixed(3)], ['0.204', '0.744'], 'art seeds');
eq(Object.keys(lw), ['v', 'ghost', 'name', 'display', 'key', 'cabin', 'cabinLabel', 'row', 'letter', 'seat', 'seatType', 'zone', 'zoneName', 'boards', 'pnr', 'seq', 'initials', 'slogan', 'bcbp', 'stubCode', 'art'], 'Passenger shape');
eq([lw.v, lw.ghost, lw.key, lw.cabinLabel, lw.row, lw.letter, DERIVE_VERSION], [1, false, 'luther west', 'Main Cabin', 33, 'C', 1], 'Passenger fields');
eq(Object.keys(lw.art), ['sunT', 'sunJ', 'palms', 'sign', 'win'], 'art shape');
ok(lw.art.palms.length === 4 && lw.art.palms.every(a => a.length === 4 && a.every(u => u >= 0 && u < 1)), 'palm seeds are 4 × 4 uniforms');
ok(Number.isInteger(lw.art.win) && lw.art.win >= 0, 'win seed');
const tv = derive('Tommy Vercetti');
eq([tv.seat, tv.pnr, tv.seq], ['23C', 'J9XRLW', '006'], 'Tommy Vercetti');
eq([derive('xX_ViceKing_Xx').cabin, derive('xX_ViceKing_Xx').seat], ['FIRST', '1A'], 'natural First pull');
const ghost = derive('');
ok(ghost.ghost && ghost.name === '' && ghost.key === 'your name here', 'ghost passenger');
eq(derive('Jason').seat, '1A', 'egg jason'); eq(derive('lucia').seat, '1C', 'egg lucia');
eq([derive('Michael De Santa').seat, derive('trevor').slogan, derive('Luther West').slogan], ['2F', 'Sit back, relax and shut up', 'Live a little, fly with US'], 'slogan eggs');

// ---------- case and whitespace insensitivity ----------

const a = derive('Luther West'), b = derive('  luther   WEST ');
eq({ ...a, name: 0, display: 0 }, { ...b, name: 0, display: 0 }, 'case/whitespace insensitive seed');
eq(b.display, 'luther WEST', 'display keeps casing as typed');

// ---------- distribution over 20,000 synthetic names ----------

const N = 20000, count = { FIRST: 0, EXTRA: 0, MAIN: 0 }, seats = new Set();
const PNR_RE = /^[BCDFGHJKLMNPQRSTVWXZ23456789]{6}$/;
for (let i = 0; i < N; i++) {
  const p = derive(`Passenger ${i}`);
  count[p.cabin]++; seats.add(p.seat);
  if (p.row === 13) assert.fail(`row 13 for Passenger ${i}`);
  if (p.cabin === 'FIRST' && !'ACDF'.includes(p.letter)) assert.fail(`First letter ${p.letter}`);
  if (!PNR_RE.test(p.pnr)) assert.fail(`PNR alphabet ${p.pnr}`);
  if (!/^\d{3}$/.test(p.seq) || +p.seq < 1 || +p.seq > 172) assert.fail(`seq ${p.seq}`);
}
checks += 4;
const pct = k => count[k] / N * 100;
ok(Math.abs(pct('FIRST') - 3) <= 0.6, `First ${pct('FIRST')} %`);
ok(Math.abs(pct('EXTRA') - 12) <= 0.6, `Extra ${pct('EXTRA')} %`);
ok(Math.abs(pct('MAIN') - 85) <= 0.6, `Main ${pct('MAIN')} %`);
eq(seats.size, 172, 'all 172 seats reachable');

// ---------- cleanName (trust boundary) ----------

eq(cleanName('ｘＸ＿Ｓｎｉｐｅｒ').name, 'xX_Sniper', 'NFKC full-width');
eq(cleanName('Lu‮ther​ We­st﻿').name, 'Luther West', 'bidi, zero-width, soft hyphen, BOM');
const flag = cleanName('Lucia 🇺🇸 👍🏽 1️⃣');
ok(flag.name === 'Lucia 1' && flag.removedEmoji && !flag.removedOther, 'emoji flags, skin tones, keycaps');
const zalgo = cleanName('Z̴͎a̷l̶g̸o');
ok(zalgo.name === 'Zalgo' && zalgo.removedOther, 'Zalgo marks dropped');
const long = cleanName('x'.repeat(40));
ok(Array.from(long.name).length === 24 && long.cut, '24 cap');
ok(Array.from(cleanName('Ж'.repeat(30)).name).length === 24, '24 code points, not bytes');
const cjk = cleanName('山田');
ok(cjk.name === '' && cjk.removedOther && derive('山田').ghost, '山田 -> ghost with removedOther');
eq(cleanName('Nguyễn Văn').name, 'Nguyễn Văn', 'Vietnamese kept');
eq(cleanName('  a \t\n b  ').name, 'a b', 'whitespace collapsed');
eq(cleanName(null).name, '', 'null safe');
eq(derive('Ξενοφών Παπαδόπουλος').initials, 'ΞΠ', 'Greek initials');
eq([derive('Fixate').initials, derive('###').initials, derive('Ada').initials], ['FI', 'VM', 'AD'], 'initials rules');

// ---------- slug, URLs, fileName ----------

eq(slug('Łukasz Żółw'), 'lukasz-zolw', 'slug fold');
eq(slug('🌴'), 'passenger', 'slug fallback');
eq(slug('Luther West'), 'luther-west', 'slug basic');
ok(slug('a'.repeat(20) + ' ' + 'b'.repeat(20)).length <= 32 && !slug('a'.repeat(31) + ' b').endsWith('-'), 'slug max 32, no trailing dash');
eq(shareUrl('Luther West'), ORIGIN + '?name=Luther+West', 'shareUrl default theme omitted');
eq(shareUrl('Luther West', 'sunset', 'story'), ORIGIN + '?name=Luther+West&theme=sunset&format=story', 'shareUrl full');
eq(shareUrl(''), ORIGIN, 'shareUrl ghost');
eq(qrText('a&b'), ORIGIN + '?name=a%26b', 'qrText &');
eq(qrText('Luther West', 'sunset'), ORIGIN + '?name=Luther+West&theme=sunset', 'qrText space and theme');
eq(qrText('Ξενοφών #1+1?%'), ORIGIN + '?name=Ξενοφών+%231%2B1%3F%25', 'qrText Greek raw, specials escaped');
eq(qrText('', 'night'), ORIGIN, 'qrText ghost');
eq(qrText('Luther West', 'night'), ORIGIN + '?name=Luther+West', 'qrText default theme omitted');
eq(fileName(lw, {}, 'png'), 'flyus-gt406-luther-west.png', 'fileName default');
eq(fileName(lw, { format: 'story', theme: 'sunset', scale: 2 }, 'png'), 'flyus-gt406-luther-west-story-sunset@2x.png', 'fileName story sunset 2x');
eq(fileName(lw, { theme: 'keys', scale: 2 }, 'svg'), 'flyus-gt406-luther-west-keys.svg', 'fileName svg has no @2x');
eq(fileName(ghost, { format: 'ticket', theme: 'nope', scale: 1 }, 'jpg'), 'flyus-gt406-passenger.jpg', 'fileName ghost, unknown theme');
eq(fileName(lw, { format: 'post' }, 'png'), 'flyus-gt406-luther-west-post.png', 'fileName post');
eq(fileName(lw, { format: 'story', theme: 'goodtime' }, 'mp4'), 'flyus-gt406-luther-west-story-goodtime.mp4', 'fileName animated Story');
eq([can.copyImage, can.shareFiles], [false, false], 'capabilities false in Node');

// ---------- countdown ----------

const cd = t => countdown(typeof t === 'string' ? Date.parse(t) : t);
const c0 = cd('2026-10-18T12:00Z');
eq([c0.days, c0.hours, c0.label, c0.state], [31, 17, '31 DAYS TO GO', 'ontime'], 'countdown 2026-10-18');
eq(cd(FLIGHT.dep - 30 * 60e3).state, 'boarding', 'dep-30min boarding');
eq(cd(FLIGHT.dep - 10 * 60e3).state, 'finalcall', 'dep-10min final call');
const c1 = cd(FLIGHT.dep + 3600e3);
eq([c1.state, c1.label], ['inflight', '4 HOURS TO GO'], 'dep+1h in flight');
const c2 = cd(FLIGHT.arr);
eq([c2.state, c2.label, c2.ms], ['landed', 'WHEELS DOWN', 0], 'arr landed');
eq(cd(FLIGHT.arr - 86400e3 - 1).label, '1 DAY TO GO', 'singular day');
eq(cd(FLIGHT.arr - 42 * 60e3).label, '42 MIN TO GO', 'minutes');
eq(cd(FLIGHT.arr + 1).ms, 0, 'ms never negative');
// Regional unlock: listed storefronts, a whole country at once, the Indiana/Argentina prefixes, the midnight estimate.
const un = (z, iso, country, est) => { const u = unlockFor(z); eq([u.at, u.country, u.estimated], [Date.parse(iso), country, est], 'unlock ' + z); };
un('Europe/Berlin', '2026-11-18T23:00Z', 'Germany', false);
un('Europe/London', '2026-11-19T00:00Z', 'the UK', false);
un('America/Los_Angeles', '2026-11-19T05:00Z', 'the US', false);
un('America/Indiana/Knox', '2026-11-19T05:00Z', 'the US', false);
un('America/Argentina/Cordoba', '2026-11-19T03:00Z', 'Argentina', false);
un('Pacific/Auckland', '2026-11-18T11:00Z', 'New Zealand', false);
un('Asia/Kathmandu', '2026-11-18T18:15Z', null, true);
un('Not/AZone', new Date(FLIGHT.arr).toISOString(), null, true);
const cb = countdown(Date.parse('2026-11-18T23:00Z'), unlockFor('Europe/Berlin').at);
eq([cb.state, cb.label], ['landed', 'WHEELS DOWN'], 'Berlin is out before GT406 departs');

// ---------- Code128 ----------

C128_PATTERNS.forEach((s, v) => ok([...s].reduce((x, d) => x + +d, 0) === (v === 106 ? 13 : 11), `pattern ${v} sum`));
function decode128(runs) {
  const syms = [];
  for (let i = 0; i < runs.length - 7; i += 6) syms.push(C128_PATTERNS.indexOf(runs.slice(i, i + 6).join('')));
  assert.equal(C128_PATTERNS.indexOf(runs.slice(-7).join('')), 106, 'stop');
  assert.equal(syms[0], 104, 'start B');
  const data = syms.slice(1, -1), check = syms.at(-1);
  assert.equal((104 + data.reduce((s, v, i) => s + v * (i + 1), 0)) % 103, check, 'checksum');
  return data.map(v => String.fromCharCode(v + 32)).join('');
}
for (const s of [lw.bcbp, lw.stubCode, derive('Jason Duval').stubCode, '~ !"#']) eq(decode128(code128(s)), s, `Code128 round-trip ${s}`);
eq(code128('GT406').reduce((x, y) => x + y, 0), 7 * 11 + 13, 'Code128 width');
const q = qrMatrix(qrText('Luther West'));
ok(q.size === 33 && typeof q.get(0, 0) === 'boolean' && q.get(0, 0) && q.get(6, 6) && !q.get(7, 7), 'QR v4 with finder pattern');
ok(qrMatrix(qrText('Ξενοφών Παπαδόπουλος Ab')).size <= 41, '24-char Greek fits v6');

// ---------- themes ----------

const KEYS = ['id', 'name', 'line', 'scheme', 'ink', 'muted', 'onBand', 'onInk', 'box', 'boxOpacity', 'boxLine', 'boxLineOpacity',
  'tear', 'tearOpacity', 'code', 'qrTile', 'qrTileOpacity', 'qrInk', 'mat', 'pageGlow', 'swatch'];
const lum = hex => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (x, y) => { const [l1, l2] = [lum(x), lum(y)].sort((m, n) => n - m); return (l1 + 0.05) / (l2 + 0.05); };
for (const id of THEME_IDS) {
  const T = THEMES[id];
  eq(Object.keys(T).sort(), [...KEYS].sort(), `theme ${id} keys`);
  ok(T.id === id && themeOf(id) === T, `themeOf ${id}`);
  ok(contrast(T.qrInk, T.qrTile) >= 7 && lum(T.qrTile) > lum(T.qrInk), `QR ${id}: dark modules on a light tile >= 7:1`);
}
ok(themeOf('nope') === THEMES.night && themeOf(undefined) === THEMES.night, 'unknown theme -> night');

// ---------- SVG output rules (spec C.1) ----------

const XSS = '<img src=x onerror=alert(1)>';
const NAMES = ['', 'Jason Duval', 'Bartholomew Montgomery-V', 'W'.repeat(24), XSS, 'Ξενοφών Παπαδόπουλος', 'Tommy "Lance" O\'Vance'];
const raw = { ...derive('x'), name: '<script>&"\'', display: '<script>&"\'' };   // bypasses cleanName on purpose
function tagsBalanced(svg) {
  const stack = [];
  for (const [, close, tag, self] of svg.matchAll(/<(\/?)([a-zA-Z][\w:-]*)[^>]*?(\/?)>/g)) {
    if (self) continue;
    if (!close) stack.push(tag); else if (stack.pop() !== tag) return false;
  }
  return stack.length === 0;
}
function checkSVG(svg, P, label, fonts = false) {
  const body = svg.replace(/<style>[\s\S]*?<\/style>/, '');
  ok(tagsBalanced(svg), `${label}: well-formed tags`);
  ok(!/<img|<script/i.test(svg), `${label}: no raw <img/<script`);
  const ids = [...svg.matchAll(/\sid="([^"]*)"/g)].map(m => m[1]);
  ok(ids.length > 0 && ids.every(id => new RegExp(`^${P}(k-)?[ea]-`).test(id)), `${label}: every id prefixed ${P}e-/${P}a- (nested ticket ${P}k-)`);
  ok(new Set(ids).size === ids.length, `${label}: ids unique`);
  const refs = [...svg.matchAll(/url\(#([^)]+)\)|href="#([^"]+)"/g)].map(m => m[1] || m[2]);
  ok(refs.every(r => ids.includes(r)), `${label}: every url(#)/href(#) resolves`);
  const labelled = svg.match(/aria-labelledby="([^"]+)"/)[1].split(' ');
  ok(labelled.every(r => ids.includes(r)) && /^<svg[^>]* role="img"/.test(svg), `${label}: role=img + aria-labelledby`);
  ok(!/\sclass=/.test(svg) && !/\sstyle=/.test(svg), `${label}: no class/style attributes`);
  ok(fonts ? (svg.match(/<style>/g) || []).length === 1 && /^<style>(@font-face\{[^}]*\}\s*)+<\/style>$/.test(svg.match(/<style>[\s\S]*?<\/style>/)[0]) : !/<style/.test(svg), `${label}: <style> only for embedded fonts`);
  ok(!/href="https?:/.test(svg) && !/@import/.test(svg), `${label}: nothing external`);
  ok(!/<use|<foreignObject/.test(svg), `${label}: no use/foreignObject`);
  ok([...svg.matchAll(/<image [^>]*>/g)].every(m => /href="(img\/[a-z0-9-]+\.(jpg|webp)|data:image\/(jpeg|webp);base64,[^"]+)"/.test(m[0])), `${label}: <image> only for the bundled photos and stickers`);
  ok(!/NaN|undefined|Infinity|\[object/.test(body), `${label}: no NaN/undefined`);
  ok(!/rgba?\(|hsla?\(/.test(body), `${label}: hex colours only`);
  ok(!/mix-blend|feTurbulence|<filter(?![^>]*filterUnits="userSpaceOnUse")/.test(body), `${label}: no grain/blend, filters in user space`);
  const loose = [...body.matchAll(/\s(?:x|y|width|height|cx|cy|r|rx|x1|y1|x2|y2)="(-?\d+\.\d{2,})"/g)].map(m => m[1]);
  ok(loose.length === 0, `${label}: coordinates rounded to 0.1 (${loose.slice(0, 3)})`);
  const paths = [...body.matchAll(/\sd="([^"]*)"/g)].flatMap(m => m[1].match(/\d+\.\d{2,}/g) || []);
  ok(paths.length === 0, `${label}: path data rounded to 0.1 (${paths.slice(0, 3)})`);
}
const NOW = Date.parse('2026-10-18T12:00Z');
for (const format of FORMAT_IDS) for (const theme of THEME_IDS) for (const name of NAMES) {
  const p = derive(name), P = 'ta-', svg = buildTicketSVG(p, { format, theme, prefix: P, now: NOW });
  const label = `${format}/${theme}/${JSON.stringify(name)}`;
  checkSVG(svg, P, label);
  const F = FORMATS[format];
  ok(svg.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${F.width} ${F.height}" width="${F.width}" height="${F.height}"`), `${label}: root size`);
  const slots = format === 'story' ? ['story'] : ['main', 'stub'];   // post nests the landscape ticket
  eq([...svg.matchAll(/data-name="(\w+)"/g)].map(m => m[1]), slots, `${label}: name slots`);
  ok(/data-flap=""/.test(svg), `${label}: flap targets`);
  ok(svg.includes(`GT406 - ${p.initials.replace(/[&<>"']/g, '')} - LSX - VCI`), `${label}: caption with initials`);
  ok(svg.includes(`<title id="${P}e-title">`) && svg.includes('not affiliated with Rockstar Games'), `${label}: title and desc disclaimer`);
  ok(p.ghost === /data-name="\w+"[^>]*fill-opacity=".45"/.test(svg), `${label}: ghost opacity on name only when ghost`);
  ok((p.cabin === 'FIRST') === (svg.includes('>FIRST<') || svg.includes('FIRST CLASS ·')), `${label}: First Class seal / pill`);
}
const xss = buildTicketSVG(raw, { prefix: 'tx-' });
checkSVG(xss, 'tx-', 'raw markup name');
ok(xss.includes('&lt;script&gt;&amp;&quot;&#39;') && !xss.includes('<script'), 'esc() covers & < > " \'');
checkSVG(buildTicketSVG(lw, { prefix: 'tf-', embedFonts: '@font-face{font-family:"GT406 Sans";src:url(data:font/woff2;base64,AA==) format("woff2")}' }), 'tf-', 'embedFonts', true);
const two = buildTicketSVG(lw, { prefix: 'ta-' }) + buildTicketSVG(lw, { prefix: 'tb-' });
const allIds = [...two.matchAll(/\sid="([^"]*)"/g)].map(m => m[1]);
ok(new Set(allIds).size === allIds.length, 'two prefixes share one document without id clashes');
eq(buildTicketSVG(lw, { prefix: 'ta-', now: NOW }), buildTicketSVG(lw, { prefix: 'ta-', now: NOW }), 'deterministic output');
ok(buildTicketSVG(lw, { format: 'nope', theme: 'nope' }) === buildTicketSVG(lw, { format: 'ticket', theme: 'night' }), 'unknown format/theme fall back');
ok(buildTicketSVG(lw, { format: 'story', now: NOW, until: FLIGHT.arr }).includes('31 DAYS TO GO') && buildTicketSVG(lw, { format: 'story', now: FLIGHT.arr, until: FLIGHT.arr }).includes('WHEELS DOWN'), 'Story days line');

// ---------- animated Story (video.js) ----------

const bare = buildTicketSVG(lw, { format: 'story', theme: 'goodtime', now: NOW, stickers: false });
ok(!bare.includes('sticker-') && buildTicketSVG(lw, { format: 'story', theme: 'goodtime', now: NOW }).includes('sticker-'), 'Story without stickers is the video base');
eq(bare, buildTicketSVG(lw, { format: 'story', theme: 'goodtime', now: NOW }).replace(/<image href="img\/sticker-[^>]*>/g, ''), 'only the stickers go');
const marks = storyStickers('goodtime', false);
eq(marks.map(m => m[0]), ['gator', 'sun', 'flamingo', 'manatee'], 'Story stickers in paint order');
eq(marks[0].slice(1), [615 + 84, 1066 + 236, 260], 'card sticker moved into Story pixels');
ok(marks.every(([n, x, y, w]) => FRAMES[n] && x < 1080 && y < 1920 && x + w > 0 && y + w * FRAMES[n].h / FRAMES[n].w > 0), 'every sticker has frames and lands in the Story');
eq(storyStickers('night', false), [], 'no stickers outside Goodtime State');
for (const [n, F] of Object.entries(FRAMES)) {
  const seq = Array.from({ length: SPAN * 30 / 1000 }, (_, i) => frameAt(n, i * 1000 / 30));
  ok(seq[0] === 0 && frameAt(n, SPAN) === 0 && seq.at(-1) === F.count - 1, `${n}: the clip loops on a whole cycle`);
  ok(seq.every((f, i) => i === 0 || f === seq[i - 1] || f === (seq[i - 1] + 1) % F.count), `${n}: frames only step forward`);
  eq(new Set(seq).size, F.count, `${n}: every frame shows`);
}

// ---------- name fitting (spec D.2) ----------

const fitOf = (svg, slot) => { const m = svg.match(new RegExp(`data-name="${slot}"[^>]*font-size="([\\d.]+)"[^>]*>([^<]*)<`)); return [+m[1], m[2]]; };
eq(fitOf(buildTicketSVG(lw), 'main'), [40, 'Luther West'], 'short name at max size');
const ws = buildTicketSVG(derive('W'.repeat(24)));
ok(fitOf(ws, 'main')[0] === 26 && fitOf(ws, 'main')[1].endsWith('…') && measure(fitOf(ws, 'main')[1], 26) <= 405, 'WWW… truncated with ellipsis at 26');
const bm = fitOf(buildTicketSVG(derive('Bartholomew Montgomery-V')), 'main');
ok(bm[0] < 40 && bm[0] >= 26 && bm[0] * 2 === Math.round(bm[0] * 2) && !bm[1].endsWith('…'), `24-char name shrinks to ${bm[0]} in 0.5 steps`);
ok(altText(lw) === 'FlyUS boarding pass for Luther West. Flight GT406 from Los Santos (LSX), 18 Nov 2026 16:00 PST, to Vice City (VCI), 19 Nov 2026 00:00 EST. Seat 33C (Main Cabin, aisle), zone 3, gate 6, terminal 1, booking reference 37DZKV. Fan-made.', 'altText');

console.log(`selftest ok: ${checks} checks`);
