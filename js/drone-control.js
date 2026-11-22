export const FLIGHT_ZONE=Object.freeze({left:760,right:1420,top:120,bottom:215});
export function constrainFlight(x,y,angle=0){
 const safe=(v,fallback)=>Number.isFinite(v)?v:fallback;
 return {x:Math.max(FLIGHT_ZONE.left,Math.min(FLIGHT_ZONE.right,safe(x,1035))),y:Math.max(FLIGHT_ZONE.top,Math.min(FLIGHT_ZONE.bottom,safe(y,173))),angle:Math.max(-Math.PI/4,Math.min(Math.PI/4,safe(angle,0)))};
}

// the 360 view: the drone can circle the whole sky. Units as above (1000 = 1 radian from the
// centre of the view): azimuth all the way round, elevation 3 to 31 degrees.
export const WIDE_ZONE=Object.freeze({left:835-3141,right:835+3141,top:367-550,bottom:367-50});
export function constrainWide(x,y,angle=0){
 const safe=(v,fallback)=>Number.isFinite(v)?v:fallback;
 return {x:Math.max(WIDE_ZONE.left,Math.min(WIDE_ZONE.right,safe(x,1035))),y:Math.max(WIDE_ZONE.top,Math.min(WIDE_ZONE.bottom,safe(y,173))),angle:Math.max(-Math.PI/4,Math.min(Math.PI/4,safe(angle,0)))};
}
