import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
const source=await readFile(new URL('../js/room.js',import.meta.url),'utf8');
const url=new URL('../vendor/three/three.module.min.js',import.meta.url).href;
const {createRoom,ROOM}=await import('data:text/javascript;base64,'+Buffer.from(source.replace("'three'",JSON.stringify(url))).toString('base64'));
test('door aperture is clear and parked sliding panel is outside it',()=>{
 const scene=new THREE.Scene();const room=createRoom({scene});scene.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(new THREE.Vector3(3,1.4,1),new THREE.Vector3(1,0,0),0,2);
 assert.equal(ray.intersectObjects(room.root.children,true).length,0);
 const bounds=new THREE.Box3().setFromObject(room.root.getObjectByName('parked-glass'));
 assert.ok(bounds.min.z>=ROOM.door.end);
});
test('screen targets stay fixed under camera rotation and are approached from the front',()=>{
 const scene=new THREE.Scene(),room=createRoom({scene});
 for(const kind of ['pc','tablet']){const f=room.focus[kind];assert.ok(f.position.distanceTo(f.point)>.3);const camera=new THREE.PerspectiveCamera();camera.position.copy(f.position);camera.lookAt(f.point);camera.updateMatrixWorld(true);const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(),camera);assert.equal(ray.intersectObjects(room.devices)[0].object.userData.device,kind);}
 const before=room.devices.map(d=>d.matrixWorld.elements.slice());
 const camera=new THREE.PerspectiveCamera();camera.rotation.set(.5,Math.PI,0);camera.updateMatrixWorld();
 assert.deepEqual(room.devices.map(d=>d.matrixWorld.elements),before);
});
test('desks are separated and every mesh has finite world bounds',()=>{
 const scene=new THREE.Scene(),room=createRoom({scene});
 const a=new THREE.Box3().setFromObject(room.root.getObjectByName('desk')),b=new THREE.Box3().setFromObject(room.root.getObjectByName('electronics-bench'));
 assert.equal(a.intersectsBox(b),false);
 room.root.traverse(o=>{if(o.isMesh){const b=new THREE.Box3().setFromObject(o);assert.ok([...b.min.toArray(),...b.max.toArray()].every(Number.isFinite));}});
});
