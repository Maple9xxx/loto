// Build: gom src/ → assets/ (JS + CSS + font), sinh service worker có danh sách file để chạy offline.
//   node scripts/build.mjs          build 1 lần
//   node scripts/build.mjs --watch  build lại mỗi khi sửa code
import { build, context } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const r = (...p) => path.join(root, ...p);
const watch = process.argv.includes('--watch');

/* 1) Font: chỉ lấy 2 bộ ký tự cần cho tiếng Việt (latin + vietnamese), chép woff2 vào assets/fonts */
function fontCss() {
  fs.mkdirSync(r('assets/fonts'), { recursive: true });
  const ranges = (cssFile, name) => {
    const css = fs.readFileSync(cssFile, 'utf8');
    const m = css.match(new RegExp(`/\\* ${name} \\*/[\\s\\S]*?unicode-range: ([^;]+);`));
    if (!m) throw new Error('không tìm thấy unicode-range: ' + name);
    return m[1];
  };
  const out = [];
  const add = (family, weight, srcFile, outName, range, fmt = 'woff2') => {
    fs.copyFileSync(srcFile, r('assets/fonts', outName));
    out.push(`@font-face{font-family:"${family}";font-style:normal;font-display:swap;font-weight:${weight};src:url(./fonts/${outName}) format("${fmt}");unicode-range:${range}}`);
  };
  const bv = r('node_modules/@fontsource-variable/baloo-2');
  for (const sub of ['latin', 'vietnamese']) {
    add('Baloo 2', '400 800', `${bv}/files/baloo-2-${sub}-wght-normal.woff2`, `baloo-2-${sub}.woff2`,
      ranges(`${bv}/wght.css`, `baloo-2-${sub}-wght-normal`), 'woff2-variations');
  }
  const bp = r('node_modules/@fontsource/be-vietnam-pro');
  for (const w of [400, 500, 600, 700]) {
    for (const sub of ['latin', 'vietnamese']) {
      add('Be Vietnam Pro', w, `${bp}/files/be-vietnam-pro-${sub}-${w}-normal.woff2`, `be-vietnam-pro-${sub}-${w}.woff2`,
        ranges(`${bp}/${w}.css`, `be-vietnam-pro-${sub}-${w}-normal`));
    }
  }
  fs.writeFileSync(r('src/fonts.generated.css'), `/* sinh bởi scripts/build.mjs */\n${out.join('\n')}\n`);
}

/* 2) Service worker: nhúng danh sách file + mã bản build */
function walk(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p, base) : [path.relative(root, p).split(path.sep).join('/')];
  });
}
function writeSW() {
  const files = ['assets/app.js', 'assets/app.css', ...walk(r('assets/fonts')), ...walk(r('icons')), 'manifest.webmanifest', 'index.html'].filter((f) => fs.existsSync(r(f)));
  const hash = crypto.createHash('sha1');
  for (const f of files) hash.update(fs.readFileSync(r(f)));
  const buildId = hash.digest('hex').slice(0, 10);
  const tpl = fs.readFileSync(r('src/sw.js'), 'utf8')
    .replace('__BUILD__', buildId)
    .replace('__ASSETS__', JSON.stringify(['./', ...files], null, 2));
  fs.writeFileSync(r('sw.js'), tpl);
  return buildId;
}

fontCss();
const opts = {
  entryPoints: [r('src/main.js')],
  outfile: r('assets/app.js'),
  bundle: true,
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  format: 'iife',
  target: ['es2020'],
  legalComments: 'none',
  external: ['./fonts/*'],
  logLevel: 'info',
};

if (watch) {
  const ctx = await context({ ...opts, plugins: [{ name: 'sw', setup(b) { b.onEnd(() => writeSW()); } }] });
  await ctx.watch();
  console.log('Đang theo dõi thay đổi… (Ctrl+C để dừng)');
} else {
  await build(opts);
  const id = writeSW();
  const size = (f) => (fs.statSync(r(f)).size / 1024).toFixed(0) + ' KB';
  console.log(`✓ assets/app.js ${size('assets/app.js')} · assets/app.css ${size('assets/app.css')} · sw.js (build ${id})`);
}
