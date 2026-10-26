// Khởi động ứng dụng: nối store ↔ giao diện ↔ sân khấu 3D ↔ âm thanh.
import './styles.css';
import { store } from './store.js';
import { COLORS, ROWS, analyze, diffEvents, rowLabel, TOTAL_NUMBERS } from './engine.js';
import { sfx, buzz, speak } from './audio.js';
import { icon } from './icons.js';
import { app } from './app.js';
import { $, $$, esc, CSTYLE, reducedMotion } from './ui/util.js';
import { toast } from './ui/toast.js';
import { openSheet } from './ui/sheet.js';
import { initCall, syncCall } from './ui/callView.js';
import { initWatch, renderWatch } from './ui/watchView.js';
import { initTickets, renderTickets, showColor } from './ui/ticketsView.js';
import { initMore, renderMore } from './ui/moreView.js';
import { initCelebrate, showKinh } from './ui/celebrate.js';
import { pwa, initInstall, onPwaChange, registerSW, installApp, initWakeLock, setWakeLock } from './pwa.js';
import { Stage3D } from './three/stage3d.js';

const stageEl = $('#stage');

/* ================= tab ================= */
function setTab(name, opts) {
  app.tab = name;
  $$('.tab').forEach((t) => { const on = t.dataset.tab === name; t.classList.toggle('active', on); t.setAttribute('aria-current', on ? 'page' : 'false'); });
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
  stageEl.classList.toggle('compact', name !== 'call');
  app.stage?.trackLayout(800);
  renderActive(opts);
}
function renderActive(opts) {
  switch (app.tab) {
    case 'call': syncCall(); break;
    case 'watch': renderWatch(); break;
    case 'tickets': renderTickets(opts); break;
    case 'more': renderMore(); break;
  }
}
app.setTab = setTab;
app.renderActive = renderActive;
app.goToColor = (ci) => { showColor(ci); setTab('tickets'); };
app.goToRow = (i) => { showColor(ROWS[i].ci, { both: true }); setTab('tickets', { flashRow: i }); };

/* ================= sân khấu (số vừa gọi, đếm, chip) ================= */
function updateStageInfo() {
  const { an, called } = store;
  const n = called.length, last = store.last;
  $('#countNum').textContent = n;
  $('#progressBar').style.width = `${(n / TOTAL_NUMBERS) * 100}%`;
  $('#stageLabel').textContent = last ? `Vừa gọi · số ${last}` : 'Chưa gọi số nào';
  $('#fbNum').textContent = last ?? '?';
  $('#liveCall').textContent = last ? `Số vừa gọi: ${last}` : '';
  const w = $('#chipWait'), k = $('#chipKinh');
  w.innerHTML = `${icon('zap', 13)}<b>${an.totalWait}</b> đợi`;
  k.innerHTML = `${icon('star', 13)}<b>${an.totalKinh}</b> kinh`;
  w.classList.toggle('on', an.totalWait > 0);
  k.classList.toggle('on', an.totalKinh > 0);
  const total = an.totalWait + an.totalKinh;
  const badge = $('#badgeWatch');
  badge.hidden = !total;
  badge.textContent = total;
  badge.classList.toggle('kinh', an.totalKinh > 0);
}

function updateSoundBtn() {
  const b = $('#btnSound'), on = store.prefs.sound;
  b.innerHTML = icon(on ? 'volume-2' : 'volume-x', 20);
  b.classList.toggle('off', !on);
  b.setAttribute('aria-pressed', String(on));
  b.title = on ? 'Tắt âm thanh' : 'Bật âm thanh';
}

function updateInstallUI() {
  const top = $('#btnInstallTop');
  top.hidden = !pwa.offer;
  top.innerHTML = `${icon('download', 17)}<span>Cài app</span>`;
  const banner = $('#installBanner');
  const show = pwa.offer && !store.prefs.installDismissed && !store.called.length;
  banner.hidden = !show;
  if (show) banner.innerHTML = `${icon('smartphone', 22)}<p>Cài <b>Lô Tô</b> về máy để mở nhanh như app, chơi cả khi mất mạng.</p>
    <button class="btn primary" type="button" data-act="install">Cài</button><button class="x" type="button" data-act="dismiss" aria-label="Đóng">${icon('x', 18)}</button>`;
  if (app.tab === 'more') renderMore();
}

/** Lịch sử gần nhất + trạng thái lúc gọi (để tô màu bóng): mới nhất đứng đầu */
function historyList(count) {
  const called = store.called, out = [];
  for (let k = called.length - 1; k >= 0 && out.length < count; k--) {
    const ev = diffEvents(analyze(called.slice(0, k)), analyze(called.slice(0, k + 1)));
    out.push({ n: called[k], state: ev.newKinh.length ? 'kinh' : ev.newWaits.length ? 'wait' : 'normal' });
  }
  return out;
}

/* ================= phản ứng với từng sự kiện của store ================= */
function onStore(evt) {
  switch (evt.type) {
    case 'call': return onCall(evt);
    case 'remove': return onRemove(evt);
    case 'reset': app.stage?.rebuild(true); refreshAll(); undoToast('Đã xóa ván cũ', 'Khôi phục', () => store.restore()); sfx.undo(); return;
    case 'restore': app.stage?.rebuild(true); refreshAll(); toast({ icon: 'circle-check', title: 'Đã khôi phục ván chơi', ms: 2200 }); return;
    case 'pref': return onPref(evt);
  }
}

function refreshAll(opts) {
  updateStageInfo();
  syncCall();
  updateInstallUI();
  if (app.tab !== 'call') renderActive(opts);
}

function onCall(evt) {
  const { n, newWaits, newKinh } = evt;
  const state = newKinh.length ? 'kinh' : newWaits.length ? 'wait' : 'normal';
  app.stage?.push(n, state);
  sfx.call(); speak(n);
  buzz(state === 'normal' ? 12 : 8);
  refreshAll({ justN: n });

  // chờ quả bóng rơi xuống rồi mới báo — nhìn "đã tay" hơn
  const delay = app.stage && !reducedMotion() ? 360 : 0;
  setTimeout(() => {
    if (newWaits.length) {
      waitToast(newWaits);
      app.stage?.sparkHero('wait');
      if (!newKinh.length) { sfx.wait(); buzz([25, 50, 25]); }
    }
    if (newKinh.length) {
      app.stage?.sparkHero('kinh');
      sfx.kinh(); buzz([70, 50, 70, 50, 160]);
      showKinh(newKinh, n);
    }
  }, delay);
}

function onRemove(evt) {
  if (app.stage) { if (evt.wasLast) app.stage.pop(); else app.stage.rebuild(true); }
  sfx.undo(); buzz(10);
  refreshAll();
  const n = evt.n;
  undoToast(`Đã hủy số ${n}`, evt.wasLast ? 'Hoàn lại' : null, () => store.call(n), 2800);
}

function undoToast(title, label, run, ms = 7000) {
  toast({ icon: 'rotate-ccw', title, action: label ? { label, run } : null, ms });
}

function waitToast(rowIdx) {
  const { an, prefs } = store;
  const my = prefs.myColor;
  const rows = rowIdx.map((i) => ROWS[i]);
  const groups = new Map();
  for (const r of rows) {
    const miss = an.miss[r.i], key = `${r.ci}:${miss}`;
    if (!groups.has(key)) groups.set(key, { ci: r.ci, miss, count: 0 });
    groups.get(key).count++;
  }
  const list = [...groups.values()].sort((a, b) => (b.ci === my) - (a.ci === my) || a.ci - b.ci);
  const mine = rows.some((r) => r.ci === my);
  const who = list.slice(0, 5).map((g) => `<span class="who" style="${CSTYLE[g.ci]}"><i></i>${esc(COLORS[g.ci].name)} <b>${g.miss}</b></span>`).join('') + (list.length > 5 ? `<span class="who">+${list.length - 5}</span>` : '');
  let title, sub = '';
  if (mine) title = `Màu của bạn đang đợi số ${an.miss[rows.find((r) => r.ci === my).i]}!`;
  else if (rows.length === 1) { title = `${COLORS[rows[0].ci].name} đang đợi số ${an.miss[rows[0].i]}`; sub = rowLabel(rows[0].i); }
  else title = `${rows.length} hàng vừa vào thế đợi`;
  toast({ icon: 'zap', kind: mine ? 'mine' : 'wait', title, sub, html: `<div class="t-list">${who}</div>`, ms: 5200, onTap: () => setTab('watch') });
}

function onPref({ key, value }) {
  if (key === 'sound') updateSoundBtn();
  if (key === 'quality') app.stage?.setQuality(value);
  if (key === 'wakeLock') setWakeLock(value);
  if (key === 'installDismissed') updateInstallUI();
  syncCall();
  if (app.tab !== 'call') renderActive();
}

/* ================= lần đầu: chọn màu của tôi ================= */
function askMyColor() {
  const colors = COLORS.map((c) => `<button class="pickc" type="button" data-ci="${c.ci}" style="${CSTYLE[c.ci]}"><i></i><span>${esc(c.name)}</span></button>`).join('');
  openSheet({
    html: `<h2>Bạn chơi màu nào?</h2>
      <p class="lead">Chọn màu vé của bạn để app báo riêng khi màu bạn đợi hoặc kinh. 7 màu còn lại vẫn được theo dõi đầy đủ.</p>
      <div class="pick-grid">${colors}</div>
      <div class="row-actions"><button class="btn" type="button" data-dismiss>Chỉ theo dõi, không chơi</button></div>`,
    onMount: (el, api) => el.addEventListener('click', (e) => {
      const b = e.target.closest('.pickc');
      if (b) { store.setPref('myColor', +b.dataset.ci); api.close(); }
    }),
    onClose: () => store.setPref('askedColor', true),
  });
}

/* ================= sân khấu 3D ================= */
async function initStage() {
  try {
    await Promise.race([document.fonts.load('800 48px "Baloo 2"'), new Promise((r) => setTimeout(r, 1500))]);
    const stage = new Stage3D({
      canvas: $('#gl'), heroEl: $('#heroSlot'), railEl: $('#railSlot'),
      quality: store.prefs.quality, reducedMotion: reducedMotion(),
      onDegrade: () => { store.setPref('quality', 'eco'); toast({ icon: 'battery-charging', title: 'Máy hơi yếu — đã chuyển sang chế độ tiết kiệm', sub: 'Bạn có thể đổi lại trong Thêm › Cài đặt.', ms: 5000 }); },
    });
    stage.setProvider(historyList);
    app.stage = stage;
    stage.rebuild(true);
    if (location.search.includes('debug')) window.__loto = { stage, store, app };
  } catch (err) {
    console.warn('Không bật được 3D, dùng giao diện dự phòng:', err);
    document.documentElement.classList.add('no-gl');
  }
}

/* ================= khởi động ================= */
function boot() {
  $$('.tab-ic').forEach((el) => { el.innerHTML = icon(el.dataset.ic, 22); });
  initCall(); initWatch(); initTickets(); initMore(); initCelebrate();

  $('#tabbar').addEventListener('click', (e) => { const t = e.target.closest('.tab'); if (t) setTab(t.dataset.tab); });
  $('#btnSound').addEventListener('click', () => { store.setPref('sound', !store.prefs.sound); if (store.prefs.sound) sfx.hello(); });
  $('#btnInstallTop').addEventListener('click', installApp);
  $('#installBanner').addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]'); if (!a) return;
    if (a.dataset.act === 'install') installApp(); else store.setPref('installDismissed', true);
  });

  updateStageInfo(); updateSoundBtn(); updateInstallUI(); syncCall();
  store.subscribe(onStore);

  initInstall(); onPwaChange(updateInstallUI);
  registerSW(() => toast({ icon: 'refresh-cw', title: 'Đã có bản Lô Tô mới', sub: 'Mở lại để dùng bản mới. Ván đang chơi không bị mất.', action: { label: 'Tải lại', run: () => location.reload() }, ms: 0 }));
  initWakeLock();
  if (store.prefs.wakeLock) setWakeLock(true);

  initStage().then(() => {
    if (!store.prefs.askedColor && !store.called.length) setTimeout(askMyColor, 600);
  });
}
boot();
