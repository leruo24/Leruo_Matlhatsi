import test from 'node:test';
import assert from 'node:assert/strict';
import {limitYaw,dragYaw} from '../js/yaw.js';
test('yaw clamps at a half-turn in either direction',()=>{assert.equal(limitYaw(8),Math.PI);assert.equal(limitYaw(-8),-Math.PI);assert.equal(limitYaw(.5),.5);});
test('horizontal drag is viewport-relative and remains bounded',()=>{assert.equal(dragYaw(0,500,1000),-Math.PI/2);assert.equal(dragYaw(0,-500,1000),Math.PI/2);assert.equal(dragYaw(0,5000,1000),-Math.PI);assert.ok(Number.isFinite(dragYaw(0,5,0)));});

import { limitPitch, dragPitch, MAX_PITCH } from '../js/yaw.js';
test('vertical look stops at 60 degrees to prevent flipping',()=>{assert.equal(limitPitch(10),MAX_PITCH);assert.equal(limitPitch(-10),-MAX_PITCH);assert.equal(limitPitch(0),0);});
test('vertical drag follows grab direction and remains finite',()=>{assert.equal(dragPitch(0,250,1000),Math.PI/8);assert.equal(dragPitch(0,-250,1000),-Math.PI/8);assert.equal(dragPitch(0,99999,0),MAX_PITCH);});
