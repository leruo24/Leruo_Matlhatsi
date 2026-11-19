import test from 'node:test';
import assert from 'node:assert/strict';
import {spring, FrameBudget} from '../js/motion.js';

test('camera interpolation agrees at 30, 60 and 120 frames per second',()=>{
  const results=[30,60,120].map(fps=>{
    const state={x:0,v:0};
    for(let i=0;i<fps*2;i++)spring(state,100,6,1/fps);
    return state;
  });
  for(const state of results){
    assert.ok(Math.abs(state.x-results[0].x)<1e-9);
    assert.ok(Math.abs(state.v-results[0].v)<1e-9);
    assert.ok(state.x<=100 && state.x>99.9);
  }
});
test('pausing freezes velocity and position; interrupted transitions remain finite',()=>{
  const state={x:0,v:0};
  spring(state,100,6,.2);
  const before={...state};
  spring(state,-50,6,0);
  assert.deepEqual(state,before);
  for(let i=0;i<300;i++)spring(state,-50,6,1/60);
  assert.ok(Number.isFinite(state.v));
  assert.ok(Math.abs(state.x+50)<.001);
});
test('resolution ignores tab interruptions and isolated slow frames',()=>{
  const budget=new FrameBudget(1.5);
  assert.equal(budget.sample(15),1.5);
  budget.sample(.06);
  for(let i=0;i<120;i++)budget.sample(1/60);
  assert.equal(budget.scale,1.5);
});
test('sustained slow rendering lowers quality and stable recovery raises it slowly',()=>{
  const budget=new FrameBudget(1.5);
  for(let i=0;i<300;i++)budget.sample(1/30);
  assert.ok(budget.scale<1.5 && budget.scale>=.6);
  const low=budget.scale;
  for(let i=0;i<60;i++)budget.sample(1/60);
  assert.equal(budget.scale,low);
  for(let i=0;i<1200;i++)budget.sample(1/60);
  assert.ok(budget.scale>low && budget.scale<=1.5);
});
