import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createRoom, ROOM, WIDE, project, homeView } from '../js/room.js';
import { PHOTO, MONITOR, TABLET } from '../js/photo-layer.js';

const build = () => { const scene = new THREE.Scene(), room = createRoom({ scene }); scene.updateMatrixWorld(true); return room; };

test('the sliding door aperture is clear and its glass panel is parked beside it', () => {
  const room = build(), { door } = ROOM, solid = [];
  room.root.traverse((o) => { if (o.isMesh && !['meadow', 'apron', 'sky'].includes(o.name) && !o.userData.photo && !o.userData.device) solid.push(o); });
  for (const z of [door.start + 0.15, (door.start + door.end) / 2, door.end - 0.15]) {
    const ray = new THREE.Raycaster(new THREE.Vector3(door.x - 0.6, 1.2, z), new THREE.Vector3(1, 0, 0), 0, 1.5);
    assert.equal(ray.intersectObjects(solid, false).length, 0, `door blocked at z=${z}`);
  }
  const panel = new THREE.Box3().setFromObject(room.root.getObjectByName('parked-glass'));
  assert.ok(panel.min.z >= door.end, 'parked panel overlaps the opening');
});

test('the photo shell is pixel-exact from the eye: its corners land on the outpainted plate corners', () => {
  const room = build(), shell = room.shell;
  shell.updateMatrixWorld(true);
  const pos = shell.geometry.attributes.position, uv = shell.geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(shell.matrixWorld).sub(room.eye).add(new THREE.Vector3(0, PHOTO.HC, 0));
    const [x, y] = project(v);
    const ex = -WIDE.left + uv.getX(i) * WIDE.width, ey = -WIDE.top + (1 - uv.getY(i)) * WIDE.height;
    assert.ok(Math.abs(x - ex) < 0.01 && Math.abs(y - ey) < 0.01, `corner ${i}: ${x},${y} vs ${ex},${ey}`);
  }
});

test('screens are hit from the eye and the zoom keeps the camera still (no depth tearing)', () => {
  const room = build();
  for (const [kind, quad] of [['pc', MONITOR], ['tablet', TABLET]]) {
    const f = room.focus[kind];
    assert.ok(f.position.equals(room.eye), 'transitions turn and zoom, they do not move the eye');
    assert.ok(f.fov > 4 && f.fov < 30, `zoom for ${kind} is ${f.fov}`);
    const camera = new THREE.PerspectiveCamera(f.fov, 16 / 9, 0.05, 200);
    camera.position.copy(f.position); camera.lookAt(f.point); camera.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(), camera);
    assert.equal(ray.intersectObjects(room.devices)[0]?.object.userData.device, kind);
    // the hit quad sits exactly over the screen in the photo
    const [cx, cy] = project(f.point.clone());
    const mx = quad.reduce((a, p) => a + p[0], 0) / 4, my = quad.reduce((a, p) => a + p[1], 0) / 4;
    assert.ok(Math.abs(cx - mx) < 1 && Math.abs(cy - my) < 1);
  }
  const before = room.devices.map((d) => d.matrixWorld.elements.slice());
  const camera = new THREE.PerspectiveCamera(); camera.rotation.set(.5, Math.PI, 0); camera.updateMatrixWorld();
  assert.deepEqual(room.devices.map((d) => d.matrixWorld.elements), before);
});

test('home view frames the photo height and never shows past the margin on wide screens', () => {
  const tall = homeView(9 / 16), wide = homeView(21 / 9);
  assert.ok(Math.abs(tall.fov - 2 * Math.atan(PHOTO.H / 2 / PHOTO.F) * 180 / Math.PI) < 0.01);
  const hfov = 2 * Math.atan(Math.tan(wide.fov * Math.PI / 360) * 21 / 9);
  assert.ok(hfov <= 2 * Math.atan((PHOTO.W / 2 + WIDE.left) / PHOTO.F) + 1e-6);
  assert.ok(tall.pitch < 0 && tall.pitch > -0.2);
  assert.equal(wide.yaw, 0);
  assert.ok(tall.yaw < 0 && tall.yaw > -0.15, 'portrait turns slightly right, toward the monitor');
});

test('every mesh has finite bounds and nothing modelled sits between the eye and the photo', () => {
  const room = build();
  room.root.traverse((o) => { if (o.isMesh) { const b = new THREE.Box3().setFromObject(o); assert.ok([...b.min.toArray(), ...b.max.toArray()].every(Number.isFinite), o.name); } });
  // rays from the eye through the photo's corners reach the shell without hitting modelled geometry closer than 1 m
  const solid = []; room.root.traverse((o) => { if (o.isMesh && !o.userData.photo && !o.userData.device && !['sky', 'meadow'].includes(o.name)) solid.push(o); });
  // the opaque core covers the photo minus the feathered rim
  const core = room.core; core.updateMatrixWorld(true);
  const cp = core.geometry.attributes.position, cuv = core.geometry.attributes.uv;
  for (let i = 0; i < cp.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(cp, i).applyMatrix4(core.matrixWorld).sub(room.eye).add(new THREE.Vector3(0, PHOTO.HC, 0));
    const [x, y] = project(v), ex = -WIDE.left + cuv.getX(i) * WIDE.width, ey = -WIDE.top + (1 - cuv.getY(i)) * WIDE.height;
    assert.ok(Math.abs(x - ex) < 0.01 && Math.abs(y - ey) < 0.01, `core corner ${i}`);
  }
  for (const [x, y] of [[835, 471], [200, 300], [1500, 300], [835, 900]]) {
    const dir = new THREE.Vector3((x - PHOTO.CX) / PHOTO.F, -(y - PHOTO.YH) / PHOTO.F, -1).normalize();
    const hit = new THREE.Raycaster(room.eye, dir, 0, 1).intersectObjects(solid)[0];
    assert.equal(hit, undefined, `modelled ${hit?.object.name} in front of the photo at ${x},${y}`);
  }
});
