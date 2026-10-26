// Màn hình 1 · Gọi số: bảng 90 số vừa khít một màn hình. Chạm = đánh dấu cho cả 8 màu.
import { store } from '../store.js';
import { sfx } from '../audio.js';
import { icon } from '../icons.js';
import { CSTYLE, $ } from './util.js';
import { sheetOpen } from './sheet.js';
import { ROWS, TOTAL_NUMBERS } from '../engine.js';

let gridEl, hintEl, typedEl, undoBtn;
const cells = [];
let pendingCancel = null, pendingTimer = 0;
let hintTimer = 0;
let typed = '', typedTimer = 0;

export function initCall() {
  gridEl = $('#grid'); hintEl = $('#hint'); typedEl = $('#typed'); undoBtn = $('#btnUndo');

  gridEl.innerHTML = Array.from({ length: TOTAL_NUMBERS }, (_, i) => {
    const n = i + 1;
    return `<button class="num" type="button" data-n="${n}" aria-label="Số ${n}"><span>${n}</span><i class="dots"></i></button>`;
  }).join('');
  $$cells();

  gridEl.addEventListener('click', (e) => {
    const b = e.target.closest('.num');
    if (b) tap(+b.dataset.n, b);
  });

  undoBtn.innerHTML = `${icon('undo-2', 18)}<span>Hoàn tác</span>`;
  undoBtn.addEventListener('click', () => { clearCancel(); store.undo(); });

  document.addEventListener('keydown', onKey);
  syncCall();
}

function $$cells() { cells.length = 0; gridEl.querySelectorAll('.num').forEach((b) => { cells[+b.dataset.n] = b; }); }

/* ---------- chạm vào 1 số ---------- */
function tap(n, el) {
  if (store.has(n)) {
    // số đã gọi: chạm lần 2 trong 2,2 giây mới hủy → tránh hủy nhầm
    if (pendingCancel === n) { clearCancel(); store.remove(n); return; }
    clearCancel();
    pendingCancel = n;
    el.classList.add('confirm');
    flashHint(`Chạm lại số ${n} để hủy`, true, 2200);
    sfx.tick();
    pendingTimer = setTimeout(clearCancel, 2200);
    return;
  }
  clearCancel();
  const res = store.call(n);
  if (res?.error) return;
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
}

function clearCancel() {
  clearTimeout(pendingTimer);
  if (pendingCancel != null) cells[pendingCancel]?.classList.remove('confirm');
  pendingCancel = null;
}

export function flashHint(text, warn = false, ms = 2600) {
  hintEl.textContent = text;
  hintEl.classList.toggle('warn', warn);
  clearTimeout(hintTimer);
  hintTimer = setTimeout(defaultHint, ms);
}

function defaultHint() {
  hintEl.classList.remove('warn');
  const n = store.called.length;
  if (!n) hintEl.textContent = 'Nghe gọi số nào, chạm số đó. App tự đánh dấu cho cả 8 màu.';
  else if (store.prefs.showHot && store.an.hot.size) hintEl.textContent = 'Số viền cam: đang có người đợi.';
  else hintEl.textContent = 'Chạm lại số đã gọi để hủy.';
}

/* ---------- đồng bộ giao diện với trạng thái ---------- */
export function syncCall() {
  if (!gridEl) return;
  const { an, called, prefs } = store;
  const last = store.last;
  const my = prefs.myColor;
  for (let n = 1; n <= TOTAL_NUMBERS; n++) {
    const b = cells[n];
    const on = an.set[n] === 1;
    const rows = !on && prefs.showHot ? an.hot.get(n) : null;
    b.classList.toggle('called', on);
    b.classList.toggle('last', n === last);
    b.classList.toggle('hot', !!rows);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    const dots = b.lastElementChild;
    if (rows) {
      const cis = [...new Set(rows.map((i) => ROWS[i].ci))].sort((a, c) => (c === my) - (a === my) || a - c);
      const html = cis.slice(0, 4).map((ci) => `<b class="${ci === my ? 'mine' : ''}" style="${CSTYLE[ci]}"></b>`).join('');
      if (dots.dataset.k !== html) { dots.innerHTML = html; dots.dataset.k = html; }
      b.setAttribute('aria-label', `Số ${n}, ${cis.length} màu đang đợi`);
    } else if (dots.dataset.k) { dots.innerHTML = ''; dots.dataset.k = ''; b.setAttribute('aria-label', `Số ${n}`); }
  }
  undoBtn.disabled = !called.length;
  if (!hintTimer || !hintEl.textContent) defaultHint();
  else if (!hintEl.classList.contains('warn')) defaultHint();
}

/* ---------- bàn phím (máy tính): gõ số rồi Enter ---------- */
function onKey(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) {
    if ((e.key === 'z' || e.key === 'Z') && !e.shiftKey) { e.preventDefault(); store.undo(); }
    return;
  }
  if (sheetOpen() || document.body.classList.contains('celebrating')) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) return;
  const k = e.key;
  if (/^\d$/.test(k)) {
    e.preventDefault();
    typed = (typed + k).slice(-2);
    showTyped();
    clearTimeout(typedTimer);
    if (typed.length === 2) commitTyped();
    else typedTimer = setTimeout(commitTyped, typed === '9' ? 700 : 850);
  } else if (k === 'Enter') { if (typed) { e.preventDefault(); commitTyped(); } }
  else if (k === 'Backspace') { if (typed) { typed = typed.slice(0, -1); showTyped(); } }
  else if (k === 'Escape') { typed = ''; showTyped(); }
}
function showTyped() {
  typedEl.textContent = typed ? `⌨ ${typed}` : '';
  typedEl.classList.toggle('on', !!typed);
}
function commitTyped() {
  clearTimeout(typedTimer);
  const n = parseInt(typed, 10);
  typed = ''; showTyped();
  if (!n || n < 1 || n > TOTAL_NUMBERS) { flashHint('Chỉ nhận số từ 1 đến 90', true); sfx.error(); return; }
  if (store.has(n)) { flashHint(`Số ${n} đã được gọi rồi`, true); sfx.error(); return; }
  store.call(n);
  cells[n]?.classList.add('pop');
}
