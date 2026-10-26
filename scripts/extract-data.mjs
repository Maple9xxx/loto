// Trích dữ liệu vé từ file index.html gốc → src/data.js (chạy 1 lần, giữ lại để đối chiếu)
import fs from 'node:fs';
const src = fs.readFileSync(process.argv[2], 'utf8');
const a = src.indexOf('const COLORS = [');
const b = src.indexOf('];', a) + 1;
const ORIGINAL = new Function(src.slice(a, b).replace('const COLORS =', 'return'))();

// Thứ tự theo số bảng trên giấy (Đỏ 1-6, Xanh Dương 7-12, ...), kèm màu hiển thị.
const META = [
  { key: 'do',           hex: '#ff4d5a', ink: '#ffffff' },
  { key: 'xanh-duong',   hex: '#2d9cff', ink: '#ffffff' },
  { key: 'xanh-la-nhat', hex: '#a6e22e', ink: '#1b2a05' },
  { key: 'cam',          hex: '#ff8a1f', ink: '#2b1500' },
  { key: 'hong',         hex: '#ff5fb0', ink: '#ffffff' },
  { key: 'xanh-la-dam',  hex: '#12b76a', ink: '#ffffff' },
  { key: 'tim',          hex: '#a56bff', ink: '#ffffff' },
  { key: 'vang',         hex: '#ffd028', ink: '#2b2100' },
];
const lines = [];
for (const m of META) {
  const c = ORIGINAL.find(x => x.key === m.key);
  lines.push(`  { key: '${c.key}', name: '${c.name}', hex: '${m.hex}', ink: '${m.ink}', sheets: [`);
  for (const s of c.sheets) {
    lines.push(`    { name: '${s.name}', boards: [`);
    for (const card of s.cards) {
      let no = parseInt(card.id.replace(/\D+/g, ''), 10);
      // Sửa nhãn nhập nhầm trong bản gốc: bảng xanh dương ghi "Bảng 38" (đúng ra là 10)
      if (c.key === 'xanh-duong' && no === 38) no = 10;
      lines.push(`      [${no}, ${JSON.stringify(card.rows)}],`);
    }
    lines.push(`    ] },`);
  }
  lines.push(`  ] },`);
}
const out = `// Dữ liệu 8 bộ vé lô tô giấy: 8 màu · 16 tờ · 48 bảng · 144 hàng.
// Mỗi màu phủ đúng 90 số (1–90), mỗi số xuất hiện đúng 1 lần trong 1 màu.
// Định dạng bảng: [số bảng, [hàng1, hàng2, hàng3]]  (mỗi hàng 5 số)
// File này được sinh bởi scripts/extract-data.mjs từ bản gốc.
export const RAW = [
${lines.join('\n')}
];
`;
fs.writeFileSync('src/data.js', out);
console.log('wrote src/data.js', out.length, 'bytes');
