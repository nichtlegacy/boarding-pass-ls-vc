// Animated Story (Goodtime State): the Story without its stickers from export.js, the stickers drawn over it
// frame by frame from their sprite sheets, H.264 through WebCodecs, MP4 through mp4-muxer. 1080×1920 at
// 30 fps, no audio, moov ahead of the data: what Instagram (Story, Reel), TikTok and X all take as uploaded.
// Loaded on demand by checkin.js; browsers without an H.264 encoder never see the option.
import { Muxer, ArrayBufferTarget } from './vendor/mp4-muxer.js';
import { FRAMES } from './sticker-frames.js';
import { storyStickers } from './art.js';
import { renderCanvas } from './export.js';

const W = 1080, H = 1920, FPS = 30;
// 7.2 s holds whole loops of every sticker: gator 2 × 3.6 s, manatee 2 × 3.2 s and flamingo 3 × 2.55 s
// retimed by up to 12 %, the 6.4 s sun once, slowed to fit. The last frame runs straight into the first.
export const SPAN = 7200;
const COUNT = SPAN * FPS / 1000;
const CODECS = ['avc1.640028', 'avc1.4d0028', 'avc1.42e028'];   // High, Main, Baseline; level 4.0 fits 1080×1920 at 30 fps
const config = codec => ({ codec, width: W, height: H, bitrate: 8e6, framerate: FPS, avc: { format: 'avc' } });

let probe;
export function videoSupport() {
  return probe ??= (async () => {
    if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') return null;
    for (const codec of CODECS) {
      try { if ((await VideoEncoder.isConfigSupported(config(codec))).supported) return codec; } catch { /* next */ }
    }
    return null;
  })();
}

// Frame of sticker `n` showing at `t` ms into the video.
const ENDS = Object.fromEntries(Object.entries(FRAMES).map(([n, F]) => { let s = 0; return [n, F.delays.map(d => (s += d))]; }));
export function frameAt(n, t) {
  const ends = ENDS[n], loop = ends.at(-1), loops = Math.max(1, Math.round(SPAN / loop));
  const local = (t % (SPAN / loops)) * loops * loop / SPAN;
  return ends.findIndex(e => e > local);
}

const sheets = new Map();
function sheet(n) {
  if (!sheets.has(n)) {
    const s = fetch(new URL(`../img/sticker-${n}-sheet.webp`, import.meta.url)).then(res => {
      if (!res.ok) throw new Error(`sheet ${n}: HTTP ${res.status}`);
      return res.blob();
    }).then(b => createImageBitmap(b));
    s.catch(() => sheets.delete(n));
    sheets.set(n, s);
  }
  return sheets.get(n);
}

export async function exportVideo(p, { theme, now } = {}, progress = () => {}) {
  const codec = await videoSupport();
  if (!codec) throw new Error('no H.264 encoder');
  const marks = storyStickers(theme, p.cabin === 'FIRST');
  const [base, bitmaps] = await Promise.all([
    renderCanvas(p, { format: 'story', theme, now, stickers: false }),
    Promise.all(marks.map(([n]) => sheet(n))),
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: 'avc', width: W, height: H, frameRate: FPS }, fastStart: 'in-memory' });
  let failed = null;
  const enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: e => { failed = e; } });
  try {
    enc.configure(config(codec));
    for (let i = 0; i < COUNT; i++) {
      if (failed) throw failed;
      const t = i * 1000 / FPS;
      ctx.drawImage(base, 0, 0);
      marks.forEach(([n, x, y, w], k) => {
        const F = FRAMES[n], f = frameAt(n, t);
        ctx.drawImage(bitmaps[k], (f % F.cols) * F.w, Math.floor(f / F.cols) * F.h, F.w, F.h, x, y, w, w * F.h / F.w);
      });
      const frame = new VideoFrame(canvas, { timestamp: Math.round(i * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
      enc.encode(frame, { keyFrame: i % (2 * FPS) === 0 });
      frame.close();
      // Back-pressure, and a breath for the page to paint the progress.
      do await new Promise(ok => setTimeout(ok, 0)); while (enc.encodeQueueSize > 4 && !failed);
      progress((i + 1) / COUNT);
    }
    await enc.flush();
    if (failed) throw failed;
  } finally {
    if (enc.state !== 'closed') enc.close();
  }
  muxer.finalize();
  return new Blob([muxer.target.buffer], { type: 'video/mp4' });
}
