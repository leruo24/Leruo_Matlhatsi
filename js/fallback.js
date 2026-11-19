import { OfficeMotion } from './office.js';
import { Sound } from './sound.js';

export function startFallback() {
  const $ = s => document.querySelector(s);
  const vr=$('#vr'), office=new OfficeMotion($('.vr-office')), sound=new Sound();
  const frame=$('#os-frame'), layer=$('#os-layer'), back=$('#back-btn');
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  let entered=false, finished=false, last=performance.now(), transitioning=false;
  $('#loader').classList.add('done');
  document.body.classList.add('vr'); vr.classList.add('gated');
  $('#world').style.cssText='background:url(assets/workshop.jpg) center / cover no-repeat';
  $('#pause-btn').hidden=true; $('#help-btn').hidden=true;
  $('#hint').textContent='Still scene · Open the computer to explore my projects';
  const pc=document.createElement('button');
  pc.className='pill fallback-pc'; pc.textContent='Step into my computer ↗'; pc.hidden=true;
  document.body.append(pc);
  function syncSound() {
    for(const id of ['#sound-btn','#vr-mute']) {
      $(id).textContent=sound.enabled?'Sound on':'Sound off';
      $(id).setAttribute('aria-pressed',String(sound.enabled));
    }
    frame.contentWindow?.postMessage({type:'host',action:'mute',on:sound.enabled},location.origin);
  }
  function finish() {
    if(finished || transitioning)return;
    transitioning=true; sound.start(); sound.nature=1;
    vr.classList.add('playing'); vr.style.transition='opacity .7s'; vr.style.opacity='0';
    setTimeout(()=>{finished=true; vr.classList.add('gone'); document.body.classList.remove('vr'); document.body.classList.add('exploring');pc.hidden=false;},720);
  }
  function openPC(page) {
    sound.start();sound.setFocus('monitor');
    layer.classList.add('on');layer.setAttribute('aria-hidden','false');back.hidden=false;pc.hidden=true;
    frame.contentWindow?.postMessage({type:'host',action:'focus'},location.origin); syncSound();
    if(page)frame.contentWindow?.postMessage({type:'host',action:'open',page},location.origin);
    frame.focus();
  }
  function closePC(){layer.classList.remove('on');layer.setAttribute('aria-hidden','true');back.hidden=true;pc.hidden=false;sound.setFocus(null);frame.contentWindow?.postMessage({type:'host',action:'blur'},location.origin);}
  $('#vr-enter').onclick=()=>{entered=true;$("#vr-gate").classList.add("out");vr.classList.remove('gated');sound.start();};
  $('#vr-go').onclick=finish;$('#vr-skip').onclick=finish;
  $('#sound-btn').onclick=$('#vr-mute').onclick=()=>{sound.start();sound.toggle();syncSound();};
  pc.onclick=()=>openPC();$('#cv-btn').onclick=()=>openPC('resume');back.onclick=closePC;
  addEventListener('keydown',e=>{if(e.key==='Escape'){if(!finished)finish();else closePC();}});
  addEventListener('message',e=>{
    if(e.origin!==location.origin || e.source!==frame.contentWindow || e.data?.type!=='os')return;
    if(['zoom-out','shutdown'].includes(e.data.action))closePC();
  });
  let wasRunning=false;
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){wasRunning=sound.ctx?.state==='running';if(wasRunning)sound.ctx.suspend();}
    else if(wasRunning)sound.ctx?.resume();
  });
  syncSound();
  function tick(now){requestAnimationFrame(tick);const dt=Math.min(.05,(now-last)/1000);last=now;if(document.hidden)return;office.draw(dt,entered&&!finished,motion.matches);sound.update(dt);}
  requestAnimationFrame(tick);
}
