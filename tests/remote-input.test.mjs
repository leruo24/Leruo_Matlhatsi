import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceRemote } from '../js/remote-input.js';
import { createRoom } from '../js/room.js';
import * as THREE from 'three';
test('flight rates agree across 30, 60 and 120Hz',()=>{
 const run=hz=>{let p={x:1000,y:170,angle:0};for(let i=0;i<hz;i++)p=advanceRemote(p,{x:.5,y:-.3,bank:.2},1/hz);return p;};
 const a=run(30);for(const hz of [60,120]){const b=run(hz);for(const k of ['x','y','angle'])assert.ok(Math.abs(a[k]-b[k])<1e-8);}
});
test('neutral sticks preserve target and long interruptions cannot teleport the drone',()=>{
 const p={x:1000,y:170,angle:.1};assert.deepEqual(advanceRemote(p,{x:0,y:0,bank:0},.02),p);
 const n=advanceRemote(p,{x:1,y:1,bank:1},60);assert.ok(n.x-p.x<=8);assert.ok(n.y-p.y<=2.25);
});
test('sustained remote flight stays inside distant sky and bank boundaries',()=>{
 let p={x:1000,y:170,angle:0};for(let i=0;i<10000;i++)p=advanceRemote(p,{x:1,y:-1,bank:1},1/60);
 assert.deepEqual(p,{x:1420,y:120,angle:Math.PI/4});
});
test('the tablet is no longer an interactive device',()=>{
 const room=createRoom({scene:new THREE.Scene()});assert.deepEqual(room.devices.map(o=>o.userData.device),['pc']);assert.equal(room.focus.tablet,undefined);
});
