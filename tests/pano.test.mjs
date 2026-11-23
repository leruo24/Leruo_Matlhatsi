import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { dirToUv, photoDir, droneDir, homeView, PANO, AUTOPILOT_ZONE, decodeDepth, SCREEN_DEVICES } from '../js/pano-view.js';
import { constrainWide, WIDE_ZONE } from '../js/drone-control.js';
import { existsSync, readFileSync } from 'node:fs';
const SCREENS = JSON.parse(readFileSync(new URL('../assets/workshop-3d/screens.json', import.meta.url), 'utf8'));

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const deg = THREE.MathUtils.radToDeg;

function homeCamera(aspect) {
  const h = homeView(aspect);
  const cam = new THREE.PerspectiveCamera(h.fov, aspect, 0.05, 200);
  cam.quaternion.setFromEuler(new THREE.Euler(h.pitch, h.yaw, 0, 'YXZ'));
  cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  return cam;
}
const onScreen = (cam, p) => { const v = new THREE.Vector3(...p).project(cam); return v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1; };

test('panorama mapping: straight ahead is the centre, right is three quarters, up is the top', () => {
  near(dirToUv(0, 0, -1)[0], 0.5); near(dirToUv(0, 0, -1)[1], 0.5);
  near(dirToUv(1, 0, 0)[0], 0.75); near(dirToUv(-1, 0, 0)[0], 0.25);
  near(dirToUv(0, 1, 0)[1], 1); near(dirToUv(0, -1, 0)[1], 0);
  const back = dirToUv(0, 0, 1)[0]; assert.ok(back < 1e-6 || back > 1 - 1e-6);
});

test('photo pixels map to directions with the photo camera (horizon row 367, focal 1000 px)', () => {
  const c = photoDir(835, 367); near(c.x, 0); near(c.y, 0); near(c.z, -1);
  const up = photoDir(835, 367 - 1000); near(deg(Math.asin(up.y)), 45, 1e-4);
});

test('home view frames the scene like the photo', () => {
  const h = homeView(1670 / 942);
  near(deg(h.pitch), -deg(Math.atan(104 / 1000)), 1e-6);
  near(h.fov, deg(2 * Math.atan(0.471)), 1e-6);
  const wide = homeView(2.4);   // wider screens keep the photo's horizontal field
  near(2 * deg(Math.atan(Math.tan(THREE.MathUtils.degToRad(wide.fov / 2)) * 2.4)), deg(2 * Math.atan(0.835)), 1e-6);
  assert.ok(homeView(0.46).fov <= 75 + 1e-9);   // tall phones: capped
});

test('monitor, laptop and tablet: in front of the eye, facing it, fully in the home view', () => {
  assert.deepEqual(Object.keys(SCREENS).sort(), Object.keys(SCREEN_DEVICES).sort());
  for (const [key, sc] of Object.entries(SCREENS)) {
    const q = sc.quad.map((p) => new THREE.Vector3(...p));
    for (const p of q) assert.ok(p.z < -3, `${key} is ahead`);
    const n = new THREE.Vector3().subVectors(q[1], q[0]).cross(new THREE.Vector3().subVectors(q[3], q[0])).normalize();
    assert.ok(Math.abs(n.dot(q[0].clone().negate().normalize())) > 0.6, `${key} roughly faces the eye`);
    for (const aspect of [16 / 9, 1670 / 942, 21 / 9]) {
      const cam = homeCamera(aspect);
      for (const p of sc.quad) assert.ok(onScreen(cam, p), `${key} corner on screen at aspect ${aspect.toFixed(2)}`);
    }
    assert.ok(sc.rect[0] < sc.rect[2] && sc.rect[1] < sc.rect[3]);
  }
  // sizes as modelled: a 1.10 m monitor, a ~13-inch laptop, a 10-inch tablet
  const w = (k) => new THREE.Vector3(...SCREENS[k].quad[0]).distanceTo(new THREE.Vector3(...SCREENS[k].quad[1]));
  assert.ok(Math.abs(w('monitor') - 1.10) < 0.01 && Math.abs(w('laptop') - 0.288) < 0.01 && Math.abs(w('tablet') - 0.217) < 0.01);
});

test('the autopilot keeps the drone in the home view; the remote can take it all the way round', () => {
  const cam = homeCamera(1670 / 942);
  for (const x of [AUTOPILOT_ZONE.left, AUTOPILOT_ZONE.right]) for (const y of [AUTOPILOT_ZONE.top, AUTOPILOT_ZONE.bottom]) {
    assert.ok(onScreen(cam, droneDir(x, y).multiplyScalar(12).toArray()), `drone at ${x},${y}`);
  }
  const back = droneDir(WIDE_ZONE.right, 200); assert.ok(back.z > 0.99 * Math.cos(Math.asin(back.y)), 'right edge of the zone is straight behind');
  const low = droneDir(835, WIDE_ZONE.bottom), high = droneDir(835, WIDE_ZONE.top);
  near(THREE.MathUtils.radToDeg(Math.asin(low.y)), 50 / 1000 * 180 / Math.PI, 1e-6); assert.ok(high.y > low.y);
  assert.deepEqual(constrainWide(99999, -99999, 9), { x: WIDE_ZONE.right, y: WIDE_ZONE.top, angle: Math.PI / 4 });
});

test('depth decoding: 16 bits, logarithmic between 0.2 m and 30 km, white is sky', () => {
  near(decodeDepth(0, 0), 0.2, 1e-9);
  assert.equal(decodeDepth(255, 255), Infinity);
  const t = Math.log(3 / 0.2) / Math.log(150000), q = Math.round(t * 65535);
  near(decodeDepth(q >> 8, q & 255), 3, 3 * 1e-4);
});

test('every panorama file the viewer asks for is in the repository', () => {
  for (const f of [PANO.low, ...PANO.mid, ...PANO.high, 'depth.png', 'nav.json', 'dogs.json', 'cows.json', 'pen.json', ...Object.values(SCREENS).map((s) => s.mask)]) {
    assert.ok(existsSync(new URL('../assets/workshop-3d/' + f, import.meta.url)), f);
  }
});
