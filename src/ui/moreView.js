// Màn hình 4 · Thêm: chia 2 trang nhỏ ("Ván chơi" · "Cài đặt") để không phải vuốt dài.
import { store } from '../store.js';
import { COLORS } from '../engine.js';
import { icon } from '../icons.js';
import { CSTYLE, $, esc } from './util.js';
import { confirmSheet } from './sheet.js';
import { pwa, installApp, showInstallHelp } from '../pwa.js';

let body;
let page = 'game';

export function initMore() {
  body = $('#moreBody');
  body.addEventListener('click', async (e) => {
    const t = e.target;
    const pg = t.closest('[data-page]');
    if (pg) { page = pg.dataset.page; renderMore(); return; }

    const pick = t.closest('.cpick');
    if (pick) { const ci = +pick.dataset.ci; store.setPref('myColor', store.prefs.myColor === ci ? null : ci); store.setPref('askedColor', true); return; }

    const h = t.closest('.hchip');
    if (h) {
      const n = +h.dataset.n;
      if (await confirmSheet({ title: `Hủy số ${n}?`, lead: 'Số này sẽ được bỏ khỏi ván chơi và vé tự cập nhật lại.', ok: 'Hủy số', danger: true })) store.remove(n);
      return;
    }
    if (t.closest('#btnNewGame')) {
      const n = store.called.length;
      if (!n) return;
      if (await confirmSheet({ title: 'Bắt đầu ván mới?', lead: `Xóa ${n} số đã gọi. Bạn có vài giây để khôi phục nếu bấm nhầm.`, ok: 'Ván mới', danger: true })) store.reset();
      return;
    }
    const sw = t.closest('[data-pref]');
    if (sw) { store.setPref(sw.dataset.pref, !store.prefs[sw.dataset.pref]); return; }
    const q = t.closest('[data-quality]');
    if (q) { store.setPref('quality', q.dataset.quality); return; }
    if (t.closest('#btnInstallRow')) { installApp(); return; }
    if (t.closest('#btnInstallHelp')) { showInstallHelp(); return; }
  });
}

const sw = (key, ic, title, sub) => `<button class="set" type="button" role="switch" aria-checked="${store.prefs[key]}" data-pref="${key}">
    <span class="set-ic">${icon(ic, 18)}</span><span class="set-tx"><b>${title}</b><small>${sub}</small></span><span class="sw"></span></button>`;

export function renderMore() {
  if (!body) return;
  const { prefs, called } = store;
  const my = prefs.myColor;

  const tabs = `<div class="seg full" role="tablist">
      <button type="button" data-page="game" class="${page === 'game' ? 'on' : ''}">Ván chơi</button>
      <button type="button" data-page="settings" class="${page === 'settings' ? 'on' : ''}">Cài đặt</button></div>`;

  let content;
  if (page === 'game') {
    const picks = COLORS.map((c) => `<button class="cpick ${my === c.ci ? 'on' : ''}" type="button" data-ci="${c.ci}" style="${CSTYLE[c.ci]}" aria-label="${esc(c.name)}" aria-pressed="${my === c.ci}"></button>`).join('');
    const last = store.last;
    const hist = called.length
      ? called.map((n) => `<button class="hchip ${n === last ? 'last' : ''}" type="button" data-n="${n}" aria-label="Số ${n}, chạm để hủy"><span>${n}</span></button>`).join('')
      : `<div class="hist-empty">Chưa gọi số nào.<br>Sang tab <b>Gọi số</b> và chạm số vừa nghe.</div>`;
    content = `
      <div class="card"><h3>Màu của tôi <span>${my == null ? 'Chỉ theo dõi' : esc(COLORS[my].name)}</span></h3>
        <div class="colors-pick">${picks}</div></div>
      <div class="card grow"><h3>Đã gọi <span>${called.length}/90 · chạm số để hủy</span></h3><div class="hist">${hist}</div></div>
      <button class="btn danger block" id="btnNewGame" type="button" ${called.length ? '' : 'disabled'}>${icon('rotate-ccw', 18)}Ván mới</button>`;
  } else {
    const showInstall = !pwa.standalone;
    const install = showInstall ? `<button class="set install" type="button" id="${pwa.offer ? 'btnInstallRow' : 'btnInstallHelp'}">
        <span class="set-ic">${icon('download', 18)}</span><span class="set-tx"><b>Cài về máy như một ứng dụng</b><small>${pwa.file ? 'Cần đưa lên https để cài' : 'Mở nhanh, toàn màn hình, chơi được khi mất mạng'}</small></span>${icon('chevron-right', 18)}</button>` : '';
    content = `<div class="card">
      ${install}
      ${sw('sound', 'volume-2', 'Âm thanh', 'Tiếng bóng rơi, đợi, kinh')}
      ${sw('haptics', 'vibrate', 'Rung', 'Rung nhẹ khi gọi số, mạnh hơn khi đợi/kinh')}
      ${sw('wakeLock', 'sun', 'Giữ màn hình sáng', 'Không tự khóa máy trong lúc chơi')}
      ${sw('speak', 'mic', 'Đọc số thành tiếng', 'Đọc lại số bạn vừa chạm để khỏi nhầm')}
      ${sw('showHot', 'flame', 'Đánh dấu số đang được đợi', 'Viền cam + chấm màu ngay trên bảng số')}
      <div class="set"><span class="set-ic">${icon('sparkles', 18)}</span><span class="set-tx"><b>Hiệu ứng 3D</b><small>Tiết kiệm pin: nền đứng yên</small></span>
        <span class="seg"><button type="button" data-quality="high" class="${prefs.quality === 'high' ? 'on' : ''}">Đầy đủ</button><button type="button" data-quality="eco" class="${prefs.quality === 'eco' ? 'on' : ''}">Tiết kiệm</button></span></div>
    </div>
    <p class="about">Lô Tô Dò Số · bản 2.0 · dữ liệu lưu ngay trên máy bạn</p>`;
  }
  body.innerHTML = `${tabs}<div class="page">${content}</div>`;
}
