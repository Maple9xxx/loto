import { $, esc } from './util.js';
import { icon } from '../icons.js';

const root = () => $('#toasts');

/**
 * Thông báo nổi ở đầu màn hình — không chặn thao tác phía dưới.
 * opts: { icon, kind: ''|'wait'|'mine', title, sub, html, action:{label,run}, ms, onTap }
 */
export function toast(opts) {
  const { icon: ic = 'info', kind = '', title, sub = '', html = '', action, ms = 4200, onTap } = opts;
  const r = root();
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <span class="t-ic">${icon(ic, 20)}</span>
    <div class="t-tx"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}${html}</div>
    ${action ? `<button class="t-act" type="button">${esc(action.label)}</button>` : ''}`;
  let timer;
  const close = () => {
    clearTimeout(timer);
    if (!el.isConnected || el.classList.contains('out')) return;
    el.classList.add('out');
    setTimeout(() => el.remove(), 280);
  };
  el.addEventListener('click', (e) => {
    if (e.target.closest('.t-act')) { action.run(); close(); return; }
    onTap?.(); close();
  });
  while (r.children.length >= 3) r.firstElementChild.remove();
  r.appendChild(el);
  if (ms) timer = setTimeout(close, ms);
  return { close };
}
