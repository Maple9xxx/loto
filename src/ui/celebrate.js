// Màn hình ăn mừng khi có hàng KINH: pháo hoa 3D + thẻ thông tin hàng vừa kinh.
import { store } from '../store.js';
import { COLORS, ROWS, rowLabel } from '../engine.js';
import { CSTYLE, $, esc } from './util.js';
import { app } from '../app.js';

let root, open = false;

export function initCelebrate() {
  root = $('#celebrate');
  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-new]')) { hideKinh(); store.reset(); return; }
    if (e.target.closest('[data-go]')) { const i = +e.target.closest('[data-go]').dataset.go; hideKinh(); app.goToRow(i); return; }
    if (e.target.closest('[data-keep]') || e.target === root) hideKinh();
  });
  document.addEventListener('keydown', (e) => { if (open && (e.key === 'Escape' || e.key === 'Enter')) hideKinh(); });
}

export const kinhOpen = () => open;

export function showKinh(rowIdx, lastN) {
  const my = store.prefs.myColor;
  const rows = rowIdx.map((i) => ROWS[i]).sort((a, b) => (b.ci === my) - (a.ci === my));
  const mine = rows.some((r) => r.ci === my);
  const shown = rows.slice(0, 2);
  const more = rows.length - shown.length;

  const cards = shown.map((r) => {
    const c = COLORS[r.ci];
    return `<div class="k-row" style="${CSTYLE[r.ci]}">
      <div class="k-row-h"><i class="chip-dot"></i><div style="flex:1;min-width:0"><b>${esc(c.name)}${r.ci === my ? ' ★' : ''}</b><small>${esc(rowLabel(r.i))}</small></div>
        <button class="btn" type="button" data-go="${r.i}" style="min-height:36px;padding:0 12px;font-size:12.5px">Xem vé</button></div>
      <div class="k-nums">${r.nums.map((n) => `<span class="${n === lastN ? 'new' : ''}">${n}</span>`).join('')}</div>
    </div>`;
  }).join('');

  root.innerHTML = `<div class="kcard ${mine ? 'mine' : ''}" role="alertdialog" aria-label="Có hàng kinh">
      <div class="k-eyebrow">${mine ? 'Màu của bạn · hô lên nào!' : 'Có người kinh rồi'}</div>
      <h2>KINH!</h2>
      <div class="k-win">${cards}</div>
      ${more > 0 ? `<p class="k-more">và ${more} hàng khác cũng vừa kinh</p>` : ''}
      <div class="row-actions"><button class="btn" type="button" data-keep>Tiếp tục ván</button><button class="btn primary" type="button" data-new>Ván mới</button></div>
    </div>`;
  open = true;
  document.body.classList.add('celebrating');
  root.classList.add('show');
  app.stage?.celebrate([...new Set(rows.map((r) => COLORS[r.ci].hex))]);
}

export function hideKinh() {
  if (!open) return;
  open = false;
  root.classList.remove('show');
  document.body.classList.remove('celebrating');
  app.stage?.stopCelebrate();
  setTimeout(() => { if (!open) root.innerHTML = ''; }, 400);
}
