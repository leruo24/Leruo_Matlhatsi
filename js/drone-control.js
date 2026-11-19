export const FLIGHT_ZONE=Object.freeze({left:760,right:1420,top:120,bottom:215});
export function constrainFlight(x,y,angle=0){
 const safe=(v,fallback)=>Number.isFinite(v)?v:fallback;
 return {x:Math.max(FLIGHT_ZONE.left,Math.min(FLIGHT_ZONE.right,safe(x,1035))),y:Math.max(FLIGHT_ZONE.top,Math.min(FLIGHT_ZONE.bottom,safe(y,173))),angle:Math.max(-Math.PI/4,Math.min(Math.PI/4,safe(angle,0)))};
}
