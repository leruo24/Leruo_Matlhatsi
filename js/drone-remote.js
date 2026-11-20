import { advanceRemote } from './remote-input.js';
const panel = document.querySelector('#drone-panel');
const position = document.querySelector('#flight-stick'), bank = document.querySelector('#bank-stick');
const x = document.querySelector('#drone-x'), y = document.querySelector('#drone-y'), angle = document.querySelector('#drone-angle');
const sticks = new Map(), keys = new Set();
let frame = 0, previous = 0;
const supported = new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','w','a','s','d','q','e']);
function paint(button, dx = 0, dy = 0) { button.querySelector('.stick-thumb').style.transform = `translate(${dx * 30}px,${dy * 30}px)`; }
function axes() {
  const p = sticks.get(position) || {x:0,y:0}, b = sticks.get(bank) || {x:0};
  const down = (...names) => names.some(n => keys.has(n)) ? 1 : 0;
  return { x: p.x + down('ArrowRight','d') - down('ArrowLeft','a'), y: p.y + down('ArrowDown','s') - down('ArrowUp','w'), bank:b.x + down('e') - down('q') };
}
function stop() {
  cancelAnimationFrame(frame); frame = 0; previous = 0; keys.clear();
  for (const [button, state] of sticks) { if (button.hasPointerCapture(state.id)) button.releasePointerCapture(state.id); }
  sticks.clear(); paint(position); paint(bank);
}
function tick(now) {
  frame = 0;
  if (panel.hidden || document.hidden) { stop(); return; }
  const a = axes(), dt = previous ? (now - previous) / 1000 : 0; previous = now;
  if (a.x || a.y || a.bank) {
    const next = advanceRemote({x:+x.value,y:335-Number(y.value),angle:Number(angle.value)*Math.PI/180},a,dt);
    x.value=next.x; y.value=335-next.y; angle.value=next.angle*180/Math.PI;
    x.dispatchEvent(new Event('input', {bubbles:true}));
  }
  if (!sticks.has(position)) paint(position, Math.max(-1,Math.min(1,a.x)), Math.max(-1,Math.min(1,a.y)));
  if (!sticks.has(bank)) paint(bank, Math.max(-1,Math.min(1,a.bank)),0);
  if (sticks.size || keys.size) frame=requestAnimationFrame(tick); else previous=0;
}
function start() { if (!frame) frame=requestAnimationFrame(tick); }
for (const button of [position,bank]) {
  function move(e) {
    const state=sticks.get(button); if (!state || state.id!==e.pointerId) return;
    const rect=button.getBoundingClientRect(), dx=(e.clientX-rect.left-rect.width/2)/(rect.width*.35), dy=button===bank?0:(e.clientY-rect.top-rect.height/2)/(rect.height*.35);
    const size=Math.max(1,Math.hypot(dx,dy)); state.x=dx/size;state.y=dy/size;
    paint(button,state.x,state.y); start();
  }
  button.addEventListener('pointerdown',e=>{if(sticks.has(button))return;e.preventDefault();button.focus();sticks.set(button,{id:e.pointerId,x:0,y:0});button.setPointerCapture(e.pointerId);move(e);});
  button.addEventListener('pointermove',move);
  for(const event of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(event,e=>{if(sticks.get(button)?.id!==e.pointerId)return;sticks.delete(button);paint(button);});
}
document.addEventListener('keydown',e=>{
  if(panel.hidden || e.ctrlKey || e.metaKey || e.altKey)return;
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();stop();document.querySelector('#drone-close').click();return;}
  const key=e.key.length===1?e.key.toLowerCase():e.key;
  if(!supported.has(key))return;
  e.preventDefault();e.stopImmediatePropagation();keys.add(key);start();
},true);
document.addEventListener('keyup',e=>{const key=e.key.length===1?e.key.toLowerCase():e.key;keys.delete(key);},true);
window.addEventListener('blur',stop);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
new MutationObserver(()=>{if(panel.hidden)stop();}).observe(panel,{attributes:true,attributeFilter:['hidden']});
for(const id of ['drone-close','drone-reset','drone-auto','drone-btn']) document.getElementById(id).addEventListener('click',stop,true);
// Fractional values are essential: rounding every frame would stall slow inputs.
for(const input of [x,y,angle]) input.step='any';
