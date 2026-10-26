// Trạng thái ứng dụng + lưu trữ cục bộ. Mọi thứ khác (UI, 3D, âm thanh) chỉ lắng nghe store.
import { analyze, diffEvents, TOTAL_NUMBERS } from './engine.js';

const KEY_GAME = 'loto2:game';
const KEY_PREFS = 'loto2:prefs';
const KEY_V1 = 'loto_save_v1';   // bản cũ — tự động chuyển sang
const KEY_V1_MUTE = 'loto_mute';

const DEFAULT_PREFS = {
  sound: true,        // âm thanh
  haptics: true,      // rung
  wakeLock: true,     // giữ màn hình sáng
  speak: false,       // đọc số thành tiếng
  showHot: true,      // hiện số đang được đợi trên bảng chọn
  quality: 'high',    // 'high' | 'eco' — hiệu ứng 3D
  compact: true,      // vé: xem gọn (2 tờ cạnh nhau)
  myColor: null,      // chỉ số màu của tôi (null = chỉ theo dõi)
  askedColor: false,  // đã hỏi chọn màu lần đầu chưa
  installDismissed: false,
};

const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* bộ nhớ đầy / chế độ riêng tư */ } };

class Store {
  constructor() {
    this.listeners = new Set();
    this.prefs = { ...DEFAULT_PREFS };
    this.called = [];
    this.an = analyze(this.called);
    this.backup = null; // ván trước khi bấm "Ván mới" (để khôi phục)
    this._load();
  }

  _load() {
    const prefs = read(KEY_PREFS);
    if (prefs) Object.assign(this.prefs, prefs);
    const game = read(KEY_GAME);
    if (game && Array.isArray(game.called)) {
      this.called = game.called.filter(n => Number.isInteger(n) && n >= 1 && n <= TOTAL_NUMBERS);
    } else {
      // chuyển dữ liệu từ bản cũ (nếu có)
      const v1 = read(KEY_V1);
      if (v1 && Array.isArray(v1.called) && v1.called.length) {
        this.called = [...new Set(v1.called.filter(n => n >= 1 && n <= TOTAL_NUMBERS))];
        try { if (localStorage.getItem(KEY_V1_MUTE) === '1' && !prefs) this.prefs.sound = false; } catch { /* noop */ }
        write(KEY_GAME, { called: this.called });
      }
    }
    this.an = analyze(this.called);
  }

  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(evt) { for (const fn of this.listeners) fn(evt, this); }

  get last() { return this.called.length ? this.called[this.called.length - 1] : null; }
  has(n) { return this.an.set[n] === 1; }

  /** Gọi một số. Trả về sự kiện hoặc null nếu không hợp lệ. */
  call(n) {
    if (!Number.isInteger(n) || n < 1 || n > TOTAL_NUMBERS) return { error: 'range' };
    if (this.has(n)) return { error: 'dup' };
    const prev = this.an;
    this.called.push(n);
    this.an = analyze(this.called);
    const { newWaits, newKinh } = diffEvents(prev, this.an);
    this._save();
    const evt = { type: 'call', n, newWaits, newKinh };
    this.emit(evt);
    return evt;
  }

  /** Hủy một số bất kỳ (không nhất thiết là số cuối). */
  remove(n) {
    const idx = this.called.indexOf(n);
    if (idx === -1) return null;
    const wasLast = idx === this.called.length - 1;
    this.called.splice(idx, 1);
    this.an = analyze(this.called);
    this._save();
    const evt = { type: 'remove', n, wasLast };
    this.emit(evt);
    return evt;
  }

  undo() { return this.last == null ? null : this.remove(this.last); }

  /** Ván mới — giữ lại bản sao để khôi phục. */
  reset() {
    if (!this.called.length) return;
    this.backup = [...this.called];
    this.called = [];
    this.an = analyze(this.called);
    this._save();
    this.emit({ type: 'reset' });
  }

  restore() {
    if (!this.backup) return false;
    this.called = this.backup;
    this.backup = null;
    this.an = analyze(this.called);
    this._save();
    this.emit({ type: 'restore' });
    return true;
  }

  setPref(key, value) {
    if (this.prefs[key] === value) return;
    this.prefs[key] = value;
    write(KEY_PREFS, this.prefs);
    this.emit({ type: 'pref', key, value });
  }

  _save() { write(KEY_GAME, { called: this.called }); }
}

export const store = new Store();
