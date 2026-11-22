import * as THREE from "three";
import { createFarm } from "./farm.js";
import { constrainFlight, FLIGHT_ZONE } from "./drone-control.js";
import { spring, blend } from "./motion.js";

/*
 * Shared by the main photo workshop (world.js), the old 3D preview room (room.js, no longer loaded)
 * and the 360 view (pano-view.js, lock screen only):
 * the photo's camera, its animated shader, the drone material and the dog animator.
 */
export const PHOTO = Object.freeze({ W: 1670, H: 942, F: 1000, CX: 835, YH: 367, HC: 1.3, PAR: 0.017, FOCUS_D: 0.3 });

export const PHOTO_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export const PHOTO_FRAG = /* glsl */ `
      precision highp float;
      uniform sampler2D tImg, tDepth, tMask, tMask2, tGravel, tConcrete;
      uniform float uTime, uPar, uFocusD, uTexel, uGust;
      uniform vec2 uMouse, uSize;
      uniform vec3 uBlink; uniform vec4 uEar; uniform float uWag, uTilt;
      varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
      float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
      vec2 parallax(vec2 uv){
        vec2 p = uv;
        for (int i = 0; i < 3; i++) { float d = texture2D(tDepth, p).r; p = uv - uMouse * (d - uFocusD) * uPar; }
        return p;
      }
      vec2 px(vec2 uv){ return vec2(uv.x * uSize.x, (1.0 - uv.y) * uSize.y); }
      vec2 toUv(vec2 P){ return vec2(P.x / uSize.x, 1.0 - P.y / uSize.y); }
      float glow(vec2 P, vec2 c, float r){ float d = length(P - c); return exp(-d * d / (r * r)); }
      // two-phase advection: moves the picture itself along a direction, looping seamlessly
      vec3 advect(vec2 uv, vec2 vel, float period, float jit){
        float ph0 = fract(uTime / period), ph1 = fract(uTime / period + 0.5);
        float w1 = abs(ph0 - 0.5) * 2.0;
        vec2 j0 = vec2(jit * floor(uTime / period), 0.0), j1 = vec2(jit * floor(uTime / period + 0.5) + 0.37, 0.0);
        vec3 a = texture2D(tImg, uv - vel * period * (ph0 - 0.5) + j0 * 0.0).rgb;
        vec3 b = texture2D(tImg, uv - vel * period * (ph1 - 0.5) + j1 * 0.0).rgb;
        return mix(a, b, w1);
      }
      void main(){
        float t = uTime;
        vec2 uv = parallax(vUv);
        float dd = texture2D(tDepth, uv).r;
        vec3 m = texture2D(tMask, uv).rgb;   // r water, g trees/vines, b sky
        vec3 m2 = texture2D(tMask2, uv).rgb; // r dirt yard, g concrete floor, b grass
        vec2 P = px(uv);
        vec2 ipx = 1.0 / uSize;

        // trees + vines: big masses move together in travelling gusts, leaves flutter on top
        float gustF = noise(vec2(P.x * 0.0035 - t * 0.32, 0.5));
        float gust = (0.35 + 0.65 * smoothstep(0.25, 0.85, gustF)) * (0.6 + 0.8 * uGust);
        vec2 sway = vec2(sin(t * 0.9 + P.y * 0.012) * 0.8 + sin(t * 2.1 + P.x * 0.025) * 0.3, sin(t * 1.4 + P.x * 0.018) * 0.3);
        vec2 flut = vec2(noise(P * 0.09 + t * 2.6), noise(P * 0.09 - t * 2.3 + 5.0)) - 0.5;
        uv += m.g * gust * (sway * 2.6 + flut * 1.7) * ipx;
        // grass and plants bend with the same wind; nearer grass moves more on screen
        float gg = noise(vec2(P.x * 0.012 - t * 0.7, P.y * 0.03));
        uv.x += m2.b * (sin(t * 1.7 + P.x * 0.05 + P.y * 0.03) * 0.5 + (gg - 0.5) * 1.6) * gust * (0.4 + dd * 14.0) * ipx.x;

        if (P.x < 480.0 && P.y > 500.0) {
        // the three dogs: each breathes at its own pace (chest/back rises a touch)
        {
          float b1 = 0.5 - 0.5 * cos(6.28318 * t / 3.1), b2 = 0.5 - 0.5 * cos(6.28318 * t / 4.2 + 1.3), b3 = 0.5 - 0.5 * cos(6.28318 * t / 2.6 + 2.1);
          uv.y -= smoothstep(1.0, 0.25, length((P - vec2(238.0, 650.0)) / vec2(40.0, 46.0))) * b1 * 0.9 * ipx.y;   // standing dog
          uv.y -= smoothstep(1.0, 0.25, length((P - vec2(262.0, 770.0)) / vec2(70.0, 32.0))) * smoothstep(812.0, 750.0, P.y) * b2 * 1.4 * ipx.y; // lying dog
          uv.y -= smoothstep(1.0, 0.25, length((P - vec2(405.0, 730.0)) / vec2(30.0, 34.0))) * b3 * 0.8 * ipx.y;   // little one
        }
        // ears: the pricked ears twitch now and then (a small turn about the base of each ear)
        {
          vec2 eb[4]; vec2 et[4];
          eb[0] = vec2(244.0, 576.0); et[0] = vec2(238.0, 557.0);
          eb[1] = vec2(290.0, 576.0); et[1] = vec2(305.0, 552.0);
          eb[2] = vec2(396.0, 666.0); et[2] = vec2(380.0, 640.0);
          eb[3] = vec2(430.0, 658.0); et[3] = vec2(438.0, 632.0);
          for (int i = 0; i < 4; i++) {
            float a = i == 0 ? uEar.x : i == 1 ? uEar.y : i == 2 ? uEar.z : uEar.w;
            vec2 ab = et[i] - eb[i]; float L = length(ab);
            vec2 q = P - eb[i]; float h = clamp(dot(q, ab) / (L * L), 0.0, 1.25);
            float w = smoothstep(9.0, 4.0, length(q - ab * min(h, 1.0))) * smoothstep(-0.05, 0.25, dot(q, ab) / (L * L));
            float an = a * w * h;
            vec2 rq = vec2(q.x * cos(an) - q.y * sin(an), q.x * sin(an) + q.y * cos(an));
            uv = mix(uv, toUv(eb[i] + rq), step(0.001, w * abs(a)));
          }
        }
        // eyes: each dog blinks on its own (the fur above slides down over the eye)
        {
          vec2 ec[6]; vec3 er[6];
          ec[0] = vec2(266.0, 595.0); er[0] = vec3(4.2, 2.6, 0.0);
          ec[1] = vec2(287.5, 592.5); er[1] = vec3(4.2, 2.6, 0.0);
          ec[2] = vec2(325.0, 707.0); er[2] = vec3(4.6, 2.6, 1.0);
          ec[3] = vec2(346.0, 702.0); er[3] = vec3(4.0, 2.4, 1.0);
          ec[4] = vec2(405.5, 675.0); er[4] = vec3(4.2, 2.8, 2.0);
          ec[5] = vec2(429.5, 671.0); er[5] = vec3(4.2, 2.8, 2.0);
          for (int i = 0; i < 6; i++) {
            float bl = er[i].z < 0.5 ? uBlink.x : er[i].z < 1.5 ? uBlink.y : uBlink.z;
            vec2 q2 = (P - ec[i]) / er[i].xy;
            float lid = step(P.y, ec[i].y - er[i].y + 2.0 * er[i].y * bl) * smoothstep(1.4, 0.85, length(q2)) * step(0.02, bl);
            uv = mix(uv, toUv(P - vec2(0.0, 2.3 * er[i].y)), lid);
          }
        }
        // the standing dog's curled tail wags (a turn about its base); faster when he's excited
        {
          vec2 tb = vec2(236.0, 596.0), q = P - tb;
          float w = smoothstep(46.0, 30.0, length(P - vec2(222.0, 548.0))) * step(P.x, 252.0) * step(P.y, 600.0);
          float an = uWag * w;
          vec2 rq = vec2(q.x * cos(an) - q.y * sin(an), q.x * sin(an) + q.y * cos(an));
          uv = mix(uv, toUv(tb + rq), step(0.001, w));
        }
        // the little one tilts its head now and then
        {
          vec2 nb = vec2(415.0, 712.0), q = P - nb;
          float w = smoothstep(44.0, 30.0, length(P - vec2(414.0, 670.0))) * step(P.y, 716.0);
          float an = uTilt * w;
          vec2 rq = vec2(q.x * cos(an) - q.y * sin(an), q.x * sin(an) + q.y * cos(an));
          uv = mix(uv, toUv(nb + rq), step(0.001, w));
        }
        }


        // the hanging lamp sways a touch on its cord
        float ang = 0.010 * sin(t * 0.8) + 0.004 * sin(t * 1.9 + 1.0);
        float lm = smoothstep(1462.0, 1472.0, P.x) * smoothstep(1600.0, 1590.0, P.x) * smoothstep(122.0, 112.0, P.y);
        vec2 pv = vec2(1530.0, -80.0), q = P - pv;
        vec2 rq = vec2(q.x * cos(ang) + q.y * sin(ang), -q.x * sin(ang) + q.y * cos(ang));
        uv = mix(uv, toUv(pv + rq), lm);

        vec3 col = texture2D(tImg, uv).rgb;
        P = px(uv);

        // clouds drift slowly to the right (the picture of the sky itself moves)
        if (m.b > 0.02) {
          vec3 sky = advect(uv, vec2(0.0024, 0.0), 16.0, 0.0);
          float edge = texture2D(tMask, uv - vec2(0.0024 * 8.0, 0.0)).b * texture2D(tMask, uv + vec2(0.0024 * 8.0, 0.0)).b;
          col = mix(col, sky, m.b * edge);
        }
        // the pond: calm water with slow, small ripples; the light on it shimmers gently
        if (m.r > 0.02) {
          float zf = 0.3 + dd * 6.0; // nearer water shows bigger ripples
          vec2 rip = vec2(noise(P * vec2(0.05, 0.16) + vec2(t * 0.35, t * 0.12)), noise(P * vec2(0.07, 0.2) - vec2(t * 0.28, -t * 0.1) + 7.0)) - 0.5;
          vec2 rip2 = vec2(noise(P * vec2(0.14, 0.4) + t * 0.6), noise(P * vec2(0.16, 0.45) - t * 0.55 + 3.0)) - 0.5;
          vec2 off = (rip * 3.4 + rip2 * 1.3) * zf * ipx * vec2(1.0, 0.55);
          vec3 w = texture2D(tImg, uv + off * m.r).rgb;
          col = mix(col, w, m.r);
          float gl = smoothstep(0.82, 0.97, noise(P * vec2(0.22, 0.7) + vec2(t * 0.25, 0.0))) * smoothstep(0.55, 0.9, lum(col));
          col += m.r * gl * vec3(1.0, 0.85, 0.65) * 0.35;
        }

        // Preserve the photograph: no sharpening or synthetic surface overlays.

        // light: lamps, sun, monitor spill, LEDs (steady, like the real things)
        col += vec3(1.0, 0.72, 0.42) * 0.07 * glow(P, vec2(300.0, 196.0), 70.0);       // the sun
        col += vec3(1.0, 0.72, 0.42) * 0.12 * glow(P, vec2(790.0, 446.0), 30.0);       // desk lamp
        col += vec3(1.0, 0.75, 0.45) * 0.045 * glow(P, vec2(770.0, 540.0), 110.0);
        col += vec3(1.0, 0.70, 0.40) * 0.08 * glow(P, vec2(1530.0, 102.0), 40.0);      // hanging lamp
        col += vec3(0.55, 0.85, 1.0) * 0.035 * glow(P, vec2(995.0, 590.0), 120.0);     // screen spill on the desk
        float led = step(0.5, fract(t * 0.9));
        col += vec3(0.3, 0.6, 1.0) * 0.5 * glow(P, vec2(1462.0, 862.0), 3.0) * led;    // ESP32 LED
        col += vec3(0.6, 0.9, 1.0) * 0.06 * glow(P, vec2(1566.0, 800.0), 10.0);       // multimeter display
        gl_FragColor = vec4(col, dd);
      }`;

export function droneMaterial({ droneTex, tMask, uTime, keepAlpha, W = PHOTO.W, H = PHOTO.H }) {
  return new THREE.ShaderMaterial({
    uniforms: { tDrone: { value: droneTex }, tMask: { value: tMask }, uTime, uTilt: { value: 0 } },
    transparent: true, depthTest: false, depthWrite: false, ...keepAlpha, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    vertexShader: `uniform float uTilt; varying vec2 vUv; varying vec2 vPhoto; void main(){ vUv = uv; vec3 p = position; float c = cos(uTilt), s = sin(uTilt); p.xy = vec2(p.x * c - p.y * s, p.x * s + p.y * c); vec4 w = modelMatrix * vec4(p, 1.0); vPhoto = w.xy / vec2(${W}.0, ${H}.0); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform sampler2D tDrone, tMask; uniform float uTime; varying vec2 vUv; varying vec2 vPhoto;
    void main(){ vec4 c = texture2D(tDrone, vUv);
      // the tree is nearer than the drone: its leaves hide it
      c.a *= 1.0 - smoothstep(0.15, 0.55, texture2D(tMask, vPhoto).g);
      // spinning rotors: the blade areas flicker slightly
      float rot = step(0.72, vUv.y) * (0.75 + 0.25 * sin(uTime * 90.0 + vUv.x * 40.0));
      c.a *= mix(1.0, rot, step(0.72, vUv.y));
      gl_FragColor = c; }`,
  });
}

/* Solve the 3x3 homography that maps four source points to four destination points. */
export function homography(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
    for (let r = 0; r < 8; r++) if (r !== c) {
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const h = b.map((v, i) => v / A[i][i]);
  return (x, y) => { const w = h[6] * x + h[7] * y + 1; return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w]; };
}

const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const rand = (a, b) => a + Math.random() * (b - a);

/* The three dogs: blinks, ear flicks, the standing dog's tail and the little one's head tilt. */
export class DogAnimator {
  constructor(uniforms) {
    this.u = uniforms;
    this.excite = 0; this.tiltNext = 5; this.tiltAt = -9; this.tiltDir = 1;
    this.blinks = [0, 1, 2].map((i) => ({ next: 1.5 + i * 1.7 + Math.random() * 2, at: -9 }));
    this.ears = [0, 1, 2, 3].map(() => ({ next: 4 + Math.random() * 8, at: -9, amp: 0 }));
  }
  pat(i, t) {
    const e = i === 0 ? [0, 1] : i === 2 ? [2, 3] : [];
    e.forEach((k) => { this.ears[k].at = t; this.ears[k].amp = (k % 2 ? 1 : -1) * 0.2; });
    if (i === 0) this.excite = 1;
    if (i === 2) { this.tiltAt = t; this.tiltDir = -this.tiltDir; }
  }
  update(t, dt) {
    const u = this.u;
    // each dog blinks on its own clock (sometimes a quick double blink)
    this.blinks.forEach((b, i) => {
      if (t > b.next) { b.at = t; b.next = t + 2.8 + Math.random() * 5; if (Math.random() < 0.18) b.next = t + 0.38; }
      const bp = (t - b.at) / 0.17;
      u.uBlink.value.setComponent(i, bp >= 0 && bp < 1 ? Math.sin(bp * Math.PI) : 0);
    });
    // the odd ear flick: a quick turn and a slower settle
    this.ears.forEach((e, i) => {
      if (t > e.next) { e.at = t; e.amp = (i % 2 ? 1 : -1) * (0.12 + Math.random() * 0.1); e.next = t + 6 + Math.random() * 12; }
      const ep = t - e.at;
      const v = ep < 0 ? 0 : ep < 0.08 ? ep / 0.08 : Math.exp(-(ep - 0.08) * 6) * Math.cos((ep - 0.08) * 18);
      u.uEar.value.setComponent(i, e.amp * v);
    });
    // tail wag (always a lazy sway; a proper wag after a pat) and the head tilt
    this.excite = Math.max(0, this.excite - dt * 0.25);
    u.uWag.value = Math.sin(t * (3 + this.excite * 9)) * (0.04 + this.excite * 0.14);
    if (t > this.tiltNext) { this.tiltAt = t; this.tiltDir = Math.random() < 0.5 ? -1 : 1; this.tiltNext = t + rand(7, 16); }
    const tp = t - this.tiltAt;
    u.uTilt.value = this.tiltDir * 0.13 * (tp < 0 ? 0 : tp < 0.35 ? ease(tp / 0.35) : tp < 2.2 ? 1 : 1 - ease((tp - 2.2) / 0.5));
  }
}

/* ------------------------------------------------------------------ *
 *  The live photo layer for the 3D room: the same animated photo as the
 *  main experience (pond, trees, grass, clouds, dogs, cows, sprinklers,
 *  drone, the lit monitor), rendered into a texture the room maps onto
 *  its photo shell. No mouse parallax: the room moves a real camera.
 * ------------------------------------------------------------------ */
export const MONITOR = [[847, 392], [1143, 396], [1143, 554], [847, 541]]; // TL TR BR BL, image px
export const TABLET = [[1114, 553], [1203, 549], [1205, 636], [1112, 640]];
export const KEEP_ALPHA = { blending: THREE.CustomBlending, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor };

/** The monitor's lock screen (time, date, "Select to sign in") over a crop of the workshop photo. */
export function drawLockScreen(screenCanvas, wallpaper) {
    const g = screenCanvas.getContext("2d"), w = screenCanvas.width, h = screenCanvas.height;
    if (wallpaper.complete && wallpaper.naturalWidth) { g.filter = "brightness(0.82) saturate(1.05)"; g.drawImage(wallpaper, 470, 92, 420, 420 / (w / h), -12, -12, w + 24, h + 24); g.filter = "none"; }
    else { g.fillStyle = "#24382c"; g.fillRect(0, 0, w, h); }
    const shade = g.createLinearGradient(0, 0, 0, h);
    shade.addColorStop(0, "rgba(0,0,0,.35)"); shade.addColorStop(0.45, "rgba(0,0,0,0)"); shade.addColorStop(1, "rgba(0,0,0,.4)");
    g.fillStyle = shade; g.fillRect(0, 0, w, h);
    const now = new Date(), pad = (n) => String(n).padStart(2, "0");
    g.textAlign = "center"; g.fillStyle = "#fff"; g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = 12;
    g.font = "300 118px 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"; g.fillText(`${pad(now.getHours())}:${pad(now.getMinutes())}`, w / 2, h * 0.33);
    g.font = "400 26px 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"; g.fillText(now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }), w / 2, h * 0.33 + 44);
    g.font = "400 17px 'Segoe UI', Arial, sans-serif"; g.globalAlpha = 0.85; g.fillText("Select to sign in", w / 2, h - 34); g.globalAlpha = 1; g.shadowBlur = 0;
}

export function createLivePhoto({ renderer, loader }) {
  const { W, H } = PHOTO;
  const raw = (t) => { t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; };
  const tiled = (t) => { t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const tImg = raw(loader.load("assets/workshop.jpg"));
  const tDepth = raw(loader.load("assets/workshop-depth.png"));
  const tMask = raw(loader.load("assets/workshop-masks.png"));
  const uniforms = {
    tImg: { value: tImg }, tDepth: { value: tDepth }, tMask: { value: tMask }, tMask2: { value: raw(loader.load("assets/workshop-masks2.png")) },
    tGravel: { value: tiled(loader.load("assets/tex/gravel.jpg")) }, tConcrete: { value: tiled(loader.load("assets/tex/concrete.jpg")) },
    uTime: { value: 0 }, uMouse: { value: new THREE.Vector2() }, uPar: { value: 0 }, uFocusD: { value: PHOTO.FOCUS_D },
    uSize: { value: new THREE.Vector2(W, H) }, uTexel: { value: 1 }, uGust: { value: 0.5 },
    uBlink: { value: new THREE.Vector3() }, uEar: { value: new THREE.Vector4() }, uWag: { value: 0 }, uTilt: { value: 0 },
  };
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, W, H, 0, -10, 10);
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.ShaderMaterial({ uniforms, depthTest: false, depthWrite: false, vertexShader: PHOTO_VERT, fragmentShader: PHOTO_FRAG }));
  photo.position.set(W / 2, H / 2, 0);
  scene.add(photo);

  // the monitor's lock screen, mapped onto the photo's (green) screen
  const Hm = homography([[0, 1], [1, 1], [1, 0], [0, 0]], MONITOR.map(([x, y]) => [x, H - y]));
  const screenGeo = new THREE.PlaneGeometry(1, 1, 16, 16);
  { const p = screenGeo.attributes.position, uv = screenGeo.attributes.uv;
    for (let i = 0; i < p.count; i++) { const [x, y] = Hm(uv.getX(i), uv.getY(i)); p.setXYZ(i, x, y, 1); } }
  const screenCanvas = document.createElement("canvas"); screenCanvas.width = 1024; screenCanvas.height = 576;
  const screenTex = new THREE.CanvasTexture(screenCanvas); screenTex.colorSpace = THREE.NoColorSpace;
  scene.add(new THREE.Mesh(screenGeo, new THREE.ShaderMaterial({
    uniforms: { tScreen: { value: screenTex } }, depthTest: false, depthWrite: false,
    vertexShader: PHOTO_VERT,
    fragmentShader: `precision highp float; uniform sampler2D tScreen; varying vec2 vUv;
      void main(){ vec3 c = texture2D(tScreen, vUv).rgb; vec2 d = vUv - 0.5; c *= 0.88 - 0.36 * dot(d, d);
        c = mix(vec3(0.012), c, smoothstep(0.0, 0.006, vUv.x) * smoothstep(1.0, 0.994, vUv.x) * smoothstep(0.0, 0.01, vUv.y) * smoothstep(1.0, 0.99, vUv.y));
        gl_FragColor = vec4(c, 0.376); }`,
  })));
  const wallpaper = new Image(); wallpaper.src = "assets/workshop.jpg";
  let lastMinute = -1;
  function drawScreen() { drawLockScreen(screenCanvas, wallpaper); screenTex.needsUpdate = true; }
  wallpaper.onload = () => { lastMinute = -1; };

  // depth on the CPU for the farm's sprinkler heads
  const depthCPU = { data: null, w: 0, h: 0 };
  const depthImg = new Image();
  depthImg.onload = () => { const c = document.createElement("canvas"); c.width = depthCPU.w = 835; c.height = depthCPU.h = 471; const g = c.getContext("2d"); g.drawImage(depthImg, 0, 0, c.width, c.height); depthCPU.data = g.getImageData(0, 0, c.width, c.height).data; };
  depthImg.src = "assets/workshop-depth.png";
  const depthAt = (x, y) => { if (!depthCPU.data) return 0.3; const ix = Math.max(0, Math.min(depthCPU.w - 1, Math.round(x / W * depthCPU.w))), iy = Math.max(0, Math.min(depthCPU.h - 1, Math.round(y / H * depthCPU.h))); return depthCPU.data[(iy * depthCPU.w + ix) * 4] / 255; };
  const farm = createFarm({ scene, loader, uniforms, keepAlpha: KEEP_ALPHA, depthAt, depthTexture: tDepth });

  // the drone, with the same autopilot and flight limits as the main experience
  const drone = new THREE.Mesh(new THREE.PlaneGeometry(100, 26), droneMaterial({ droneTex: raw(loader.load("assets/drone.png")), tMask, uTime: uniforms.uTime, keepAlpha: KEEP_ALPHA }));
  drone.position.z = 1.5; scene.add(drone);
  const flight = { x: 1035, y: 173, tx: 1035, ty: 173, vx: 0, vy: 0, tilt: 0, next: 0, manual: false, angle: 0, rotation: 0 };
  const sx = { x: 1035, v: 0 }, sy = { x: 173, v: 0 };
  const rand = (a, b) => a + Math.random() * (b - a);
  function updateDrone(dt, t, reduced) {
    const d = flight;
    if (!d.manual && t > d.next) { d.tx = rand(FLIGHT_ZONE.left, FLIGHT_ZONE.right); d.ty = rand(FLIGHT_ZONE.top, FLIGHT_ZONE.bottom); d.next = t + rand(4, 9); }
    const b = constrainFlight(d.tx, d.ty, d.angle); d.tx = b.x; d.ty = b.y; d.angle = b.angle;
    if (reduced) { d.x = d.tx; d.y = d.ty; d.vx = d.vy = 0; d.rotation = d.angle; }
    else {
      sx.x = d.x; sx.v = d.vx; sy.x = d.y; sy.v = d.vy;
      const k = d.manual ? 3.2 : 0.8;
      d.x = spring(sx, d.tx, k, dt); d.vx = sx.v; d.y = spring(sy, d.ty, k * 1.1, dt); d.vy = sy.v;
      d.tilt += (-d.vx * 0.004 - d.tilt) * blend(3, dt);
      d.rotation += (d.angle - d.rotation) * blend(5, dt);
    }
    drone.position.x = d.x;
    drone.position.y = H - (d.y + (reduced ? 0 : Math.sin(t * 1.9) * 1.2));
    drone.scale.setScalar(Math.min(1.1, 0.75 + (d.y - 120) / 95 * 0.35));
    drone.rotation.z = d.rotation;
    drone.material.uniforms.uTilt.value = d.tilt;
  }

  const dogs = new DogAnimator(uniforms);
  // the render target holds only the part of the photo that's on screen, at screen resolution
  const rt = new THREE.WebGLRenderTarget(4, 4, { depthBuffer: false });
  rt.texture.generateMipmaps = false; rt.texture.minFilter = THREE.LinearFilter;
  const rect = new THREE.Vector4(0, 0, 1, 1);   // visible photo region, uv (v up)
  const fill = new THREE.Vector2(1, 1);         // used part of the render target
  let time = 0, pixelScale = 1;
  return {
    texture: rt.texture, rect, fill, uniforms, flight, dogs,
    resize(width, height) { rt.setSize(Math.max(4, Math.ceil(width)), Math.max(4, Math.ceil(height))); },
    /** advance the animation; dt is 0 while paused or for reduced motion */
    update(dt, reduced) {
      time += dt; const t = time;
      uniforms.uTime.value = t;
      uniforms.uGust.value = 0.5 + 0.5 * Math.sin(t * 0.21) * Math.sin(t * 0.083 + 1.3);
      farm.update(dt, t, pixelScale, reduced);
      dogs.update(t, dt);
      updateDrone(dt, t, reduced);
      const m = new Date().getMinutes(); if (m !== lastMinute) { lastMinute = m; drawScreen(); }
    },
    /**
     * Render the photo region [x0,x1]x[y0,y1] (image px, y down) at `scale` render-target px per image px.
     * Returns false when nothing of the photo is in view.
     */
    render(x0, y0, x1, y1, scale) {
      x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(W, Math.ceil(x1)); y1 = Math.min(H, Math.ceil(y1));
      if (x1 - x0 < 1 || y1 - y0 < 1) return false;
      const vw = Math.min(rt.width, Math.max(1, Math.round((x1 - x0) * scale))), vh = Math.min(rt.height, Math.max(1, Math.round((y1 - y0) * scale)));
      pixelScale = Math.min(vw / (x1 - x0), vh / (y1 - y0));
      camera.left = x0; camera.right = x1; camera.top = H - y0; camera.bottom = H - y1; camera.updateProjectionMatrix();
      rect.set(x0 / W, 1 - y1 / H, x1 / W, 1 - y0 / H); fill.set(vw / rt.width, vh / rt.height);
      const prev = renderer.getRenderTarget();
      rt.viewport.set(0, 0, vw, vh); rt.scissor.set(0, 0, vw, vh); rt.scissorTest = true;
      renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(true, false, false);
      renderer.render(scene, camera);
      renderer.setRenderTarget(prev);
      return true;
    },
    pilot: {
      set(x, y, angleDeg) { const f = constrainFlight(x, y, angleDeg * Math.PI / 180); Object.assign(flight, { manual: true, tx: f.x, ty: f.y, angle: f.angle }); },
      reset() { Object.assign(flight, { manual: true, tx: 1035, ty: 173, angle: 0 }); },
      auto() { Object.assign(flight, { manual: false, angle: 0, next: -1 }); },
      take() { Object.assign(flight, { manual: true, tx: flight.x, ty: flight.y }); },
    },
    dispose() { rt.dispose(); },
  };
}
