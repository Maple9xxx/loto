// Sân khấu 3D (three.js): bóng lô tô rơi xuống, dải bóng vừa gọi, nền hội chợ đêm, pháo hoa khi Kinh.
// Một canvas toàn màn hình nằm SAU giao diện; quả bóng chính bám theo vị trí của phần tử DOM "hero".
// Hệ toạ độ thế giới: 1 đơn vị = 1px CSS tại mặt phẳng z = 0, gốc ở tâm màn hình, y hướng lên.
import {
  WebGLRenderer, Scene, PerspectiveCamera, SphereGeometry, MeshPhysicalMaterial, MeshStandardMaterial, Mesh, Group,
  PMREMGenerator, Sprite, SpriteMaterial, Points, PointsMaterial, BufferGeometry, BufferAttribute, AdditiveBlending,
  NeutralToneMapping, SRGBColorSpace, Fog, DirectionalLight, Quaternion, Vector3, Color,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeBallTexture, makeSoftTexture, BALL_STYLES, shadeHex } from './textures.js';
import { FX } from './fx.js';
import { COLORS } from '../engine.js';

const FOV = 28;
const MAX_BALLS = 8;           // 1 bóng chính + tối đa 7 bóng trên dải
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const IDLE_STYLE = { base: '#3b2b86', ink: '#2a1b63', glow: '#8a6bff' };

/** ---------- Một quả bóng ---------- */
class Ball {
  constructor(geo) {
    this.mat = new MeshPhysicalMaterial({ roughness: 0.24, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.15 });
    this.mesh = new Mesh(geo, this.mat);
    this.mesh.visible = false;
    this.n = 0; this.state = 'normal'; this.idle = false;
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0;
    this.r = 0; this.rv = 0;
    this.tx = 0; this.ty = 0; this.tr = 0;
    this.q = new Quaternion(); this.tq = new Quaternion(); this.av = new Vector3();
    this.align = 0;              // tốc độ xoay về mặt trước (0 = để quay tự do)
    this.mode = 'spring';        // 'drop' | 'spring' | 'fly'
    this.squash = 0;
    this.tint = 1; this.tintT = 1;
    this.seed = Math.random() * 100;
    this.bounces = 0;
  }
  setFace(n, state) {
    this.n = n; this.state = state;
    this.idle = n === '?';
    const st = this.idle ? IDLE_STYLE : BALL_STYLES[state] || BALL_STYLES.normal;
    const old = this.mat.map;
    this.mat.map = makeBallTexture({ n, base: st.base, ink: st.ink });
    this.mat.needsUpdate = old == null;
    old?.dispose();
  }
  dispose() { this.mat.map?.dispose(); this.mat.dispose(); }
}

const _q = new Quaternion(); const _v = new Vector3();

export class Stage3D {
  constructor({ canvas, heroEl, railEl, quality = 'high', reducedMotion = false, onDegrade = null }) {
    this.canvas = canvas; this.heroEl = heroEl; this.railEl = railEl;
    this.quality = quality; this.reduced = reducedMotion; this.onDegrade = onDegrade;
    this.W = innerWidth; this.H = innerHeight;
    this.items = [];             // bóng đang hiển thị, mới nhất ở đầu
    this.flying = [];            // bóng đang bay đi (hủy số)
    this.layout = { hero: { x: 0, y: 0, r: 40 }, rail: [], ok: false };
    this.trackUntil = 0; this.layoutDirty = true;
    this.glow = { color: new Color('#ff8a4c'), level: 0, cur: 0, flash: 0 };
    this.pointer = { x: 0, y: 0, px: 0, py: 0 };
    this.drag = null;
    this.provider = () => [];
    this.raf = 0; this.last = 0; this.lastRender = 0; this.t = 0; this.dirty = true;
    this.lost = false;
    this.frames = 0; this.accum = 0; this.degradeLevel = 0;
    this.autoDegrade = !navigator.webdriver;

    this.renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.pr = this._targetPixelRatio();

    this.scene = new Scene();
    this.camera = new PerspectiveCamera(FOV, this.W / this.H, 10, 6000);

    // ánh sáng + môi trường phản chiếu cho lớp bóng bóng loáng
    const pmrem = new PMREMGenerator(this.renderer);
    const env = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(env, 0.04).texture;
    env.dispose?.(); pmrem.dispose();
    const key = new DirectionalLight('#fff1dd', 1.9); key.position.set(-0.55, 0.85, 1); this.scene.add(key);
    const rim = new DirectionalLight('#8fb4ff', 1.0); rim.position.set(0.8, -0.35, -0.6); this.scene.add(rim);

    this.ballGeo = new SphereGeometry(1, 64, 40);

    // quầng sáng sau bóng chính
    this.haloTex = makeSoftTexture({ size: 256, power: 1.7 });
    this.halo = new Sprite(new SpriteMaterial({ map: this.haloTex, color: '#ff8a4c', transparent: true, opacity: 0, depthWrite: false, depthTest: true, blending: AdditiveBlending, toneMapped: false, fog: false }));
    this.scene.add(this.halo);

    this.fx = new FX(this.scene, this.pr);
    this._buildAmbient();
    this.resize();

    // sự kiện
    this._onResize = () => { this.resize(); };
    addEventListener('resize', this._onResize);
    addEventListener('orientationchange', this._onResize);
    this._ro = new ResizeObserver(() => { this.layoutDirty = true; this.kick(); });
    this._ro.observe(heroEl); this._ro.observe(railEl);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { this.last = performance.now(); this.kick(); } });
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; document.documentElement.classList.add('no-gl'); });
    addEventListener('pointermove', (e) => {
      this.pointer.px = (e.clientX / this.W - 0.5) * 2; this.pointer.py = (e.clientY / this.H - 0.5) * 2;
      if (this.quality === 'high') this.kick();
    }, { passive: true });
    this._bindDrag();
  }

  /* ================= nền hội chợ đêm ================= */
  _buildAmbient() {
    this.ambient = new Group();
    this.scene.add(this.ambient);

    // bokeh: các đốm đèn lồng mờ trôi chậm
    const N = 56;
    this.bk = { N, nx: new Float32Array(N), ny: new Float32Array(N), z: new Float32Array(N), sp: new Float32Array(N), ph: new Float32Array(N) };
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const palette = ['#ffb347', '#ff6a88', '#ffd45c', '#7aa8ff', '#c18bff', '#ff8a4c', '#ffe9b0'];
    for (let i = 0; i < N; i++) {
      this.bk.nx[i] = rand(-1.1, 1.1); this.bk.ny[i] = rand(-1.1, 1.1); this.bk.z[i] = -rand(180, 1100);
      this.bk.sp[i] = rand(0.004, 0.016); this.bk.ph[i] = rand(0, 6.28);
      const c = new Color(palette[i % palette.length]);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3).setUsage(35048));
    geo.setAttribute('color', new BufferAttribute(col, 3));
    this.bokehTex = makeSoftTexture({ size: 128, power: 0.9, ring: 0.5 });
    this.bokeh = new Points(geo, new PointsMaterial({
      size: 380, map: this.bokehTex, vertexColors: true, transparent: true, opacity: 0.34, depthWrite: false, blending: AdditiveBlending, sizeAttenuation: true, toneMapped: false, fog: false,
    }));
    this.bokeh.frustumCulled = false;
    this.ambient.add(this.bokeh);

    // 8 quả bóng lớn, mỗi quả một màu vé, trôi ở xa
    this.far = [];
    const spots = [[-0.97, 0.38], [0.98, 0.5], [-0.93, -0.22], [0.97, -0.12], [0.9, -0.72], [-0.88, -0.78], [0.35, 0.99], [-0.45, -1.0]];
    COLORS.forEach((c, i) => {
      const mat = new MeshStandardMaterial({ roughness: 0.42, metalness: 0, envMapIntensity: 0.4, color: new Color().setScalar(0.36) });
      mat.map = makeBallTexture({ n: '', base: c.hex, ink: shadeHex(c.hex, -0.55), w: 384, h: 192 });
      const m = new Mesh(this.ballGeo, mat);
      m.userData = { nx: spots[i][0], ny: spots[i][1], z: -rand(500, 1300), r: rand(0.55, 1) , ph: rand(0, 6.28), spin: rand(0.05, 0.16) * (Math.random() < 0.5 ? -1 : 1) };
      this.ambient.add(m);
      this.far.push(m);
    });
  }

  _layoutAmbient() {
    const { W, H } = this;
    const base = Math.min(W, H);
    for (const m of this.far) {
      const u = m.userData;
      const dist = this.camZ - u.z;
      const scale = dist / this.camZ;                   // bù perspective để kích thước trên màn hình ổn định
      m.userData.baseR = (base * 0.1 + 14) * u.r * scale;
      m.userData.bx = u.nx * (W / 2) * scale * 0.98;
      m.userData.by = u.ny * (H / 2) * scale * 0.98;
    }
  }

  _updateAmbient(dt) {
    const t = this.t;
    const { W, H } = this;
    // bokeh trôi lên
    const p = this.bokeh.geometry.attributes.position;
    const bk = this.bk;
    for (let i = 0; i < bk.N; i++) {
      bk.ny[i] += bk.sp[i] * dt;
      if (bk.ny[i] > 1.15) bk.ny[i] = -1.15;
      const dist = this.camZ - bk.z[i], sc = dist / this.camZ;
      p.array[i * 3] = (bk.nx[i] * (W / 2) + Math.sin(t * 0.3 + bk.ph[i]) * 22) * sc;
      p.array[i * 3 + 1] = bk.ny[i] * (H / 2) * sc;
      p.array[i * 3 + 2] = bk.z[i];
    }
    p.needsUpdate = true;
    // bóng lớn: nhấp nhô + xoay chậm
    for (const m of this.far) {
      const u = m.userData;
      m.position.set(u.bx + Math.sin(t * 0.22 + u.ph) * 14, u.by + Math.cos(t * 0.27 + u.ph) * 18, u.z);
      m.scale.setScalar(u.baseR);
      m.rotation.y += u.spin * dt;
      m.rotation.x = Math.sin(t * 0.2 + u.ph) * 0.25;
    }
    // thị sai theo con trỏ
    const pt = this.pointer;
    pt.x += (pt.px - pt.x) * Math.min(1, dt * 2.2); pt.y += (pt.py - pt.y) * Math.min(1, dt * 2.2);
    this.ambient.position.set(-pt.x * 16, pt.y * 12, 0);
  }

  /* ================= kích thước / bố cục ================= */
  _targetPixelRatio() {
    const dpr = window.devicePixelRatio || 1;
    const cap = this.quality === 'high' ? 2 : 1.25;
    return clamp(Math.min(dpr, cap) - this.degradeLevel * 0.5, 1, cap);
  }

  resize() {
    this.W = innerWidth; this.H = innerHeight;
    this.pr = this._targetPixelRatio();
    this.renderer.setPixelRatio(this.pr);
    this.renderer.setSize(this.W, this.H, false);
    this.canvas.style.width = this.W + 'px'; this.canvas.style.height = this.H + 'px';
    this.camera.aspect = this.W / this.H;
    this.camZ = (this.H / 2) / Math.tan((FOV / 2) * Math.PI / 180);
    this.camera.position.set(0, 0, this.camZ);
    this.camera.far = this.camZ + 4000;
    this.camera.updateProjectionMatrix();
    this.scene.fog = new Fog(0x120a2a, this.camZ * 1.15, this.camZ * 2.7);
    this.fx.resize(this.W, this.H);
    this.fx.setPixelRatio(this.pr);
    this._layoutAmbient();
    this.layoutDirty = true;
    this.dirty = true;
    this.kick();
  }

  /** Báo cho sân khấu biết bố cục DOM sắp thay đổi (chuyển tab…) → theo dõi từng khung hình một lúc. */
  trackLayout(ms = 700) { this.trackUntil = performance.now() + ms; this.kick(); }

  _readLayout() {
    const hr = this.heroEl.getBoundingClientRect();
    const rr = this.railEl.getBoundingClientRect();
    const L = this.layout;
    L.ok = hr.width > 4;
    L.hero.x = hr.left + hr.width / 2 - this.W / 2;
    L.hero.y = this.H / 2 - (hr.top + hr.height / 2);
    L.hero.r = Math.min(hr.width, hr.height) / 2 * 0.98;
    L.rail.length = 0;
    const d = rr.height;
    const slotW = d * 1.16;
    const count = rr.width > 4 ? clamp(Math.floor(rr.width / slotW), 0, MAX_BALLS - 1) : 0;
    for (let k = 0; k < count; k++) {
      L.rail.push({
        x: rr.left + slotW * (k + 0.5) - this.W / 2,
        y: this.H / 2 - (rr.top + rr.height / 2),
        r: (d / 2) * (1 - 0.04 * k) * 0.97,
      });
    }
    this.layoutDirty = false;
    this._retarget();
  }

  _retarget() {
    const L = this.layout;
    this.items.forEach((b, k) => {
      if (k === 0) { b.tx = L.hero.x; b.ty = L.hero.y; b.tr = L.ok ? L.hero.r : 0; b.tintT = 1; }
      else if (L.rail[k - 1]) { const s = L.rail[k - 1]; b.tx = s.x; b.ty = s.y; b.tr = s.r; b.tintT = Math.max(0.5, 1 - 0.08 * (k - 1)); }
      else {
        const e = L.rail[L.rail.length - 1] || L.hero;
        b.tx = e.x + (L.rail.length ? 30 : 0); b.ty = e.y; b.tr = 0; b.tintT = 0.4;
      }
    });
  }

  /* ================= API cho giao diện ================= */
  /** Hàm trả về lịch sử gần nhất: [{n, state}] (mới nhất đầu tiên) */
  setProvider(fn) { this.provider = fn; }

  _newBall(n, state) {
    const b = new Ball(this.ballGeo);
    b.setFace(n, state);
    this.scene.add(b.mesh);
    return b;
  }

  _spawnAt(b, mode) {
    const L = this.layout;
    b.r = 0.01; b.rv = 0;
    b.x = L.hero.x; b.y = L.hero.y; b.vx = 0; b.vy = 0;
    if (mode === 'drop') {
      b.mode = 'drop';
      b.x = L.hero.x + rand(-12, 12);
      b.y = this.H / 2 + L.hero.r * 2.4;
      b.vy = -rand(260, 520);
      b.r = L.hero.r;
      b.q.setFromAxisAngle(_v.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(), rand(0, 6.28));
      b.av.set(rand(-1, 1), rand(-1, 1), rand(-0.5, 0.5)).normalize().multiplyScalar(rand(11, 17));
      b.align = 0; b.bounces = 0;
    } else {
      b.mode = 'spring';
      b.q.identity(); b.av.set(0, 0, 0); b.align = 6;
    }
    b.tq.identity().setFromAxisAngle(_v.set(0, 0, 1), rand(-0.08, 0.08));
    b.mesh.visible = true;
  }

  /** Dựng lại toàn bộ từ lịch sử (lúc mở app, hủy số bất kỳ, ván mới, khôi phục) */
  rebuild(animated = true) {
    for (const b of this.items) this._retire(b, false);
    this.items = [];
    this._readLayout();
    const hist = this.provider(MAX_BALLS);
    if (!hist.length) {
      const b = this._newBall('?', 'normal');
      this._spawnAt(b, 'spring'); b.r = 0.01;
      this.items.push(b);
    } else {
      hist.forEach((h) => {
        const b = this._newBall(h.n, h.state);
        this._spawnAt(b, 'spring');
        if (!animated) b.r = 0;
        this.items.push(b);
      });
    }
    this._readLayout();
    if (!animated) for (const b of this.items) { b.x = b.tx; b.y = b.ty; b.r = b.tr; b.tint = b.tintT; }
    this.setGlow(hist[0]?.state, !!hist.length);
    this.dirty = true; this.kick();
  }

  /** Gọi số mới: bóng cũ lăn vào dải, bóng mới rơi xuống */
  push(n, state) {
    if (this.layoutDirty) this._readLayout();
    const first = this.items[0];
    if (first?.idle) { this._retire(first, true); this.items.shift(); }
    if (this.items.length >= MAX_BALLS) this._retire(this.items.pop(), false);
    if (this.items[0]?.mode === 'drop') this.items[0].mode = 'spring';
    const b = this._newBall(n, state);
    this._spawnAt(b, this.reduced ? 'spring' : 'drop');
    if (this.reduced) { b.r = 0.01; }
    this.items.unshift(b);
    this._retarget();
    this.setGlow(state, true);
    this.glow.flash = 1;
    this.dirty = true; this.kick();
  }

  /** Hủy số cuối: bóng chính bay lên rồi biến mất, bóng trước đó trở lại vị trí chính */
  pop() {
    const first = this.items.shift();
    if (first) this._retire(first, true);
    const hist = this.provider(MAX_BALLS);
    if (!hist.length) {
      const b = this._newBall('?', 'normal'); this._spawnAt(b, 'spring'); b.r = 0.01;
      this.items = [b];
    } else if (this.items.length < Math.min(hist.length, MAX_BALLS)) {
      const h = hist[this.items.length];       // bổ sung quả cũ hơn ở cuối dải
      if (h) {
        const b = this._newBall(h.n, h.state);
        this._spawnAt(b, 'spring');
        this.items.push(b);
      }
    }
    this._retarget();
    this.setGlow(hist[0]?.state, !!hist.length);
    this.dirty = true; this.kick();
  }

  _retire(b, fly) {
    if (!fly) { this.scene.remove(b.mesh); b.dispose(); return; }
    b.mode = 'fly'; b.ty = this.H / 2 + b.r * 2.2; b.tx = b.x; b.vy = rand(160, 260); b.tr = b.r * 0.55;
    this.flying.push(b);
  }

  setGlow(state, hasBall) {
    const g = this.glow;
    if (!hasBall) { g.level = 0.0; return; }
    const st = BALL_STYLES[state] || BALL_STYLES.normal;
    g.color.set(st.glow);
    g.level = state === 'kinh' ? 0.95 : state === 'wait' ? 0.7 : 0.34;
  }

  /** Tia lửa quanh bóng chính (đợi / kinh) */
  sparkHero(state) {
    const h = this.layout.hero;
    const st = BALL_STYLES[state] || BALL_STYLES.normal;
    this.fx.sparkle(h.x, h.y, st.glow, state === 'kinh' ? 34 : 20, state === 'kinh' ? 260 : 190, 11);
    this.dirty = true; this.kick();
  }

  celebrate(hexColors) {
    this.fx.celebrate(hexColors, { reduced: this.reduced });
    this.dirty = true; this.kick();
  }
  stopCelebrate() { this.fx.clear(); this.dirty = true; this.kick(); }

  setQuality(q) {
    if (this.quality === q) return;
    this.quality = q; this.degradeLevel = 0;
    this.resize();
  }

  /* ================= kéo để xoay bóng ================= */
  _bindDrag() {
    const el = this.heroEl;
    el.addEventListener('pointerdown', (e) => {
      const b = this.items[0]; if (!b || b.idle && false) return;
      el.setPointerCapture?.(e.pointerId);
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), vx: 0, vy: 0 };
      if (b) { b.align = 0; b.av.set(0, 0, 0); }
      this.kick();
    });
    el.addEventListener('pointermove', (e) => {
      const d = this.drag; if (!d || d.id !== e.pointerId) return;
      const b = this.items[0]; if (!b) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      const now = performance.now(), dt = Math.max(1, now - d.t) / 1000;
      d.x = e.clientX; d.y = e.clientY; d.t = now;
      d.vx = dx / dt; d.vy = dy / dt;
      const k = 1 / Math.max(20, b.r);
      _q.setFromAxisAngle(_v.set(0, 1, 0), dx * k); b.q.premultiply(_q);
      _q.setFromAxisAngle(_v.set(1, 0, 0), dy * k); b.q.premultiply(_q);
      this.dirty = true; this.kick();
    });
    const end = (e) => {
      const d = this.drag; if (!d || d.id !== e.pointerId) return;
      this.drag = null;
      const b = this.items[0]; if (!b) return;
      const k = 1 / Math.max(20, b.r);
      b.av.set(clamp(d.vy * k, -18, 18), clamp(d.vx * k, -18, 18), 0);
      b.align = 2.4;
      this.kick();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  /* ================= vòng lặp ================= */
  kick() {
    if (this.raf || this.lost || document.hidden) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this._loop);
  }

  _busy(now) {
    if (this.dirty || this.drag || this.fx.active || this.flying.length || now < this.trackUntil || this.glow.flash > 0.01) return true;
    for (const b of this.items) {
      if (b.mode !== 'spring') return true;
      if (Math.abs(b.x - b.tx) + Math.abs(b.y - b.ty) + Math.abs(b.r - b.tr) > 0.25 || Math.abs(b.vx) + Math.abs(b.vy) > 1 || Math.abs(b.rv) > 0.3) return true;
      if (b.av.lengthSq() > 0.0004 || b.squash > 0.004 || Math.abs(b.tint - b.tintT) > 0.01) return true;
      if (b.align > 0 && b.q.angleTo(b.tq) > 0.01) return true;
    }
    return false;
  }

  _loop = (now) => {
    this.raf = 0;
    if (document.hidden || this.lost) return;
    const ambientOn = this.quality === 'high' && !this.reduced;
    const busy = this._busy(now);
    if (!busy && !ambientOn) return;                       // ngủ cho đến khi có việc
    if (!busy && now - this.lastRender < 33) { this.raf = requestAnimationFrame(this._loop); return; }

    const dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000));
    this.last = now; this.lastRender = now; this.t += dt; this.dirty = false;

    if (this.layoutDirty || now < this.trackUntil) this._readLayout();
    if (ambientOn) this._updateAmbient(dt);
    this._updateBalls(dt);
    this._updateHalo(dt);
    this.fx.update(dt);
    this.renderer.render(this.scene, this.camera);

    // tự hạ chất lượng nếu máy yếu (chỉ đo khi đang hoạt động hết công suất)
    if (busy && this.autoDegrade) {
      this.accum += dt; this.frames++;
      if (this.frames >= 100) {
        const avg = this.accum / this.frames; this.frames = 0; this.accum = 0;
        if (avg > 0.03) this._degrade();
      }
    }
    this.raf = requestAnimationFrame(this._loop);
  };

  /** Chạy mô phỏng nhanh N giây không vẽ — dùng khi kiểm thử để đạt trạng thái cuối. */
  fastForward(sec = 2) {
    this._readLayout();
    for (let t = 0; t < sec; t += 1 / 60) {
      this.t += 1 / 60;
      this._updateBalls(1 / 60); this._updateHalo(1 / 60); this.fx.update(1 / 60);
    }
    this.dirty = true; this.kick();
  }

  _degrade() {
    if (this.pr > 1.01) { this.degradeLevel++; this.resize(); }
    else if (this.quality === 'high') { this.onDegrade?.(); }
  }

  _updateBalls(dt) {
    const t = this.t;
    const K = 150, C = 2 * Math.sqrt(K) * 0.78;             // lò xo gần tới hạn, hơi nảy
    const G = 3600;
    const step = (b, hero) => {
      // --- vị trí ---
      if (b.mode === 'drop') {
        b.vy -= G * dt; b.y += b.vy * dt;
        b.vx += (b.tx - b.x) * 60 * dt; b.vx *= Math.exp(-6 * dt); b.x += b.vx * dt;
        b.r += (b.tr - b.r) * Math.min(1, dt * 14);
        if (b.y <= b.ty && b.vy < 0) {
          b.y = b.ty;
          const impact = -b.vy;
          if (impact < 170 || b.bounces >= 2) { b.mode = 'spring'; b.vy = 0; b.align = 7; b.squash = Math.max(b.squash, 0.14); this._landed(b); }
          else { b.vy = impact * 0.36; b.bounces++; b.squash = Math.min(0.28, impact / 3200); this._landed(b, b.bounces === 1); b.align = b.bounces * 2.5; }
        }
      } else if (b.mode === 'fly') {
        b.vy += (b.ty - b.y) * 18 * dt; b.vy *= Math.exp(-2.2 * dt); b.y += b.vy * dt;
        b.r += (b.tr - b.r) * Math.min(1, dt * 7);
      } else {
        for (const k of ['x', 'y', 'r']) {
          const v = k === 'r' ? 'rv' : 'v' + k, tgt = b['t' + k];
          const a = K * (tgt - b[k]) - C * b[v];
          b[v] += a * dt; b[k] += b[v] * dt;
        }
        if (b.r < 0) b.r = 0;
      }
      if (b.mode === 'spring' && b.align < 2) b.align = 2;     // luôn quay dần về mặt trước
      b.tint += (b.tintT - b.tint) * Math.min(1, dt * 8);
      b.squash *= Math.exp(-9 * dt);

      // --- xoay ---
      const sp = b.av.length();
      if (sp > 1e-4) {
        _q.setFromAxisAngle(_v.copy(b.av).normalize(), sp * dt);
        b.q.premultiply(_q);
        b.av.multiplyScalar(Math.exp(-(b.mode === 'drop' ? 1.1 : 2.6) * dt));
        if (sp < 0.02) b.av.set(0, 0, 0);
      }
      if (b.idle) {                                          // bóng "?" xoay chậm liên tục
        _q.setFromAxisAngle(_v.set(0.2, 1, 0).normalize(), 0.5 * dt); b.q.premultiply(_q);
      } else if (b.align > 0 && !this.drag) {
        b.q.slerp(b.tq, 1 - Math.exp(-b.align * dt));
      }

      // --- áp lên mesh ---
      const r = Math.max(0.001, b.r);
      const sq = b.squash;
      b.mesh.position.set(b.x, b.y + (hero && !this.reduced && b.mode === 'spring' && this.quality === 'high' ? Math.sin(t * 1.7 + b.seed) * 2.4 : 0), 0);
      b.mesh.scale.set(r * (1 + sq * 0.55), r * (1 - sq), r * (1 + sq * 0.55));
      b.mesh.quaternion.copy(b.q);
      if (hero && b.mode === 'spring' && !b.idle && !this.drag && this.quality === 'high' && !this.reduced && b.q.angleTo(b.tq) < 0.12) {
        // lắc lư nhẹ khi đứng yên
        _q.setFromAxisAngle(_v.set(0, 1, 0), Math.sin(t * 0.9 + b.seed) * 0.09); b.mesh.quaternion.multiply(_q);
        _q.setFromAxisAngle(_v.set(1, 0, 0), Math.cos(t * 0.7 + b.seed) * 0.05); b.mesh.quaternion.multiply(_q);
      }
      b.mat.color.setScalar(b.tint);
      b.mesh.visible = r > 0.6;
    };

    this.items.forEach((b, k) => step(b, k === 0));
    for (let k = this.flying.length - 1; k >= 0; k--) {
      const b = this.flying[k];
      step(b, false);
      if (b.y > this.H / 2 + b.r * 1.2 || b.r < 1) { this.scene.remove(b.mesh); b.dispose(); this.flying.splice(k, 1); }
    }
  }

  _landed(b, big = true) {
    if (this.items[0] !== b) return;
    this.glow.flash = Math.max(this.glow.flash, 0.9);
    if (big) this.fx.sparkle(b.x, b.y - b.r * 0.8, '#ffe6b0', 10, 130, 8);
  }

  _updateHalo(dt) {
    const g = this.glow, b = this.items[0];
    g.cur += (g.level - g.cur) * Math.min(1, dt * 5);
    g.flash *= Math.exp(-3.2 * dt);
    const show = b && b.r > 2 && (g.cur > 0.01 || g.flash > 0.01);
    this.halo.visible = !!show;
    if (!show) return;
    const pulse = this.reduced ? 1 : 0.86 + 0.14 * Math.sin(this.t * 3.1);
    this.halo.position.set(b.x, b.y, -b.r * 0.6);
    this.halo.scale.setScalar(b.r * (3.1 + g.flash * 0.9));
    this.halo.material.color.copy(g.color);
    this.halo.material.opacity = clamp((g.cur * pulse + g.flash * 0.55), 0, 1);
  }
}
