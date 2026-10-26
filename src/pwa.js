// Cài ứng dụng về máy (PWA), service worker (chạy offline), giữ màn hình sáng.
import { store } from './store.js';
import { openSheet } from './ui/sheet.js';
import { icon } from './icons.js';

const ua = navigator.userAgent;
export const pwa = {
  deferred: null,
  ios: /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
  file: location.protocol === 'file:',
  get standalone() { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; },
  get canPrompt() { return !!this.deferred; },
  /** Có nên hiện nút "Cài app" nổi bật (trên cùng / banner) không */
  get offer() { return !this.standalone && !this.file && (this.canPrompt || this.ios); },
};

const listeners = new Set();
export const onPwaChange = (fn) => listeners.add(fn);
const notify = () => listeners.forEach((fn) => fn());

export function initInstall() {
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); pwa.deferred = e; notify(); });
  addEventListener('appinstalled', () => { pwa.deferred = null; notify(); });
  matchMedia('(display-mode: standalone)').addEventListener?.('change', notify);
}

export async function installApp() {
  if (pwa.deferred) {
    const d = pwa.deferred;
    d.prompt();
    try { await d.userChoice; } catch { /* noop */ }
    pwa.deferred = null; notify();
    return;
  }
  showInstallHelp();
}

export function showInstallHelp() {
  let steps;
  if (pwa.ios) {
    steps = [
      `Mở trang này bằng <b>Safari</b>, chạm nút <b>Chia sẻ</b> ${icon('share', 20)} ở thanh dưới.`,
      `Kéo xuống, chọn <b>Thêm vào MH chính</b> ${icon('square-plus', 20)} (Add to Home Screen).`,
      `Chạm <b>Thêm</b> — biểu tượng Lô Tô sẽ xuất hiện ngoài màn hình chính.`,
    ];
  } else if (/android/i.test(ua)) {
    steps = [
      `Chạm nút <b>⋮</b> (menu) ở góc trên của trình duyệt.`,
      `Chọn <b>Cài đặt ứng dụng</b> hoặc <b>Thêm vào màn hình chính</b>.`,
      `Chạm <b>Cài đặt</b> — mở từ màn hình chính như app thường, chơi được cả khi mất mạng.`,
    ];
  } else {
    steps = [
      `Nhìn lên thanh địa chỉ, chạm biểu tượng <b>cài đặt</b> ${icon('download', 18)} (hoặc menu <b>⋮</b> → <b>Cài đặt Lô Tô</b>).`,
      `Xác nhận <b>Cài đặt</b> — app mở trong cửa sổ riêng, chơi được cả khi mất mạng.`,
    ];
  }
  const note = pwa.file
    ? `<p class="lead" style="margin-top:10px">Bạn đang mở file trực tiếp từ máy. Cần đưa lên một địa chỉ <b>https</b> (ví dụ GitHub Pages) thì mới cài được.</p>`
    : '';
  openSheet({
    html: `<h2>Cài Lô Tô về máy</h2><p class="lead">Mở nhanh như app, toàn màn hình, chơi được cả khi mất mạng.</p>
      <ol class="steps">${steps.map((s) => `<li><span>${s}</span></li>`).join('')}</ol>${note}
      <div class="row-actions"><button class="btn primary" type="button" data-dismiss>Đã hiểu</button></div>`,
  });
}

/* ---------- Service worker ---------- */
export function registerSW(onUpdate) {
  if (!('serviceWorker' in navigator) || pwa.file) return;
  const hadController = !!navigator.serviceWorker.controller;
  addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw?.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) onUpdate?.();
        });
      });
    }).catch(() => { /* chạy được không cần SW */ });
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) onUpdate?.(); });
}

/* ---------- Giữ màn hình sáng ---------- */
let lock = null;
export async function setWakeLock(on) {
  try {
    if (!on) { await lock?.release(); lock = null; return; }
    if (lock || !('wakeLock' in navigator) || document.hidden) return;
    lock = await navigator.wakeLock.request('screen');
    lock.addEventListener('release', () => { lock = null; });
  } catch { lock = null; }
}
export function initWakeLock() {
  const again = () => { if (store.prefs.wakeLock && !lock) setWakeLock(true); };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) again(); });
  addEventListener('pointerdown', again, { passive: true });
}
