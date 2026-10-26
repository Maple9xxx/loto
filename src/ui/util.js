import { COLORS } from '../engine.js';
import { shadeHex } from '../three/textures.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function rgba(hex, a) {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
}

/** Biến CSS cho từng màu vé: dùng được ở mọi nơi qua style="${CSTYLE[ci]}" */
export const CSTYLE = COLORS.map((c) =>
  `--c:${c.hex};--on:${c.ink};--c-hi:${shadeHex(c.hex, 0.55)};--c-lo:${shadeHex(c.hex, -0.38)};--c-12:${rgba(c.hex, 0.12)};--c-25:${rgba(c.hex, 0.25)};--c-45:${rgba(c.hex, 0.45)}`);

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
