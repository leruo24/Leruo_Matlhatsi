import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createRoom, ROOM, WIDE, CORE, project, homeView, photoInView } from '../js/room.js';
import { BENCH, TRUNK } from '../js/room-seam.js';
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
  for (const [kind, quad] of [['pc', MONITOR]]) {
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

test('home view keeps the whole view on the opaque photo core at any aspect ratio', () => {
  for (const aspect of [9 / 19.5, 3 / 4, 16 / 9, 21 / 9, 32 / 9]) {
    const h = homeView(aspect), cam = new THREE.PerspectiveCamera(h.fov, aspect, 0.05, 200);
    cam.position.set(...ROOM.eye); cam.rotation.set(h.pitch, h.yaw, 0, 'YXZ'); cam.updateMatrixWorld(true);
    assert.ok(photoInView(cam, CORE)?.covers, `aspect ${aspect.toFixed(2)} shows the feathered edge`);
  }
  const wide = homeView(16 / 9), full = 2 * Math.atan(PHOTO.H / 2 / PHOTO.F) * 180 / Math.PI;
  assert.ok(wide.fov > full - 6, `16:9 home view keeps most of the photo height (${wide.fov.toFixed(1)} vs ${full.toFixed(1)} deg)`);
  assert.ok(homeView(9 / 16).yaw < 0, 'portrait turns slightly right, toward the monitor');
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

test('joinery is instanced and leaves the central viewing position clear', () => {
 const room=build(), detail=room.root.getObjectByName('room-joinery');
 assert.ok(detail);
 assert.ok(detail.children.length < 24, 'repeated boards and hardware should share batches');
 const ray=new THREE.Raycaster(room.eye,new THREE.Vector3(0,0,1),0,.8);
 assert.equal(ray.intersectObjects(detail.children,false).length,0,'furnishings must not crowd the eye');
 const boards=detail.getObjectByName('individual-timber-boards');
 assert.ok(boards.isInstancedMesh && boards.count>80);
});

test('the live photo is only rendered when some of it is in view', () => {
  const room = build(), cam = new THREE.PerspectiveCamera(50.4, 16 / 9, 0.05, 200);
  cam.position.copy(room.eye);
  const view = (yaw, pitch = 0) => { cam.rotation.set(pitch, yaw, 0, 'YXZ'); cam.updateMatrixWorld(true); return photoInView(cam, room.coreBounds); };
  const hv = homeView(16 / 9); cam.fov = hv.fov; cam.updateProjectionMatrix();
  const home = view(hv.yaw, hv.pitch);
  assert.ok(home && home.covers, 'facing the photo, its core fills the view');
  assert.ok(home.rect[0] < 80 && home.rect[2] > PHOTO.W - 80 && home.rect[1] < 80 && home.rect[3] > PHOTO.H - 80, 'home view sees about the whole photo');
  assert.equal(view(Math.PI), null, 'facing the back wall, nothing of the photo is visible');
  assert.equal(view(Math.PI / 2 + 0.7), null, 'facing the left wall past the photo');
  const side = view(0.7);
  assert.ok(side && !side.covers && side.rect[0] === 0, 'looking left shows the left of the photo and the room');
});

test('objects continued past the photo edge line up with the photo, rest on the floor and keep the door clear', () => {
  const room = build();
  // the bench top's back and front edges project onto the rows measured in the photo
  const backEdge = project(new THREE.Vector3(1.6, BENCH.top, -BENCH.back)), frontEdge = project(new THREE.Vector3(1.6, BENCH.top, -BENCH.front));
  assert.ok(Math.abs(backEdge[1] - 716) < 0.5 && Math.abs(frontEdge[1] - 925) < 0.5);
  assert.ok(BENCH.back - BENCH.front > 0.5 && BENCH.back - BENCH.front < 0.7, 'believable bench depth');
  // the trunk leaves the frame at the photo's right edge, where the real trunk does
  const [tx] = project(new THREE.Vector3(TRUNK.x, 1, -TRUNK.z));
  assert.ok(Math.abs(tx - PHOTO.W) < 2);
  const group = room.root.getObjectByName('seam-continuations');
  for (const name of ['bench-leg', 'tree-root-flare']) {
    group.traverse((o) => { if (o.name === name) { const bb = new THREE.Box3().setFromObject(o); assert.ok(Math.abs(bb.min.y) < 0.005, `${name} floats or sinks (${bb.min.y})`); } });
  }
  const bench = new THREE.Box3().setFromObject(group.getObjectByName('bench-top'));
  assert.ok(ROOM.door.x - bench.max.x > 0.9, 'at least 0.9 m of walking space between the bench and the sliding door');
});
