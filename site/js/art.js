// Background art for the FlyUS GT406 tickets: a GTA VI screenshot per livery under a livery wash, plus the
// vector tabs and fronds. Pure string builders, no DOM, no Math.random: the same arguments always give the
// same bytes. Presentation attributes only, ids `${P}a-*`, hex colours with separate opacity attributes.
// Photos are referenced through `src(file)`: a relative URL on the page, a data URL inside exports
// (an SVG drawn through <img> may not load anything external).
import { FOIL, DEFAULT_THEME } from './themes.js';

// Screenshots: Rockstar Games, via gtavicentre.com. Cropped by hand into site/img/.
// The Story and Post backdrops are shared unless a livery brings its own (`scene`).
export const PHOTOS = {
  ticket: id => `ticket-${known(id)}.jpg`, card: id => `card-${known(id)}.jpg`,
  story: id => at(id).scene?.story ?? 'scene-story.jpg', post: id => at(id).scene?.post ?? 'hero-1600.jpg',
};
export const photoSrc = file => `img/${file}`;
// Stickers: Rockstar's animated Goodtime State stickers (Vice City Collection), via gtavicentre.com. The
// page shows the animated WebP; exports and reduced motion take the `-still` first frame.
const STICKERS = { gator: [320, 228], sun: [320, 354], flamingo: [320, 487], manatee: [320, 250] };
export const sticker = n => `sticker-${n}.webp`;
export const still = file => file.replace(/^(sticker-[a-z]+)\.webp$/, '$1-still.webp');
const used = (theme, ...keys) => [...new Set(keys.flatMap(k => (at(theme).stickers?.[k] || []).map(s => sticker(s[0]))))];
export function photosFor(format, theme) {
  return format === 'story' ? [PHOTOS.story(theme), PHOTOS.card(theme), ...used(theme, 'story', 'card')]
    : format === 'post' ? [PHOTOS.post(theme), PHOTOS.ticket(theme), ...used(theme, 'post', 'ticket')]
    : [PHOTOS.ticket(theme), ...used(theme, 'ticket')];
}

// Art tokens per livery: `sky` is the wash over the photo (top, middle, bottom) at `wash` opacity, `tint`
// a veil fading out from the left edge at `veil` opacity (the ink-heavy departure column), then the tab
// gradients and their close-up fronds. Washes are tuned so ink on the photo holds >= 4.5:1.
export const ART_THEMES = {
  night: {
    sky: ['#0D0A1C', '#2B1745', '#3A1650'], wash: .5, tint: '#0D0A1C', veil: .55,
    band: ['#15102B', '#3A1D58', '#7C2C7E'], bandFrond: '#FFFFFF', bandFrondOpacity: .10,
    foot: ['#7C2C7E', '#311A4E'], footFrond: '#FF8AD8', footFrondOpacity: .35,
  },
  sunset: {
    sky: ['#B7A2EE', '#D9B1EA', '#C9A6E6'], wash: .68, tint: '#E6DBFF', veil: .5,
    band: ['#5059A9', '#8968AB', '#C674B3'], bandFrond: '#FFFFFF', bandFrondOpacity: .31,
    foot: ['#CC74A4', '#AC85B3'], footFrond: '#E9A0C8', footFrondOpacity: .85,
  },
  keys: {
    sky: ['#E8FBFF', '#D2F3F5', '#BFEDEA'], wash: .5, tint: '#F2FDFF', veil: .55,
    band: ['#08707F', '#14A3A8', '#2BC3B5'], bandFrond: '#FFFFFF', bandFrondOpacity: .22,
    foot: ['#F2A65A', '#E8844A'], footFrond: '#FFFFFF', footFrondOpacity: .22,
  },
  ocean: {
    sky: ['#9ADBD6', '#BFE6DA', '#F7CFC2'], wash: .7, tint: '#E9F6F1', veil: .5,
    band: ['#0F5E6B', '#178A8E', '#28A195'], bandFrond: '#06363F', bandFrondOpacity: .3,
    foot: ['#EB6A5D', '#E76C56'], footFrond: '#A8392F', footFrondOpacity: .3,
  },
  // Rockstar's illustrated Vice City Collection art instead of a screenshot (palms at dusk on the ticket,
  // the lifeguard beach on the Story card and the scenes), with the collection's stickers over the wash.
  // Sticker rows are [name, x, y, width]; a fifth `true` drops it under the First Class seal.
  goodtime: {
    sky: ['#FFF4FA', '#FFF0F2', '#FFEBDD'], wash: .42, tint: '#FFF6F4', veil: .5,
    band: ['#A3127A', '#C560B7', '#7A55CF'], bandFrond: '#FFFFFF', bandFrondOpacity: .2,
    foot: ['#FF8E5E', '#F06AA0'], footFrond: '#FFFFFF', footFrondOpacity: .25,
    scene: { story: 'scene-story-goodtime.jpg', post: 'scene-post-goodtime.jpg' },
    stickers: {
      ticket: [['sun', 1214, 96, 186, true], ['gator', 740, 648, 380]],
      story: [['sun', -46, -40, 190], ['flamingo', -30, 1470, 250], ['manatee', 790, 1650, 300]],
      post: [['manatee', -30, 700, 250], ['flamingo', 1450, 540, 190]],
    },
  },
};
const known = id => (ART_THEMES[id] ? id : DEFAULT_THEME), at = id => ART_THEMES[known(id)];

function stickers(A, key, src, foil) {
  return (A.stickers?.[key] || []).filter(s => !(foil && s[4])).map(([n, x, y, w]) => {
    const [sw, sh] = STICKERS[n];
    return `<image href="${src(sticker(n))}" x="${x}" y="${y}" width="${w}" height="${f(w * sh / sw)}"/>`;
  }).join('');
}

// ---------- numbers and paths ----------
// Path data is written in integer tenths and relative steps: exact 0.1 rounding (R6) and roughly half the
// bytes of absolute coordinates, which matters because the palms dominate the SVG size.
const f = v => +v.toFixed(1);
const num = t => String(t / 10).replace(/^(-?)0\./, '$1.');
function sub(pts) {
  let X = Math.round(pts[0][0] * 10), Y = Math.round(pts[0][1] * 10), out = `M${num(X)} ${num(Y)}l`, first = true;
  for (let i = 1; i < pts.length; i++) {
    const x = Math.round(pts[i][0] * 10), y = Math.round(pts[i][1] * 10), a = num(x - X), b = num(y - Y);
    if (x === X && y === Y) continue;
    out += (first || a[0] === '-' ? '' : ' ') + a + (b[0] === '-' ? '' : ' ') + b;
    first = false; X = x; Y = y;
  }
  return out + 'z';
}
const stops = (cols, offs, op) => cols.map((c, i) => `<stop offset="${offs ? offs[i] : f(i / (cols.length - 1) * 100) / 100}" stop-color="${c}"${op ? ` stop-opacity="${op[i]}"` : ''}/>`).join('');
const vgrad = (id, y1, y2, s) => `<linearGradient id="${id}" x1="0" y1="${f(y1)}" x2="0" y2="${f(y2)}" gradientUnits="userSpaceOnUse">${s}</linearGradient>`;
const foilGrad = (id, x2, y2) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}" gradientUnits="userSpaceOnUse">${stops(FOIL)}</linearGradient>`;

// ---------- palms ----------
const D = Math.PI / 180;
// One frond in palm-local space (crown at the origin, gravity +y). The rachis arches toward the ground as it
// grows; leaflets hang from it as narrow outward teeth, longer and steeper on the side facing down. Every
// tooth points away from the rachis, so the outline winds one way and nonzero fill never punches holes.
function frond(a, L, bend, leaf, n, wide = .3, g = 1.2) {
  const s = Math.cos(a * D) >= 0 ? 1 : -1, step = L / n, sp = [];
  let x = Math.cos(a * D) * L * .04, y = Math.sin(a * D) * L * .04;
  for (let k = 0; k <= n; k++) {
    const th = (a + s * bend * (k / n) ** 1.7) * D;
    sp.push([x, y, Math.cos(th), Math.sin(th)]);
    x += Math.cos(th) * step; y += Math.sin(th) * step;
  }
  const sides = [[], []];
  for (const [si, sg] of [[0, 1], [1, -1]]) {
    for (let k = 0; k <= n; k++) {
      const [px, py, tx, ty] = sp[k], t = k / n, nx = -ty * sg, ny = tx * sg;
      const w = L * .011 * (1 - t) + .5, b = [px + nx * w, py + ny * w];
      if (k === 0 || k === n) { sides[si].push(b); continue; }
      const down = Math.max(0, ny);                       // 1 when this side faces the ground
      const prof = t < .25 ? .45 + .55 * t / .25 : 1 - .78 * ((t - .25) / .75) ** 1.5;
      const len = leaf * prof * (.62 + .38 * down), phi = (40 + 22 * down - 12 * t) * D;
      const vx = tx * Math.cos(phi) + nx * Math.sin(phi), vy = ty * Math.cos(phi) + ny * Math.sin(phi) + g * (.3 + .7 * down);
      let al = vx * tx + vy * ty, ou = vx * nx + vy * ny; const vl = Math.hypot(al, ou); al /= vl; ou /= vl;
      if (ou < .26) { ou = .26; al = al < 0 ? -.965 : .965; }
      const dx = tx * al + nx * ou, dy = ty * al + ny * ou;
      sides[si].push(b, [b[0] + dx * len, b[1] + dy * len], [b[0] + tx * step * wide, b[1] + ty * step * wide]);
    }
  }
  return [[0, 0], ...sides[0], ...sides[1].reverse()];
}
// Close-up fronds for the tabs: [x, y, angle°, length, bend°] each, rooted outside the tab so only the
// leafy part crosses it, as in the original's photo crop. Leaflets nearly symmetric (low gravity).
function spray(list, leafK = .3, n = 15) {
  return list.map(([x, y, a, L, b]) => sub(frond(a, L, b, L * leafK, n, .55, .35).map(([u, v]) => [x + u, y + v]))).join('');
}
const TAB_FRONDS = {
  tl: [[1190, -70, 168, 470, 40], [1190, -70, 140, 420, 50], [1190, -70, 108, 300, 30], [1190, -70, 66, 330, -40], [1190, -70, 24, 380, 40],
    [30, -90, 70, 330, -45], [30, -90, 34, 380, 40], [30, -90, 4, 300, 30]],
  tr: [[1900, -60, 172, 400, 40], [1900, -60, 140, 340, 45], [1900, -60, 104, 260, 25], [1900, -60, 62, 280, -30]],
  bl: [[640, 880, -112, 300, 40], [640, 880, -140, 380, 45], [640, 880, -166, 420, 40], [-40, 860, -40, 300, 40], [-40, 860, -12, 340, 40]],
  br: [[2040, 870, -116, 260, 40], [2040, 870, -142, 320, 40], [2040, 870, -168, 340, 40]],
};

const TABS = {
  tl: 'M0,0H1355V34A100,100 0 0 1 1255,134H0Z', tr: 'M1473,0H2000V134H1573A100,100 0 0 1 1473,34Z',
  bl: 'M0,700H564A58,58 0 0 1 622,758V813H0Z', br: 'M1799,700H2000V813H1741V758A58,58 0 0 1 1799,700Z',
};

export function ticketArt({ theme, foil, P, src = photoSrc }) {
  const A = at(theme), id = n => `${P}a-${n}`, url = n => `url(#${id(n)})`;

  // 1 photo, 2 livery wash: the sky gradient over the whole pass plus a stronger veil on the left, where
  // the departure column and the passenger row sit, so ink keeps its contrast on any part of the shot
  const back = `<image href="${src(PHOTOS.ticket(theme))}" width="2000" height="813" preserveAspectRatio="xMidYMid slice"/>`
    + `<rect width="2000" height="813" fill="${url('sky')}" fill-opacity="${A.wash}"/><rect width="2000" height="813" fill="${url('tint')}"/>`
    + stickers(A, 'ticket', src, foil);

  // 8 tabs: band / foot gradients (or First Class foil) with big close-up fronds clipped inside each tab
  const bandFill = foil ? url('foil') : url('band'), footFill = foil ? url('foil') : url('foot');
  const tab = (k, fill, fr, col, op) => `<g clip-path="${url('c' + k)}"><path d="${TABS[k]}" fill="${fill}"/><path d="${fr}" fill="${col}" fill-opacity="${op}"/></g>`;
  const tabs = tab('tl', bandFill, spray(TAB_FRONDS.tl), A.bandFrond, A.bandFrondOpacity)
    + tab('tr', bandFill, spray(TAB_FRONDS.tr), A.bandFrond, A.bandFrondOpacity)
    + tab('bl', footFill, spray(TAB_FRONDS.bl), A.footFrond, A.footFrondOpacity)
    + tab('br', footFill, spray(TAB_FRONDS.br), A.footFrond, A.footFrondOpacity);

  // defs
  const defs = vgrad(id('sky'), 0, 813, stops(A.sky, [0, .42, 1]))
    + `<linearGradient id="${id('tint')}" x1="0" y1="0" x2="1300" y2="0" gradientUnits="userSpaceOnUse">${stops([A.tint, A.tint], [0, 1], [A.veil, 0])}</linearGradient>`
    + vgrad(id('band'), 0, 134, stops(A.band, [0, .5, 1]))
    + vgrad(id('foot'), 700, 813, stops(A.foot))
    + (foil ? foilGrad(id('foil'), 2000, 400) : '')
    + Object.entries(TABS).map(([k, d]) => `<clipPath id="${id('c' + k)}"><path d="${d}"/></clipPath>`).join('');
  return { defs, back, tabs };
}

// ---------- Story card (card-local 912×1440) ----------
export function cardArt({ theme, foil, P, src = photoSrc }) {
  const A = at(theme), id = n => `${P}a-${n}`, url = n => `url(#${id(n)})`;
  const defs = `<linearGradient id="${id('csky')}" x1="0" y1="0" x2="319.2" y2="1440" gradientUnits="userSpaceOnUse">${stops(A.sky, [0, .42, 1])}</linearGradient>`
    + `<linearGradient id="${id('ctint')}" x1="0" y1="0" x2="912" y2="0" gradientUnits="userSpaceOnUse">${stops([A.tint, A.tint], [0, 1], [A.veil, A.veil * .4])}</linearGradient>`
    + vgrad(id('cband'), 0, 176, stops(A.band, [0, .5, 1]))
    + (foil ? foilGrad(id('cfoil'), 912, 176) : '')
    + `<clipPath id="${id('cbandclip')}"><rect width="912" height="176"/></clipPath>`;
  const field = `<image href="${src(PHOTOS.card(theme))}" width="912" height="1440" preserveAspectRatio="xMidYMid slice"/>`
    + `<rect width="912" height="1440" fill="${url('csky')}" fill-opacity="${A.wash}"/><rect width="912" height="1440" fill="${url('ctint')}"/>`
    + stickers(A, 'card', src, foil);
  const band = `<g clip-path="${url('cbandclip')}"><rect width="912" height="176" fill="${foil ? url('cfoil') : url('cband')}"/><path d="${spray(CARD_FRONDS)}" fill="${A.bandFrond}" fill-opacity="${A.bandFrondOpacity}"/></g>`;
  return { defs, field, band };
}
const CARD_FRONDS = [[960, -70, 172, 420, 40], [960, -70, 146, 360, 50], [960, -70, 120, 270, 30], [960, -70, 96, 200, 20]];

// ---------- generic dusk scene (Story backdrop, og image, Post) ----------
// Stepped skyline across [x0, x1] standing on y = base; returns [silhouette path, window rects].
// Windows are left out of `quiet` (x0, y0, x1, y1), where the scene carries text.
export function sceneArt({ theme, width: W, height: H, P, src = photoSrc }) {
  const A = at(theme), id = n => `${P}a-${n}`, url = n => `url(#${id(n)})`;
  // The airliner over the Vice City sign, tinted toward the livery and shaded top and bottom, where the
  // white headline, countdown and URL sit.
  const defs = vgrad(id('sshade'), 0, H, stops(['#100D16', '#100D16', '#100D16', '#100D16'], [0, .3, .62, 1], [.62, 0, .1, .9]));
  const body = `<rect width="${W}" height="${H}" fill="#100D16"/>`
    + `<image href="${src(H > W ? PHOTOS.story(theme) : PHOTOS.post(theme))}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`
    + `<rect width="${W}" height="${H}" fill="${A.sky[1]}" fill-opacity=".16"/><rect width="${W}" height="${H}" fill="${url('sshade')}"/>`
    + stickers(A, H > W ? 'story' : 'post', src, false);
  return { defs, body };
}
