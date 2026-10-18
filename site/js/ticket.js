// Ticket layouts: passenger + livery -> one self-contained SVG string. Pure and Node-safe (DOM only inside
// patchName/measure/fontsReady, which callers use in the browser).
// SVG rules (spec C.1): presentation attributes only, every id prefixed, no external anything, user text
// escaped, hex colours with separate opacities, numbers rounded to 0.1, fonts by family name only.
import { FLIGHT, qrText, countdown, localUnlock } from './passenger.js';
import { themeOf, FOIL } from './themes.js';
import { code128, qrMatrix } from './codes.js';
import { ticketArt, cardArt, sceneArt, photoSrc } from './art.js';
import { WORDMARK } from './wordmark.js';

export const FORMATS = {
  ticket: { id: 'ticket', width: 2000, height: 813, label: 'Ticket', hint: '2000×813 · X, Discord, READMEs' },
  story: { id: 'story', width: 1080, height: 1920, label: 'Story', hint: '1080×1920 · Instagram, TikTok, WhatsApp' },
  post: { id: 'post', width: 1600, height: 900, label: 'Post', hint: '1600×900 · X, Reddit' },
};
export const FORMAT_IDS = ['ticket', 'story', 'post'];

// GT406 Sans is the renamed Carlito subset (OFL Reserved Font Name); Carlito/Calibri stay as local fallbacks.
const SANS = 'GT406 Sans, Carlito, Calibri, sans-serif';
const WIDE = 'Archivo Expanded, Arial Black, sans-serif';
const SLOGAN = 'Arimo, Arial, sans-serif';
const CANVAS_FONT = '"GT406 Sans", Carlito, Calibri, sans-serif';

const n = v => Math.round(v * 10) / 10;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const text = (x, y, size, s, a = '') => `<text x="${x}" y="${y}" font-size="${size}"${a}>${esc(s)}</text>`;
const rect = (x, y, w, h, a = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}"${a}/>`;
const grad = (id, x1, y1, x2, y2, stops) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" gradientUnits="userSpaceOnUse">${stops.map((c, i) => `<stop offset="${n(i / (stops.length - 1) * 100) / 100}" stop-color="${c}"/>`).join('')}</linearGradient>`;

// The template's four-engine airliner, nose right (ticket-spec section 5), with its engine pods.
const PLANE = '<path d="M752,347L746,341L718,340.5L680.5,289.5L674.5,290.5L686,322L689,342L657,343.5L640,327L635,327L636,337L643,345.5L634,346.2L643,348.5L636,357L635,367L640,367L657,350.5L689,352L686,372L674.5,403.5L680.5,404.5L718,353.5L746,353L752,347Z"/>'
  + [[688, 302.5, 14, 5], [704, 318, 11, 6], [688, 386.5, 14, 5], [704, 370, 11, 6]].map(([x, y, w, h]) => rect(x, y, w, h, ` rx="${h / 2}"`)).join('');
const LOGO = `<path d="${WORDMARK.d}"/><path d="${WORDMARK.star}"/>`;
const SHAPE = 'M28,0H1391A24,24 0 0 0 1439,0H1972A28,28 0 0 1 2000,28V785A28,28 0 0 1 1972,813H1439A24,24 0 0 0 1391,813H28A28,28 0 0 1 0,785V28A28,28 0 0 1 28,0Z';
const CARD = 'M40,0H872A40,40 0 0 1 912,40V1040A36,36 0 0 0 912,1112V1400A40,40 0 0 1 872,1440H40A40,40 0 0 1 0,1400V1112A36,36 0 0 0 0,1040V40A40,40 0 0 1 40,0Z';
// Card and Post shadow; the region is explicit and in user space (rule R3).
const SHADOW = (P, x, y, w, h) => `<filter id="${P}e-shadow" x="${x}" y="${y}" width="${w}" height="${h}" filterUnits="userSpaceOnUse"><feDropShadow dx="0" dy="30" stdDeviation="20" flood-color="#100D16" flood-opacity=".5"/></filter>`;

// ---------- codes ----------

// Code128 as one path of bars; edges rounded on absolute positions so rounding never accumulates.
function bars(payload, x, y, len, thick, vertical) {
  const runs = code128(payload), u = len / runs.reduce((a, b) => a + b, 0);
  let pos = 0, d = '';
  runs.forEach((m, i) => {
    if (i % 2 === 0) {
      const a = n((vertical ? y : x) + pos * u), b = n((vertical ? y : x) + (pos + m) * u);
      d += vertical ? `M${x} ${a}H${x + thick}V${b}H${x}z` : `M${a} ${y}H${b}V${y + thick}H${a}z`;
    }
    pos += m;
  });
  return d;
}

// QR modules in module units (runs merged per row), scaled into the code area by the caller's transform.
function qr(payload, x, y, area, fill) {
  const q = qrMatrix(payload); let d = '';
  for (let r = 0; r < q.size; r++) for (let c = 0; c < q.size;) {
    if (!q.get(c, r)) { c++; continue; }
    let e = c; while (e < q.size && q.get(e, r)) e++;
    d += `M${c} ${r}h${e - c}v1h${c - e}z`; c = e;
  }
  return `<path d="${d}" fill="${fill}" transform="translate(${x} ${y}) scale(${+(area / q.size).toFixed(4)})" shape-rendering="crispEdges"/>`;
}

function starburst(points, r, k) {
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const a = (i * 180 / points - 90) * Math.PI / 180, rr = i % 2 ? r * k : r;
    d += (i ? 'L' : 'M') + n(rr * Math.cos(a)) + ',' + n(rr * Math.sin(a));
  }
  return d + 'Z';
}

// ---------- name fitting (spec D.2) ----------

// Carlito Bold advances (1/1000 em) for U+0020..U+007E: the Node stand-in for canvas measureText, so
// og.html and selftest size ASCII names like a browser does (kerning aside).
const ADV = [226, 326, 438, 498, 507, 729, 705, 233, 312, 312, 498, 498, 258, 306, 267, 430, 507, 507, 507, 507, 507, 507, 507, 507, 507, 507, 276, 276, 498, 498, 498, 463, 898, 606, 561, 529, 630, 488, 459, 637, 631, 267, 331, 547, 423, 874, 659, 676, 532, 686, 563, 473, 495, 653, 591, 906, 551, 520, 478, 325, 430, 325, 498, 498, 300, 494, 537, 418, 537, 503, 316, 474, 537, 246, 255, 480, 246, 813, 537, 538, 537, 537, 355, 399, 347, 537, 473, 745, 459, 474, 397, 344, 475, 344, 498];
let ctx;
export function measure(s, sizePx) {
  if (typeof document !== 'undefined') {
    ctx ||= document.createElement('canvas').getContext('2d');
    ctx.font = `700 ${sizePx}px ${CANVAS_FONT}`;
    return ctx.measureText(s).width;
  }
  let w = 0;
  for (const ch of s) { const c = ch.codePointAt(0); w += c >= 32 && c < 127 ? ADV[c - 32] : 560; }
  return w * sizePx / 1000;
}

const SLOTS = { main: [40, 405, 26], stub: [41.2, 400, 26], story: [64, 790, 40] };   // max, maxWidth, min
function fit(s, [max, maxWidth, min]) {
  const w = measure(s, max);
  if (w <= maxWidth) return { text: s, size: max };
  let size = Math.floor(max * maxWidth / w * 2) / 2;   // down to 0.5 px: same size in every browser
  // Hinted advances do not scale linearly with the size, so confirm the estimate and step down if needed.
  while (size >= min && measure(s, size) > maxWidth) size -= 0.5;
  if (size >= min) return { text: s, size };
  const cps = Array.from(s);
  while (cps.length && measure(cps.join('') + '…', min) > maxWidth) cps.pop();
  return { text: cps.join('').trimEnd() + '…', size: min };
}

function nameText(p, slot, x, y) {
  const f = fit(p.display, SLOTS[slot]);
  return `<text data-name="${slot}" x="${x}" y="${y}" font-size="${f.size}"${p.ghost ? ' fill-opacity=".45"' : ''}>${esc(f.text)}</text>`;
}

// Per keystroke: only the name nodes change, so the art never jitters while typing.
export function patchName(svg, p, format) {
  for (const el of svg.querySelectorAll('[data-name]')) {
    const f = fit(p.display, SLOTS[el.getAttribute('data-name')] || SLOTS.main);
    el.textContent = f.text;
    el.setAttribute('font-size', f.size);
    if (p.ghost) el.setAttribute('fill-opacity', '.45'); else el.removeAttribute('fill-opacity');
  }
}

// ---------- text ----------

export function altText(p, format = 'ticket') {
  const who = p.ghost ? 'a passenger yet to check in' : p.display;
  return `FlyUS boarding pass for ${who}. Flight GT406 from Los Santos (LSX), 18 Nov 2026 16:00 PST, to Vice City (VCI), 19 Nov 2026 00:00 EST. `
    + `Seat ${p.seat} (${p.cabinLabel}, ${p.seatType}), zone ${p.zone}, gate ${FLIGHT.gate}, terminal ${FLIGHT.terminal}, booking reference ${p.pnr}. Fan-made.`;
}
const DESC_TAIL = ' Unofficial fan project, not affiliated with Rockstar Games or Take-Two Interactive. Made at boardingpass.nichtlegacy.com.';

const FACES = ['400 16px "GT406 Sans"', '700 16px "GT406 Sans"', 'italic 700 16px "GT406 Sans"', '900 16px "Archivo Expanded"', 'italic 700 16px Arimo'];
export function fontsReady() {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve();
  return Promise.all(FACES.map(f => document.fonts.load(f))).then(() => {});
}

// ---------- landscape ticket 2000×813 (spec D.1) ----------

function landscape(p, T, P, src) {
  const A = ticketArt({ theme: T.id, foil: p.cabin === 'FIRST', P, src });
  const cap = `GT406 - ${p.initials} - LSX - VCI`;
  const line = T.boxLine ? ` stroke="${T.boxLine}" stroke-width="1.5" stroke-opacity="${T.boxLineOpacity}"` : '';
  const flap = s => `<tspan data-flap="">${esc(s)}</tspan>`;
  const seal = p.cabin !== 'FIRST' ? '' : `<g transform="translate(1322 222) rotate(-12)">`
    + `<path d="${starburst(16, 66, 0.86)}" fill="url(#${P}e-foil)"/>`
    + `<circle r="50" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-dasharray="3 5" stroke-opacity=".9"/>`
    // x offsets of half the tracking keep the tracked words optically centred
    + `<g fill="#FFFFFF" font-weight="700" text-anchor="middle">${text(1, -18, 13, 'GT406', ' letter-spacing="2"')}${text(1.5, 8, 27, 'FIRST', ' letter-spacing="3"')}${text(1, 32, 13, 'CLASS', ' letter-spacing="2"')}</g></g>`;

  const defs = `<clipPath id="${P}e-shape"><path d="${SHAPE}"/></clipPath>`
    + (seal ? grad(`${P}e-foil`, -66, -66, 66, 66, FOIL) : '') + A.defs;

  const boxes = `<g fill="${T.box}" fill-opacity="${T.boxOpacity}"${line}>${rect(114, 565, 1171, 95, ' rx="8"')}${rect(1492, 365, 450, 209, ' rx="8"')}</g>`;
  const tear = `<path d="M1415,40V773" fill="none" stroke="${T.tear}" stroke-opacity="${T.tearOpacity}" stroke-width="9" stroke-linecap="round" stroke-dasharray="0 21"/>`;

  const fit = size => +(size * Math.min(1, FLIGHT.slogan.length / p.slogan.length)).toFixed(1);   // longer egg slogans shrink to the same width
  const ink = `<g font-family="${SANS}">`
    // white on the tabs: wordmarks, slogans, BOARDING PASS, disclaimer
    + `<g fill="${T.onBand}">${LOGO}<g transform="translate(1791 730) scale(.6) translate(-131 -20)">${LOGO}</g>`
    + `<g font-family="${SLOGAN}" font-weight="700" font-style="italic">${text(420.9, 83.6, fit(53.8), p.slogan, ' letter-spacing="4.93"')}${text(1851, 788, fit(10), p.slogan, ' letter-spacing=".4"')}</g>`
    + text(1565, 78, 53.5, 'BOARDING PASS', ' font-weight="700"')
    + `<g font-weight="700" font-style="italic">${text(133, 753.3, 23.5, FLIGHT.disclaimer[0])}${text(134, 781.3, 23.5, FLIGHT.disclaimer[1])}</g></g>`
    // rules, planes, dividers
    + `<g fill="${T.ink}">${rect(496, 344.8, 126, 5)}${rect(788, 344.8, 126, 5)}<g transform="translate(12 0)">${PLANE}</g>`
    + [563.6, 794.9, 947.7, 1093.7].map(x => rect(x, 580, 1.8, 65.5)).join('')
    + rect(1474, 350, 485, 1.6) + rect(1647, 216.5, 50, 2) + rect(1767, 216.5, 50, 2)
    + `<g transform="translate(1706 192.5) scale(.4237) translate(-634 -288)">${PLANE}</g>`
    + rect(1614, 489, 1.8, 67.5) + rect(1759.8, 489, 1.8, 67.5) + '</g>'
    // barcodes and QR
    + `<path d="${bars(p.bcbp, 40, 146, 541, 54, true)}${bars(p.stubCode, 1472, 597, 486, 48, false)}" fill="${T.code}" shape-rendering="crispEdges"/>`
    + rect(1238, 684, 120, 120, ` rx="10" fill="${T.qrTile}" fill-opacity="${T.qrTileOpacity}"`)
    + qr(qrText(p.name, T.id), 1246, 692, 104, T.qrInk)
    // airport codes
    + `<g font-family="${WIDE}" font-weight="900" fill="${T.ink}">`
    + `<text font-size="119.8" transform="translate(121.1 385) scale(1.085 1)">LSX</text><text font-size="121.2" transform="translate(943.8 384) scale(1.042 1)">VCI</text>`
    + `<text font-size="57.4" transform="translate(1470.5 235) scale(1.092 1)">LSX</text><text font-size="56" text-anchor="end" transform="translate(1958 235) scale(1.026 1)">VCI</text></g>`
    // muted labels
    + `<g fill="${T.muted}">`
    + text(129.1, 277, 41, 'DEPARTURE') + text(946, 277, 41, 'ARRIVAL')
    + `<g letter-spacing="1">${text(216, 538, 22, 'PST')}${text(1032, 538, 22, 'EST')}</g>`
    + text(706.2, 446, 24, `FLIGHT GT406 · ${FLIGHT.block}`, ' letter-spacing="2.4" text-anchor="middle"')
    + [[132, 'PASSENGER'], [613, 'REFERENCE'], [847, 'SEAT'], [996, 'GATE'], [1142, 'TERMINAL']].map(([x, s]) => text(x, 596, 27, s)).join('')
    + `<text font-size="23.75" text-anchor="middle" transform="translate(10 428) rotate(90)">${esc(cap)}</text>`
    + text(1516, 395, 27.5, 'PASSENGER')
    + `<text x="1922" y="395" font-size="22" letter-spacing="1" text-anchor="end">ZONE ${flap(p.zone)} · ${flap(p.boards)}</text>`
    + `<text x="1517.1" y="472" font-size="23.5" letter-spacing=".8">REFERENCE: <tspan font-weight="700" font-size="25" fill="${T.ink}" data-flap="">${esc(p.pnr)}</tspan></text>`
    + `<text x="1922" y="472" font-size="22" letter-spacing="1" text-anchor="end">SEQ ${flap(p.seq)}</text>`
    + text(1516, 506, 27.5, 'SEAT') + text(1662, 506, 27.5, 'GATE') + text(1808, 506, 27.5, 'TERMINAL')
    + text(1715, 676, 22.3, cap, ' text-anchor="middle"') + '</g>'
    // ink text
    + `<g fill="${T.ink}">`
    + `<g font-weight="700">${text(129, 444, 58.3, FLIGHT.from.city)}${text(946, 444, 58.3, FLIGHT.to.city)}</g>`
    + text(127.9, 488, 34.6, FLIGHT.from.date) + text(942.9, 488, 34.6, FLIGHT.to.date)
    + text(128, 538, 34.6, FLIGHT.from.time) + text(945, 538, 34.6, FLIGHT.to.time)
    + `<g font-weight="700">`
    + nameText(p, 'main', 133, 645)
    + text(614, 645, 40, p.pnr, ' data-flap=""') + text(847, 645, 40, p.seat, ' data-flap=""')
    + text(997, 645, 40, FLIGHT.gate) + text(1142.1, 645, 40, FLIGHT.terminal)
    + text(1472, 277, 32.2, FLIGHT.from.city) + text(1959, 277, 32.2, FLIGHT.to.city, ' text-anchor="end"')
    + text(1472.9, 301, 19, FLIGHT.from.date) + text(1959, 301, 19, FLIGHT.to.date, ' text-anchor="end"')
    + text(1473, 329, 19, `${FLIGHT.from.time} ${FLIGHT.from.tz}`) + text(1959, 329, 19, `${FLIGHT.to.time} ${FLIGHT.to.tz}`, ' text-anchor="end"')
    + nameText(p, 'stub', 1516, 446)
    + text(1514, 556, 41.2, p.seat, ' data-flap=""') + text(1662, 556, 41.2, FLIGHT.gate) + text(1808.1, 556, 41.2, FLIGHT.terminal)
    + '</g></g>' + seal + '</g>';

  return { defs, body: `<g clip-path="url(#${P}e-shape)">${A.back}${A.tabs}${boxes}${tear}${ink}</g>` };
}

// ---------- Story 1080×1920 (spec D.6): scene + vertical card ----------

function story(p, T, P, now, until, src) {
  const first = p.cabin === 'FIRST';
  const S = sceneArt({ theme: T.id, width: 1080, height: 1920, P, src });
  const C = cardArt({ theme: T.id, foil: first, P, src });
  const line = T.boxLine ? ` stroke="${T.boxLine}" stroke-width="1.5" stroke-opacity="${T.boxLineOpacity}"` : '';
  const defs = S.defs + C.defs
    + `<clipPath id="${P}e-card"><path d="${CARD}"/></clipPath>`
    + SHADOW(P, -80, -60, 1072, 1600)
    + (first ? grad(`${P}e-foil`, 56, 0, 856, 0, FOIL) : '');

  const scene = `<g fill="#FFFFFF" text-anchor="middle">`
    + `<g font-family="${WIDE}" font-weight="900">${text(541, 176, 50, 'SEE YOU IN VICE CITY', ' letter-spacing="2"')}${text(541, 1764, 40, countdown(now, until).label, ' letter-spacing="2"')}</g>`
    + text(540, 1826, 30, 'boardingpass.nichtlegacy.com', ` font-family="${SANS}" font-weight="700" fill-opacity=".8"`) + '</g>';

  const pill = first ? 'FIRST CLASS · ZONE 1 · STARFISH ISLAND' : `ZONE ${p.zone} · ${p.zoneName}`;
  const fit = size => +(size * Math.min(1, FLIGHT.slogan.length / p.slogan.length)).toFixed(1);   // longer egg slogans shrink to the same width
  const ink = `<g font-family="${SANS}">`
    + `<g fill="${T.onBand}"><g transform="translate(56 22) scale(.92) translate(-131 -20)">${LOGO}</g>`
    + text(856, 92, 40, 'BOARDING PASS', ' font-weight="700" text-anchor="end"')
    + text(856, 134, 28, `FLIGHT GT406 · ${p.cabinLabel.toUpperCase()}`, ' letter-spacing="1" text-anchor="end" fill-opacity=".85"') + '</g>'
    + `<g fill="${T.ink}">${rect(384, 335, 56, 4)}${rect(532, 335, 56, 4)}<g transform="translate(486 337) scale(.62) translate(-693 -347)">${PLANE}</g>`
    + rect(315, 744, 2, 202) + rect(599, 744, 2, 202) + '</g>'
    + `<g font-family="${WIDE}" font-weight="900" font-size="112" fill="${T.ink}"><text transform="translate(52 378) scale(1.085 1)">LSX</text><text text-anchor="end" transform="translate(860 378) scale(1.04 1)">VCI</text></g>`
    + `<g fill="${T.muted}">`
    + text(56, 252, 26, 'DEPARTURE') + text(856, 252, 26, 'ARRIVAL', ' text-anchor="end"') + text(60, 584, 26, 'PASSENGER')
    + text(56, 768, 26, 'SEAT') + text(340, 768, 26, 'GATE') + text(624, 768, 26, 'TERMINAL')
    + text(56, 888, 26, 'BOARDS') + text(340, 888, 26, 'ZONE') + text(624, 888, 26, 'SEQ')
    + text(330, 1160, 26, 'REFERENCE') + text(330, 1352, 24, `GT406 - ${p.initials} - LSX - VCI`) + '</g>'
    + `<g fill="${T.ink}">`
    + `<g font-weight="700">${text(56, 446, 44, FLIGHT.from.city)}${text(856, 446, 44, FLIGHT.to.city, ' text-anchor="end"')}</g>`
    + text(56, 492, 30, `${FLIGHT.from.date} · ${FLIGHT.from.time} ${FLIGHT.from.tz}`) + text(856, 492, 30, `${FLIGHT.to.date} · ${FLIGHT.to.time} ${FLIGHT.to.tz}`, ' text-anchor="end"')
    + `<g font-weight="700">${nameText(p, 'story', 60, 662)}`
    + text(56, 836, 64, p.seat, ' data-flap=""') + text(340, 836, 64, FLIGHT.gate) + text(624, 836, 64, FLIGHT.terminal)
    + text(56, 942, 48, p.boards, ' data-flap=""') + text(340, 942, 48, String(p.zone), ' data-flap=""') + text(624, 942, 48, p.seq, ' data-flap=""')
    + text(330, 1222, 56, p.pnr, ' letter-spacing="4" data-flap=""') + '</g>'
    + text(56, 1406, 22, FLIGHT.disclaimer.join(' '), ' font-weight="700" font-style="italic" fill-opacity=".8"') + '</g>'
    + rect(56, 972, 800, 56, ` rx="28" fill="${first ? `url(#${P}e-foil)` : T.ink}"`)
    + text(457.5, 1010, 28, pill, ` font-weight="700" letter-spacing="3" text-anchor="middle" fill="${first ? '#FFFFFF' : T.onInk}"`)
    + `<path d="${bars(p.stubCode, 330, 1250, 526, 70, false)}" fill="${T.code}" shape-rendering="crispEdges"/>`
    + rect(56, 1124, 236, 236, ` rx="16" fill="${T.qrTile}"`) + qr(qrText(p.name, T.id), 68, 1136, 212, T.qrInk)
    + '</g>';

  const card = `<g transform="translate(84 236)"><g filter="url(#${P}e-shadow)"><g clip-path="url(#${P}e-card)">`
    + C.field + C.band
    + `<g fill="${T.box}" fill-opacity="${T.boxOpacity}"${line}>${rect(32, 540, 848, 160, ' rx="12"')}</g>`
    + `<path d="M56,1076H856" fill="none" stroke="${T.tear}" stroke-opacity="${T.tearOpacity}" stroke-width="7" stroke-linecap="round" stroke-dasharray="0 18"/>`
    + ink + '</g></g></g>';

  return { defs, body: S.body + scene + card };
}

// ---------- Post 1600×900 (spec D.7): the landscape ticket tilted on the dusk scene ----------

function post(p, T, P, src) {
  const S = sceneArt({ theme: T.id, width: 1600, height: 900, P, src });
  const k = landscape(p, T, P + 'k-', src);   // own prefix: the nested ticket's ids never meet the scene's
  return {
    defs: S.defs + SHADOW(P, 40, 126, 1520, 740),
    body: S.body
      + `<g fill="#FFFFFF" font-family="${SANS}" font-weight="700">${text(100, 92, 30, 'NOW BOARDING · GT406', ' letter-spacing="6"')}</g>`
      + `<g transform="rotate(-2 800 470)" filter="url(#${P}e-shadow)"><svg x="100" y="186" width="1400" height="569" viewBox="0 0 2000 813"><defs>${k.defs}</defs>${k.body}</svg></g>`,
  };
}

// ---------- entry ----------

// `src` maps a photo file name to its URL: relative on the page, data URLs for exports (see export.js).
export function buildTicketSVG(p, { format = 'ticket', theme, prefix = 't-', embedFonts = null, now = Date.now(), until = localUnlock().at, src = photoSrc } = {}) {
  const F = FORMATS[format] || FORMATS.ticket, T = themeOf(theme), P = prefix;
  const { defs, body } = F.id === 'story' ? story(p, T, P, now, until, src) : F.id === 'post' ? post(p, T, P, src) : landscape(p, T, P, src);
  const alt = altText(p, F.id);
  // geometricPrecision: Chromium otherwise lays out SVG text with hinted advances at the scaled pixel size,
  // which opens visible gaps inside words ("DEPART URE") whenever the preview is not at 1:1.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${F.width} ${F.height}" width="${F.width}" height="${F.height}" text-rendering="geometricPrecision" role="img" aria-labelledby="${P}e-title ${P}e-desc">`
    + `<title id="${P}e-title">${esc(alt)}</title><desc id="${P}e-desc">${esc(alt + DESC_TAIL)}</desc>`
    + (embedFonts ? `<style>${embedFonts}</style>` : '')
    + `<defs>${defs}</defs>${body}</svg>`;
}
