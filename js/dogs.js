import * as THREE from 'three';

/**
 * The three dogs, walking about the workshop in the 360 view.
 *
 * Each dog is a sprite rendered in Blender (blender/dog_sprites.py): 8 headings x a walk cycle,
 * plus a standing idle with a wagging tail. The page picks the frame from the dog's heading
 * relative to the line of sight and from how far it has walked, stands the sprite on the floor
 * facing the eye, and gives it one depth (just in front of the dog) so the render's furniture,
 * walls and other dogs hide it correctly (the panorama writes its own depth, see pano-view.js).
 *
 * Positions are kept in the Blender scene's floor plane (metres; +x right, +y away from the eye)
 * and converted to three.js (x, z - 1.6, -y) only for drawing.
 */
export const EYE_H = 1.6;
const DIR = 'assets/workshop-3d/';
export const toThree = (x, y, z = 0, out = new THREE.Vector3()) => out.set(x, z - EYE_H, -y);

// where the dogs start: their places in the approved photo (Blender floor coordinates, heading deg)
const START = { golden: [-2.25, 3.95, -110], retriever: [-2.05, 3.45, -55], terrier: [-1.75, 3.1, -100] };
// mouth position in the dog's own frame (m forward, m up), for carrying the ball
const MOUTH = { golden: [0.6, 0.69], retriever: [0.67, 0.74], terrier: [0.37, 0.39] };
const SPEED = { golden: 0.85, retriever: 0.75, terrier: 0.95 };

/** Which of the 8 sprite headings shows a dog facing `heading` (radians, Blender floor plane) at (x, y). */
export function spriteHeading(x, y, heading, n = 8) {
  const len = Math.hypot(x, y) || 1;
  const fx = x / len, fy = y / len;            // line of sight, on the floor
  const rx = fy, ry = -fx;                      // screen right, on the floor
  const hx = Math.cos(heading), hy = Math.sin(heading);
  const a = Math.atan2(hx * fx + hy * fy, hx * rx + hy * ry);   // 0 = facing right, +90 deg = away
  return ((Math.round(a / (2 * Math.PI / n)) % n) + n) % n;
}

// ---------------------------------------------------------------- the floor grid
export class NavGrid {
  constructor(j, radius = 0.22) {
    Object.assign(this, { x0: j.x0, y0: j.y0, cell: j.cell, w: j.w, h: j.h });
    const raw = typeof atob === 'function' ? Uint8Array.from(atob(j.data), (c) => c.charCodeAt(0)) : Uint8Array.from(Buffer.from(j.data, 'base64'));
    this.height = raw;
    // keep the dogs' bodies clear of furniture: grow every blocked cell by the dog radius
    const r = Math.ceil(radius / this.cell), free = new Uint8Array(this.w * this.h);
    for (let jy = 0; jy < this.h; jy++) for (let ix = 0; ix < this.w; ix++) {
      let ok = raw[jy * this.w + ix] !== 255;
      for (let dy = -r; ok && dy <= r; dy++) for (let dx = -r; ok && dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const X = ix + dx, Y = jy + dy;
        if (X < 0 || Y < 0 || X >= this.w || Y >= this.h || raw[Y * this.w + X] === 255) ok = false;
      }
      free[jy * this.w + ix] = ok ? 1 : 0;
    }
    this.free = free;
  }
  cellOf(x, y) { return [Math.floor((x - this.x0) / this.cell), Math.floor((y - this.y0) / this.cell)]; }
  centre(i, j) { return [this.x0 + (i + 0.5) * this.cell, this.y0 + (j + 0.5) * this.cell]; }
  ok(i, j) { return i >= 0 && j >= 0 && i < this.w && j < this.h && this.free[j * this.w + i] === 1; }
  isFree(x, y) { const [i, j] = this.cellOf(x, y); return this.ok(i, j); }
  groundAt(x, y) {
    const [i, j] = this.cellOf(x, y);
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return 0;
    const v = this.height[j * this.w + i]; return v === 255 ? 0 : (v - 100) / 100;
  }
  nearestFree(x, y, maxR = 30) {
    const [ci, cj] = this.cellOf(x, y);
    for (let r = 0; r <= maxR; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      if (this.ok(ci + di, cj + dj)) return this.centre(ci + di, cj + dj);
    }
    return null;
  }
  /** straight walk possible between two points (sampled every half cell) */
  clear(ax, ay, bx, by) {
    const n = Math.ceil(Math.hypot(bx - ax, by - ay) / (this.cell * 0.5));
    for (let k = 0; k <= n; k++) { const t = k / Math.max(1, n); if (!this.isFree(ax + (bx - ax) * t, ay + (by - ay) * t)) return false; }
    return true;
  }
  /** A* over the grid (8 neighbours), then shortcut to the farthest visible point at each step */
  path(ax, ay, bx, by) {
    const [si, sj] = this.cellOf(ax, ay), [ti, tj] = this.cellOf(bx, by);
    if (!this.ok(ti, tj)) return null;
    const W = this.w, start = sj * W + si, goal = tj * W + ti;
    const g = new Float32Array(W * this.h).fill(Infinity), from = new Int32Array(W * this.h).fill(-1), done = new Uint8Array(W * this.h);
    const open = [[0, start]]; g[start] = 0;
    const hfn = (k) => Math.hypot((k % W) - ti, Math.floor(k / W) - tj);
    const push = (item) => { open.push(item); let i = open.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (open[p][0] <= open[i][0]) break; [open[p], open[i]] = [open[i], open[p]]; i = p; } };
    const pop = () => { const top = open[0], last = open.pop(); if (open.length) { open[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < open.length && open[l][0] < open[m][0]) m = l; if (r < open.length && open[r][0] < open[m][0]) m = r; if (m === i) break; [open[m], open[i]] = [open[i], open[m]]; i = m; } } return top; };
    let found = false, steps = 0;
    while (open.length && steps++ < 40000) {
      const [, k] = pop(); if (done[k]) continue; done[k] = 1;
      if (k === goal) { found = true; break; }
      const i = k % W, j = Math.floor(k / W);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = i + di, nj = j + dj;
        if (!this.ok(ni, nj) || (di && dj && (!this.ok(i + di, j) || !this.ok(i, j + dj)))) continue;
        const nk = nj * W + ni, ng = g[k] + (di && dj ? Math.SQRT2 : 1);
        if (ng < g[nk]) { g[nk] = ng; from[nk] = k; push([ng + hfn(nk), nk]); }
      }
    }
    if (!found) return null;
    const cells = []; for (let k = goal; k !== -1 && k !== start; k = from[k]) cells.push(k);
    const pts = cells.reverse().map((k) => this.centre(k % W, Math.floor(k / W)));
    pts[pts.length - 1] = [bx, by];
    const out = []; let cx = ax, cy = ay, idx = 0;
    while (idx < pts.length) {
      let far = idx;
      for (let k = pts.length - 1; k > idx; k--) if (this.clear(cx, cy, pts[k][0], pts[k][1])) { far = k; break; }
      out.push(pts[far]); [cx, cy] = pts[far]; idx = far + 1;
    }
    return out;
  }
}

// ---------------------------------------------------------------- drawing
export const VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
export const FRAG = /* glsl */ `precision highp float;
  uniform sampler2D tAtlas; uniform vec4 uCell; uniform float uDepth, uTint; varying vec2 vUv;
  void main(){
    vec4 c = texture2D(tAtlas, uCell.xy + vUv * uCell.zw);
    if (c.a < 0.01) discard;
    gl_FragColor = vec4(c.rgb * uTint, c.a);
    gl_FragDepth = uDepth;
  }`;

function ballMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: `varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    // tennis-ball felt, lit from the open front (upper left) with a warm floor bounce
    fragmentShader: `precision highp float; varying vec3 vN; uniform float uTint;
      void main(){ vec3 n = normalize(vN); float k = max(dot(n, normalize(vec3(-0.5, 0.7, 0.5))), 0.0);
        vec3 c = vec3(0.62, 0.72, 0.16) * (0.32 + 0.75 * k) + vec3(0.06, 0.04, 0.02) * max(-n.y, 0.0);
        gl_FragColor = vec4(c * uTint, 1.0); }`,
    uniforms: { uTint: { value: 1 } },
  });
}

export function createDogs({ scene, camera, renderer, onChange = () => {}, sound = null, time = 'day' }) {
  const group = new THREE.Group(); scene.add(group);
  const state = { ready: false, dogs: [], nav: null, ball: null, light: null, control: -1, axes: [0, 0] };

  // floor brightness from the low-res panorama of the current time of day, so a dog walking out of
  // the sun (or out of the lamplight at night) dims
  const lightCanvas = document.createElement('canvas'); lightCanvas.width = 512; lightCanvas.height = 256;
  const lightImg = new Image(); lightImg.src = DIR + time + '/pano-2k.jpg';
  lightImg.onload = () => {
    const g = lightCanvas.getContext('2d', { willReadFrequently: true }); g.drawImage(lightImg, 0, 0, 512, 256);
    state.light = g.getImageData(0, 0, 512, 256).data;
    const ref = []; for (const [x, y] of Object.values(START)) ref.push(lumAt(x + 0.3, y - 0.3));
    state.refLum = ref.reduce((a, b) => a + b, 0) / ref.length;
  };
  const _v = new THREE.Vector3();
  function lumAt(x, y) {
    if (!state.light) return 1;
    toThree(x, y, state.nav ? state.nav.groundAt(x, y) : 0, _v).normalize();
    const u = 0.5 + Math.atan2(_v.x, -_v.z) / (2 * Math.PI), v = 0.5 + Math.asin(_v.y) / Math.PI;
    const px = Math.min(511, Math.max(0, Math.floor(u * 512))), py = Math.min(255, Math.max(0, Math.floor((1 - v) * 256)));
    const i = (py * 512 + px) * 4, d = state.light;
    return (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
  }

  // ball and its contact shadow
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.033, 20, 14), ballMaterial());
  ball.visible = false; group.add(ball);
  const shadowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const ballShadow = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.11), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  ballShadow.rotation.x = -Math.PI / 2; ballShadow.visible = false; group.add(ballShadow);

  Promise.all([fetch(DIR + 'dogs.json').then((r) => r.json()), fetch(DIR + 'nav.json').then((r) => r.json())]).then(([meta, nav]) => {
    state.nav = new NavGrid(nav, 0.3);   // a little wider than the body, so they keep off walls and furniture
    const loader = new THREE.TextureLoader();
    // the ball-carrying sheets, fetched once the walking sheets are in (they are only needed on a throw)
    const loadCarry = () => {
      for (const d of state.dogs) {
        const m = meta[d.name]; if (!m || !m.carryFile || d.carryTex) continue;
        const t = loader.load(DIR + m.carryFile, () => { d.carryTex = t; onChange(); });
        t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4;
      }
    };
    let pending = 0;
    for (const [name, m] of Object.entries(meta)) {
      pending++;
      const tex = loader.load(DIR + m.file, () => { if (--pending === 0) { state.ready = true; onChange(); setTimeout(loadCarry, 3000); } });
      tex.colorSpace = THREE.NoColorSpace; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.anisotropy = 4;
      // walking with the ball in its mouth (mouth open round it): a separate atlas
      // (loaded a few seconds after the walking sheets: until then a fetched ball is drawn in 3D as before)
      const carryTex = null;
      const mat = new THREE.ShaderMaterial({ uniforms: { tAtlas: { value: tex }, uCell: { value: new THREE.Vector4(0, 0, 1, 1) }, uDepth: { value: 0.5 }, uTint: { value: 1 } },
        vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: true });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(m.size, m.size), mat);
      mesh.visible = false; mesh.userData.dog = name; group.add(mesh);
      let [x, y, h] = START[name] || [0, 2, 0];
      if (!state.nav.isFree(x, y)) [x, y] = state.nav.nearestFree(x, y) || [x, y];   // their photo spots hug the furniture
      state.dogs.push({ name, m, mesh, x, y, heading: h * Math.PI / 180, phase: Math.random(), idle: Math.random(), mode: 'idle',
        timer: 1.5 + Math.random() * 4, path: null, speed: SPEED[name] || 0.8, carry: false, bubble: 0, tex, carryTex });
    }
  }).catch((e) => console.warn('Dogs unavailable', e));

  const rand = (a, b) => a + Math.random() * (b - a);
  function pickWander(d) {
    const nav = state.nav;
    for (let k = 0; k < 40; k++) {
      // mostly inside the workshop (the front half, the part you see first), now and then the yard,
      // keeping well clear of the glass
      const r = Math.random(), inside = r < 0.9;
      const x = inside ? rand(-4.5, 3.7) : rand(-2.0, 6.0), y = inside ? (r < 0.6 ? rand(1.2, 4.0) : rand(-2.8, 1.2)) : rand(6.0, 9.5);
      if (!nav.isFree(x, y) || Math.hypot(x - d.x, y - d.y) < 1.2) continue;
      const p = nav.path(d.x, d.y, x, y);
      if (p) return p;
    }
    return null;
  }
  function go(d, x, y, mode) {
    const t = state.nav.nearestFree(x, y);
    if (!t) return false;
    const p = state.nav.path(d.x, d.y, t[0], t[1]);
    if (!p) return false;
    d.path = p; d.mode = mode; return true;
  }
  function frontSpot(extra = 0) {
    // a spot on the floor straight ahead, just far enough that a dog standing there is fully in view
    const f = new THREE.Vector3(); camera.getWorldDirection(f);
    const len = Math.hypot(f.x, f.z) || 1;
    const bottom = Math.asin(Math.max(-1, Math.min(1, f.y))) - THREE.MathUtils.degToRad(camera.fov / 2);
    const dist = Math.max(2.2, Math.min(5, (bottom < -0.05 ? EYE_H / Math.tan(-bottom) : 2.2) + 0.5)) + extra;
    return [f.x / len * dist, -f.z / len * dist];
  }

  /** Call a dog over: it trots to a spot in front of you, turns to face you and barks. */
  function greet(i) {
    const d = state.dogs[i]; if (!d || !state.nav) return;
    const [x, y] = frontSpot(i * 0.3);
    if (go(d, x + (i - 1) * 0.45, y, 'greet')) { d.speed = SPEED[d.name] * 1.4; }
    bark(d);
  }
  function bark(d) {
    d.bubble = 1.4;
    if (!sound) return;
    _v.copy(d.mesh.position).project(camera);
    try { sound.start(); sound.dog(state.dogs.indexOf(d), 835 + 835 * Math.max(-1, Math.min(1, _v.x))); } catch {}
  }

  /** Throw the ball 3-6 m ahead (or at a floor point); the dogs race for it and bring it back. */
  function throwBall(target) {
    if (!state.nav || !state.ready) return false;
    let tx, ty;
    if (target) [tx, ty] = target; else { [tx, ty] = frontSpot(rand(1.0, 3.0)); const [rx, ry] = [ty, -tx]; const s = rand(-0.6, 0.6) / Math.hypot(tx, ty); tx += rx * s; ty += ry * s; }
    // the ball can't fly through the walls or the glass: keep the landing spot inside the room,
    // shortening the throw along its line if it would leave
    const X0 = -4.6, X1 = 3.8, Y0 = -3.0, Y1 = 4.0, sx = 0.15, sy = 0.45;
    let u = 1;
    if (tx > X1) u = Math.min(u, (X1 - sx) / (tx - sx)); if (tx < X0) u = Math.min(u, (X0 - sx) / (tx - sx));
    if (ty > Y1) u = Math.min(u, (Y1 - sy) / (ty - sy)); if (ty < Y0) u = Math.min(u, (Y0 - sy) / (ty - sy));
    tx = sx + (tx - sx) * u; ty = sy + (ty - sy) * u;
    // land on free floor inside: step back along the throw until there is some
    const inside = (p) => p && p[0] > X0 - 0.2 && p[0] < X1 + 0.2 && p[1] > Y0 - 0.2 && p[1] < Y1 + 0.2;
    let t = null;
    for (let k = 0; k <= 12 && !inside(t); k++) {
      const f = 1 - k / 12;
      t = state.nav.nearestFree(sx + (tx - sx) * f, sy + (ty - sy) * f, 8);
    }
    if (!inside(t)) return false;
    [tx, ty] = t;
    state.ball = { x0: 0.15, y0: 0.45, z0: 1.25, x: tx, y: ty, t: 0, dur: 0.75 + 0.08 * Math.hypot(tx, ty), mode: 'flying', holder: null };
    ball.visible = ballShadow.visible = true;
    for (const d of state.dogs) if (d.mode !== 'driven') { d.mode = 'wait'; d.path = null; }
    return true;
  }

  function steer(d, dt, reduced) {
    const [tx, ty] = d.path[0];
    const dx = tx - d.x, dy = ty - d.y, dist = Math.hypot(dx, dy);
    const want = Math.atan2(dy, dx);
    let dh = Math.atan2(Math.sin(want - d.heading), Math.cos(want - d.heading));
    d.heading += Math.sign(dh) * Math.min(Math.abs(dh), (reduced ? 20 : 5.5) * dt);
    // slow down for sharp turns, then walk
    const step = Math.min(dist, d.speed * dt * Math.max(0.25, Math.cos(dh)));
    // keep a little room between dogs
    // (wait for a dog that's ahead and in the way, but never for more than a moment)
    const inWay = state.dogs.some((o) => o !== d && Math.hypot(o.x - d.x, o.y - d.y) < 0.45 && Math.hypot(o.x - tx, o.y - ty) < Math.hypot(d.x - tx, d.y - ty));
    if (inWay && (d.blocked = (d.blocked || 0) + dt) < 0.8) return 0;
    if (!inWay) d.blocked = 0;
    d.x += Math.cos(want) * step; d.y += Math.sin(want) * step;
    if (dist - step < 0.03) d.path.shift();
    return step;
  }

  function face(d, x, y, dt) {
    const want = Math.atan2(y - d.y, x - d.x);
    const dh = Math.atan2(Math.sin(want - d.heading), Math.cos(want - d.heading));
    d.heading += Math.sign(dh) * Math.min(Math.abs(dh), 4 * dt);
    return Math.abs(dh) < 0.15;
  }

  function updateBall(dt) {
    const b = state.ball; if (!b) return;
    const nav = state.nav;
    if (b.mode === 'flying') {
      b.t += dt; const u = Math.min(1, b.t / b.dur);
      const gz = nav.groundAt(b.x, b.y);
      const x = b.x0 + (b.x - b.x0) * u, y = b.y0 + (b.y - b.y0) * u;
      const z = b.z0 + (gz + 0.033 - b.z0) * u + Math.sin(Math.PI * u) * (0.7 + 0.15 * Math.hypot(b.x, b.y));
      b.px = x; b.py = y; b.pz = z;
      if (u >= 1) {
        b.mode = 'ground'; b.bounce = 0.35;
        // the race: everyone runs for it
        for (const d of state.dogs) if (d.mode !== 'driven' && go(d, b.x, b.y, 'chase')) d.speed = SPEED[d.name] * 2.0;
      }
    } else if (b.mode === 'ground') {
      b.bounce = Math.max(0, b.bounce - dt * 0.9);
      b.px = b.x; b.py = b.y; b.pz = nav.groundAt(b.x, b.y) + 0.033 + Math.abs(Math.sin(b.bounce * 14)) * b.bounce * 0.25;
    } else if (b.mode === 'held') {
      const d = b.holder, [mx, mz] = MOUTH[d.name];
      b.px = d.x + Math.cos(d.heading) * mx; b.py = d.y + Math.sin(d.heading) * mx; b.pz = nav.groundAt(d.x, d.y) + mz - 0.04;
    }
    toThree(b.px, b.py, b.pz, ball.position);
    ball.visible = !(b.mode === 'held' && b.holder?.carryTex);
    toThree(b.px, b.py, nav.groundAt(b.px, b.py) + 0.012, ballShadow.position);
    ballShadow.material.opacity = b.mode === 'flying' ? 0.4 : 1;
  }

  // you walking a dog: stick up = away from you along the view, down = toward you, sideways = across
  function driven(d, dt) {
    const f = new THREE.Vector3(); camera.getWorldDirection(f);
    const len = Math.hypot(f.x, f.z) || 1;
    const fx = f.x / len, fy = -f.z / len, rx = fy, ry = -fx;
    const [ax, ay] = state.axes;
    let vx = fx * -ay + rx * ax, vy = fy * -ay + ry * ax;
    const mag = Math.min(1, Math.hypot(vx, vy));
    if (mag < 0.08) return 0;
    const n = Math.hypot(vx, vy); vx /= n; vy /= n;
    const want = Math.atan2(vy, vx);
    const dh = Math.atan2(Math.sin(want - d.heading), Math.cos(want - d.heading));
    d.heading += Math.sign(dh) * Math.min(Math.abs(dh), 7 * dt);
    const sp = SPEED[d.name] * (0.6 + 1.3 * mag) * Math.max(0.3, Math.cos(dh));
    const dx = Math.cos(d.heading) * sp * dt, dy = Math.sin(d.heading) * sp * dt;
    const nav = state.nav;
    // slide along walls and furniture instead of stopping dead
    if (nav.isFree(d.x + dx, d.y + dy)) { d.x += dx; d.y += dy; }
    else if (nav.isFree(d.x + dx, d.y)) d.x += dx;
    else if (nav.isFree(d.x, d.y + dy)) d.y += dy;
    else return 0;
    // picks up the ball if you walk it there
    const b = state.ball;
    if (b && b.mode === 'ground' && Math.hypot(d.x - b.x, d.y - b.y) < 0.4) { b.mode = 'held'; b.holder = d; b.dropped = undefined; bark(d); }
    return Math.hypot(dx, dy);
  }

  function think(d, dt, reduced) {
    const b = state.ball;
    let moved = 0;
    if (d.mode === 'driven') return driven(d, dt);
    if (d.mode === 'idle') {
      d.timer -= dt;
      if (d.timer <= 0) { const p = pickWander(d); if (p) { d.path = p; d.mode = 'walk'; d.speed = SPEED[d.name]; } else d.timer = 2; }
    } else if (d.mode === 'walk' || d.mode === 'greet' || d.mode === 'chase' || d.mode === 'return') {
      if (d.mode === 'chase' && b && b.mode === 'ground' && Math.hypot(d.x - b.x, d.y - b.y) < 0.45) {
        // got it: carry it back to you; the others give up and wander off after a moment
        b.mode = 'held'; b.holder = d; bark(d);
        for (const o of state.dogs) if (o !== d && o.mode !== 'driven') { o.mode = 'idle'; o.path = null; o.timer = rand(0.8, 2.5); o.speed = SPEED[o.name]; }
        const [fx, fy] = frontSpot(); go(d, fx, fy, 'return'); d.speed = SPEED[d.name] * 1.5;
      } else if (d.path && d.path.length) {
        moved = steer(d, dt, reduced);
      } else {
        if (d.mode === 'return' && b && b.holder === d) { b.mode = 'ground'; b.x = b.px; b.y = b.py; b.bounce = 0.2; b.holder = null; b.dropped = 6; d.mode = 'present'; d.timer = 4; }
        else if (d.mode === 'greet') { d.mode = 'present'; d.timer = 4; }
        else if (d.mode === 'chase') { d.mode = 'idle'; d.timer = rand(1, 3); }
        else { d.mode = 'idle'; d.timer = rand(2, 7); }
        d.speed = SPEED[d.name];
      }
    } else if (d.mode === 'present') {
      // sit and look at you (face the eye), tail going
      face(d, 0, 0, dt);
      d.timer -= dt; if (d.timer <= 0) { d.mode = 'idle'; d.timer = rand(1, 3); }
    }
    return moved;
  }

  function draw(d, dt, reduced) {
    const { m, mesh } = d;
    const walking = d.moved > 0;
    if (walking) d.phase = (d.phase + d.moved / (m.stride / 0.62)) % 1;
    else d.idle = (d.idle + dt * (reduced ? 0 : 0.9)) % 1;
    const holding = !!(d.carryTex && state.ball && state.ball.mode === 'held' && state.ball.holder === d);
    const row = spriteHeading(d.x, d.y, d.heading, m.headings);
    const dv = 1 / m.rows;
    if (holding) {
      // the carry walk; standing still with the ball, it holds the first frame
      const col = walking ? Math.floor(d.phase * m.carryCols) % m.carryCols : 0, du = 1 / m.carryCols;
      mesh.material.uniforms.tAtlas.value = d.carryTex;
      mesh.material.uniforms.uCell.value.set(col * du, 1 - (row + 1) * dv, du, dv);
    } else {
      const col = walking ? Math.floor(d.phase * m.walk) % m.walk : m.walk + (Math.floor(d.idle * m.idle) % m.idle), du = 1 / m.cols;
      mesh.material.uniforms.tAtlas.value = d.tex;
      mesh.material.uniforms.uCell.value.set(col * du, 1 - (row + 1) * dv, du, dv);
    }
    const gz = state.nav.groundAt(d.x, d.y);
    toThree(d.x, d.y, gz, mesh.position);
    mesh.lookAt(0, 0, 0);
    mesh.translateY((m.groundY - 0.5) * m.size);
    // one depth for the whole dog: a point just in front of it, so furniture nearer than the dog
    // hides it and the floor behind its feet does not
    const len = Math.hypot(d.x, d.y) || 1;
    toThree(d.x - d.x / len * 0.3, d.y - d.y / len * 0.3, gz + 0.3 * m.size, _v).project(camera);
    mesh.material.uniforms.uDepth.value = Math.min(1, Math.max(0, _v.z * 0.5 + 0.5));
    const lum = state.refLum ? lumAt(d.x, d.y) / state.refLum : 1;
    mesh.material.uniforms.uTint.value = Math.max(0.3, Math.min(1.05, Math.pow(lum, 0.5)));
    mesh.visible = true;
  }

  return {
    setTime(t) { lightImg.src = DIR + t + '/pano-2k.jpg'; },
    group, ball, state,
    get ready() { return state.ready; },
    /** advance and place everything; returns true while anything is moving */
    update(dt, reduced, depthReady) {
      if (!state.ready || !state.nav) return false;
      const step = Math.min(dt, 0.05);
      let busy = false;
      for (const d of state.dogs) {
        d.moved = think(d, step, reduced);
        if (d.bubble > 0) d.bubble -= step;
        busy = busy || d.mode !== 'idle' || d.moved > 0;
      }
      updateBall(step);
      if (state.ball && state.ball.dropped !== undefined && state.ball.mode === 'ground') {
        state.ball.dropped -= step;
        if (state.ball.dropped <= 0) { state.ball = null; ball.visible = ballShadow.visible = false; }
      }
      for (const d of state.dogs) draw(d, step, reduced);
      group.visible = depthReady;
      return busy || !!state.ball;
    },
    /** dog under a ray, by a rough body ellipse on its sprite plane (transparent corners don't count) */
    pick(ray) {
      let best = -1, bestD = Infinity;
      state.dogs.forEach((d, i) => {
        if (!d.mesh.visible) return;
        const hit = ray.intersectObject(d.mesh)[0]; if (!hit) return;
        const u = hit.uv.x - 0.5, v = hit.uv.y - (1 - d.m.groundY + 0.34);
        if ((u / 0.36) ** 2 + (v / 0.32) ** 2 > 1) return;
        if (hit.distance < bestD) { bestD = hit.distance; best = i; }
      });
      return best;
    },
    greet, throwBall,
    names: () => state.dogs.map((d) => d.name),
    /** take control of dog i (or -1 to let it go); it stands still until you move the stick */
    control(i) {
      state.dogs.forEach((d, k) => { if (d.mode === 'driven' && k !== i) { d.mode = 'idle'; d.timer = 1.5; d.speed = SPEED[d.name]; } });
      state.control = i;
      const d = state.dogs[i]; if (d) { d.mode = 'driven'; d.path = null; }
      state.axes = [0, 0];
    },
    drive(ax, ay) { state.axes = [ax, ay]; },
    bark(i) { const d = state.dogs[i ?? state.control]; if (d) bark(d); },
    /** drop the ball if the walked dog is carrying it */
    drop() { const b = state.ball; if (b && b.mode === 'held' && b.holder?.mode === 'driven') { b.mode = 'ground'; b.x = b.px; b.y = b.py; b.bounce = 0.2; b.holder = null; b.dropped = 8; } },
    controlled() { return state.dogs[state.control] || null; },
    bubbles() { return state.dogs.filter((d) => d.bubble > 0).map((d) => ({ name: d.name, at: d.mesh.position, size: d.m.size, life: d.bubble })); },
  };
}
