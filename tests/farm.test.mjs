import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';

const source=await readFile(new URL('../js/farm.js',import.meta.url),'utf8');
const threeURL=new URL('../vendor/three/three.module.min.js',import.meta.url).href;
const {createFarm}=await import('data:text/javascript;base64,'+Buffer.from(source.replace('"three"',JSON.stringify(threeURL))).toString('base64'));
function fixture(){
  const scene=new THREE.Scene();
  const uniforms={uTime:{value:0},uMouse:{value:new THREE.Vector2()},uPar:{value:.017},uFocusD:{value:.3}};
  const farm=createFarm({scene,uniforms,loader:{load:()=>new THREE.Texture()},keepAlpha:{},depthAt:()=>.1});
  return {scene,uniforms,farm};
}
test('ten minutes of farm motion retain a bounded scene and particle allocation',()=>{
  const {scene,uniforms,farm}=fixture();
  const objects=[...scene.children], geometries=objects.map(o=>o.geometry);
  for(let i=0;i<36000;i++){uniforms.uTime.value=i/60;farm.update(1/60,i/60,1,false);}
  assert.equal(scene.children.length,6);
  assert.deepEqual(scene.children,objects);
  assert.deepEqual(scene.children.map(o=>o.geometry),geometries);
  const sprays=scene.children.filter(o=>o.isPoints);
  assert.equal(sprays.length,2);
  assert.equal(sprays[0].geometry,sprays[1].geometry);
  assert.equal(sprays[0].geometry.attributes.position.count,320);
  for(const o of objects)assert.ok(o.position.toArray().every(Number.isFinite));
});
test('paused farm keeps cow poses still and follows photo parallax',()=>{
  const {scene,uniforms,farm}=fixture();
  farm.update(0,0,1,true);
  const cow=scene.children[0],pose=cow.material.uniforms.pose.value;
  const x=cow.position.x;
  uniforms.uMouse.value.x=1;
  farm.update(0,0,1,true);
  assert.equal(cow.material.uniforms.pose.value,pose);
  assert.ok(Math.abs(cow.position.x-(x+(.1-.3)*.017*1670))<1e-8);
});
