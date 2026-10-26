// Màn hình 2 · Theo dõi: ai đang đợi số nào, 8 màu đang "nóng" đến đâu — vừa khít một màn hình.
import { store } from '../store.js';
import { COLORS, ROWS, rowLabel } from '../engine.js';
import { icon } from '../icons.js';
import { CSTYLE, $, esc } from './util.js';
import { openSheet } from './sheet.js';
import { app } from '../app.js';

let body;
export function initWatch() {
  body = $('#watchBody');
  body.addEventListener('click', (e) => {
    const hot = e.target.closest('.hot-chip');
    if (hot) return hot.classList.contains('more') ? openAllHot() : openHot(+hot.dataset.n);
    const card = e.target.closest('.ccard');
    if (card) app.goToColor(+card.dataset.ci);
  });
}

function hotList() {
  const my = store.prefs.myColor;
  return [...store.an.hot.entries()].map(([n, rows]) => {
    const cis = [...new Set(rows.map((i) => ROWS[i].ci))];
    return { n, rows, cis, mine: cis.includes(my) };
  }).sort((a, b) => (b.mine - a.mine) || (b.rows.length - a.rows.length) || (a.n - b.n));
}

export function renderWatch() {
  if (!body) return;
  const { an, prefs } = store;
  const my = prefs.myColor;
  const hot = hotList();

  // số chip hiển thị vừa một hàng; thừa thì gộp vào "+N"
  const w = body.clientWidth || 340;
  const cap = Math.max(3, Math.floor((w + 7) / 59));
  const shown = hot.length > cap ? hot.slice(0, cap - 1) : hot;
  const rest = hot.length - shown.length;

  const hotHTML = hot.length
    ? shown.map((h) => `<button class="hot-chip ${h.mine ? 'mine' : ''}" type="button" data-n="${h.n}" aria-label="Số ${h.n}, ${h.cis.length} màu đang đợi">
          <span class="hot-num"><span>${h.n}</span></span>
          <span class="hot-dots">${h.cis.slice(0, 4).map((ci) => `<i style="${CSTYLE[ci]}"></i>`).join('')}</span>
        </button>`).join('') + (rest ? `<button class="hot-chip more" type="button" aria-label="Xem thêm ${rest} số">+${rest}</button>` : '')
    : `<div class="hot-empty">${icon('radar', 20)}<span>Chưa ai vào thế đợi.<br>Khi có hàng chỉ còn thiếu 1 số, số đó hiện ở đây.</span></div>`;

  const cards = COLORS.map((c) => {
    const bc = an.byColor[c.ci];
    const bars = [...bc.bars].sort((a, b) => b - a)
      .map((m) => `<i class="bar ${m === 4 ? 'w' : m === 5 ? 'k' : m === 0 ? 'z' : ''}" style="--m:${m}"></i>`).join('');
    const pills = [];
    if (bc.kinh.length) pills.push(`<span class="pill k">${icon('star', 12)}<b>${bc.kinh.length}</b> kinh</span>`);
    if (bc.wait.length) pills.push(`<span class="pill w">${icon('zap', 12)}<b>${bc.wait.length}</b> đợi</span>`);
    bc.missing.slice().sort((a, b) => a - b).slice(0, bc.kinh.length ? 1 : 2).forEach((n) => pills.push(`<span class="pill need">${n}</span>`));
    if (!pills.length) pills.push(`<span class="cquiet">${bc.bars.some((m) => m >= 3) ? 'Gần đợi' : 'Chưa đợi'}</span>`);
    const mine = my === c.ci;
    return `<button class="ccard ${mine ? 'mine' : ''} ${bc.kinh.length ? 'has-kinh' : ''}" type="button" data-ci="${c.ci}" style="${CSTYLE[c.ci]}" aria-label="${esc(c.name)}: ${bc.wait.length} hàng đợi, ${bc.kinh.length} hàng kinh">
      <span class="ccard-h"><i class="chip-dot"></i><strong>${esc(c.name)}</strong>${mine ? '<span class="mine-tag">Tôi</span>' : ''}</span>
      <span class="bars" aria-hidden="true">${bars}</span>
      <span class="cstat">${pills.join('')}</span>
    </button>`;
  }).join('');

  body.innerHTML = `
    <div class="sec-h"><h2>Đang chờ số</h2><span>${hot.length ? `${hot.length} số · ${an.totalWait} hàng` : ''}</span></div>
    <div class="hot-strip">${hotHTML}</div>
    <div class="sec-h"><h2>8 màu vé</h2><span>chạm để xem vé</span></div>
    <div class="color-grid">${cards}</div>`;
}

/* ---------- chi tiết 1 số đang được đợi ---------- */
function openHot(n) {
  const rows = store.an.hot.get(n);
  if (!rows) return;
  const my = store.prefs.myColor;
  const list = rows.slice().sort((a, b) => (ROWS[b].ci === my) - (ROWS[a].ci === my) || ROWS[a].ci - ROWS[b].ci).map((i) => {
    const r = ROWS[i], c = COLORS[r.ci];
    return `<div class="lrow" style="${CSTYLE[r.ci]}"><i class="chip-dot"></i>
      <div class="tx"><b>${esc(c.name)}${r.ci === my ? ' ★' : ''}</b><small>${esc(rowLabel(i))}</small></div>
      <button class="btn" type="button" data-row="${i}">Xem vé</button></div>`;
  }).join('');
  openSheet({
    html: `<h2>Số ${n} đang được đợi</h2><p class="lead">Nếu số này được gọi, <b>${rows.length} hàng</b> sẽ kinh.</p><div class="list-rows">${list}</div>`,
    onMount: (el, api) => el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-row]');
      if (b) { api.close(); app.goToRow(+b.dataset.row); }
    }),
  });
}

function openAllHot() {
  const hot = hotList();
  const items = hot.map((h) => `<button class="hot-chip ${h.mine ? 'mine' : ''}" type="button" data-n="${h.n}" style="width:auto">
      <span class="hot-num"><span>${h.n}</span></span><span class="hot-dots">${h.cis.slice(0, 4).map((ci) => `<i style="${CSTYLE[ci]}"></i>`).join('')}</span></button>`).join('');
  openSheet({
    html: `<h2>Tất cả số đang được đợi</h2><p class="lead">${hot.length} số · ${store.an.totalWait} hàng. Chạm một số để xem ai đang đợi.</p>
      <div class="pick-grid">${items}</div>`,
    onMount: (el, api) => el.addEventListener('click', (e) => {
      const b = e.target.closest('.hot-chip');
      if (b) { api.close(); setTimeout(() => openHot(+b.dataset.n), 380); }
    }),
  });
}
