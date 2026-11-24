import * as THREE from 'three';
import { drawLockScreen, PHOTO } from './photo-layer.js';
import { constrainWide } from './drone-control.js';
import { spring, blend } from './motion.js';

/**
 * The look-around workshop: a 360-degree render of the Blender scene (blender/), seen from the
 * same eye as the approved photo, with the live parts layered on top in 3D: the monitor's lock
 * screen (clickable, opens the PC) and the drone. The camera only turns, so a flat quad placed
 * where the monitor is in the scene lines up with the render exactly.
 *
 * The same goes for the laptop and the old Android tablet on the desk (screens.json).
 *
 * The panorama also writes depth: a distance map rendered from the same eye (depth.webp, from
 * blender/render_depth.py) sets each sky-sphere pixel's depth to the real distance of what the
 * render shows there. Anything drawn live (the drone, the walking dogs, the ball) is then hidden
 * by nearer walls, furniture and tree trunks, exactly as if it were in the scene.
 *
 * Coordinates: three.js, relative to the eye (x right, y up, -z straight ahead toward the desk).
 */
export const PANO_DIR = 'assets/workshop-3d/';
/** The four lighting sets rendered in Blender (blender/timeofday.py), one per folder. */
export const TIMES = Object.freeze(['sunrise', 'day', 'sunset', 'night']);
/** Which set matches a local time: sunrise 05:00-07:59, day 08:00-16:29, sunset 16:30-19:29,
 * night otherwise. */
export function timeOfDay(date = new Date()) {
  const m = date.getHours() * 60 + date.getMinutes();
  if (m >= 300 && m < 480) return 'sunrise';
  if (m >= 480 && m < 990) return 'day';
  if (m >= 990 && m < 1170) return 'sunset';
  return 'night';
}
/** Lighting for the live things drawn over the render (drone, birds, sprites), per set. The sun
 * direction matches blender/timeofday.py (azimuth from the front, positive to the right). */
export const LIGHT = Object.freeze({
  sunrise: { az: 62, el: 9, sun: 0xffc49e, sunI: 1.6, sky: 0xb8b4d0, ground: 0x6b5a48, hemiI: 0.9, sprite: 0.88, birds: true },
  day: { az: -35, el: 50, sun: 0xfff4e6, sunI: 2.4, sky: 0xcfe0ff, ground: 0x8a7d62, hemiI: 1.2, sprite: 1.0, birds: true },
  sunset: { az: -28, el: 14, sun: 0xffa060, sunI: 2.0, sky: 0xd9b49a, ground: 0x6e5440, hemiI: 0.85, sprite: 0.9, birds: true },
  night: { az: 35, el: 38, sun: 0x9fb4ff, sunI: 0.25, sky: 0x26304a, ground: 0x0c0d12, hemiI: 0.35, sprite: 0.32, birds: false },
});
export const PANO = Object.freeze({
  low: 'pano-2k.jpg',                                         // 2048x1024, shown first
  mid: ['pano-4k-0.jpg', 'pano-4k-1.jpg'],                    // 4096x2048 in two 2048x2048 halves
  high: ['pano-8k-0.jpg', 'pano-8k-1.jpg', 'pano-8k-2.jpg', 'pano-8k-3.jpg'], // 8192x4096 in quarters
});

// the screens drawn live (monitor, laptop, old tablet): corners and visibility masks exported from
// the Blender scene by blender/export_screens.py. Which device each one opens:
export const SCREEN_DEVICES = Object.freeze({ monitor: 'pc', laptop: 'laptop', tablet: 'tablet' });

/** Direction (three.js, unit vector) -> equirectangular uv of the Blender panorama (v up). */
export function dirToUv(x, y, z) {
  const u = 0.5 + Math.atan2(x, -z) / (2 * Math.PI);
  const v = 0.5 + Math.asin(Math.max(-1, Math.min(1, y))) / Math.PI;
  return [u - Math.floor(u), v];
}

// the distance map: latitude -90 deg up to DEPTH_TOP, distance d = 0.2 * 150000^t (t in 16 bits: r = high byte)
export const DEPTH = Object.freeze({ file: 'depth.webp', top: 40 * Math.PI / 180, near: 0.2, far: 30000 });
export function decodeDepth(r, g) { const t = (r * 256 + g) / 65535; return t >= 0.99999 ? Infinity : DEPTH.near * Math.pow(DEPTH.far / DEPTH.near, t); }

/** Drone flight coordinates -> direction. x, y are the remote's units (photo pixels at the centre of
 * the view): 1000 units = 1 radian of azimuth / elevation, so the drone can circle the whole sky. */
export function droneDir(x, y) {
  const az = (x - PHOTO.CX) / PHOTO.F, el = (PHOTO.YH - y) / PHOTO.F;
  return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}
// where the autopilot wanders: the sky in front of the workshop
export const AUTOPILOT_ZONE = Object.freeze({ left: 330, right: 1480, top: 120, bottom: 260 });

/** Photo pixel (approved image, y down) -> direction from the eye. The Blender front camera matches it. */
export function photoDir(px, py) {
  return new THREE.Vector3((px - PHOTO.CX) / PHOTO.F, (PHOTO.YH - py) / PHOTO.F, -1).normalize();
}

/**
 * The opening view: the approved photo's framing (its centre is 5.9 deg below the horizon),
 * widened to the photo's horizontal field on wide screens and capped on tall ones.
 */
export function homeView(aspect) {
  const photoAspect = PHOTO.W / PHOTO.H;
  const halfH = (PHOTO.H / 2) / PHOTO.F, halfW = (PHOTO.W / 2) / PHOTO.F;
  let fov = aspect >= photoAspect ? 2 * Math.atan(halfW / aspect) : 2 * Math.atan(halfH);
  if (aspect < 1) fov = Math.min(THREE.MathUtils.degToRad(75), 2 * Math.atan(halfW / aspect));
  return { yaw: 0, pitch: -Math.atan((PHOTO.H / 2 - PHOTO.YH) / PHOTO.F), fov: THREE.MathUtils.radToDeg(fov) };
}

const SKY_VERT = /* glsl */ `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w; }`;
const SKY_FRAG = /* glsl */ `precision highp float;
  uniform sampler2D tLow, t0, t1, t2, t3, tDepth; uniform float uTiles, uDepthOn, uDepthTop; uniform vec2 uTileSize; uniform mat4 uProj, uView; varying vec3 vDir;
  const float PI = 3.141592653589793;
  // Catmull-Rom (bicubic) sampling in 9 taps: noticeably crisper than plain bilinear when the
  // panorama is magnified, which it nearly always is on a laptop or phone screen
  vec3 crisp(sampler2D t, vec2 uv, vec2 size){
    vec2 p = uv * size - 0.5, i = floor(p), f = p - i;
    if (p.x < 1.5 || p.x > size.x - 2.5) return texture2D(t, uv).rgb;   // near a tile edge: plain sampling
    vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f)), w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
    vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f)), w3 = f * f * (-0.5 + 0.5 * f);
    vec2 w12 = w1 + w2, a = (i - 0.5) / size, b = (i + 0.5 + w2 / w12) / size, c = (i + 2.5) / size;
    vec3 r = (texture2D(t, vec2(a.x, a.y)).rgb * w0.x + texture2D(t, vec2(b.x, a.y)).rgb * w12.x + texture2D(t, vec2(c.x, a.y)).rgb * w3.x) * w0.y
           + (texture2D(t, vec2(a.x, b.y)).rgb * w0.x + texture2D(t, vec2(b.x, b.y)).rgb * w12.x + texture2D(t, vec2(c.x, b.y)).rgb * w3.x) * w12.y
           + (texture2D(t, vec2(a.x, c.y)).rgb * w0.x + texture2D(t, vec2(b.x, c.y)).rgb * w12.x + texture2D(t, vec2(c.x, c.y)).rgb * w3.x) * w3.y;
    return clamp(r, 0.0, 1.0);
  }
  void main(){
    vec3 d = normalize(vDir);
    float u = fract(0.5 + atan(d.x, -d.z) / (2.0 * PI));
    float v = 0.5 + asin(clamp(d.y, -1.0, 1.0)) / PI;
    vec3 c;
    if (uTiles < 1.5) c = texture2D(tLow, vec2(u, v)).rgb;
    else {
      float k = u * uTiles, i = floor(k); vec2 q = vec2(k - i, v);
      vec2 sz = uTileSize;
      if (i < 0.5) c = crisp(t0, q, sz); else if (i < 1.5) c = crisp(t1, q, sz);
      else if (i < 2.5) c = crisp(t2, q, sz); else c = crisp(t3, q, sz);
    }
    gl_FragColor = vec4(c, 1.0);
    // depth of what the render shows here (sky and anything past 190 m: the far plane)
    float lat = asin(clamp(d.y, -1.0, 1.0)), dist = 1e9;
    if (uDepthOn > 0.5 && lat < uDepthTop) {
      vec3 e = texture2D(tDepth, vec2(u, (lat + 0.5 * PI) / (uDepthTop + 0.5 * PI))).rgb;
      float t = (floor(e.r * 255.0 + 0.5) * 256.0 + floor(e.g * 255.0 + 0.5)) / 65535.0;
      if (t < 0.99999) dist = 0.2 * pow(150000.0, t);
    }
    if (dist < 190.0) { vec4 clip = uProj * uView * vec4(d * dist, 1.0); gl_FragDepth = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0); }
    else gl_FragDepth = 0.9999999;
  }`;

export function createPanoView({ scene, loader, renderer, camera, onChange = () => {}, time = timeOfDay() }) {
  if (!TIMES.includes(time)) time = timeOfDay();
  const dir = () => PANO_DIR + time + '/';
  const prep = (t) => { t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 1; return t; };
  const blank = new THREE.DataTexture(new Uint8Array([24, 30, 24, 255]), 1, 1); blank.needsUpdate = true;
  const uniforms = { tLow: { value: blank }, t0: { value: blank }, t1: { value: blank }, t2: { value: blank }, t3: { value: blank }, uTiles: { value: 1 }, uTileSize: { value: new THREE.Vector2(2048, 4096) },
    tDepth: { value: blank }, uDepthOn: { value: 0 }, uDepthTop: { value: DEPTH.top }, uProj: { value: camera.projectionMatrix }, uView: { value: camera.matrixWorldInverse } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(50, 96, 48), new THREE.ShaderMaterial({ uniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: true }));   // writes the depth map's depth (see SKY_FRAG)
  sky.renderOrder = -1; sky.frustumCulled = false; scene.add(sky);

  // low-resolution panorama first, then the sharp tiles for this device (one lighting set at a time)
  const maxTex = renderer.capabilities.maxTextureSize;
  // 8K wherever the GPU allows it, phones included: a phone shows a narrow slice of the room on a dense
  // screen, so the 4K set looked soft there. 4K only where 4096 px textures aren't supported.
  const set = maxTex >= 4096 ? PANO.high : PANO.mid;
  let loadId = 0;
  // callbacks for when the sharp tiles are on screen (the page holds back less urgent downloads until then)
  const sharp = []; let isSharp = false;
  const whenSharp = (cb) => { if (isSharp) cb(); else sharp.push(cb); };
  function loadSet() {
    const id = ++loadId;
    const L = id === 1 ? loader : new THREE.TextureLoader();   // only the first load counts toward 'Ready'
    const low = L.load(dir() + PANO.low, () => { if (id === loadId) { uniforms.tLow.value = prep(low); uniforms.uTiles.value = 1; onChange(); } });
    let loaded = 0;
    const tiles = set.map((name) => new THREE.TextureLoader().load(dir() + name, () => {
      if (id !== loadId) return;
      if (++loaded === set.length) { tiles.forEach((t, j) => { uniforms['t' + j].value = prep(t); }); uniforms.uTileSize.value.set(tiles[0].image.width, tiles[0].image.height); uniforms.uTiles.value = set.length; onChange(); if (!isSharp) { isSharp = true; sharp.splice(0).forEach((cb) => cb()); } }
    }));
  }
  loadSet();
  // the distance map (nearest filtering: never blend a near edge with the far background)
  const depthTex = new THREE.TextureLoader().load(PANO_DIR + DEPTH.file, () => { uniforms.tDepth.value = depthTex; uniforms.uDepthOn.value = 1; onChange(); });
  depthTex.colorSpace = THREE.NoColorSpace; depthTex.minFilter = depthTex.magFilter = THREE.NearestFilter; depthTex.generateMipmaps = false;
  const quality = () => (uniforms.uTiles.value > 1 ? (set === PANO.high ? '8K' : '4K') : 'preview');

  // the screens: flat quads exactly where the monitor, laptop and tablet screens are in the scene,
  // each showing its lock screen, each cut by a mask so the chair (or anything else in front) stays in front
  const wallpaper = new Image(); wallpaper.src = 'assets/workshop.jpg';
  let lastMinute = -1; wallpaper.onload = () => { lastMinute = -1; onChange(); };
  const blankMask = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); blankMask.needsUpdate = true;
  const screens = [], devices = [], focus = {};
  const SCREEN_FRAG = `precision highp float; uniform sampler2D tScreen, tMask; uniform vec4 uMaskRect; uniform float uGlow; varying vec2 vUv; varying vec3 vPos;
      const float PI = 3.141592653589793;
      void main(){ vec3 c = texture2D(tScreen, vUv).rgb; vec2 d = vUv - 0.5; c *= (0.86 - 0.34 * dot(d, d)) * uGlow;
        c = mix(vec3(0.012), c, smoothstep(0.0, 0.004, vUv.x) * smoothstep(1.0, 0.996, vUv.x) * smoothstep(0.0, 0.006, vUv.y) * smoothstep(1.0, 0.994, vUv.y));
        vec3 dir = normalize(vPos);
        vec2 p = vec2(fract(0.5 + atan(dir.x, -dir.z) / (2.0 * PI)), 0.5 + asin(clamp(dir.y, -1.0, 1.0)) / PI);
        float a = texture2D(tMask, (p - uMaskRect.xy) / (uMaskRect.zw - uMaskRect.xy)).r;
        gl_FragColor = vec4(c, a); }`;
  function addScreen(key, info) {
    const size = key === 'tablet' ? [500, 800] : key === 'laptop' ? [800, 500] : [1024, 576];
    const canvas = document.createElement('canvas'); [canvas.width, canvas.height] = size;
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.NoColorSpace;
    const q = info.quad.map((p) => new THREE.Vector3(...p));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([...q[3].toArray(), ...q[2].toArray(), ...q[1].toArray(), ...q[0].toArray()], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: { tScreen: { value: tex }, tMask: { value: blankMask }, uMaskRect: { value: new THREE.Vector4(...info.rect) }, uGlow: { value: key === 'tablet' ? 0.92 : 1 } },
      side: THREE.DoubleSide, transparent: true, depthWrite: false, depthTest: false,   // the mask does the occlusion here
      vertexShader: `varying vec2 vUv; varying vec3 vPos; void main(){ vUv = uv; vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: SCREEN_FRAG,
    }));
    const device = SCREEN_DEVICES[key];
    mesh.userData.device = device; mesh.userData.screen = key; scene.add(mesh);
    mesh.material.uniforms.tMask.value = prep(loader.load(PANO_DIR + info.mask, onChange));
    const centre = q.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(0.25);
    const h = q[0].distanceTo(q[3]);
    focus[device] = { position: new THREE.Vector3(), point: centre, fov: THREE.MathUtils.radToDeg(2 * Math.atan((h / 0.62) / 2 / centre.length())) };
    screens.push({ key, canvas, tex, mesh }); devices.push(mesh);
  }
  const screensReady = fetch(PANO_DIR + 'screens.json').then((r) => r.json()).then((j) => {
    for (const [key, info] of Object.entries(j)) addScreen(key, info);
    lastMinute = -1; onChange();
  }).catch((e) => console.warn('Screens unavailable', e));
  function drawScreens() {
    for (const sc of screens) {
      if (sc.key === 'tablet') drawAndroidLock(sc.canvas); else drawLockScreen(sc.canvas, wallpaper);
      sc.tex.needsUpdate = true;
    }
  }

  // the drone: same remote and autopilot as the main experience, but free to circle the whole
  // workshop 12 m out. The depth map hides it behind the walls, roof and tree trunks; through the
  // back window you can still see it.
  const DRONE_D = 12.0;
  const drone = buildDrone(); drone.renderOrder = 2; scene.add(drone);
  // light for the live 3D things, matched to the render's sun and sky for the current set
  const sun = new THREE.DirectionalLight(0xffffff, 2); const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  scene.add(sun, hemi);
  const birds = createBirds(); scene.add(birds.group);
  function applyLight() {
    const L = LIGHT[time], a = THREE.MathUtils.degToRad(L.az), e = THREE.MathUtils.degToRad(L.el);
    sun.position.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)).multiplyScalar(50);
    sun.color.set(L.sun); sun.intensity = L.sunI; hemi.color.set(L.sky); hemi.groundColor.set(L.ground); hemi.intensity = L.hemiI;
    drone.userData.lights.forEach((m) => { m.visible = time === 'night' || time === 'sunrise'; });
    birds.group.visible = L.birds;
  }
  applyLight();
  const flight = { x: 1035, y: 173, tx: 1035, ty: 173, vx: 0, vy: 0, tilt: 0, next: 0, manual: false, angle: 0, rotation: 0 };
  const sx = { x: 1035, v: 0 }, sy = { x: 173, v: 0 };
  const rand = (a, b) => a + Math.random() * (b - a);
  function updateDrone(dt, t, reduced) {
    const d = flight;
    if (!d.manual && t > d.next) { d.tx = rand(AUTOPILOT_ZONE.left, AUTOPILOT_ZONE.right); d.ty = rand(AUTOPILOT_ZONE.top, AUTOPILOT_ZONE.bottom); d.next = t + rand(4, 9); }
    const b = constrainWide(d.tx, d.ty, d.angle); d.tx = b.x; d.ty = b.y; d.angle = b.angle;
    if (reduced) { d.x = d.tx; d.y = d.ty; d.vx = d.vy = 0; d.rotation = d.angle; }
    else {
      sx.x = d.x; sx.v = d.vx; sy.x = d.y; sy.v = d.vy;
      const k = d.manual ? 3.2 : 0.8;
      d.x = spring(sx, d.tx, k, dt); d.vx = sx.v; d.y = spring(sy, d.ty, k * 1.1, dt); d.vy = sy.v;
      d.tilt += (-d.vx * 0.004 - d.tilt) * blend(3, dt);
      d.rotation += (d.angle - d.rotation) * blend(5, dt);
    }
    const dir = droneDir(d.x, d.y + (reduced ? 0 : Math.sin(t * 1.9) * 1.2));
    drone.position.copy(dir).multiplyScalar(DRONE_D);
    drone.lookAt(0, 0, 0);
    drone.rotateZ(d.rotation + d.tilt);
    drone.rotateX(0.32 + Math.max(-0.2, Math.min(0.2, d.vy * 0.002)));   // seen a little from above, nose dipping as it climbs
    const scale = Math.min(1.1, 0.75 + (d.y - 120) / 95 * 0.35);
    drone.scale.setScalar(scale * 2.4);
    for (const r of drone.userData.rotors) r.rotation.y += dt * (reduced ? 0 : 60) * r.userData.spin;
  }
  updateDrone(0, 0, true);

  let clock = 0;
  return {
    sky, drone, birds, devices, focus, flight, quality, screensReady, whenSharp,
    get time() { return time; },
    /** switch to another lighting set (sunrise, day, sunset, night) */
    setTime(t) { if (!TIMES.includes(t) || t === time) return; time = t; applyLight(); loadSet(); onChange(); },
    screen(key) { return screens.find((s) => s.key === key)?.mesh; },
    get depthReady() { return uniforms.uDepthOn.value > 0.5; },
    update(dt, reduced) {
      clock += dt;
      updateDrone(dt, clock, reduced);
      birds.update(dt, clock, reduced);
      const m = new Date().getMinutes();
      if (m !== lastMinute && screens.length) { lastMinute = m; drawScreens(); }
    },
    pilot: {
      set(x, y, angleDeg) { const f = constrainWide(x, y, angleDeg * Math.PI / 180); Object.assign(flight, { manual: true, tx: f.x, ty: f.y, angle: f.angle }); },
      reset() { Object.assign(flight, { manual: true, tx: 1035, ty: 173, angle: 0 }); },
      auto() { Object.assign(flight, { manual: false, angle: 0, next: -1 }); },
      take() { Object.assign(flight, { manual: true, tx: flight.x, ty: flight.y }); },
    },
  };
}

/** A small quadcopter, about 35 cm across, built from primitives and lit like the scene: dark grey
 * body and arms, four motors with spinning two-blade props and their motion-blur discs, a camera on
 * a gimbal at the front, navigation LEDs (only lit in the dark). Front is +Z. */
function buildDrone() {
  const g = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.45, metalness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x121316, roughness: 0.5, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.1, 6, 16), shell); body.rotation.x = Math.PI / 2; body.scale.set(1.15, 1, 0.55); g.add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.025, 0.12), dark); top.position.y = 0.03; g.add(top);
  const rotors = [], lights = [];
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, 0.16), shell);
    arm.position.set(sx * 0.065, 0.004, sz * 0.065); arm.rotation.y = Math.atan2(sx, sz); g.add(arm);
    const mx = sx * 0.12, mz = sz * 0.12;
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.026, 16), dark); motor.position.set(mx, 0.012, mz); g.add(motor);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.05, 6), dark); leg.position.set(mx, -0.025, mz); g.add(leg);
    const rotor = new THREE.Group(); rotor.position.set(mx, 0.028, mz); rotor.userData.spin = sx * sz;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.002, 0.014), dark); rotor.add(blade);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.075, 32), new THREE.MeshBasicMaterial({ color: 0x9aa3ad, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
    disc.rotation.x = -Math.PI / 2; rotor.add(disc); g.add(rotor); rotors.push(rotor);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), new THREE.MeshBasicMaterial({ color: sz > 0 ? 0xffffff : sx > 0 ? 0x33ff55 : 0xff3322 }));
    led.position.set(mx, -0.004, mz + sz * 0.018); g.add(led); lights.push(led);
  }
  const gimbal = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), dark); gimbal.position.set(0, -0.022, 0.085); g.add(gimbal);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.01, 16), new THREE.MeshStandardMaterial({ color: 0x0a1020, roughness: 0.05, metalness: 0.8 }));
  lens.position.set(0, -0.022, 0.107); g.add(lens);
  g.userData = { rotors, lights };
  return g;
}

/** A loose flock of small birds wheeling over the farm, 40-90 m out: flat wing pairs that flap. */
function createBirds(n = 9) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0x1b1d20, side: THREE.DoubleSide });
  const birds = [];
  for (let i = 0; i < n; i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(18), 3));
    const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; group.add(m);
    birds.push({ m, geo, off: [Math.random() * 6 - 3, Math.random() * 2 - 1, Math.random() * 6 - 3], phase: Math.random() * 6.28, rate: 7 + Math.random() * 3, size: 0.35 + Math.random() * 0.15 });
  }
  const centre = new THREE.Vector3(), fwd = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  return {
    group,
    update(dt, t, reduced) {
      if (!group.visible) return;
      // the flock's centre drifts on a big slow loop in front of and around the workshop
      const a = t * 0.045, r = 60 + 15 * Math.sin(t * 0.07);
      centre.set(Math.sin(a) * r, 14 + 5 * Math.sin(t * 0.11), -Math.cos(a) * r);
      fwd.set(Math.cos(a), 0, Math.sin(a)); side.crossVectors(up, fwd).normalize();
      for (const b of birds) {
        const flap = reduced ? 0.2 : Math.sin(t * b.rate + b.phase) * (0.5 + 0.5 * (Math.sin(t * 0.6 + b.phase) > -0.3 ? 1 : 0.1));
        const p = centre.clone().addScaledVector(side, b.off[0] + Math.sin(t * 0.3 + b.phase)).addScaledVector(fwd, b.off[2]);
        p.y += b.off[1] + 0.4 * Math.sin(t * 0.5 + b.phase);
        const s = b.size, tip = flap * s * 0.8;
        const v = (o, ds, dy, df) => [p.x + side.x * ds + fwd.x * df, p.y + dy, p.z + side.z * ds + fwd.z * df];
        const pos = b.geo.attributes.position.array;
        // left wing, right wing: shoulder front, shoulder back, tip
        pos.set([...v(0, 0, 0, 0.1 * s), ...v(0, 0, 0, -0.12 * s), ...v(0, -s, tip, -0.05 * s),
          ...v(0, 0, 0, 0.1 * s), ...v(0, 0, 0, -0.12 * s), ...v(0, s, tip, -0.05 * s)]);
        b.geo.attributes.position.needsUpdate = true;
      }
    },
  };
}

/** The old Android tablet's lock screen (about 2012): dark wallpaper with faint diagonal lines, a big
 * thin clock, the date, the unlock ring and the black system bar with its outline keys. No logos. */
export function drawAndroidLock(canvas, now = new Date()) {
  const g = canvas.getContext('2d'), W = canvas.width, H = canvas.height, bar = H * 0.09;
  const bg = g.createRadialGradient(W * 0.2, H * 0.1, 0, W * 0.3, H * 0.3, W * 0.9);
  bg.addColorStop(0, '#17324a'); bg.addColorStop(0.5, '#0b1622'); bg.addColorStop(1, '#030507');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(51,181,229,0.06)'; g.lineWidth = 1;
  for (let x = -H; x < W; x += 46) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + H * 0.47, 0); g.stroke(); }
  const hh = String(now.getHours()).padStart(2, '0'), mm = String(now.getMinutes()).padStart(2, '0');
  g.fillStyle = '#f2f4f6'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = `200 ${Math.round(Math.min(H * 0.3, W * 0.3))}px Roboto, "Helvetica Neue", Arial, sans-serif`;
  g.fillText(`${hh}:${mm}`, W / 2, H * 0.44);
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  g.font = `400 ${Math.round(Math.min(H * 0.04, W * 0.045))}px Roboto, Arial, sans-serif`; g.fillStyle = '#9aa0a6';
  g.fillText(`${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]}`, W / 2, H * 0.52);
  // unlock ring with a padlock
  const cx = W / 2, cy = H * 0.72, r = Math.min(H, W * 1.6) * 0.1;
  g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(cx - r * 0.22, cy - r * 0.05, r * 0.44, r * 0.34);
  g.beginPath(); g.arc(cx, cy - r * 0.05, r * 0.15, Math.PI, 0); g.stroke();
  // system bar
  g.fillStyle = '#000'; g.fillRect(0, H - bar, W, bar);
  g.strokeStyle = '#d8d8d8'; g.lineWidth = 2.5; const ky = H - bar / 2, ks = bar * 0.28;
  g.beginPath(); g.moveTo(W * 0.12 + ks, ky - ks * 0.6); g.lineTo(W * 0.12 - ks, ky); g.lineTo(W * 0.12 + ks, ky + ks * 0.6); g.stroke();
  g.strokeRect(W * 0.22 - ks * 0.8, ky - ks * 0.4, ks * 1.6, ks * 1.1);
  g.beginPath(); g.moveTo(W * 0.22 - ks, ky - ks * 0.3); g.lineTo(W * 0.22, ky - ks * 1.1); g.lineTo(W * 0.22 + ks, ky - ks * 0.3); g.stroke();
  g.strokeRect(W * 0.32 - ks * 0.7, ky - ks * 0.5, ks * 1.4, ks * 1.1);
  g.strokeRect(W * 0.32 - ks * 0.4, ky - ks * 0.85, ks * 1.4, ks * 1.1);
  g.fillStyle = '#e8e8e8'; g.textAlign = 'right'; g.font = `300 ${Math.round(bar * 0.42)}px Roboto, Arial, sans-serif`;
  g.fillText(`${hh}:${mm}`, W - bar * 0.4, ky + bar * 0.15);
  g.fillStyle = '#33b5e5'; g.fillRect(W - bar * 2.0, ky - bar * 0.18, bar * 0.22, bar * 0.4);
}
