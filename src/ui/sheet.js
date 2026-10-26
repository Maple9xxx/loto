import { $ } from './util.js';

let current = null;

export function closeSheet() { current?.close(); }
export const sheetOpen = () => !!current;

/** Mở bảng trượt từ dưới lên. Trả về { el, close }. */
export function openSheet({ html, onMount, onClose }) {
  closeSheet();
  const root = $('#sheetRoot');
  root.innerHTML = `<div class="scrim" data-close></div><div class="sheet" role="dialog" aria-modal="true"><div class="grabber"></div>${html}</div>`;
  const el = root.querySelector('.sheet');
  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    root.classList.remove('sheet-open');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => { if (current === api) { root.innerHTML = ''; current = null; } }, 380);
    onClose?.();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  root.querySelector('[data-close]').addEventListener('click', close);
  root.addEventListener('click', (e) => { if (e.target.closest('[data-dismiss]')) close(); });
  document.addEventListener('keydown', onKey);
  const api = { el, close };
  current = api;
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('sheet-open')));
  onMount?.(el, api);
  return api;
}

/** Hộp xác nhận. Trả về Promise<boolean>. */
export function confirmSheet({ title, lead = '', ok = 'Đồng ý', cancel = 'Hủy', danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    openSheet({
      html: `<h2>${title}</h2>${lead ? `<p class="lead">${lead}</p>` : ''}
        <div class="row-actions"><button class="btn" type="button" data-dismiss>${cancel}</button><button class="btn ${danger ? 'danger' : 'primary'}" type="button" data-ok>${ok}</button></div>`,
      onMount: (el, api) => el.querySelector('[data-ok]').addEventListener('click', () => { result = true; api.close(); }),
      onClose: () => resolve(result),
    });
  });
}
