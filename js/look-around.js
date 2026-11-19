import * as THREE from 'three';
import { createRoom } from './room.js';
import { createRenderLoop } from './render-loop.js';
import { spring, FrameBudget } from './motion.js';
import { limitYaw, dragYaw, limitPitch, dragPitch, MAX_PITCH } from './yaw.js';
const canvas=document.querySelector('#view'),status=document.querySelector('#status');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const pitch={x:0,v:0};let pitchTarget=0;
const state={x:0,v:0};let target=0,drag=null,renderer,scene,camera,loaded=false,room,transition=null;
const screen=document.querySelector('#screen'),device=document.querySelector('#device');
const maxRatio=Math.min(devicePixelRatio,matchMedia('(pointer: coarse)').matches?1.25:1.5);
const budget=new FrameBudget(maxRatio);let ratio=maxRatio,readout='';
const loop=createRenderLoop(draw,{enabled:()=>!document.hidden&&!screen.open});
function resize(){if(!renderer)return;renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();wake();}
function wake(){loop.wake();}
function draw(dt,elapsed){
 if(reduced.matches){state.x=target;state.v=0;pitch.x=pitchTarget;pitch.v=0;}else {spring(state,target,10,dt);spring(pitch,pitchTarget,10,dt);}
 if(renderer&&loaded){const next=budget.sample(elapsed);if(Math.abs(next-ratio)>.001){ratio=next;renderer.setPixelRatio(ratio);renderer.setSize(innerWidth,innerHeight);}if(transition){
 transition.time+=dt;const t=reduced.matches?1:Math.min(1,transition.time/.85),ease=t*t*(3-2*t);
 camera.position.lerpVectors(transition.from,transition.to,ease);camera.quaternion.slerpQuaternions(transition.q0,transition.q1,ease);
 if(t===1){const done=transition.done;transition=null;done?.();}
 }else camera.rotation.set(pitch.x,state.x,0,'YXZ');renderer.render(scene,camera);}
 else canvas.style.backgroundPosition=`${50-state.x/Math.PI*50}% ${50+pitch.x/MAX_PITCH*50}%`;
 const nextReadout=`Turn ${Math.round(state.x*180/Math.PI)}° · Tilt ${Math.round(pitch.x*180/Math.PI)}°`;
 if(nextReadout!==readout){document.querySelector('#readout').textContent=nextReadout;readout=nextReadout;}
 return !!transition||Math.abs(state.x-target)>.0001||Math.abs(state.v)>.0001||Math.abs(pitch.x-pitchTarget)>.0001||Math.abs(pitch.v)>.0001;
}
function turn(value){if(transition)return;target=limitYaw(value);wake();}
function tilt(value){if(transition)return;pitchTarget=limitPitch(value);wake();}
function centre(){if(transition)return;target=0;pitchTarget=0;wake();}
try{
 renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'default'});
 renderer.setPixelRatio(maxRatio);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
 scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(65,1,.05,100);
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
 renderer.shadowMap.autoUpdate=false;
 room=createRoom({scene,loader:new THREE.TextureLoader(new THREE.LoadingManager(()=>wake()))});
 camera.position.copy(room.eye);renderer.shadowMap.needsUpdate=true;
 loaded=true;resize();
 status.textContent='Arrow keys to look · Home to centre';

}catch(error){console.warn('Panorama WebGL unavailable',error);renderer?.dispose();renderer=null;canvas.style.background='url(assets/panorama/workshop-open-door.png) center / auto 150% no-repeat';status.textContent='Still panorama fallback: image pan only. Full rotation needs WebGL.';wake();}
canvas.addEventListener('pointerdown',e=>{if(transition)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,yaw:target,pitch:pitchTarget};canvas.setPointerCapture(e.pointerId);canvas.focus();});
canvas.addEventListener('pointermove',e=>{if(drag?.id===e.pointerId){turn(dragYaw(drag.yaw,e.clientX-drag.x,innerWidth));tilt(dragPitch(drag.pitch,e.clientY-drag.y,innerHeight));}});
canvas.addEventListener('pointerup',e=>{
 if(!drag||transition||!room||Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>6)return;
 const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2),camera);
 const hit=ray.intersectObjects(room.devices)[0];if(hit)openDevice(hit.object.userData.device);
});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>drag=null);
window.addEventListener('keydown',e=>{if(transition||screen.open||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;if(e.key==='ArrowLeft'){e.preventDefault();turn(target+.15);}if(e.key==='ArrowRight'){e.preventDefault();turn(target-.15);}if(e.key==='ArrowUp'){e.preventDefault();tilt(pitchTarget+.15);}if(e.key==='ArrowDown'){e.preventDefault();tilt(pitchTarget-.15);}if(e.key==='Home'){e.preventDefault();centre();}});
document.querySelector('#left').onclick=()=>turn(target+Math.PI/4);
document.querySelector('#right').onclick=()=>turn(target-Math.PI/4);
document.querySelector('#centre').onclick=centre;
document.querySelector('#up').onclick=()=>tilt(pitchTarget+Math.PI/12);
document.querySelector('#down').onclick=()=>tilt(pitchTarget-Math.PI/12);
function moveCamera(position,quaternion,done){
 transition={from:camera.position.clone(),to:position.clone(),q0:camera.quaternion.clone(),q1:quaternion.clone(),time:0,done};wake();
}
function openDevice(kind){
 if(transition||screen.open)return;
 const show=()=>{device.title=kind==='tablet'?'Leruo’s tablet':'Leruo’s PC';screen.dataset.kind=kind;device.src=kind==='tablet'?'tablet/index.html':'os/index.html?embedded=1&crt=0';screen.showModal();loop.stop();};
 if(!room){show();return;}
 const destination=room.focus[kind],aim=camera.clone();aim.position.copy(destination.position);aim.lookAt(destination.point);
 moveCamera(destination.position,aim.quaternion,show);
}
document.querySelector('#pc').onclick=()=>openDevice('pc');document.querySelector('#tablet').onclick=()=>openDevice('tablet');
document.querySelector('#exit').onclick=()=>screen.close();screen.addEventListener('close',()=>{if(screen.open)return;device.src='about:blank';if(room){const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch.x,state.x,0,'YXZ'));moveCamera(room.eye,q);}else wake();});
addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{if(document.hidden){loop.stop();}else wake();});
