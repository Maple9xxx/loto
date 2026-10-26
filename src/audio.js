// Âm thanh tổng hợp bằng WebAudio (không cần file mp3), rung, và đọc số thành tiếng.
import { store } from './store.js';

let ctx = null;
function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone({ freq = 440, type = 'sine', dur = 0.12, gain = 0.3, delay = 0 }) {
  const c = getCtx(); if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.linearRampToValueAtTime(gain, t0 + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(env).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function glide({ from, to, type = 'triangle', dur = 0.2, gain = 0.25, delay = 0 }) {
  const c = getCtx(); if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  env.gain.setValueAtTime(gain, t0);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(env).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function click({ dur = 0.035, gain = 0.16, delay = 0 }) {
  const c = getCtx(); if (!c) return;
  const t0 = c.currentTime + delay;
  const buf = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = c.createBufferSource();
  const f = c.createBiquadFilter();
  const env = c.createGain();
  f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 0.9;
  env.gain.setValueAtTime(gain, t0);
  src.buffer = buf;
  src.connect(f).connect(env).connect(c.destination);
  src.start(t0);
}

const on = () => store.prefs.sound;

export const sfx = {
  /** số thường: tiếng "cạch" của bóng rơi */
  call() { if (!on()) return; click({}); tone({ freq: 880, type: 'triangle', dur: 0.08, gain: 0.16 }); },
  /** có hàng vào thế đợi */
  wait() { if (!on()) return; [330, 415, 494].forEach((f, i) => tone({ freq: f, dur: 0.2, gain: 0.26, delay: i * 0.1 })); },
  /** kinh! */
  kinh() {
    if (!on()) return;
    [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.24, gain: 0.3, delay: i * 0.1 }));
    tone({ freq: 1047, dur: 0.6, gain: 0.2, delay: 0.42 });
    [1319, 1568].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.5, gain: 0.12, delay: 0.55 + i * 0.12 }));
  },
  undo() { if (!on()) return; glide({ from: 440, to: 180 }); },
  tick() { if (!on()) return; tone({ freq: 660, dur: 0.05, gain: 0.1 }); },
  error() { if (!on()) return; tone({ freq: 220, type: 'square', dur: 0.08, gain: 0.1 }); tone({ freq: 180, type: 'square', dur: 0.1, gain: 0.1, delay: 0.09 }); },
  hello() { if (!on()) return; tone({ freq: 523, dur: 0.14, gain: 0.2 }); tone({ freq: 784, dur: 0.2, gain: 0.2, delay: 0.12 }); },
};

/** Rung nhẹ (Android). iOS không hỗ trợ — bỏ qua im lặng. */
export function buzz(pattern) {
  if (!store.prefs.haptics) return;
  try { navigator.vibrate?.(pattern); } catch { /* noop */ }
}

/** Đọc số bằng giọng tiếng Việt của máy (nếu bật trong cài đặt). */
export function speak(n) {
  if (!store.prefs.speak || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(n));
    u.lang = 'vi-VN';
    u.rate = 1.05;
    speechSynthesis.speak(u);
  } catch { /* noop */ }
}
