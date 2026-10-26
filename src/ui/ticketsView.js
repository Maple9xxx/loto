// Màn hình 3 · Vé: 8 chấm màu trên một hàng, 2 tờ cạnh nhau, tự co để vừa màn hình.
import { store } from '../store.js';
import { COLORS, ROWS } from '../engine.js';
import { icon } from '../icons.js';
import { CSTYLE, $, esc } from './util.js';

let body;
let ci = 0;            // màu đang xem
let mode = 'both';     // 'both' | 0 | 1  (cả hai tờ / chỉ tờ 1 / chỉ tờ 2)
let started = false;

export function initTickets() {
  body = $('#ticketBody');
  body.addEventListener('click', (e) => {
    const dot = e.target.closest('.cdot');
    if (dot) { ci = +dot.dataset.ci; renderTickets(); return; }
    const seg = e.target.closest('[data-mode]');
    if (seg) { mode = seg.dataset.mode === 'both' ? 'both' : +seg.dataset.mode; renderTickets(); }
  });
}

export function showColor(index, { both = false } = {}) {
  ci = index; started = true;
  if (both) mode = 'both';
}

export function currentColor() { return ci; }

export function renderTickets({ justN = null, flashRow = null } = {}) {
  if (!body) return;
  if (!started) { started = true; if (store.prefs.myColor != null) ci = store.prefs.myColor; }
  const an = store.an;
  const c = COLORS[ci];
  const my = store.prefs.myColor;

  const dots = COLORS.map((k) => {
    const bc = an.byColor[k.ci];
    const badge = bc.kinh.length ? `<em class="k">${bc.kinh.length}</em>` : bc.wait.length ? `<em>${bc.wait.length}</em>` : '';
    return `<button class="cdot ${k.ci === ci ? 'active' : ''}" type="button" data-ci="${k.ci}" style="${CSTYLE[k.ci]}" role="tab" aria-selected="${k.ci === ci}" aria-label="${esc(k.name)}">${badge}</button>`;
  }).join('');

  const s0 = c.sheets[0], s1 = c.sheets[1];
  const segBtn = (m, label, aria) => `<button type="button" data-mode="${m}" class="${String(mode) === String(m) ? 'on' : ''}" aria-label="${aria}">${label}</button>`;
  const tools = `<div class="tools" style="${CSTYLE[ci]}">
      <span class="name">${esc(c.name)}${my === ci ? ' ★' : ''}</span>
      <div class="seg" role="group" aria-label="Chọn tờ">
        ${segBtn('both', icon('layout-grid', 15), 'Xem cả hai tờ')}${segBtn(0, `${s0.from}–${s0.to}`, `Chỉ ${s0.name}`)}${segBtn(1, `${s1.from}–${s1.to}`, `Chỉ ${s1.name}`)}
      </div>
    </div>`;

  const sheets = (mode === 'both' ? c.sheets : [c.sheets[mode]]).map((s) => {
    const boards = s.boards.map((b) => {
      let matched = 0;
      const rows = b.rows.map((_, ri) => {
        const row = ROWS[c.ci * 18 + s.si * 9 + b.bi * 3 + ri];
        matched += an.m[row.i];
        return rowHTML(row, an, justN, flashRow);
      }).join('');
      return `<div class="board"><div class="board-h">Bảng ${b.no}<span>${matched}/15</span></div>${rows}</div>`;
    }).join('');
    return `<div class="sheet-col"><div class="sheet-h"><b>${esc(s.name)}</b><span>Bảng ${s.from}–${s.to}</span></div>${boards}</div>`;
  }).join('');

  body.innerHTML = `<div class="cdots" role="tablist" aria-label="Chọn màu vé">${dots}</div>${tools}
    <div class="sheets ${mode === 'both' ? '' : 'single'}" style="${CSTYLE[ci]}">${sheets}</div>`;
}

function rowHTML(row, an, justN, flashRow) {
  const m = an.m[row.i];
  const st = m === 5 ? 'kinh' : m === 4 ? 'wait' : '';
  const miss = an.miss[row.i];
  const cells = row.nums.map((n) => {
    const on = an.set[n] === 1;
    let cls = on ? 'cell on' : 'cell';
    if (st === 'wait' && n === miss) cls = 'cell miss';
    if (on && n === justN) cls += ' just';
    return `<span class="${cls}"><i><span>${n}</span></i></span>`;
  }).join('');
  return `<div class="trow ${st}${row.i === flashRow ? ' flash' : ''}" data-row="${row.i}">${cells}</div>`;
}
