import test from 'node:test';
import assert from 'node:assert/strict';
import {constrainFlight,FLIGHT_ZONE} from '../js/drone-control.js';
test('manual drone cannot leave distant sky or rotate beyond bank limits',()=>{
 assert.deepEqual(constrainFlight(-1,9999,10),{x:760,y:215,angle:Math.PI/4});
 assert.deepEqual(constrainFlight(9999,-1,-10),{x:1420,y:120,angle:-Math.PI/4});
});
test('non-finite control input recovers to safe sky coordinates',()=>{
 const r=constrainFlight(NaN,Infinity,-Infinity);assert.deepEqual(r,{x:1035,y:173,angle:0});
 assert.ok(r.y>=FLIGHT_ZONE.top&&r.y<=FLIGHT_ZONE.bottom);
});
