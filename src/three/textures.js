// Vẽ texture bằng canvas 2D: mặt bóng lô tô (equirectangular), quầng sáng, tia lửa.
import { CanvasTexture, SRGBColorSpace, LinearMipmapLinearFilter, LinearFilter } from 'three';

const TAU = Math.PI * 2;

/** Bảng màu bóng theo trạng thái lúc gọi số */
export const BALL_STYLES = {
  normal: { base: '#e5254a', ink: '#99102a', glow: '#ff8a4c' },
  wait:   { base: '#ffa826', ink: '#8a4300', glow: '#ffbf4d' },
  kinh:   { base: '#22d596', ink: '#06573a', glow: '#46f2b0' },
};

function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
export function shadeHex(hex, amt) {
  const [r, g, b] = hexToRgb(hex).map(c => Math.max(0, Math.min(255, Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt)))));
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}
export const shade = shadeHex;

/** Số có 6 hoặc 9 thì gạch chân để khỏi đọc ngược — như bóng thật */
const needsUnderline = (n) => /[69]/.test(String(n));

/**
 * Texture quả bóng: nền màu + 2 nhãn tròn (trước & sau) ghi số.
 * Nhãn "trước" nằm ở u = 0.25 (hướng +z của SphereGeometry → quay về phía camera).
 */
export function makeBallTexture({ n, base, ink, w = 768, h = 384, anisotropy = 4 }) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');

  // nền: chuyển nhẹ từ sáng (đỉnh) → tối (đáy)
  const bg = g.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, shade(base, 0.12));
  bg.addColorStop(0.5, base);
  bg.addColorStop(1, shade(base, -0.22));
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);

  // hai dải kem mảnh quanh xích đạo (nét "bóng lô tô")
  g.fillStyle = 'rgba(255,244,225,0.28)';
  for (const f of [0.17, 0.83]) g.fillRect(0, h * f - h * 0.006, w, h * 0.012);

  const r = h * 0.215;
  const label = (cx) => {
    const cy = h / 2;
    // viền kem ngoài
    g.beginPath(); g.arc(cx, cy, r * 1.1, 0, TAU);
    g.fillStyle = 'rgba(255,246,228,0.95)'; g.fill();
    // nhãn
    const lg = g.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
    lg.addColorStop(0, '#ffffff'); lg.addColorStop(1, '#fff0d6');
    g.beginPath(); g.arc(cx, cy, r, 0, TAU);
    g.fillStyle = lg; g.fill();
    // vòng mảnh in trên nhãn
    g.beginPath(); g.arc(cx, cy, r * 0.9, 0, TAU);
    g.lineWidth = r * 0.035; g.strokeStyle = ink; g.globalAlpha = 0.28; g.stroke(); g.globalAlpha = 1;
    // số (n = '' → nhãn trống, dùng cho bóng nền)
    const s = String(n);
    if (!s) return;
    const fs = s.length === 1 ? r * 1.32 : r * 1.12;
    g.font = `800 ${fs}px "Baloo 2", "Be Vietnam Pro", system-ui, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = ink;
    const ty = cy + fs * 0.06;
    g.fillText(s, cx, ty);
    if (needsUnderline(n)) {
      const tw = g.measureText(s).width;
      g.fillRect(cx - tw * 0.42, ty + fs * 0.4, tw * 0.84, Math.max(2, fs * 0.075));
    }
  };
  label(w * 0.25);
  label(w * 0.75);

  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  return tex;
}

/** Chấm tròn mềm (quầng sáng / bokeh). power càng cao → lõi càng sắc */
export function makeSoftTexture({ size = 128, power = 1, color = '255,255,255', ring = 0 } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const h = size / 2;
  const grad = g.createRadialGradient(h, h, 0, h, h, h);
  const stops = 8;
  for (let i = 0; i <= stops; i++) {
    const t = i / stops;
    const a = Math.pow(1 - t, power);
    grad.addColorStop(t, `rgba(${color},${a.toFixed(3)})`);
  }
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  if (ring) { // bokeh: viền sáng hơn một chút
    g.beginPath(); g.arc(h, h, h * 0.78, 0, TAU);
    g.lineWidth = size * 0.04; g.strokeStyle = `rgba(${color},${ring})`; g.stroke();
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}
