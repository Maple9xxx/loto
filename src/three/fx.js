// Hiệu ứng hạt: pháo hoa, tia lửa, confetti. Toạ độ thế giới: 1 đơn vị = 1px CSS, gốc ở tâm màn hình, y hướng lên.
import {
  BufferGeometry, BufferAttribute, Points, ShaderMaterial, AdditiveBlending, InstancedMesh,
  PlaneGeometry, MeshBasicMaterial, DoubleSide, Object3D, Color, Euler, Quaternion, Vector3, Matrix4,
} from 'three';
import { makeSoftTexture } from './textures.js';

const MAX = 2400;
const rand = (a, b) => a + Math.random() * (b - a);
const hexRGB = (hex) => { const v = parseInt(hex.slice(1), 16); return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]; };

const VERT = /* glsl */`
  attribute float aSize;
  attribute vec4 aColor;
  uniform float uPx;
  varying vec4 vColor;
  void main() {
    vColor = aColor;
    gl_PointSize = aSize * uPx;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const FRAG = /* glsl */`
  uniform sampler2D uMap;
  varying vec4 vColor;
  void main() {
    float a = texture2D(uMap, gl_PointCoord).a * vColor.a;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vColor.rgb, a);
  }
`;

export class FX {
  constructor(scene, pixelRatio = 1) {
    this.scene = scene;
    this.W = 360; this.H = 640;

    // ---- hạt ----
    this.n = 0;
    this.pos = new Float32Array(MAX * 3);
    this.col = new Float32Array(MAX * 4);
    this.siz = new Float32Array(MAX);
    this.vel = new Float32Array(MAX * 3);
    this.age = new Float32Array(MAX);
    this.ttl = new Float32Array(MAX);
    this.s0 = new Float32Array(MAX);
    this.grav = new Float32Array(MAX);
    this.drag = new Float32Array(MAX);
    this.twk = new Float32Array(MAX);      // pha nhấp nháy (0 = không nhấp nháy)
    this.rgb = new Float32Array(MAX * 3);

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(this.pos, 3).setUsage(35048));
    geo.setAttribute('aColor', new BufferAttribute(this.col, 4).setUsage(35048));
    geo.setAttribute('aSize', new BufferAttribute(this.siz, 1).setUsage(35048));
    geo.setDrawRange(0, 0);
    this.geo = geo;
    this.softTex = makeSoftTexture({ size: 64, power: 1.6 });
    this.mat = new ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: { uMap: { value: this.softTex }, uPx: { value: pixelRatio } },
      transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending,
    });
    this.points = new Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    scene.add(this.points);

    // ---- pháo đang bay lên ----
    this.rockets = [];
    this.queue = []; // lịch bắn pháo

    // ---- confetti ----
    this.C = 200;
    this.cMesh = new InstancedMesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ side: DoubleSide, toneMapped: false }), this.C);
    this.cMesh.frustumCulled = false;
    this.cMesh.visible = false;
    this.cMesh.renderOrder = 9;
    this.cMesh.instanceMatrix.setUsage(35048);
    scene.add(this.cMesh);
    this.cd = Array.from({ length: this.C }, () => ({}));
    this.cTime = 0; this.cLive = false;
    this._m = new Matrix4(); this._q = new Quaternion(); this._e = new Euler(); this._v = new Vector3(); this._s = new Vector3();
    this._dummyColor = new Color();
    for (let i = 0; i < this.C; i++) this.cMesh.setColorAt(i, this._dummyColor.set('#fff'));
    this.clock = 0;
  }

  setPixelRatio(pr) { this.mat.uniforms.uPx.value = pr; }
  resize(W, H) { this.W = W; this.H = H; }
  get active() { return this.n > 0 || this.rockets.length > 0 || this.queue.length > 0 || this.cLive; }

  clear() {
    this.n = 0; this.rockets.length = 0; this.queue.length = 0; this.cLive = false; this.cMesh.visible = false;
    this.geo.setDrawRange(0, 0);
  }

  /** Thêm 1 hạt. Trả về false nếu hết chỗ. */
  _emit(x, y, vx, vy, rgb, size, ttl, { gravity = 0, drag = 0, twinkle = 0 } = {}) {
    if (this.n >= MAX) return false;
    const i = this.n++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = 0;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy;
    this.rgb[i * 3] = rgb[0]; this.rgb[i * 3 + 1] = rgb[1]; this.rgb[i * 3 + 2] = rgb[2];
    this.s0[i] = size; this.siz[i] = size;
    this.age[i] = 0; this.ttl[i] = ttl;
    this.grav[i] = gravity; this.drag[i] = drag; this.twk[i] = twinkle ? rand(0, 6.28) : 0;
    return true;
  }

  /** Nổ pháo hoa tròn */
  burst(x, y, colors, { n = 90, speed = 360, ttl = 1.7, size = 15, glitter = 26 } = {}) {
    const rgbs = colors.map(hexRGB);
    this._emit(x, y, 0, 0, [1, 0.95, 0.8], size * 8, 0.28);                       // chớp sáng giữa tâm
    for (let k = 0; k < n; k++) {
      const a = rand(0, 6.2832);
      const sp = speed * (0.35 + 0.65 * Math.sqrt(Math.random()));
      this._emit(x, y, Math.cos(a) * sp, Math.sin(a) * sp, rgbs[k % rgbs.length], rand(size * 0.6, size), ttl * rand(0.75, 1.15), { gravity: 240, drag: 1.7 });
    }
    for (let k = 0; k < glitter; k++) {                                           // lấp lánh rơi chậm
      const a = rand(0, 6.2832), sp = rand(30, 190);
      this._emit(x, y, Math.cos(a) * sp, Math.sin(a) * sp, [1, 0.93, 0.7], rand(5, 9), rand(1.6, 2.6), { gravity: 70, drag: 1.2, twinkle: 1 });
    }
  }

  /** Vài tia lửa nhỏ (khi bóng chạm đáy, khi vào thế đợi…) */
  sparkle(x, y, color, n = 14, speed = 150, size = 9) {
    const rgb = hexRGB(color);
    for (let k = 0; k < n; k++) {
      const a = rand(0, 6.2832), sp = speed * rand(0.4, 1);
      this._emit(x, y, Math.cos(a) * sp, Math.sin(a) * sp + 40, rgb, rand(size * 0.5, size), rand(0.45, 0.9), { gravity: 200, drag: 2.4 });
    }
  }

  /** Cả màn hình ăn mừng: pháo hoa liên tiếp + mưa confetti */
  celebrate(colors, { reduced = false } = {}) {
    const W = this.W, H = this.H;
    const palette = [...colors, '#ffd45c', '#ffffff'];
    const shots = reduced ? 2 : 7;
    for (let k = 0; k < shots; k++) {
      this.queue.push({
        t: 0.05 + k * 0.42 + rand(0, 0.18),
        x: rand(-W * 0.38, W * 0.38),
        y: rand(H * 0.04, H * 0.36),
        colors: [palette[(k * 2) % palette.length], palette[(k * 2 + 3) % palette.length]],
      });
    }
    if (reduced) return;
    // confetti
    const cp = [...colors, '#ffd45c', '#ff5fb0', '#2d9cff', '#ffffff'];
    this.cTime = 0; this.cLive = true; this.cMesh.visible = true;
    for (let i = 0; i < this.C; i++) {
      const d = this.cd[i];
      d.x = rand(-W * 0.55, W * 0.55); d.y = H / 2 + rand(10, 520); d.z = rand(-40, 120);
      d.vy = -rand(130, 290); d.sway = rand(18, 60); d.f = rand(1.5, 4); d.ph = rand(0, 6.28);
      d.rx = rand(0, 6.28); d.ry = rand(0, 6.28); d.rz = rand(0, 6.28);
      d.wx = rand(-7, 7); d.wy = rand(-7, 7); d.wz = rand(-3, 3);
      d.w = rand(8, 15); d.h = rand(5, 9); d.delay = rand(0, 1.3); d.life = rand(3.6, 5.2);
      this.cMesh.setColorAt(i, this._dummyColor.set(cp[i % cp.length]));
    }
    this.cMesh.instanceColor.needsUpdate = true;
  }

  update(dt) {
    this.clock += dt;

    // lịch bắn pháo
    for (let k = this.queue.length - 1; k >= 0; k--) {
      const q = this.queue[k];
      q.t -= dt;
      if (q.t <= 0) {
        const tt = rand(0.55, 0.8);
        this.rockets.push({ x: q.x + rand(-30, 30), y: -this.H / 2 - 10, vx: rand(-20, 20), ty: q.y, tt, age: 0, colors: q.colors, y0: -this.H / 2 - 10 });
        this.queue.splice(k, 1);
      }
    }
    // pháo bay lên (+ vệt)
    for (let k = this.rockets.length - 1; k >= 0; k--) {
      const r = this.rockets[k];
      r.age += dt;
      const t = Math.min(1, r.age / r.tt);
      const e = 1 - (1 - t) * (1 - t);              // easeOutQuad
      r.x += r.vx * dt;
      r.y = r.y0 + (r.ty - r.y0) * e;
      for (let j = 0; j < 3; j++) this._emit(r.x + rand(-2, 2), r.y - j * 6, rand(-14, 14), rand(-40, -10), [1, 0.82, 0.5], rand(4, 8), rand(0.25, 0.5), { gravity: 60, drag: 2 });
      if (t >= 1) { this.burst(r.x, r.y, r.colors); this.rockets.splice(k, 1); }
    }

    // vật lý hạt
    let n = this.n;
    for (let i = 0; i < n; i++) {
      const a = (this.age[i] += dt);
      const ttl = this.ttl[i];
      if (a >= ttl) {                       // chết → đổi chỗ với hạt cuối
        n--;
        if (i !== n) this._copy(n, i);
        i--; continue;
      }
      const i3 = i * 3;
      const dr = Math.exp(-this.drag[i] * dt);
      this.vel[i3] *= dr; this.vel[i3 + 1] = this.vel[i3 + 1] * dr - this.grav[i] * dt;
      this.pos[i3] += this.vel[i3] * dt; this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      const life = 1 - a / ttl;
      let alpha = Math.min(1, life * 2.2);
      if (this.twk[i]) alpha *= 0.55 + 0.45 * Math.sin(a * 26 + this.twk[i]);
      const i4 = i * 4;
      this.col[i4] = this.rgb[i3]; this.col[i4 + 1] = this.rgb[i3 + 1]; this.col[i4 + 2] = this.rgb[i3 + 2]; this.col[i4 + 3] = alpha;
      this.siz[i] = this.s0[i] * (0.35 + 0.65 * life);
    }
    this.n = n;
    this.geo.setDrawRange(0, n);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;

    // confetti
    if (this.cLive) {
      this.cTime += dt;
      let alive = 0;
      for (let i = 0; i < this.C; i++) {
        const d = this.cd[i];
        const t = this.cTime - d.delay;
        if (t < 0 || t > d.life) { this._s.set(0, 0, 0); this._m.compose(this._v.set(0, 0, 0), this._q.identity(), this._s); this.cMesh.setMatrixAt(i, this._m); if (t < 0) alive++; continue; }
        alive++;
        const x = d.x + Math.sin(t * d.f + d.ph) * d.sway;
        const y = d.y + d.vy * t;
        const fade = Math.min(1, (d.life - t) / 0.6);
        this._e.set(d.rx + d.wx * t, d.ry + d.wy * t, d.rz + d.wz * t);
        this._q.setFromEuler(this._e);
        this._s.set(d.w * fade, d.h * fade, 1);
        this._m.compose(this._v.set(x, y, d.z), this._q, this._s);
        this.cMesh.setMatrixAt(i, this._m);
      }
      this.cMesh.instanceMatrix.needsUpdate = true;
      if (!alive) { this.cLive = false; this.cMesh.visible = false; }
    }
  }

  _copy(from, to) {
    const f3 = from * 3, t3 = to * 3, f4 = from * 4, t4 = to * 4;
    for (let k = 0; k < 3; k++) { this.pos[t3 + k] = this.pos[f3 + k]; this.vel[t3 + k] = this.vel[f3 + k]; this.rgb[t3 + k] = this.rgb[f3 + k]; }
    for (let k = 0; k < 4; k++) this.col[t4 + k] = this.col[f4 + k];
    this.siz[to] = this.siz[from]; this.age[to] = this.age[from]; this.ttl[to] = this.ttl[from];
    this.s0[to] = this.s0[from]; this.grav[to] = this.grav[from]; this.drag[to] = this.drag[from]; this.twk[to] = this.twk[from];
  }
}
