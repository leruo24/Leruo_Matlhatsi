import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { dirToUv, photoDir, homeView, MONITOR_QUAD, PANO } from '../js/pano-view.js';
import { FLIGHT_ZONE } from '../js/drone-control.js';
import { existsSync } from 'node:fs';

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

test('the monitor is in front, faces the eye and is fully visible in the home view', () => {
  for (const p of MONITOR_QUAD) assert.ok(p[2] < -3);
  const [a, b, , d] = MONITOR_QUAD.map((p) => new THREE.Vector3(...p));
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a)).normalize();
  const toEye = a.clone().negate().normalize();
  assert.ok(Math.abs(n.dot(toEye)) > 0.9, 'screen roughly faces the eye');
  for (const aspect of [16 / 9, 1670 / 942, 21 / 9, 4 / 3]) {
    const cam = homeCamera(aspect);
    for (const p of MONITOR_QUAD) assert.ok(onScreen(cam, p), `monitor corner on screen at aspect ${aspect.toFixed(2)}`);
  }
});

test('the drone flight zone is in view at home on a landscape screen', () => {
  const cam = homeCamera(16 / 9);
  for (const x of [FLIGHT_ZONE.left, FLIGHT_ZONE.right]) for (const y of [FLIGHT_ZONE.top, FLIGHT_ZONE.bottom]) {
    assert.ok(onScreen(cam, photoDir(x, y).multiplyScalar(9).toArray()), `drone at ${x},${y}`);
  }
});

test('every panorama file the viewer asks for is in the repository', () => {
  for (const f of [PANO.low, ...PANO.mid, ...PANO.high, 'monitor-mask.png']) {
    assert.ok(existsSync(new URL('../assets/workshop-3d/' + f, import.meta.url)), f);
  }
});
