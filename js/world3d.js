// The walk and superhero views: the Blender farm exported as a real-time 3D model (assets/world/farm.glb,
// made by blender/export_web.py), lit live for the time of day.
//   walk:  first person at eye height, inside the office and around the yard (the dogs' walk map keeps you
//          out of walls and furniture)
//   fly:   superhero flight over the whole farm
// Coordinates: the model is glTF (y up). The walk map is in Blender's ground plane (x, y), which is
// three.js (x, -z).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { NavGrid } from './dogs.js';

const EYE = 1.62;
// sun direction and light per time of day (blender/timeofday.py: elevation and azimuth of the lamp)
const LIGHTS = {
  sunrise: { fog: 0xd9b9a8, el: 9, az: 62, sun: 0xffc29e, sunI: 2.2, hemi: [0xffd9c2, 0x4a3b30, 0.55], inside: 0.6, glow: 0.6, exposure: 0.65, sky: { turbidity: 8, rayleigh: 2.5, el: 3.5 } },
  day: { fog: 0xbfd0e2, el: 48, az: -35, sun: 0xfff2e0, sunI: 3.0, hemi: [0xcfe3ff, 0x5a4a38, 0.9], inside: 0.0, glow: 0.0, exposure: 0.55, sky: { turbidity: 5, rayleigh: 1.2, el: 48 } },
  sunset: { fog: 0xd8a283, el: 10, az: -28, sun: 0xff9e57, sunI: 2.4, hemi: [0xffc49a, 0x3c2c22, 0.5], inside: 0.6, glow: 0.8, exposure: 0.7, sky: { turbidity: 9, rayleigh: 3, el: 2 } },
  night: { fog: 0x0b1018, el: 38, az: 35, sun: 0x8ca6ff, sunI: 0.25, hemi: [0x24304a, 0x0c0b0a, 0.25], inside: 1.0, glow: 1.5, exposure: 0.9, sky: { turbidity: 2, rayleigh: 0.3, el: -8 } },
};
// the office's pendant and floor lamps (Blender positions), lit from sunset to sunrise
const LAMPS = [[1.05, 1.62, 2.01], [2.05, 1.62, 2.01], [-1.08, 3.99, 2.16], [-0.2, 3.8, 2.16], [0.68, 3.61, 2.16], [-4.55, -1.75, 1.55]];
const toThree = (x, y, z) => new THREE.Vector3(x, z, -y);
const dirFrom = (az, el) => { const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el); return toThree(Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)); };

export function createWorld3D({ renderer, onChange = () => {} }) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 40000);
  camera.rotation.order = 'YXZ';
  const state = { mode: null, loaded: false, loading: null, time: 'day', yaw: 0, pitch: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(), fov: 70 };
  const input = { move: new THREE.Vector2(), lift: 0, run: false, keys: new Set() };

  // sky, sun, sky light, lamps
  const sky = new Sky(); sky.scale.setScalar(30000); scene.add(sky);
  const sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true;
  sun.shadow.mapSize.setScalar(matchMedia('(pointer: coarse)').matches ? 1024 : 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8); scene.add(hemi);
  // distance haze, and land beyond the modelled ground so the horizon never shows a gap
  scene.fog = new THREE.FogExp2(0xbfd0e2, 0.00011);   // light enough that the city still shows 5-7 km out
  const farLand = new THREE.Mesh(new THREE.CircleGeometry(30000, 48).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x3d4a2a }));
  farLand.position.y = -1.2; farLand.receiveShadow = false; scene.add(farLand);
  const lamps = LAMPS.map(([x, y, z]) => { const l = new THREE.PointLight(0xffcc94, 0, 9, 1.6); l.position.copy(toThree(x, y, z)); scene.add(l); return l; });
  const glows = [];
  const roofs = [];     // the office and garage roofs, lifted off in the superhero view so you can see inside
  const devices = [];   // the live screens (monitor, laptop, tablet), shared with the 360 view   // emissive materials (lamp shades, lit windows, city lights) scaled with the time of day
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null, nav = null;

  function setTime(t) {
    state.time = LIGHTS[t] ? t : 'day';
    const L = LIGHTS[state.time];
    const u = sky.material.uniforms;
    u.turbidity.value = L.sky.turbidity; u.rayleigh.value = L.sky.rayleigh; u.mieCoefficient.value = 0.005; u.mieDirectionalG.value = 0.8;
    u.sunPosition.value.copy(dirFrom(L.az, L.sky.el));
    sun.color.set(L.sun); sun.intensity = L.sunI;
    scene.fog.color.set(L.fog); farLand.material.color.set(state.time === 'night' ? 0x0d100c : 0x3d4a2a);
    hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2];
    lamps.forEach((l) => { l.intensity = 6 * L.inside; });
    glows.forEach((g) => { g.m.emissiveIntensity = g.base * (g.kind === 'lamp' ? Math.max(L.inside, 0.05) : g.kind === 'city' ? L.glow * 0.8 : L.glow); });
    // image-based light from the sky, so metal and glass pick up the right colours
    const skyOnly = new THREE.Scene(); const s2 = new Sky(); s2.scale.setScalar(1000); s2.material.uniforms = THREE.UniformsUtils.clone(u); skyOnly.add(s2);
    envRT?.dispose(); envRT = pmrem.fromScene(skyOnly, 0, 0.1, 2000);
    scene.environment = envRT.texture; scene.environmentIntensity = state.time === 'night' ? 0.25 : 0.6;
    onChange();
  }

  function prepMaterials(root) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.computeBoundingSphere();
      // the ground, the mountains and other huge pieces only receive shadows (casting them costs a lot and adds nothing)
      o.castShadow = o.geometry.boundingSphere.radius * o.getWorldScale(new THREE.Vector3()).x < 120; o.receiveShadow = true;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        const n = (m.name || '').toLowerCase();
        if (m.transmission > 0 || /glass|pane|window/.test(n) && m.opacity === 1 && !m.map && !/frame/.test(n)) {
          // real-time transmission costs a whole extra render: glass is drawn as a faint transparent sheet
          m.transmission = 0; m.transparent = true; m.opacity = 0.14; m.depthWrite = false; m.roughness = 0.05; m.metalness = 0;
          o.castShadow = false;
        }
        if (m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.05) {
          const kind = /^int /.test(n) ? 'lamp' : /city/.test(n) ? 'city' : 'window';
          glows.push({ m, base: m.emissiveIntensity || 1, kind });
        }
        if (m.map && /leaf|leaves|twig/.test(n)) { m.alphaTest = 0.45; m.transparent = false; m.side = THREE.DoubleSide; o.castShadow = true; }
        if (/\[roof\]/.test(n)) roofs.push(o);
        if (/water/.test(n)) { m.roughness = 0.12; m.metalness = 0; m.envMapIntensity = 0.35; }
        if (/mountain|city/.test(n)) o.castShadow = false;
        if (m.map) m.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      }
    });
  }

  function load(onProgress = () => {}) {
    if (state.loading) return state.loading;
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    state.loading = Promise.all([
      new Promise((res, rej) => loader.load('assets/world/farm.glb', res, (e) => { if (e.total) onProgress(e.loaded / e.total); }, rej)),
      fetch('assets/workshop-3d/nav.json').then((r) => r.json()),
    ]).then(([gltf, navJson]) => {
      nav = new NavGrid(navJson, 0.25);
      prepMaterials(gltf.scene);
      scene.add(gltf.scene);
      state.loaded = true;
      setTime(state.time);
      return true;
    });
    return state.loading;
  }

  /* ---- modes ---- */
  function enter(mode, { yaw = 0 } = {}) {
    const from = state.mode;
    state.mode = mode;
    if (mode === 'walk') {
      // land where you were flying if that's inside the walkable area, otherwise start where the 360 view was taken
      let x = 0, y = 0;
      if (from === 'fly') { const f = nav.nearestFree(state.pos.x, state.pos.y, 20); if (f) [x, y] = f; else state.yaw = 0; }
      else state.yaw = yaw;
      if (!nav.isFree(x, y)) [x, y] = nav.nearestFree(x, y, 40) || [0, 0];
      state.pos.set(x, y, nav.groundAt(x, y)); state.pitch = 0;
      shadowArea(28);
    } else {
      // take off from where you were walking, or start high over the farm
      if (from === 'walk') { state.pos.z += 6; state.pitch = -0.15; }
      else { state.pos.set(-6, -42, 26); state.yaw = 0; state.pitch = -0.38; }
      shadowArea(140);
    }
    state.vel.set(0, 0, 0);
    roofs.forEach((r) => { r.visible = mode !== 'fly'; });
    onChange();
  }

  /** The 360 view's live screens: same canvases (clock, lock screens), drawn on the model's monitor, laptop and
   *  tablet. Their quads are relative to the 360 camera's eye, so they're raised by its height. */
  const SCREEN_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const SCREEN_FRAG = 'precision highp float; uniform sampler2D t; uniform float uGlow; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(t, vUv).rgb * uGlow, 1.0); }';
  function addScreens(list) {
    if (devices.length) return;
    const room = new THREE.Vector3(0, EYE, 0);
    for (const src of list) {
      const geo = src.geometry.clone(); geo.translate(0, EYE, 0);
      const p = geo.attributes.position, a = new THREE.Vector3().fromBufferAttribute(p, 0), b = new THREE.Vector3().fromBufferAttribute(p, 1), c = new THREE.Vector3().fromBufferAttribute(p, 2);
      const nrm = new THREE.Triangle(a, b, c).getNormal(new THREE.Vector3());
      const mid = a.clone().add(c).multiplyScalar(0.5);
      if (nrm.dot(room.clone().sub(mid)) < 0) nrm.negate();
      geo.translate(nrm.x * 0.006, nrm.y * 0.006, nrm.z * 0.006);   // just in front of the model's screen
      const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: { t: { value: src.material.uniforms.tScreen.value }, uGlow: { value: 1 } },
        vertexShader: SCREEN_VERT, fragmentShader: SCREEN_FRAG, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
      mesh.userData.device = src.userData.device; scene.add(mesh); devices.push(mesh);
    }
  }
  const ray = new THREE.Raycaster(); ray.far = 3.2;
  /** the device under a screen point (normalised -1..1), if it's within reach */
  function pick(x = 0, y = 0) {
    if (!devices.length || state.mode !== 'walk') return null;
    ray.setFromCamera(new THREE.Vector2(x, y), camera);
    return ray.intersectObjects(devices)[0]?.object.userData.device || null;
  }
  function shadowArea(r) {
    const c = sun.shadow.camera; c.left = -r; c.right = r; c.top = r; c.bottom = -r; c.near = 1; c.far = 900; c.updateProjectionMatrix();
  }
  function exit() { state.mode = null; input.keys.clear(); input.move.set(0, 0); input.lift = 0; }

  const KEYS = { KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
  function keyAxes() {
    let x = 0, y = 0;
    for (const k of input.keys) if (KEYS[k]) { x += KEYS[k][0]; y += KEYS[k][1]; }
    const len = Math.hypot(x, y) || 1; input.keyMove = [x / len, y / len];
    input.lift = (input.keys.has('Space') || input.keys.has('KeyE') ? 1 : 0) - (input.keys.has('KeyQ') || input.keys.has('KeyC') || input.keys.has('ControlLeft') ? 1 : 0);
    input.run = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
  }
  function key(e, down) {
    if (!state.mode) return false;
    const k = e.code;
    if (!(k in KEYS) && !['Space', 'KeyE', 'KeyQ', 'KeyC', 'ControlLeft', 'ShiftLeft', 'ShiftRight'].includes(k)) return false;
    if (down) input.keys.add(k); else input.keys.delete(k);
    keyAxes(); onChange();
    return true;
  }
  function look(dx, dy) {
    state.yaw -= dx; state.pitch = THREE.MathUtils.clamp(state.pitch - dy, -1.45, 1.45); onChange();
  }

  /* ---- per frame ---- */
  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), want = new THREE.Vector3();
  function update(dt) {
    if (!state.mode || !state.loaded) return false;
    const km = input.keyMove || [0, 0];
    const mx = THREE.MathUtils.clamp(input.move.x + km[0], -1, 1), my = THREE.MathUtils.clamp(input.move.y + km[1], -1, 1);
    // forward and right on the ground, in Blender's plane: yaw 0 looks along +y (out of the front windows)
    const fx = -Math.sin(state.yaw), fy = Math.cos(state.yaw), rx = Math.cos(state.yaw), ry = Math.sin(state.yaw);
    let moving = false;
    if (state.mode === 'walk') {
      const speed = input.run ? 3.4 : 1.6;
      want.set((fx * my + rx * mx) * speed, (fy * my + ry * mx) * speed, 0);
      state.vel.lerp(want, 1 - Math.exp(-10 * dt));
      const nx = state.pos.x + state.vel.x * dt, ny = state.pos.y + state.vel.y * dt;
      // slide along walls: try both axes, then each on its own
      if (nav.isFree(nx, ny)) { state.pos.x = nx; state.pos.y = ny; }
      else if (nav.isFree(nx, state.pos.y)) state.pos.x = nx;
      else if (nav.isFree(state.pos.x, ny)) state.pos.y = ny;
      const g = nav.groundAt(state.pos.x, state.pos.y);
      state.pos.z += (g - state.pos.z) * (1 - Math.exp(-12 * dt));
      moving = state.vel.lengthSq() > 0.01;
      const bob = moving ? Math.sin(performance.now() / 1000 * (input.run ? 11 : 7.5)) * (input.run ? 0.035 : 0.02) : 0;
      camera.position.copy(toThree(state.pos.x, state.pos.y, state.pos.z + EYE + bob));
      state.fov += ((input.run && moving ? 76 : 70) - state.fov) * (1 - Math.exp(-6 * dt));
      sun.position.copy(camera.position).addScaledVector(dirFrom(LIGHTS[state.time].az, LIGHTS[state.time].el), 300);
    } else {
      // superhero flight: move where you look; speed builds up, and the view widens with it
      const speed = input.run ? 60 : 22;
      const cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
      want.set((fx * cp * my + rx * mx) * speed, (fy * cp * my + ry * mx) * speed, (sp * my + input.lift) * speed);
      state.vel.lerp(want, 1 - Math.exp(-3 * dt));
      state.pos.addScaledVector(state.vel, dt);
      state.pos.x = THREE.MathUtils.clamp(state.pos.x, -700, 700); state.pos.y = THREE.MathUtils.clamp(state.pos.y, -700, 700);
      state.pos.z = THREE.MathUtils.clamp(state.pos.z, 2, 260);
      moving = state.vel.lengthSq() > 0.05;
      camera.position.copy(toThree(state.pos.x, state.pos.y, state.pos.z));
      const v = state.vel.length();
      state.fov += (70 + Math.min(22, v * 0.35) - state.fov) * (1 - Math.exp(-4 * dt));
      sun.position.copy(camera.position).addScaledVector(dirFrom(LIGHTS[state.time].az, LIGHTS[state.time].el), 500);
    }
    sun.target.position.copy(camera.position); sun.target.updateMatrixWorld();
    const roll = state.mode === 'fly' ? THREE.MathUtils.clamp(-mx * 0.12, -0.12, 0.12) : 0;
    camera.rotation.set(state.pitch, state.yaw, 0); camera.rotation.z += (roll - camera.rotation.z) * 0.1;
    camera.fov = state.fov; camera.updateProjectionMatrix();
    return moving;
  }

  function render() {
    const tm = renderer.toneMapping, ex = renderer.toneMappingExposure, sh = renderer.shadowMap.enabled;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = LIGHTS[state.time].exposure;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.render(scene, camera);
    renderer.toneMapping = tm; renderer.toneMappingExposure = ex; renderer.shadowMap.enabled = sh;
  }
  function resize(w, h) { camera.aspect = w / h; camera.updateProjectionMatrix(); }

  return { state, input, load, enter, exit, setTime, update, render, resize, key, look, camera, scene, addScreens, pick,
    get active() { return !!state.mode && state.loaded; } };
}
