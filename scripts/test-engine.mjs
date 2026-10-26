import assert from 'node:assert/strict';
import { COLORS, ROWS, ROWS_OF, analyze, diffEvents } from '../src/engine.js';

assert.equal(COLORS.length, 8);
assert.equal(ROWS.length, 144);
for (let n = 1; n <= 90; n++) {
  assert.equal(ROWS_OF[n].length, 8, `số ${n} phải nằm trong đúng 8 hàng`);
  assert.equal(new Set(ROWS_OF[n].map(i => ROWS[i].ci)).size, 8, `số ${n}: mỗi màu đúng 1 hàng`);
}
// Gọi dần các số của 1 hàng → kiểm tra chuyển trạng thái đợi → kinh
const target = ROWS.find(r => r.ci === 3 && r.boardNo === 22 && r.ri === 1); // Cam · Bảng 22 · hàng 2
const called = [];
let prev = analyze(called), events;
target.nums.forEach((n, k) => {
  called.push(n);
  const next = analyze(called);
  events = diffEvents(prev, next);
  if (k < 3) assert.ok(!events.newWaits.includes(target.i) && !events.newKinh.includes(target.i));
  if (k === 3) { assert.ok(events.newWaits.includes(target.i), 'phải vào thế đợi ở số thứ 4'); assert.equal(next.miss[target.i], target.nums[4]); assert.ok(next.hot.get(target.nums[4]).includes(target.i)); }
  if (k === 4) { assert.ok(events.newKinh.includes(target.i), 'phải kinh ở số thứ 5'); assert.ok(!next.hot.get(target.nums[4])?.includes(target.i)); }
  prev = next;
});
// Gọi cả 90 số → mọi hàng đều kinh
const all = analyze(Array.from({ length: 90 }, (_, i) => i + 1));
assert.equal(all.totalKinh, 144);
console.log('engine OK — 144 hàng, 90 số, chuyển trạng thái đúng');
