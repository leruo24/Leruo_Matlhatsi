import * as THREE from 'three';
import { createPanoView, homeView, PANO, PANO_DIR } from './pano-view.js';
import { createDogs } from './dogs.js';
import { createCows } from './cows.js';
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
let ratio = maxRatio, readout = '', paused = false;

// look state: yaw/pitch are offsets from the home view, which frames the scene like the main experience's photo
const yaw = { x: 0, v: 0 }, pitch = { x: 0, v: 0 };
let yawTarget = 0, pitchTarget = 0, drag = null, transition = null, zoom = null;
let renderer, scene, camera, pano, dogs, cows, home = { pitch: 0, yaw: 0, fov: 50 };
// barks only (the main experience's full soundscape is tuned to the photo): the same CC0 recordings,
// loaded on the first click, panned to where the dog is; off if sound is switched off on the main page
const sound = {
  ctx: null, buf: {},
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { if (localStorage.getItem('lm-sound') === 'off') return; } catch {}
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    for (const n of ['bark1', 'bark2', 'bark3']) fetch(`assets/audio/${n}.mp3`).then((r) => r.arrayBuffer()).then((a) => this.ctx.decodeAudioData(a)).then((b) => { this.buf[n] = b; }).catch(() => {});
  },
  dog(i, x) {
    const b = this.buf[['bark1', 'bark2', 'bark3'][i]]; if (!this.ctx || !b) return;
    const s = this.ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = [1.0, 0.92, 1.12][i];
    const g = this.ctx.createGain(); g.gain.value = [0.5, 0.55, 0.45][i];
    const p = this.ctx.createStereoPanner(); p.pan.value = Math.max(-0.9, Math.min(0.9, (x - 835) / 920));
    s.connect(g).connect(p).connect(this.ctx.destination); s.start();
  },
};
canvas.addEventListener('pointerdown', () => sound.start(), { once: true });

const loop = createRenderLoop(draw, { enabled: () => !document.hidden && !screen.open });
const wake = () => loop.wake();
const animating = () => !!pano && !paused && !reduced.matches;

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
  if (!zoom) camera.fov = home.fov;
  camera.updateProjectionMatrix(); wake();
}

// the drone only needs frames while it's on screen
const frustum = new THREE.Frustum(), _m = new THREE.Matrix4();
function droneInView() {
  camera.updateMatrixWorld();
  frustum.setFromProjectionMatrix(_m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  return frustum.containsPoint(pano.drone.position);
}

function lookRotation(y, p) { return new THREE.Quaternion().setFromEuler(new THREE.Euler(home.pitch + p, home.yaw + y, 0, 'YXZ')); }

function draw(dt, elapsed) {
  if (reduced.matches) { yaw.x = yawTarget; yaw.v = 0; pitch.x = pitchTarget; pitch.v = 0; }
  else { spring(yaw, yawTarget, 10, dt); spring(pitch, pitchTarget, 10, dt); }
  if (renderer) {
    const next = budget.sample(elapsed);
    if (Math.abs(next - ratio) > .001) { ratio = next; renderer.setPixelRatio(ratio); renderer.setSize(innerWidth, innerHeight); }
    if (transition) {
      transition.time += Math.min(elapsed, 0.25);   // real time, so a slow device still finishes in about a second
      const t = reduced.matches ? 1 : Math.min(1, transition.time / .9), e = t * t * (3 - 2 * t);
      camera.quaternion.slerpQuaternions(transition.q0, transition.q1, e);
      camera.fov = THREE.MathUtils.lerp(transition.f0, transition.f1, e); camera.updateProjectionMatrix();
      if (t === 1) { const done = transition.done; transition = null; done?.(); }
    } else camera.quaternion.copy(lookRotation(yaw.x, pitch.x));
    if (!transition && !drag && !zoom) { followDrone(); followDog(); }
    renderer.info.reset();
    pano.update(animating() ? dt : 0, reduced.matches);
    dogs.update(animating() ? dt : 0, reduced.matches, pano.depthReady);
    cows.update(animating() ? dt : 0, reduced.matches, pano.depthReady);
    placeDogCard();
    renderer.render(scene, camera);
    drawBubbles();
    reportPerf(elapsed);
  } else canvas.style.backgroundPosition = `${50 - yaw.x / Math.PI * 50}% ${50 + pitch.x / MAX_PITCH * 50}%`;
  const nextReadout = `Turn ${Math.round(yaw.x * 180 / Math.PI)}° · Tilt ${Math.round(pitch.x * 180 / Math.PI)}°`;
  if (nextReadout !== readout) { $('#readout').textContent = nextReadout; readout = nextReadout; }
  const settling = !!transition || Math.abs(yaw.x - yawTarget) > .0001 || Math.abs(yaw.v) > .0001 || Math.abs(pitch.x - pitchTarget) > .0001 || Math.abs(pitch.v) > .0001;
  // the dogs are always doing something (walking, or standing with the tail going)
  return settling || (animating() && !!renderer && (dogs.ready || droneInView()));
}

// while you fly the drone, the view turns to keep it in sight
function followDrone() {
  if ($('#drone-panel').hidden || !pano.flight.manual) return;
  const p = pano.drone.position, len = p.length();
  const az = Math.atan2(-p.x, -p.z), el = Math.asin(p.y / len);
  const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
  const now = home.yaw + yaw.x, off = Math.atan2(Math.sin(az - now), Math.cos(az - now));
  if (Math.abs(off) > hfov * 0.3) yawTarget = limitYaw(yaw.x + off - Math.sign(off) * hfov * 0.25);
  const pnow = home.pitch + pitch.x, poff = el - pnow, vhalf = THREE.MathUtils.degToRad(camera.fov / 2);
  if (Math.abs(poff) > vhalf * 0.6) pitchTarget = limitPitch(pitch.x + poff - Math.sign(poff) * vhalf * 0.5);
}

// while you walk a dog, the view keeps it in sight the same way
function followDog() {
  const d = dogPanel.hidden ? null : dogs.controlled(); if (!d) return;
  const p = d.mesh.position, len = p.length();
  const az = Math.atan2(-p.x, -p.z), el = Math.asin(p.y / len) + 0.08;
  const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
  const now = home.yaw + yaw.x, off = Math.atan2(Math.sin(az - now), Math.cos(az - now));
  if (Math.abs(off) > hfov * 0.25) yawTarget = limitYaw(yaw.x + off - Math.sign(off) * hfov * 0.2);
  const pnow = home.pitch + pitch.x, poff = el - pnow, vhalf = THREE.MathUtils.degToRad(camera.fov / 2);
  if (Math.abs(poff) > vhalf * 0.5) pitchTarget = limitPitch(pitch.x + poff - Math.sign(poff) * vhalf * 0.4);
}

// "Woof!" over a dog that barks
const bubbles = new Map(), _b = new THREE.Vector3();
function drawBubbles() {
  const live = new Set();
  for (const b of dogs.bubbles()) {
    live.add(b.name);
    let el = bubbles.get(b.name);
    if (!el) { el = Object.assign(document.createElement('div'), { className: 'woof', textContent: 'Woof!' }); el.setAttribute('aria-hidden', 'true'); document.body.append(el); bubbles.set(b.name, el); }
    _b.copy(b.at).add(new THREE.Vector3(0, b.size * 0.42, 0)).project(camera);
    const vis = _b.z < 1 && Math.abs(_b.x) < 1.1 && Math.abs(_b.y) < 1.1;
    el.style.display = vis ? '' : 'none';
    el.style.transform = `translate(${(_b.x + 1) / 2 * innerWidth}px, ${(1 - _b.y) / 2 * innerHeight}px) translate(-50%, -100%)`;
    el.style.opacity = String(Math.min(1, b.life * 2));
  }
  for (const [name, el] of bubbles) if (!live.has(name)) { el.remove(); bubbles.delete(name); }
}

const turn = (v) => { if (transition || zoom) return; yawTarget = limitYaw(v); wake(); };
const tilt = (v) => { if (transition || zoom) return; pitchTarget = limitPitch(v); wake(); };
const centre = () => { if (transition || zoom) return; yawTarget = 0; pitchTarget = 0; wake(); };

try {
  if (params.has('nowebgl')) throw new Error('WebGL disabled for testing');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('debug') });
  renderer.setPixelRatio(maxRatio);
  // the panorama is already display-ready (Blender's AgX view): no tone curve, no colour conversion
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.info.autoReset = false;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, 1, .05, 200);
  const manager = new THREE.LoadingManager(() => { say(coarse ? 'Ready. Drag to look around.' : 'Ready · drag or use the arrow keys to look around. Home re-centres.'); wake(); });
  const loader = new THREE.TextureLoader(manager);
  pano = createPanoView({ scene, loader, renderer, camera, onChange: wake });
  dogs = createDogs({ scene, camera, renderer, onChange: wake, sound });
  cows = createCows({ scene, camera, onChange: wake });
  resize();
  for (const id of ['#drone-btn', '#pause', '#ball', '#dog-btn']) $(id).hidden = false;
  setInterval(wake, 30000);   // keeps the monitor's clock current while nothing moves
  if (params.has('debug')) window.__room = { THREE, pano, dogs, cows, renderer, scene, camera };
} catch (error) {
  console.warn('3D room unavailable', error);
  renderer?.dispose(); renderer = null; pano = null;
  canvas.style.background = `#111811 url(${PANO_DIR + PANO.low}) center / auto 160% repeat-x`;
  say('Still panorama fallback: image pan only. The live 360° view needs WebGL.', 0);
  wake();
}

/* ---- looking around ---- */
canvas.addEventListener('pointerdown', (e) => { if (transition || zoom) return; drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: yawTarget, pitch: pitchTarget }; canvas.setPointerCapture(e.pointerId); canvas.focus(); });
canvas.addEventListener('pointermove', (e) => {
  if (drag?.id === e.pointerId) { turn(dragYaw(drag.yaw, e.clientX - drag.x, innerWidth)); tilt(dragPitch(drag.pitch, e.clientY - drag.y, innerHeight)); return; }
  if (!pano || transition || zoom || e.pointerType !== 'mouse') return;
  const hit = hitDevice(e);
  canvas.style.cursor = hit ? 'pointer' : '';
  canvas.title = hit?.startsWith('dog:') ? 'Call or walk this dog' : hit === 'tablet' ? 'Open the tablet' : hit === 'laptop' ? 'Open the laptop' : hit ? 'Use the computer' : '';
});
function rayAt(e) { const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, 1 - e.clientY / innerHeight * 2), camera); return ray; }
function hitDevice(e) {
  const ray = rayAt(e);
  const dog = dogs?.ready ? dogs.pick(ray) : -1;
  if (dog >= 0) return `dog:${dog}`;
  return ray.intersectObjects(pano.devices)[0]?.object.userData.device;
}
// a floor point under the pointer (Blender floor coordinates), for throwing the ball there
function floorAt(e) {
  const ray = rayAt(e).ray;
  if (ray.direction.y > -0.02) return null;
  const t = -1.6 / ray.direction.y, x = ray.direction.x * t, y = -ray.direction.z * t;
  return Math.hypot(x, y) < 14 ? [x, y] : null;
}
const DOG_NAMES = { golden: 'golden dog', retriever: 'retriever', terrier: 'terrier' };
const dogName = (i) => DOG_NAMES[dogs.names()[i]] || 'dog';
canvas.addEventListener('pointerup', (e) => {
  if (!drag || transition || zoom || !pano || Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) return;
  const kind = hitDevice(e);
  if (kind?.startsWith('dog:')) { openDogCard(Number(kind.slice(4))); return; }
  closeDogCard();
  if (kind) openDevice(kind);
});
canvas.addEventListener('dblclick', (e) => { const p = floorAt(e); if (p && throwBall(p)) e.preventDefault(); });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(ev, () => { drag = null; });
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (!dogCard.hidden) closeDogCard(); else if (!dogPanel.hidden) closeDogPanel(); else if (!helpCard.hidden) toggleHelp(false); }
  if (!$('#drone-panel').hidden || !dogPanel.hidden || transition || screen.open || ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  const k = { ArrowLeft: () => turn(yawTarget + .15), ArrowRight: () => turn(yawTarget - .15), ArrowUp: () => tilt(pitchTarget + .15), ArrowDown: () => tilt(pitchTarget - .15), Home: centre, b: () => throwBall(), B: () => throwBall() }[e.key];
  if (k) { e.preventDefault(); k(); }
});
$('#left').onclick = () => turn(yawTarget + Math.PI / 4);
$('#right').onclick = () => turn(yawTarget - Math.PI / 4);
$('#centre').onclick = centre;
$('#up').onclick = () => tilt(pitchTarget + Math.PI / 12);
$('#down').onclick = () => tilt(pitchTarget - Math.PI / 12);

/* ---- the PC: turn to face the screen and zoom in, then open it ---- */
function rotateTo(q1, f1, done) { transition = { q0: camera.quaternion.clone(), q1: q1.clone(), f0: camera.fov, f1, time: 0, done }; wake(); }
// the monitor and the laptop open LeruOS; the old tablet opens its own Android-style home screen
const DEVICES = {
  pc: { title: 'Leruo’s PC', src: 'os/index.html?embedded=1&crt=0' },
  laptop: { title: 'Leruo’s laptop', src: 'os/index.html?embedded=1&crt=0' },
  tablet: { title: 'Leruo’s tablet', src: 'tablet/index.html' },
};
function openDevice(kind) {
  if (transition || screen.open) return;
  const dev = DEVICES[kind] || DEVICES.pc;
  closeDogCard(); closeDogPanel();
  const show = () => { device.title = dev.title; screen.dataset.kind = kind; device.src = dev.src; screen.showModal(); loop.stop(); };
  if (!pano || !pano.focus[kind]) { show(); return; }
  // a camera looks down -Z: Matrix4.lookAt builds that orientation (Object3D.lookAt would face away)
  const f = pano.focus[kind], aim = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(f.position, f.point, camera.up));
  zoom = kind;
  rotateTo(aim, f.fov, show);
}
// on a phone the tablet is the way in; on a computer, the PC
const primary = coarse ? 'tablet' : 'pc';
$('#pc').textContent = coarse ? 'Open tablet' : 'Enter computer';
$('#pc').onclick = () => openDevice(primary);
addEventListener('message', (e) => { if (e.data?.type === 'tablet' && e.data.action === 'exit' && screen.open) screen.close(); });

$('#exit').onclick = () => screen.close();
screen.addEventListener('close', () => {
  device.src = 'about:blank';
  if (!pano) { wake(); return; }
  rotateTo(lookRotation(yaw.x, pitch.x), home.fov, () => { zoom = null; });
});

/* ---- the dogs: fetch ---- */
function throwBall(target) {
  if (!dogs?.ready || transition || zoom) return false;
  try { sound.start(); } catch {}
  const ok = dogs.throwBall(target);
  say(ok ? 'Ball thrown. The first dog to reach it brings it back.' : 'Nowhere clear to throw it there.');
  wake(); return ok;
}
$('#ball').onclick = () => throwBall();

/* ---- scenery pause and the drone ---- */
$('#pause').onclick = () => { paused = !paused; $('#pause').setAttribute('aria-pressed', String(paused)); $('#pause .label').textContent = paused ? 'Resume' : 'Pause'; say(paused ? 'Scenery paused.' : 'Scenery moving again.'); wake(); };
const panel = $('#drone-panel'), droneBtn = $('#drone-btn');
// the 360 view lets the drone go all the way round (see drone-control.js WIDE_ZONE)
panel.dataset.zone = 'wide';
$('#drone-x').min = String(835 - 3141); $('#drone-x').max = String(835 + 3141);
$('#drone-y').min = String(335 - 317); $('#drone-y').max = String(335 + 183);
function syncFlight() {
  if (!pano) return;
  const f = pano.flight;
  $('#drone-x').value = f.tx; $('#drone-y').value = 335 - f.ty; $('#drone-angle').value = f.angle * 180 / Math.PI;
  $('#drone-auto').setAttribute('aria-pressed', String(!f.manual));
  $('#drone-status').textContent = f.manual ? 'Manual flight · release the sticks to hover.' : 'Autopilot · move either stick to take control.';
}
const closeFlight = () => { panel.hidden = true; droneBtn.setAttribute('aria-expanded', 'false'); };
droneBtn.onclick = () => {
  if (!panel.hidden) { closeFlight(); return; }
  closeDogPanel(); closeDogCard();
  pano?.pilot.take(); panel.hidden = false; droneBtn.setAttribute('aria-expanded', 'true'); syncFlight(); $('#flight-stick').focus();
  if (yawTarget || pitchTarget) centre();   // the drone flies over the farm, in front of you
};
$('#drone-close').onclick = () => { closeFlight(); droneBtn.focus(); };
for (const id of ['#drone-x', '#drone-y', '#drone-angle']) $(id).addEventListener('input', () => {
  pano?.pilot.set(Number($('#drone-x').value), 335 - Number($('#drone-y').value), Number($('#drone-angle').value)); syncFlight(); wake();
});
$('#drone-reset').onclick = () => { pano?.pilot.reset(); syncFlight(); wake(); };
$('#drone-auto').onclick = () => { pano?.pilot.auto(); syncFlight(); wake(); };

/* ---- status messages: a short toast above the controls ---- */
let sayTimer = 0;
function say(text, ms = 4200) {
  status.textContent = text; status.classList.add('show');
  clearTimeout(sayTimer); if (ms) sayTimer = setTimeout(() => status.classList.remove('show'), ms);
}

/* ---- the dogs: a card when you select one, and a panel to walk one ---- */
const dogCard = $('#dog-card'), dogPanel = $('#dog-panel'), dogBtn = $('#dog-btn'), helpCard = $('#help');
let cardDog = -1;
function openDogCard(i) {
  cardDog = i; dogCard.hidden = false;
  $('#dog-card-name').textContent = dogName(i).replace(/^./, (c) => c.toUpperCase());
  placeDogCard(); $('#dog-call').focus({ preventScroll: true }); wake();
}
function closeDogCard() { dogCard.hidden = true; cardDog = -1; }
function placeDogCard() {
  if (dogCard.hidden || cardDog < 0) return;
  const d = dogs.state.dogs[cardDog]; if (!d) return;
  const v = d.mesh.position.clone().add(new THREE.Vector3(0, d.m.size * 0.45, 0)).project(camera);
  const x = Math.min(innerWidth - 140, Math.max(140, (v.x + 1) / 2 * innerWidth)), y = Math.max(90, (1 - v.y) / 2 * innerHeight);
  dogCard.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
}
$('#dog-call').onclick = () => { const i = cardDog; closeDogCard(); try { sound.start(); } catch {} dogs.greet(i); say(`The ${dogName(i)} is coming over.`); wake(); };
$('#dog-walk').onclick = () => { const i = cardDog; closeDogCard(); openDogPanel(i); };
$('#dog-card-close').onclick = closeDogCard;

function chooseDog(i) {
  dogs.control(i);
  dogPanel.querySelectorAll('[data-dog]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.dog) === i)));
  $('#dog-status').textContent = `Walking the ${dogName(i)}. Drag the stick, or use the arrow keys / WASD.`;
}
function openDogPanel(i = 0) {
  if (!dogs?.ready) return;
  closeFlight(); closeDogCard();
  dogPanel.hidden = false; dogBtn.setAttribute('aria-expanded', 'true');
  chooseDog(i); $('#dog-stick').focus(); wake();
}
function closeDogPanel() { if (dogPanel.hidden) return; dogPanel.hidden = true; dogBtn.setAttribute('aria-expanded', 'false'); dogs?.control(-1); keys.clear(); }
dogBtn.onclick = () => (dogPanel.hidden ? openDogPanel(Math.max(0, dogs.state.control)) : closeDogPanel());
$('#dog-close').onclick = () => { closeDogPanel(); dogBtn.focus(); };
dogPanel.querySelectorAll('[data-dog]').forEach((b) => { b.onclick = () => chooseDog(Number(b.dataset.dog)); });
$('#dog-bark').onclick = () => { try { sound.start(); } catch {} dogs.bark(); wake(); };
$('#dog-drop').onclick = () => { dogs.drop(); wake(); };
$('#dog-throw').onclick = () => throwBall();

// the stick: drag the thumb; its offset is the direction and speed
const stick = $('#dog-stick'), thumb = stick.querySelector('.stick-thumb');
let stickDrag = null;
function setStick(ax, ay) {
  thumb.style.transform = `translate(${ax * 34}px, ${ay * 34}px)`;
  dogs?.drive(ax, ay); wake();
}
stick.addEventListener('pointerdown', (e) => { stickDrag = e.pointerId; stick.setPointerCapture(e.pointerId); moveStick(e); });
stick.addEventListener('pointermove', (e) => { if (stickDrag === e.pointerId) moveStick(e); });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) stick.addEventListener(ev, () => { stickDrag = null; setStick(0, 0); });
function moveStick(e) {
  const r = stick.getBoundingClientRect(), R = r.width / 2;
  let ax = (e.clientX - r.left - R) / R, ay = (e.clientY - r.top - R) / R;
  const m = Math.hypot(ax, ay); if (m > 1) { ax /= m; ay /= m; }
  setStick(ax, ay);
}
// keyboard walking while the panel is open: arrows / WASD, Space barks
const keys = new Set();
const KEYMAP = { ArrowUp: [0, -1], w: [0, -1], W: [0, -1], ArrowDown: [0, 1], s: [0, 1], S: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0], ArrowRight: [1, 0], d: [1, 0], D: [1, 0] };
function keyAxes() { let x = 0, y = 0; for (const k of keys) { x += KEYMAP[k][0]; y += KEYMAP[k][1]; } const m = Math.hypot(x, y) || 1; setStick(x / m * (x || y ? 1 : 0), y / m * (x || y ? 1 : 0)); }
addEventListener('keydown', (e) => {
  if (dogPanel.hidden || screen.open) return;
  if (KEYMAP[e.key]) { e.preventDefault(); keys.add(e.key); keyAxes(); }
  else if (e.key === ' ') { e.preventDefault(); $('#dog-bark').click(); }
});
addEventListener('keyup', (e) => { if (keys.delete(e.key)) keyAxes(); });

/* ---- help ---- */
function toggleHelp(open = helpCard.hidden) { helpCard.hidden = !open; $('#help-btn').setAttribute('aria-expanded', String(open)); if (open) $('#help-close').focus(); }
$('#help-btn').onclick = () => toggleHelp();
$('#help-close').onclick = () => { toggleHelp(false); $('#help-btn').focus(); };
if (coarse) document.body.classList.add('touch');

addEventListener('resize', resize);
reduced.addEventListener?.('change', wake);
document.addEventListener('visibilitychange', () => { if (document.hidden) loop.stop(); else wake(); });
wake();
