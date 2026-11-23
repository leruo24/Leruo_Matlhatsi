import * as THREE from 'three';
import { VERT, FRAG, spriteHeading, toThree, NavGrid } from './dogs.js';

/**
 * Free-range hens around the coop in the yard (about 13 m out, front left). Like the cows they are
 * Blender sprite frames (blender/chicken_sprites.py): 8 headings x a walk cycle plus a pecking loop.
 * They peck about, then trot a metre or three to a new spot near the coop, on free ground from
 * nav.json (the same grid the dogs walk on), keeping clear of each other.
 */
const DIR = 'assets/workshop-3d/';
export const COOP = Object.freeze({ x: -6.5, y: 12.5, r: 4.6 });
const FLOCK = [[-4.6, 11.0, 'chicken-brown'], [-5.2, 13.8, 'chicken-white'], [-8.4, 11.2, 'chicken-brown'],
  [-3.8, 12.9, 'chicken-black'], [-7.6, 14.6, 'chicken-white'], [-6.0, 10.2, 'chicken-brown']];

export function createChickens({ scene, camera, onChange = () => {} }) {
  const group = new THREE.Group(); scene.add(group);
  const state = { ready: false, hens: [], nav: null, tint: new THREE.Color(1, 1, 1) };
  const rand = (a, b) => a + Math.random() * (b - a);
  Promise.all([fetch(DIR + 'chickens.json').then((r) => r.json()), fetch(DIR + 'nav.json').then((r) => r.json())]).then(([meta, nav]) => {
    state.nav = new NavGrid(nav, 0.12);
    const loader = new THREE.TextureLoader(), tex = {};
    let pending = 0;
    for (const [name, m] of Object.entries(meta)) {
      pending++;
      tex[name] = loader.load(DIR + m.file, () => { if (--pending === 0) { state.ready = true; onChange(); } });
      tex[name].colorSpace = THREE.NoColorSpace;
    }
    for (const [x, y, coat] of FLOCK) {
      const m = meta[coat]; if (!m) continue;
      const mat = new THREE.ShaderMaterial({ uniforms: { tAtlas: { value: tex[coat] }, uCell: { value: new THREE.Vector4(0, 0, 1, 1) }, uDepth: { value: 0.5 }, uTint: { value: 0.95 } },
        vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(m.size, m.size), mat); mesh.visible = false; group.add(mesh);
      state.hens.push({ m, mesh, x, y, heading: rand(0, Math.PI * 2), phase: Math.random(), idle: Math.random(), mode: 'peck', timer: rand(1, 6), tx: x, ty: y, moved: 0 });
    }
  }).catch((e) => console.warn('Chickens unavailable', e));

  const _v = new THREE.Vector3();
  const okSpot = (h, x, y) => Math.hypot(x - COOP.x, y - COOP.y) < COOP.r && state.nav.clear(h.x, h.y, x, y)
    && !state.hens.some((o) => o !== h && Math.hypot(o.x - x, o.y - y) < 0.5);
  function think(h, dt) {
    if (h.mode === 'peck') {
      h.timer -= dt;
      if (h.timer <= 0) {
        for (let k = 0; k < 16; k++) {
          const a = rand(0, Math.PI * 2), r = rand(0.8, 3);
          const tx = h.x + Math.cos(a) * r, ty = h.y + Math.sin(a) * r;
          if (okSpot(h, tx, ty)) { h.tx = tx; h.ty = ty; h.mode = 'walk'; break; }
        }
        if (h.mode !== 'walk') h.timer = rand(1, 3);
      }
      return 0;
    }
    const dx = h.tx - h.x, dy = h.ty - h.y, dist = Math.hypot(dx, dy);
    const want = Math.atan2(dy, dx), dh = Math.atan2(Math.sin(want - h.heading), Math.cos(want - h.heading));
    h.heading += Math.sign(dh) * Math.min(Math.abs(dh), 5 * dt);
    if (Math.abs(dh) > 0.5) return 0.0001;
    const step = Math.min(dist, h.m.speed * dt);
    h.x += Math.cos(h.heading) * step; h.y += Math.sin(h.heading) * step;
    if (dist - step < 0.03) { h.mode = 'peck'; h.timer = rand(2, 9); }
    return step;
  }
  function draw(h, dt, reduced) {
    const { m, mesh } = h;
    if (h.moved > 0.001) h.phase = (h.phase + h.moved / (m.stride / 0.65)) % 1;
    else h.idle = (h.idle + dt * (reduced ? 0 : 0.5)) % 1;
    const col = h.moved > 0.001 ? Math.floor(h.phase * m.walk) % m.walk : m.walk + (Math.floor(h.idle * m.idle) % m.idle);
    const row = spriteHeading(h.x, h.y, h.heading, m.headings);
    mesh.material.uniforms.uCell.value.set(col / m.cols, 1 - (row + 1) / m.rows, 1 / m.cols, 1 / m.rows);
    const gz = state.nav.groundAt(h.x, h.y);
    toThree(h.x, h.y, gz, mesh.position); mesh.lookAt(0, 0, 0); mesh.translateY((m.groundY - 0.5) * m.size);
    const len = Math.hypot(h.x, h.y);
    toThree(h.x - h.x / len * 0.3, h.y - h.y / len * 0.3, gz + 0.2, _v).project(camera);
    mesh.material.uniforms.uDepth.value = Math.min(1, Math.max(0, _v.z * 0.5 + 0.5));
    mesh.material.uniforms.uTint.value = state.k;
    mesh.visible = true;
  }
  state.k = 0.95;
  return {
    group, state,
    get ready() { return state.ready; },
    /** brightness for the time of day (the sprites are lit for daylight) */
    setLight(k) { state.k = k; },
    update(dt, reduced, depthReady) {
      if (!state.ready) return false;
      const step = Math.min(dt, 0.1);
      for (const h of state.hens) { h.moved = reduced ? 0 : think(h, step); draw(h, step, reduced); }
      group.visible = depthReady;
      return true;
    },
  };
}
