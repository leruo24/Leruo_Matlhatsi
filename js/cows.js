import * as THREE from 'three';
import { VERT, FRAG, spriteHeading, toThree } from './dogs.js';

/**
 * Cows grazing in their pen across the farm (about 65 m out). Like the dogs they are Blender sprite
 * frames (blender/cow_sprites.py): 8 headings x a walk cycle plus a grazing loop. They graze most of
 * the time, then amble a few metres to fresh grass, keeping clear of each other and the fence.
 * Positions are in the Blender scene's ground plane; heights come from pen.json.
 */
const DIR = 'assets/workshop-3d/';
// the pen's fence runs x -14..2, y 60..74; cows keep 1.4 m inside it
export const PEN = Object.freeze({ x0: -27 + 1.4, x1: -13 - 1.4, y0: -8 + 1.4, y1: 4 - 1.4 });
// things in the pen the cows walk round: the hay ring, the shelter, the bales (x, y, radius)
export const PEN_OBSTACLES = Object.freeze([[-21.5, -3.0, 2.0], [-24.8, -6.2, 2.6], [-24.5, 2.0, 1.6], [-22.8, 2.4, 1.6]]);
export const inPen = (x, y) => x >= PEN.x0 && x <= PEN.x1 && y >= PEN.y0 && y <= PEN.y1 && !PEN_OBSTACLES.some(([ox, oy, r]) => Math.hypot(x - ox, y - oy) < r);
// where they stand at first (the render's placings) and which coat each wears
const HERD = [[-18, -4, 30, 'cow-brown'], [-16, 0, -60, 'cow-black'], [-20, 0.5, 120, 'cow-red'], [-17.5, -5.5, 200, 'cow-brown']];

export function penHeight(pen, x, y) {
  const fx = Math.max(0, Math.min(pen.w - 1.001, (x - pen.x0) / pen.cell)), fy = Math.max(0, Math.min(pen.h - 1.001, (y - pen.y0) / pen.cell));
  const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, H = pen.heights;
  return (H[j][i] * (1 - u) + H[j][i + 1] * u) * (1 - v) + (H[j + 1][i] * (1 - u) + H[j + 1][i + 1] * u) * v;
}

export function createCows({ scene, camera, onChange = () => {} }) {
  const group = new THREE.Group(); scene.add(group);
  const state = { ready: false, cows: [], pen: null, k: 0.95 };
  const rand = (a, b) => a + Math.random() * (b - a);
  Promise.all([fetch(DIR + 'cows.json').then((r) => r.json()), fetch(DIR + 'pen.json').then((r) => r.json())]).then(([meta, pen]) => {
    state.pen = pen;
    const loader = new THREE.TextureLoader(), tex = {};
    let pending = 0;
    for (const [name, m] of Object.entries(meta)) {
      pending++;
      tex[name] = loader.load(DIR + m.file, () => { if (--pending === 0) { state.ready = true; onChange(); } });
      tex[name].colorSpace = THREE.NoColorSpace;
    }
    for (const [x, y, h, coat] of HERD) {
      const m = meta[coat]; if (!m) continue;
      const mat = new THREE.ShaderMaterial({ uniforms: { tAtlas: { value: tex[coat] }, uCell: { value: new THREE.Vector4(0, 0, 1, 1) }, uDepth: { value: 0.5 }, uTint: { value: 0.95 } },
        vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(m.size, m.size), mat); mesh.visible = false; group.add(mesh);
      state.cows.push({ m, mesh, x, y, heading: h * Math.PI / 180, phase: Math.random(), idle: Math.random(), mode: 'graze', timer: rand(3, 15), tx: x, ty: y, moved: 0 });
    }
  }).catch((e) => console.warn('Cows unavailable', e));

  const _v = new THREE.Vector3();
  function think(c, dt) {
    if (c.mode === 'graze') {
      c.timer -= dt;
      if (c.timer <= 0) {
        // fresh grass a few metres away, clear of the other cows
        for (let k = 0; k < 20; k++) {
          const a = rand(0, Math.PI * 2), r = rand(2, 5);
          const tx = c.x + Math.cos(a) * r, ty = c.y + Math.sin(a) * r;
          if (!inPen(tx, ty) || !inPen((c.x + tx) / 2, (c.y + ty) / 2)) continue;
          if (state.cows.some((o) => o !== c && Math.hypot(o.x - tx, o.y - ty) < 2.6)) continue;
          c.tx = tx; c.ty = ty; c.mode = 'walk'; break;
        }
        if (c.mode !== 'walk') c.timer = rand(2, 6);
      }
      return 0;
    }
    const dx = c.tx - c.x, dy = c.ty - c.y, dist = Math.hypot(dx, dy);
    const want = Math.atan2(dy, dx), dh = Math.atan2(Math.sin(want - c.heading), Math.cos(want - c.heading));
    c.heading += Math.sign(dh) * Math.min(Math.abs(dh), 1.2 * dt);
    if (Math.abs(dh) > 0.6) return 0.0001;    // turning on the spot first
    const step = Math.min(dist, c.m.speed * dt);
    if (state.cows.some((o) => o !== c && Math.hypot(o.x - c.x - Math.cos(c.heading) * 0.6, o.y - c.y - Math.sin(c.heading) * 0.6) < 2.0)) { c.mode = 'graze'; c.timer = rand(4, 10); return 0; }
    c.x += Math.cos(c.heading) * step; c.y += Math.sin(c.heading) * step;
    if (dist - step < 0.05) { c.mode = 'graze'; c.timer = rand(8, 25); }
    return step;
  }
  function draw(c, dt, reduced) {
    const { m, mesh } = c;
    if (c.moved > 0.001) c.phase = (c.phase + c.moved / (m.stride / 0.65)) % 1;
    else c.idle = (c.idle + dt * (reduced ? 0 : 0.18)) % 1;
    const col = c.moved > 0.001 ? Math.floor(c.phase * m.walk) % m.walk : m.walk + (Math.floor(c.idle * m.idle) % m.idle);
    const row = spriteHeading(c.x, c.y, c.heading, m.headings);
    mesh.material.uniforms.uCell.value.set(col / m.cols, 1 - (row + 1) / m.rows, 1 / m.cols, 1 / m.rows);
    const gz = penHeight(state.pen, c.x, c.y);
    toThree(c.x, c.y, gz, mesh.position); mesh.lookAt(0, 0, 0); mesh.translateY((m.groundY - 0.5) * m.size);
    const len = Math.hypot(c.x, c.y);
    toThree(c.x - c.x / len * 1.2, c.y - c.y / len * 1.2, gz + 0.8, _v).project(camera);
    mesh.material.uniforms.uDepth.value = Math.min(1, Math.max(0, _v.z * 0.5 + 0.5));
    mesh.material.uniforms.uTint.value = state.k;
    mesh.visible = true;
  }
  return {
    group, state,
    get ready() { return state.ready; },
    /** brightness for the time of day (the sprites are lit for daylight) */
    setLight(k) { state.k = k; },
    update(dt, reduced, depthReady) {
      if (!state.ready) return false;
      const step = Math.min(dt, 0.1);
      for (const c of state.cows) { c.moved = reduced ? 0 : think(c, step); draw(c, step, reduced); }
      group.visible = depthReady;
      return true;
    },
  };
}
