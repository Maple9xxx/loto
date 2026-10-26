// Lõi logic: phân tích số đã gọi trên toàn bộ 144 hàng vé. Không đụng DOM.
import { RAW } from './data.js';

export const COLORS = RAW.map((c, ci) => ({
  ci,
  key: c.key,
  name: c.name,
  hex: c.hex,
  ink: c.ink,
  sheets: c.sheets.map((s, si) => ({
    si,
    name: s.name,
    from: Math.min(...s.boards.map(b => b[0])),
    to: Math.max(...s.boards.map(b => b[0])),
    boards: s.boards.map(([no, rows], bi) => ({ no, bi, rows })),
  })),
}));

/** Danh sách phẳng 144 hàng. i = ci*18 + si*9 + bi*3 + ri */
export const ROWS = [];
/** ROWS_OF[n] = các chỉ số hàng chứa số n (mỗi số nằm trong đúng 8 hàng — 1 hàng / màu) */
export const ROWS_OF = Array.from({ length: 91 }, () => []);

COLORS.forEach(c => c.sheets.forEach(s => s.boards.forEach(b => b.rows.forEach((nums, ri) => {
  const row = { i: ROWS.length, ci: c.ci, si: s.si, bi: b.bi, ri, boardNo: b.no, nums };
  ROWS.push(row);
  nums.forEach(n => ROWS_OF[n].push(row.i));
}))));

export const TOTAL_NUMBERS = 90;

/**
 * Phân tích toàn bộ trạng thái từ danh sách số đã gọi.
 * - m[i]    : số ô đã trúng của hàng i (0–5)
 * - miss[i] : nếu hàng i đang "đợi" (m = 4) → số còn thiếu, ngược lại 0
 * - hot     : Map<số đang được đợi, danh sách hàng đợi số đó>
 */
export function analyze(called) {
  const set = new Uint8Array(91);
  for (const n of called) set[n] = 1;

  const m = new Uint8Array(ROWS.length);
  const miss = new Uint8Array(ROWS.length);
  for (const row of ROWS) {
    let c = 0, missing = 0;
    for (const n of row.nums) { if (set[n]) c++; else missing = n; }
    m[row.i] = c;
    if (c === 4) miss[row.i] = missing;
  }

  const byColor = COLORS.map(() => ({ wait: [], kinh: [], bars: [], missing: [] }));
  const hot = new Map();
  let totalWait = 0, totalKinh = 0;
  for (const row of ROWS) {
    const bc = byColor[row.ci];
    bc.bars.push(m[row.i]);
    if (m[row.i] === 4) {
      bc.wait.push(row.i); totalWait++;
      const n = miss[row.i];
      if (!bc.missing.includes(n)) bc.missing.push(n);
      if (!hot.has(n)) hot.set(n, []);
      hot.get(n).push(row.i);
    } else if (m[row.i] === 5) {
      bc.kinh.push(row.i); totalKinh++;
    }
  }
  return { set, m, miss, byColor, hot, totalWait, totalKinh };
}

/** So sánh hai lần phân tích → các hàng vừa chuyển sang "đợi" / "kinh". */
export function diffEvents(prev, next) {
  const newWaits = [], newKinh = [];
  for (let i = 0; i < ROWS.length; i++) {
    if (next.m[i] === 4 && prev.m[i] < 4) newWaits.push(i);
    else if (next.m[i] === 5 && prev.m[i] < 5) newKinh.push(i);
  }
  return { newWaits, newKinh };
}

/** Nhãn hàng dạng chữ: "Tờ 22 · Bảng 22 · Hàng 2" */
export function rowLabel(i) {
  const r = ROWS[i];
  const c = COLORS[r.ci];
  return `${c.sheets[r.si].name} · Bảng ${r.boardNo} · Hàng ${r.ri + 1}`;
}

/** Trạng thái hiển thị của một hàng */
export function rowStatus(an, i) {
  const m = an.m[i];
  return m === 5 ? 'kinh' : m === 4 ? 'wait' : m === 3 ? 'warm' : 'idle';
}
