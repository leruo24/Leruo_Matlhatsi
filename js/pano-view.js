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
 * The panorama also writes depth: a distance map rendered from the same eye (depth.png, from
 * blender/render_depth.py) sets each sky-sphere pixel's depth to the real distance of what the
 * render shows there. Anything drawn live (the drone, the walking dogs, the ball) is then hidden
 * by nearer walls, furniture and tree trunks, exactly as if it were in the scene.
 *
 * Coordinates: three.js, relative to the eye (x right, y up, -z straight ahead toward the desk).
 */
export const PANO_DIR = 'assets/workshop-3d/';
export const PANO = Object.freeze({
  low: 'pano-2k.jpg',                                         // 2048x1024, shown first
  mid: ['pano-4k-0.jpg', 'pano-4k-1.jpg'],                    // 4096x2048 in two 2048x2048 halves
  high: ['pano-8k-0.jpg', 'pano-8k-1.jpg', 'pano-8k-2.jpg', 'pano-8k-3.jpg'], // 8192x4096 in quarters
});

// where the screen is actually visible (not hidden behind the chair): a mask rendered in panorama
// space, covering uv [u0, u1] x [v0, v1] of the panorama (v up)
export const MONITOR_MASK = Object.freeze({ file: 'monitor-mask.png', rect: [0.486173, 0.442415, 0.537491, 0.489237] });

// the monitor's screen in the Blender scene (exported from blender/workshop.blend): TL, TR, BR, BL
export const MONITOR_QUAD = Object.freeze([[-0.2525, -0.19, -4.084], [0.8235, -0.19, -3.8553], [0.8235, -0.67, -3.8553], [-0.2525, -0.67, -4.084]]);

/** Direction (three.js, unit vector) -> equirectangular uv of the Blender panorama (v up). */
export function dirToUv(x, y, z) {
  const u = 0.5 + Math.atan2(x, -z) / (2 * Math.PI);
  const v = 0.5 + Math.asin(Math.max(-1, Math.min(1, y))) / Math.PI;
  return [u - Math.floor(u), v];
}

// the distance map: latitude -90 deg up to DEPTH_TOP, distance d = 0.2 * 150000^t (t in 16 bits: r = high byte)
export const DEPTH = Object.freeze({ file: 'depth.png', top: 40 * Math.PI / 180, near: 0.2, far: 30000 });
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
  uniform sampler2D tLow, t0, t1, t2, t3, tDepth; uniform float uTiles, uDepthOn, uDepthTop; uniform mat4 uProj, uView; varying vec3 vDir;
  const float PI = 3.141592653589793;
  void main(){
    vec3 d = normalize(vDir);
    float u = fract(0.5 + atan(d.x, -d.z) / (2.0 * PI));
    float v = 0.5 + asin(clamp(d.y, -1.0, 1.0)) / PI;
    vec3 c;
    if (uTiles < 1.5) c = texture2D(tLow, vec2(u, v)).rgb;
    else {
      float k = u * uTiles, i = floor(k); vec2 q = vec2(k - i, v);
      if (i < 0.5) c = texture2D(t0, q).rgb; else if (i < 1.5) c = texture2D(t1, q).rgb;
      else if (i < 2.5) c = texture2D(t2, q).rgb; else c = texture2D(t3, q).rgb;
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

export function createPanoView({ scene, loader, renderer, camera, onChange = () => {} }) {
  const prep = (t) => { t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 1; return t; };
  const blank = new THREE.DataTexture(new Uint8Array([24, 30, 24, 255]), 1, 1); blank.needsUpdate = true;
  const uniforms = { tLow: { value: blank }, t0: { value: blank }, t1: { value: blank }, t2: { value: blank }, t3: { value: blank }, uTiles: { value: 1 },
    tDepth: { value: blank }, uDepthOn: { value: 0 }, uDepthTop: { value: DEPTH.top }, uProj: { value: camera.projectionMatrix }, uView: { value: camera.matrixWorldInverse } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(50, 96, 48), new THREE.ShaderMaterial({ uniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: true }));   // writes the depth map's depth (see SKY_FRAG)
  sky.renderOrder = -1; sky.frustumCulled = false; scene.add(sky);

  // low-resolution panorama first, then the sharp tiles for this device
  uniforms.tLow.value = prep(loader.load(PANO_DIR + PANO.low, onChange));
  const maxTex = renderer.capabilities.maxTextureSize;
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const set = maxTex >= 4096 && !coarse ? PANO.high : PANO.mid;
  let loaded = 0;
  const tiles = set.map((name, i) => prep(new THREE.TextureLoader().load(PANO_DIR + name, () => {
    if (++loaded === set.length) { tiles.forEach((t, j) => { uniforms['t' + j].value = t; }); uniforms.uTiles.value = set.length; onChange(); }
  })));
  // the distance map (nearest filtering: never blend a near edge with the far background)
  const depthTex = new THREE.TextureLoader().load(PANO_DIR + DEPTH.file, () => { uniforms.tDepth.value = depthTex; uniforms.uDepthOn.value = 1; onChange(); });
  depthTex.colorSpace = THREE.NoColorSpace; depthTex.minFilter = depthTex.magFilter = THREE.NearestFilter; depthTex.generateMipmaps = false;
  const quality = () => (uniforms.uTiles.value > 1 ? (set === PANO.high ? '8K' : '4K') : 'preview');

  // the monitor: a quad exactly where the screen is in the scene, showing the lock screen
  const screenCanvas = document.createElement('canvas'); screenCanvas.width = 1024; screenCanvas.height = 576;
  const screenTex = new THREE.CanvasTexture(screenCanvas); screenTex.colorSpace = THREE.NoColorSpace;
  const wallpaper = new Image(); wallpaper.src = 'assets/workshop.jpg';
  let lastMinute = -1; wallpaper.onload = () => { lastMinute = -1; onChange(); };
  const blankMask = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); blankMask.needsUpdate = true;
  const q = MONITOR_QUAD.map((p) => new THREE.Vector3(...p));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([...q[3].toArray(), ...q[2].toArray(), ...q[1].toArray(), ...q[0].toArray()], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const screen = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms: { tScreen: { value: screenTex }, tMask: { value: blankMask }, uMaskRect: { value: new THREE.Vector4(...MONITOR_MASK.rect) } },
    side: THREE.DoubleSide, transparent: true, depthWrite: false, depthTest: false,   // the chair mask does the occlusion here
    vertexShader: `varying vec2 vUv; varying vec3 vPos; void main(){ vUv = uv; vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    // a lit panel seen at golden hour: dimmed toward the corners, a hair of edge falloff
    fragmentShader: `precision highp float; uniform sampler2D tScreen, tMask; uniform vec4 uMaskRect; varying vec2 vUv; varying vec3 vPos;
      const float PI = 3.141592653589793;
      void main(){ vec3 c = texture2D(tScreen, vUv).rgb; vec2 d = vUv - 0.5; c *= 0.86 - 0.34 * dot(d, d);
        c = mix(vec3(0.012), c, smoothstep(0.0, 0.004, vUv.x) * smoothstep(1.0, 0.996, vUv.x) * smoothstep(0.0, 0.006, vUv.y) * smoothstep(1.0, 0.994, vUv.y));
        vec3 dir = normalize(vPos);
        vec2 p = vec2(fract(0.5 + atan(dir.x, -dir.z) / (2.0 * PI)), 0.5 + asin(clamp(dir.y, -1.0, 1.0)) / PI);
        float a = texture2D(tMask, (p - uMaskRect.xy) / (uMaskRect.zw - uMaskRect.xy)).r;
        gl_FragColor = vec4(c, a); }`,
  }));
  screen.userData.device = 'pc'; scene.add(screen);
  screen.material.uniforms.tMask.value = prep(loader.load(PANO_DIR + MONITOR_MASK.file, onChange));
  const centre = q.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(0.25);
  const screenH = q[0].distanceTo(q[3]);
  const focus = { pc: { position: new THREE.Vector3(), point: centre, fov: THREE.MathUtils.radToDeg(2 * Math.atan((screenH / 0.62) / 2 / centre.length())) } };

  // the drone: same remote and autopilot as the main experience, but free to circle the whole
  // workshop 12 m out. The depth map hides it behind the walls, roof and tree trunks; through the
  // back window you can still see it.
  const DRONE_D = 12.0;
  const droneTex = prep(loader.load('assets/drone.png'));
  const drone = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.26), new THREE.MeshBasicMaterial({ map: droneTex, transparent: true, depthWrite: false }));
  drone.renderOrder = 2; scene.add(drone);
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
    const scale = Math.min(1.1, 0.75 + (d.y - 120) / 95 * 0.35);
    drone.scale.setScalar(scale * 0.075 * DRONE_D);
  }
  updateDrone(0, 0, true);

  let time = 0;
  return {
    sky, screen, drone, devices: [screen], focus, flight, quality,
    get depthReady() { return uniforms.uDepthOn.value > 0.5; },
    update(dt, reduced) {
      time += dt;
      updateDrone(dt, time, reduced);
      const m = new Date().getMinutes();
      if (m !== lastMinute) { lastMinute = m; drawLockScreen(screenCanvas, wallpaper); screenTex.needsUpdate = true; }
    },
    pilot: {
      set(x, y, angleDeg) { const f = constrainWide(x, y, angleDeg * Math.PI / 180); Object.assign(flight, { manual: true, tx: f.x, ty: f.y, angle: f.angle }); },
      reset() { Object.assign(flight, { manual: true, tx: 1035, ty: 173, angle: 0 }); },
      auto() { Object.assign(flight, { manual: false, angle: 0, next: -1 }); },
      take() { Object.assign(flight, { manual: true, tx: flight.x, ty: flight.y }); },
    },
  };
}
