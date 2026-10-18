// Stamps every local script, module import and stylesheet in a copy of site/ with ?v=<version>, so a deploy
// is one atomic set: a browser holding an older art.js in its cache can no longer pair it with a newer
// ticket.js (Pages caches each file for ten minutes on its own). Run by the Pages workflow on the artifact
// copy, never on site/ itself:  node scripts/stamp.mjs _site <version>
// Every reference to one module must carry the same stamp, or the browser would load it twice (app.js is
// both a <script> and an import of checkin.js), so the version is global, not per file.
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const [dir, version] = process.argv.slice(2);
if (!dir || !/^[\w.-]+$/.test(version ?? '')) { console.error('usage: node scripts/stamp.mjs <dir> <version>'); process.exit(2); }
const v = `?v=${version}`;

// import x from './a.js' · import './a.js' · import('./a.js') · export … from './a.js'
const JS = /(\b(?:from|import)\s*\(?\s*)(['"])(\.{1,2}\/[^'"?#]+\.js)\2/g;
// src="app.js" · href="app.css" · href="js/passenger.js" (modulepreload) · href="/app.css" (404 page)
const HTML = /(\b(?:src|href)=")((?![a-z]+:|\/\/)[^"?#]+\.(?:js|css))"/g;

const files = (d) => readdirSync(d).flatMap(n => statSync(join(d, n)).isDirectory() ? files(join(d, n)) : [join(d, n)]);
let stamped = 0;
for (const f of files(dir)) {
  const html = f.endsWith('.html');
  if (!html && !f.endsWith('.js')) continue;
  let s = readFileSync(f, 'utf8');
  s = s.replace(JS, (_, a, q, p) => (stamped++, `${a}${q}${p}${v}${q}`));
  if (html) s = s.replace(HTML, (_, a, p) => (stamped++, `${a}${p}${v}"`));
  // Check: nothing local left unstamped (a new reference style would otherwise slip through silently).
  const left = [...s.matchAll(JS), ...(html ? s.matchAll(HTML) : [])].filter(m => !m[0].includes(v));
  if (left.length) { console.error(`${f}: unstamped ${left.map(m => m[0]).join(', ')}`); process.exit(1); }
  writeFileSync(f, s);
}
console.log(`stamped ${stamped} references with ${v}`);
