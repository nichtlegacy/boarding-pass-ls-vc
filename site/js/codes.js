// Real, scannable codes for the ticket: Code128-B barcodes and the QR matrix. Pure, Node-safe.
import qrcodegen from './vendor/qrcodegen.js';

// Code128 symbol patterns 0..106 as bar/space module widths (106 = stop, 7 runs, 13 modules).
const C128 = '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112'.split(' ');
export const C128_PATTERNS = C128;

// Module runs, alternating bar/space and starting with a bar: Start B, data, mod-103 checksum, stop.
// Characters outside printable ASCII become a space (the payloads in passenger.js are ASCII by construction).
export function code128(text) {
  const vals = [104];
  for (const ch of String(text)) { const c = ch.codePointAt(0); vals.push(c >= 32 && c < 127 ? c - 32 : 0); }
  vals.push(vals.reduce((s, v, i) => s + v * (i || 1), 0) % 103, 106);
  return vals.flatMap(v => [...C128[v]].map(Number));
}

// Byte mode for anything with lowercase or non-ASCII (all names), ECC LOW boosted as far as the version
// allows: the smallest code that fits gives the biggest modules in the 104 px tile.
export function qrMatrix(text) {
  const qr = qrcodegen.QrCode.encodeText(String(text), qrcodegen.QrCode.Ecc.LOW);
  return { size: qr.size, get: (x, y) => qr.getModule(x, y) };
}
