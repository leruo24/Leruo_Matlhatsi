import test from 'node:test';
import assert from 'node:assert/strict';
import {createRenderLoop} from '../js/render-loop.js';
function harness(render) {
 let time=0, callback, count=0;
 const loop=createRenderLoop(render,{request:fn=>{callback=fn;count++;return count;},cancel:()=>callback=null,now:()=>time});
 return {loop,advance(ms){time+=ms;const fn=callback;callback=null;fn?.(time);},get count(){return count;},get pending(){return !!callback;}};
}
test('continuous frames preserve elapsed time even when rendering costs time',()=>{
 const elapsed=[];const h=harness((dt)=>{elapsed.push(dt);return elapsed.length<3;});
 h.loop.wake();h.loop.wake();assert.equal(h.count,1);
 h.advance(16);h.advance(20);h.advance(17);
 assert.deepEqual(elapsed,[.016,.020,.017]);assert.equal(h.pending,false);
});
test('idle and stopped loops restart without a large animation jump',()=>{
 const times=[];const h=harness(dt=>{times.push(dt);return true;});
 h.loop.wake();h.advance(16);h.loop.stop();h.advance(5000);h.loop.wake();h.advance(16);
 assert.deepEqual(times,[.016,.016]);
});
test('long frames clamp motion time while retaining raw performance sample',()=>{
 let sample;const h=harness((dt,raw)=>{sample=[dt,raw];return false;});h.loop.wake();h.advance(200);assert.deepEqual(sample,[.05,.2]);
});
