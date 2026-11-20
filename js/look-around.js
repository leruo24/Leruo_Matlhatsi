import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createRoom, homeView, photoInView as photoRegion } from './room.js';
import { createLivePhoto, PHOTO } from './photo-layer.js';
import { createRenderLoop } from './render-loop.js';
import { spring, FrameBudget } from './motion.js';
import { limitYaw, dragYaw, limitPitch, dragPitch, MAX_PITCH } from './yaw.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#view'), status = $('#status'), screen = $('#screen'), device = $('#device');
const params = new URLSearchParams(location.search);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const coarse = matchMedia('(pointer: coarse)').matches;
const maxRatio = Math.min(devicePixelRatio, coarse ? 1.25 : 1.5);
const budget = new FrameBudget(maxRatio);
let ratio = maxRatio, readout = '', paused = false, photoInView = true;

// look state: yaw/pitch are offsets from the home view, which frames the photo like the main experience
const yaw = { x: 0, v: 0 }, pitch = { x: 0, v: 0 };
let yawTarget = 0, pitchTarget = 0, drag = null, transition = null, zoom = null;
let renderer, scene, camera, room, live, home = { pitch: 0, yaw: 0, fov: 50 };

const loop = createRenderLoop(draw, { enabled: () => !document.hidden && !screen.open });
const wake = () => loop.wake();
const animating = () => !!live && !paused && !reduced.matches;

/* ---- performance readout (?perf): measured, not promised ---- */
const perf = params.has('perf') ? Object.assign(document.createElement('pre'), { id: 'perf' }) : null;
if (perf) document.body.append(perf);
const perfStats = { frames: 0, time: 0, worst: 0, samples: [] };
function reportPerf(elapsed) {
  if (!perf || !(elapsed > 0)) return;
  perfStats.frames++; perfStats.time += elapsed; perfStats.worst = Math.max(perfStats.worst, elapsed);
  perfStats.samples.push(elapsed * 1000); if (perfStats.samples.length > 600) perfStats.samples.shift();
  if (perfStats.time < 0.5) return;
  const s = [...perfStats.samples].sort((a, b) => a - b), p95 = s[Math.floor(s.length * 0.95)] || 0;
  const info = renderer.info;
  perf.textContent = `fps ${(perfStats.frames / perfStats.time).toFixed(1)} · frame ${(perfStats.time / perfStats.frames * 1000).toFixed(1)} ms · p95 ${p95.toFixed(1)} ms · worst ${(perfStats.worst * 1000).toFixed(0)} ms\n`
    + `draw calls ${info.render.calls} · triangles ${info.render.triangles.toLocaleString()} · textures ${info.memory.textures} · pixel ratio ${ratio.toFixed(2)} · ${innerWidth}×${innerHeight}`;
  window.__perf = { fps: perfStats.frames / perfStats.time, frameMs: perfStats.time / perfStats.frames * 1000, p95, calls: info.render.calls, triangles: info.render.triangles, ratio };
  perfStats.frames = 0; perfStats.time = 0; perfStats.worst = 0;
}

function resize() {
  if (!renderer) return;
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  home = homeView(camera.aspect);
  live?.resize(innerWidth * ratio, innerHeight * ratio);
  if (!zoom) camera.fov = home.fov;
  camera.updateProjectionMatrix(); wake();
}

// which part of the photo is on screen right now (image px), and at what resolution
const _d = new THREE.Vector3();
let coreCovers = false;
function visiblePhotoRect() {
  const v = photoRegion(camera, room.coreBounds);
  coreCovers = !!v?.covers;
  if (!v) return null;
  const scale = Math.min(1.5, (innerHeight * ratio / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / PHOTO.F);
  return [...v.rect, scale];
}

function lookRotation(y, p) { return new THREE.Quaternion().setFromEuler(new THREE.Euler(home.pitch + p, home.yaw + y, 0, 'YXZ')); }

function draw(dt, elapsed) {
  if (reduced.matches) { yaw.x = yawTarget; yaw.v = 0; pitch.x = pitchTarget; pitch.v = 0; }
  else { spring(yaw, yawTarget, 10, dt); spring(pitch, pitchTarget, 10, dt); }
  if (renderer) {
    const next = budget.sample(elapsed);
    if (Math.abs(next - ratio) > .001) { ratio = next; renderer.setPixelRatio(ratio); renderer.setSize(innerWidth, innerHeight); live?.resize(innerWidth * ratio, innerHeight * ratio); }
    if (transition) {
      transition.time += Math.min(elapsed, 0.25);   // real time, so a slow device still finishes in about a second
      const t = reduced.matches ? 1 : Math.min(1, transition.time / .9), e = t * t * (3 - 2 * t);
      camera.quaternion.slerpQuaternions(transition.q0, transition.q1, e);
      camera.fov = THREE.MathUtils.lerp(transition.f0, transition.f1, e); camera.updateProjectionMatrix();
      if (t === 1) { const done = transition.done; transition = null; done?.(); }
    } else camera.quaternion.copy(lookRotation(yaw.x, pitch.x));
    renderer.info.reset();
    if (live) {
      camera.updateMatrixWorld();
      const r = window.__room?.flags.nolive ? null : visiblePhotoRect();
      photoInView = !!r;
      if (r) live.update(animating() ? dt : 0, reduced.matches);
      room.shellUniforms.uLiveOn.value = r && live.render(r[0], r[1], r[2], r[3], r[4]) ? 1 : 0;
      // when the photo's opaque core fills the view, the modelled room behind it isn't drawn at all
      room.setModelVisible(!(r && coreCovers));
    }
    renderer.render(scene, camera);
    reportPerf(elapsed);
  } else canvas.style.backgroundPosition = `${50 - yaw.x / Math.PI * 50}% ${50 + pitch.x / MAX_PITCH * 50}%`;
  const nextReadout = `Turn ${Math.round(yaw.x * 180 / Math.PI)}° · Tilt ${Math.round(pitch.x * 180 / Math.PI)}°`;
  if (nextReadout !== readout) { $('#readout').textContent = nextReadout; readout = nextReadout; }
  const settling = !!transition || Math.abs(yaw.x - yawTarget) > .0001 || Math.abs(yaw.v) > .0001 || Math.abs(pitch.x - pitchTarget) > .0001 || Math.abs(pitch.v) > .0001;
  return settling || (animating() && photoInView);
}

const turn = (v) => { if (transition || zoom) return; yawTarget = limitYaw(v); wake(); };
const tilt = (v) => { if (transition || zoom) return; pitchTarget = limitPitch(v); wake(); };
const centre = () => { if (transition || zoom) return; yawTarget = 0; pitchTarget = 0; wake(); };

try {
  if (params.has('nowebgl')) throw new Error('WebGL disabled for testing');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('debug') });
  renderer.setPixelRatio(maxRatio);
  // no tone curve: surfaces sampled from the photo keep the photo's colours under matched light
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
  renderer.info.autoReset = false;
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xd9b89c, 45, 110);
  camera = new THREE.PerspectiveCamera(50, 1, .05, 200);
  const manager = new THREE.LoadingManager(() => { renderer.shadowMap.needsUpdate = true; status.textContent = coarse ? 'Ready.' : 'Ready · arrow keys look around, Home re-centres.'; wake(); });
  const loader = new THREE.TextureLoader(manager);
  live = createLivePhoto({ renderer, loader });
  room = createRoom({ scene, loader, gltf: new GLTFLoader(manager), photoTexture: live, maxAnisotropy: renderer.capabilities.getMaxAnisotropy() });
  room.onChange = () => { renderer.shadowMap.needsUpdate = true; wake(); };
  camera.position.copy(room.eye);
  renderer.shadowMap.needsUpdate = true;
  resize();
  $('#drone-btn').hidden = false; $('#pause').hidden = false;
  if (params.has('debug')) window.__room = { THREE, room, live, renderer, scene, camera, flags: {} };
} catch (error) {
  console.warn('3D room unavailable', error);
  renderer?.dispose(); renderer = null; live = null;
  canvas.style.background = 'url(assets/panorama/workshop-open-door.png) center / auto 150% no-repeat';
  status.textContent = 'Still panorama fallback: image pan only. The 3D room needs WebGL.';
  wake();
}

/* ---- looking around ---- */
canvas.addEventListener('pointerdown', (e) => { if (transition || zoom) return; drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: yawTarget, pitch: pitchTarget }; canvas.setPointerCapture(e.pointerId); canvas.focus(); });
canvas.addEventListener('pointermove', (e) => {
  if (drag?.id === e.pointerId) { turn(dragYaw(drag.yaw, e.clientX - drag.x, innerWidth)); tilt(dragPitch(drag.pitch, e.clientY - drag.y, innerHeight)); return; }
  if (!room || transition || zoom || e.pointerType !== 'mouse') return;
  canvas.style.cursor = hitDevice(e) ? 'pointer' : '';
});
function hitDevice(e) {
  const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, 1 - e.clientY / innerHeight * 2), camera);
  return ray.intersectObjects(room.devices)[0]?.object.userData.device;
}
canvas.addEventListener('pointerup', (e) => {
  if (!drag || transition || zoom || !room || Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) return;
  const kind = hitDevice(e); if (kind) openDevice(kind);
});
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(ev, () => { drag = null; });
addEventListener('keydown', (e) => {
  if (!$('#drone-panel').hidden || transition || screen.open || ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  const k = { ArrowLeft: () => turn(yawTarget + .15), ArrowRight: () => turn(yawTarget - .15), ArrowUp: () => tilt(pitchTarget + .15), ArrowDown: () => tilt(pitchTarget - .15), Home: centre }[e.key];
  if (k) { e.preventDefault(); k(); }
});
$('#left').onclick = () => turn(yawTarget + Math.PI / 4);
$('#right').onclick = () => turn(yawTarget - Math.PI / 4);
$('#centre').onclick = centre;
$('#up').onclick = () => tilt(pitchTarget + Math.PI / 12);
$('#down').onclick = () => tilt(pitchTarget - Math.PI / 12);

/* ---- the PC: turn to face the screen and zoom in, then open it ---- */
function rotateTo(q1, f1, done) { transition = { q0: camera.quaternion.clone(), q1: q1.clone(), f0: camera.fov, f1, time: 0, done }; wake(); }
function openDevice(kind) {
  if (transition || screen.open) return;
  const show = () => { device.title = 'Leruo’s PC'; screen.dataset.kind = kind; device.src = 'os/index.html?embedded=1&crt=0'; screen.showModal(); loop.stop(); };
  if (!room) { show(); return; }
  // a camera looks down -Z: Matrix4.lookAt builds that orientation (Object3D.lookAt would face away)
  const f = room.focus[kind], aim = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(f.position, f.point, camera.up));
  zoom = kind;
  rotateTo(aim, f.fov, show);
}
$('#pc').onclick = () => openDevice('pc');

$('#exit').onclick = () => screen.close();
screen.addEventListener('close', () => {
  device.src = 'about:blank';
  if (!room) { wake(); return; }
  rotateTo(lookRotation(yaw.x, pitch.x), home.fov, () => { zoom = null; });
});

/* ---- scenery pause and the drone ---- */
$('#pause').onclick = () => { paused = !paused; $('#pause').setAttribute('aria-pressed', String(paused)); $('#pause').textContent = paused ? 'Resume scenery' : 'Pause scenery'; wake(); };
const panel = $('#drone-panel'), droneBtn = $('#drone-btn');
function syncFlight() {
  if (!live) return;
  const f = live.flight;
  $('#drone-x').value = f.tx; $('#drone-y').value = 335 - f.ty; $('#drone-angle').value = f.angle * 180 / Math.PI;
  $('#drone-auto').setAttribute('aria-pressed', String(!f.manual));
  $('#drone-status').textContent = f.manual ? 'Manual flight · release the sticks to hover.' : 'Autopilot · move either stick to take control.';
}
const closeFlight = () => { panel.hidden = true; droneBtn.setAttribute('aria-expanded', 'false'); };
droneBtn.onclick = () => {
  if (!panel.hidden) { closeFlight(); return; }
  live?.pilot.take(); panel.hidden = false; droneBtn.setAttribute('aria-expanded', 'true'); syncFlight(); $('#flight-stick').focus();
  if (yawTarget || pitchTarget) centre();   // the drone flies over the farm, in front of you
};
$('#drone-close').onclick = () => { closeFlight(); droneBtn.focus(); };
for (const id of ['#drone-x', '#drone-y', '#drone-angle']) $(id).addEventListener('input', () => {
  live?.pilot.set(Number($('#drone-x').value), 335 - Number($('#drone-y').value), Number($('#drone-angle').value)); syncFlight(); wake();
});
$('#drone-reset').onclick = () => { live?.pilot.reset(); syncFlight(); wake(); };
$('#drone-auto').onclick = () => { live?.pilot.auto(); syncFlight(); wake(); };

addEventListener('resize', resize);
reduced.addEventListener?.('change', wake);
document.addEventListener('visibilitychange', () => { if (document.hidden) loop.stop(); else wake(); });
wake();
