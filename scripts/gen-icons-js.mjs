// Gom các icon lucide cần dùng → src/icons.js (nhúng sẵn, không cần mạng)
import fs from 'node:fs';
const NAMES = ['megaphone','radar','ticket','sliders-horizontal','undo-2','volume-2','volume-x','download','share','x','check','star','zap','crown','rotate-ccw','smartphone','vibrate','sun','history','trash-2','sparkles','chevron-right','layout-grid','rows-3','eye','keyboard','info','flame','plus','refresh-cw','mic','palette','trophy','party-popper','square-plus','hand','circle-help','gauge','bell-ring','wifi-off','circle-check','user-round','battery-charging'];
const dir = 'node_modules/lucide-static/icons/';
const out = {};
for (const n of NAMES) {
  const f = dir + n + '.svg';
  if (!fs.existsSync(f)) { console.warn('thiếu icon', n); continue; }
  const svg = fs.readFileSync(f, 'utf8');
  out[n] = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '').replace(/\s+/g, ' ').trim();
}
const js = `// Sinh bởi scripts/gen-icons-js.mjs từ lucide-static (ISC License).
const PATHS = ${JSON.stringify(out, null, 1)};

export function icon(name, size = 20, cls = '') {
  const p = PATHS[name];
  if (!p) return '';
  return \`<svg class="ic \${cls}" width="\${size}" height="\${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">\${p}</svg>\`;
}
`;
fs.writeFileSync('src/icons.js', js);
console.log('icons:', Object.keys(out).length, 'bytes:', js.length);
