import * as THREE from "three";
import { Sound } from "./sound.js";

/*
 * Leruo's workshop: a photograph that behaves like a real place.
 *
 *  1. The photo is drawn with an AI depth map, so it shifts in true depth as you look around.
 *  2. A 3D camera is matched to the photo (focal length, horizon, camera height), so the birds
 *     that cross the sky are real 3D objects, tested against the photo's depth so the leaves
 *     pass in front of them.
 *  3. The pond, trees, grass, clouds, the drone and the three dogs (breathing, blinking, ears)
 *     are animated inside the photo, with restrained, believable motion.
 *  4. Everything is graded together in one final pass (focus pull, vignette, grain).
 */
const P = window.PORTFOLIO || {};
const W = 1670, H = 942; // image size (px)
const SCREEN = [[847, 392], [1143, 396], [1143, 554], [847, 541]]; // TL TR BR BL of the main monitor (its green screen)
const SCREEN_C = [995, 470];
const PAR = 0.011; // parallax strength (uv units at full mouse travel)
const FOCUS_D = 0.3; // depth that stays still while you look around
// camera matched to the photo: focal length (px), principal point / horizon (px), height (m)
const F = 1000, CX = 835, YH = 367, HC = 1.3;

const HOTSPOTS = {
  monitor: { label: "Use the computer", x: 995, y: 470, rx: 160, ry: 100 },
};

const $ = (s) => document.querySelector(s);
const canvas = $("#world");
const sound = new Sound();
const params = new URLSearchParams(location.search);
const rand = (a, b) => a + Math.random() * (b - a);

/* ------------------------------------------------------------------ *
 *  Renderer, render target, textures
 * ------------------------------------------------------------------ */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance", preserveDrawingBuffer: location.search.includes("debug") });
const coarse = matchMedia("(pointer: coarse)").matches;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.5 : 2));
renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // the photo is display-ready; everything is composed in display space
renderer.autoClear = false;
// colour = photo + 3D in display space, alpha = disparity (1 / distance) for the focus pull
const rt = new THREE.WebGLRenderTarget(4, 4, { samples: new URLSearchParams(location.search).has("nomsaa") ? 0 : coarse ? 2 : 4, depthBuffer: true });

const manager = new THREE.LoadingManager();
const loader = new THREE.TextureLoader(manager);
const raw = (t) => { t.colorSpace = THREE.NoColorSpace; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; };
const tiled = (t) => { t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t; };
const tImg = raw(loader.load("assets/workshop.jpg"));
const tDepth = raw(loader.load("assets/workshop-depth.png"));
const tMask = raw(loader.load("assets/workshop-masks.png"));
const tMask2 = raw(loader.load("assets/workshop-masks2.png"));
const tGravel = tiled(loader.load("assets/tex/gravel.jpg"));
const tConcrete = tiled(loader.load("assets/tex/concrete.jpg"));

// depth on the CPU too (markers, focus, placing things)
const depthCPU = { data: null, w: 0, h: 0 };
const depthImg = new Image();
depthImg.onload = () => {
  const c = document.createElement("canvas");
  c.width = depthCPU.w = 835; c.height = depthCPU.h = 471;
  const g = c.getContext("2d");
  g.drawImage(depthImg, 0, 0, c.width, c.height);
  depthCPU.data = g.getImageData(0, 0, c.width, c.height).data;
};
depthImg.src = "assets/workshop-depth.png";
function depthAt(x, y) {
  if (!depthCPU.data) return 0.3;
  const ix = Math.max(0, Math.min(depthCPU.w - 1, Math.round((x / W) * depthCPU.w)));
  const iy = Math.max(0, Math.min(depthCPU.h - 1, Math.round((y / H) * depthCPU.h)));
  return depthCPU.data[(iy * depthCPU.w + ix) * 4] / 255;
}
// photo <-> world (metres). Camera at (0, HC, 0) looking down -Z. Depth map value ≈ 1 / distance.
const unproject = (x, y, Z) => new THREE.Vector3(((x - CX) * Z) / F, HC - ((y - YH) * Z) / F, -Z);
const onGround = (x, y) => unproject(x, y, (F * HC) / (y - YH));
const onPlane = (x, y, h) => unproject(x, y, (F * (HC - h)) / (y - YH));
const project = (v) => [CX + (F * v.x) / -v.z, YH - (F * (v.y - HC)) / -v.z];

/* ------------------------------------------------------------------ *
 *  Layer 1: the photo (orthographic, world units = image px, y up)
 * ------------------------------------------------------------------ */
const photoScene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(0, W, H, 0, -10, 10);
const uniforms = {
  tImg: { value: tImg }, tDepth: { value: tDepth }, tMask: { value: tMask }, tMask2: { value: tMask2 },
  tGravel: { value: tGravel }, tConcrete: { value: tConcrete },
  uTime: { value: 0 }, uMouse: { value: new THREE.Vector2() }, uPar: { value: PAR }, uFocusD: { value: FOCUS_D },
  uSize: { value: new THREE.Vector2(W, H) }, uTexel: { value: 1 }, uGust: { value: 0.5 },
  uBlink: { value: new THREE.Vector3() }, uEar: { value: new THREE.Vector4() }, uDrone: { value: new THREE.Vector2() },
};
const KEEP_ALPHA = { blending: THREE.CustomBlending, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor };

const photo = new THREE.Mesh(
  new THREE.PlaneGeometry(W, H),
  new THREE.ShaderMaterial({
    uniforms, depthTest: false, depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D tImg, tDepth, tMask, tMask2, tGravel, tConcrete;
      uniform float uTime, uPar, uFocusD, uTexel, uGust;
      uniform vec2 uMouse, uSize;
      uniform vec3 uBlink; uniform vec4 uEar; uniform vec2 uDrone;
      varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
      float lum(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
      vec2 parallax(vec2 uv){
        vec2 p = uv;
        for (int i = 0; i < 5; i++) { float d = texture2D(tDepth, p).r; p = uv - uMouse * (d - uFocusD) * uPar; }
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
        uv += m.g * gust * (sway * 1.5 + flut * 1.0) * ipx;
        // grass and plants bend with the same wind; nearer grass moves more on screen
        float gg = noise(vec2(P.x * 0.012 - t * 0.7, P.y * 0.03));
        uv.x += m2.b * (sin(t * 1.7 + P.x * 0.05 + P.y * 0.03) * 0.5 + (gg - 0.5) * 1.6) * gust * (0.4 + dd * 14.0) * ipx.x;

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
        // the drone hovers: a gentle bob and drift, nothing more
        {
          float dm = smoothstep(52.0, 36.0, abs(P.x - 1032.0)) * smoothstep(22.0, 12.0, abs(P.y - 171.0));
          uv -= dm * uDrone * ipx;
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
          vec3 sky = advect(uv, vec2(0.0011, 0.0), 24.0, 0.0);
          float edge = texture2D(tMask, uv - vec2(0.0011 * 12.0, 0.0)).b * texture2D(tMask, uv + vec2(0.0011 * 12.0, 0.0)).b;
          col = mix(col, sky, m.b * edge);
        }
        // the pond: calm water with slow, small ripples; the light on it shimmers gently
        if (m.r > 0.02) {
          float zf = 0.3 + dd * 6.0; // nearer water shows bigger ripples
          vec2 rip = vec2(noise(P * vec2(0.05, 0.16) + vec2(t * 0.35, t * 0.12)), noise(P * vec2(0.07, 0.2) - vec2(t * 0.28, -t * 0.1) + 7.0)) - 0.5;
          vec2 rip2 = vec2(noise(P * vec2(0.14, 0.4) + t * 0.6), noise(P * vec2(0.16, 0.45) - t * 0.55 + 3.0)) - 0.5;
          vec2 off = (rip * 2.2 + rip2 * 0.8) * zf * ipx * vec2(1.0, 0.55);
          vec3 w = texture2D(tImg, uv + off * m.r).rgb;
          col = mix(col, w, m.r);
          float gl = smoothstep(0.82, 0.97, noise(P * vec2(0.22, 0.7) + vec2(t * 0.25, 0.0))) * smoothstep(0.55, 0.9, lum(col));
          col += m.r * gl * vec3(1.0, 0.85, 0.65) * 0.35;
        }

        // mild sharpening to keep the photo crisp when it's scaled up
        vec3 nb = (texture2D(tImg, uv + vec2(ipx.x, 0.0)).rgb + texture2D(tImg, uv - vec2(ipx.x, 0.0)).rgb + texture2D(tImg, uv + vec2(0.0, ipx.y)).rgb + texture2D(tImg, uv - vec2(0.0, ipx.y)).rgb) * 0.25;
        col += (col - nb) * clamp(0.22 * uTexel, 0.0, 0.55);

        // ground: real surface detail projected in perspective onto the dirt yard and the concrete floor
        if (m2.r + m2.g > 0.02 && P.y > 330.0) {
          float Z = 1300.0 / max(P.y - 318.0, 4.0);
          vec2 gp = vec2((P.x - 835.0) * Z / 1000.0, Z);
          float gd = lum(texture2D(tGravel, gp * 0.9).rgb) - lum(texture2D(tGravel, gp * 0.9, 3.5).rgb);
          float cd = lum(texture2D(tConcrete, gp * 0.45).rgb) - lum(texture2D(tConcrete, gp * 0.45, 3.5).rgb);
          float near = smoothstep(0.02, 0.12, 1.0 / Z);
          col *= 1.0 + m2.r * gd * 0.85 * near + m2.g * cd * 0.55;
          // polished concrete catches a soft moving sheen from the sky as you look around
          col += m2.g * vec3(1.0, 0.85, 0.65) * 0.035 * smoothstep(0.3, 1.0, noise(vec2(P.x * 0.004 + uMouse.x * 1.5, P.y * 0.01)));
        }

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
      }`,
  })
);
photo.position.set(W / 2, H / 2, 0);
photoScene.add(photo);

/* ------------------------------------------------------------------ *
 *  The main monitor: a live screen mapped onto the photo
 * ------------------------------------------------------------------ */
function homography(src, dst) {
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
const toWorld = ([x, y]) => [x, H - y];
const Hm = homography([[0, 1], [1, 1], [1, 0], [0, 0]], SCREEN.map(toWorld));
const screenGeo = new THREE.PlaneGeometry(1, 1, 24, 24);
{
  const p = screenGeo.attributes.position, uv = screenGeo.attributes.uv;
  for (let i = 0; i < p.count; i++) { const [x, y] = Hm(uv.getX(i), uv.getY(i)); p.setXYZ(i, x, y, 1); }
}
const screenCanvas = document.createElement("canvas");
screenCanvas.width = 1024; screenCanvas.height = 576;
const screenTex = new THREE.CanvasTexture(screenCanvas);
screenTex.colorSpace = THREE.NoColorSpace;
screenTex.anisotropy = 4;
const wallpaper = new Image(); wallpaper.src = "assets/workshop.jpg"; // the view itself, cropped to the mountains
const avatar = new Image(); avatar.src = "assets/leruo-headshot.jpg";
const screenU = { tScreen: { value: screenTex }, uMouse: uniforms.uMouse, uPar: uniforms.uPar, uFocusD: uniforms.uFocusD, uSize: uniforms.uSize, uD: { value: 0.376 }, uTime: uniforms.uTime, uWake: { value: 0 } };
const screenMesh = new THREE.Mesh(screenGeo, new THREE.ShaderMaterial({
  uniforms: screenU, depthTest: false, depthWrite: false,
  vertexShader: `uniform vec2 uMouse, uSize; uniform float uPar, uFocusD, uD; varying vec2 vUv;
    void main(){ vUv = uv; vec3 p = position; p.xy += uMouse * (uD - uFocusD) * uPar * uSize; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
  fragmentShader: `precision highp float; uniform sampler2D tScreen; uniform float uTime, uWake, uD; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tScreen, vUv).rgb;
      vec2 d = vUv - 0.5;
      c *= 1.0 - 0.18 * dot(d, d) * 2.0;                       // panel falloff off-axis
      c = c * (0.86 + 0.14 * uWake);                          // brightens when you sit down
      c += vec3(1.0, 0.86, 0.7) * 0.035 * smoothstep(0.3, 1.0, vUv.x * 0.7 + vUv.y * 0.5); // faint glare from the opening
      c = mix(vec3(0.012), c, smoothstep(0.0, 0.006, vUv.x) * smoothstep(1.0, 0.994, vUv.x) * smoothstep(0.0, 0.01, vUv.y) * smoothstep(1.0, 0.99, vUv.y));
      gl_FragColor = vec4(c, uD);
    }`,
}));
photoScene.add(screenMesh);

const pad2 = (n) => String(n).padStart(2, "0");
let screenHover = false;
function drawScreen() {
  const g = screenCanvas.getContext("2d");
  const w = screenCanvas.width, h = screenCanvas.height;
  // wallpaper: one of Leruo's own photos, softened like a lock screen
  if (wallpaper.complete && wallpaper.naturalWidth) {
    const sx = 470, sy = 92, sw = 420, sh = 420 / (w / h);
    g.filter = screenHover ? "blur(10px) brightness(0.62)" : "brightness(0.82) saturate(1.05)";
    g.drawImage(wallpaper, sx, sy, sw, sh, -12, -12, w + 24, h + 24);
    g.filter = "none";
  } else { g.fillStyle = "#24382c"; g.fillRect(0, 0, w, h); }
  const shade = g.createLinearGradient(0, 0, 0, h);
  shade.addColorStop(0, "rgba(0,0,0,.35)"); shade.addColorStop(0.45, "rgba(0,0,0,0)"); shade.addColorStop(1, "rgba(0,0,0,.4)");
  g.fillStyle = shade; g.fillRect(0, 0, w, h);
  g.textAlign = "center"; g.fillStyle = "#fff";
  g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = 12;
  const now = new Date();
  if (!screenHover) {
    // lock screen: big clock, date (same proportions as a real 16:9 lock screen)
    g.font = "300 118px 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
    g.fillText(`${pad2(now.getHours())}:${pad2(now.getMinutes())}`, w / 2, h * 0.33);
    g.font = "400 26px 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
    g.fillText(now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }), w / 2, h * 0.33 + 44);
    g.font = "400 17px 'Segoe UI', Arial, sans-serif"; g.globalAlpha = 0.85;
    g.fillText("Click to sign in", w / 2, h - 34); g.globalAlpha = 1;
  } else {
    // sign-in: avatar, name, button
    const r = 62, cx = w / 2, cy = h * 0.4;
    g.save(); g.beginPath(); g.arc(cx, cy, r, 0, 7); g.clip();
    if (avatar.complete && avatar.naturalWidth) g.drawImage(avatar, 0, avatar.naturalHeight * 0.05, avatar.naturalWidth, avatar.naturalWidth, cx - r, cy - r, r * 2, r * 2);
    g.restore();
    g.font = "600 30px 'Segoe UI', Arial, sans-serif"; g.fillText(P.name || "Leruo Matlhatsi", cx, cy + r + 46);
    g.shadowBlur = 0; g.fillStyle = "rgba(255,255,255,.18)"; roundRect(g, cx - 80, cy + r + 70, 160, 38, 6); g.fill();
    g.fillStyle = "#fff"; g.font = "400 18px 'Segoe UI', Arial, sans-serif"; g.fillText("Sign in", cx, cy + r + 95);
  }
  g.shadowBlur = 0;
  // status icons, bottom right
  g.textAlign = "right"; g.font = "16px Arial"; g.globalAlpha = 0.8; g.fillText("⌁  ◔", w - 26, h - 30); g.globalAlpha = 1; g.textAlign = "left";
  screenTex.needsUpdate = true;
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

/* dust in the sunlight (photo layer) */
const N_DUST = 260;
const dustPos = new Float32Array(N_DUST * 3), dustSeed = new Float32Array(N_DUST);
for (let i = 0; i < N_DUST; i++) {
  dustPos[i * 3] = 140 + Math.random() * 800; dustPos[i * 3 + 1] = H - (330 + Math.random() * 600); dustPos[i * 3 + 2] = 0.35 + Math.random() * 0.5;
  dustSeed[i] = Math.random() * 100;
}
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
dustGeo.setAttribute("seed", new THREE.BufferAttribute(dustSeed, 1));
const dust = new THREE.Points(dustGeo, new THREE.ShaderMaterial({
  uniforms: { uTime: uniforms.uTime, uMouse: uniforms.uMouse, uPar: uniforms.uPar, uFocusD: uniforms.uFocusD, uSize: uniforms.uSize, uScale: { value: 1 } },
  vertexShader: `uniform float uTime, uPar, uFocusD, uScale; uniform vec2 uMouse, uSize; attribute float seed; varying float vA;
    void main(){
      vec3 p = position; float d = p.z; p.z = 2.0;
      p.x += sin(uTime * 0.2 + seed) * 18.0 + uTime * 2.0 * fract(seed * 0.37);
      p.y += mod(uTime * 3.0 * (0.3 + fract(seed * 0.71)) + seed * 7.0, 160.0) - 80.0;
      p.xy += uMouse * (d - uFocusD) * uPar * uSize;
      vA = (0.35 + 0.65 * sin(uTime * (0.6 + fract(seed)) + seed * 3.0) * 0.5 + 0.5) * 0.45;
      gl_PointSize = (1.0 + fract(seed * 1.3) * 2.2) * uScale;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`,
  fragmentShader: `precision highp float; varying float vA; void main(){ float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard; gl_FragColor = vec4(vec3(1.0, 0.86, 0.62) * vA * smoothstep(0.5, 0.0, r), 1.0); }`,
  transparent: true, depthTest: false, depthWrite: false,
  blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
}));
photoScene.add(dust);

/* ------------------------------------------------------------------ *
 *  Layer 2: real 3D objects, with a camera matched to the photo
 * ------------------------------------------------------------------ */
const scene3 = new THREE.Scene();
const ONLY = new URLSearchParams(location.search).get("only");
const add3 = (name, ...o) => { if (!ONLY || ONLY.split(",").includes(name)) scene3.add(...o); };
const cam3 = new THREE.PerspectiveCamera();
cam3.matrixAutoUpdate = true;
const H_UNI = {
  tDepthH: { value: tDepth }, uViewH: { value: new THREE.Vector4(0, 0, W, H) }, uResH: { value: new THREE.Vector2(1, 1) },
  uMouseH: uniforms.uMouse, uParH: uniforms.uPar, uFocusDH: uniforms.uFocusD, uExposure: { value: 1.0 },
  uHaze: { value: new THREE.Color(0.86, 0.74, 0.6) },
};
const H_GLSL = /* glsl */ `
  uniform sampler2D tDepthH; uniform vec4 uViewH; uniform vec2 uResH, uMouseH; uniform float uParH, uFocusDH, uExposure; uniform vec3 uHaze;
  varying float vHoldZ;
  float photoDisp(){
    vec2 s = gl_FragCoord.xy / uResH;
    vec2 img = vec2(uViewH.x + s.x * uViewH.z, uViewH.y + (1.0 - s.y) * uViewH.w);
    vec2 uv = vec2(img.x / 1670.0, 1.0 - img.y / 942.0), p = uv;
    for (int i = 0; i < 4; i++) { float d = texture2D(tDepthH, p).r; p = uv - uMouseH * (d - uFocusDH) * uParH; }
    return texture2D(tDepthH, p).r;
  }
  float imgY(){ return uViewH.y + (1.0 - gl_FragCoord.y / uResH.y) * uViewH.w; }
  // linear light -> the photo's look: filmic curve, display gamma, atmospheric haze with distance
  vec3 toPhoto(vec3 c, float z){
    c *= uExposure;
    c = (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14);
    c = pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
    return mix(c, uHaze, 1.0 - exp(-z * 0.0045));
  }`;
// patch a built-in material: hide it wherever the photo is nearer, and output in the photo's colour space
function holdout(mat, { bias = 0.035, keepAlpha = false, onlyBelow = 0 } = {}) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, H_UNI);
    sh.vertexShader = "varying float vHoldZ;\n" + sh.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\n vHoldZ = -mvPosition.z;");
    let fs = H_GLSL + "\n" + sh.fragmentShader.replace("void main() {", `void main() {\n float fdH = 1.0 / max(vHoldZ, 0.01);\n if (photoDisp() > fdH * (1.0 + ${bias.toFixed(3)}) + 0.002${onlyBelow ? ` && imgY() > ${onlyBelow.toFixed(1)}` : ""}) discard;`);
    const end = fs.lastIndexOf("}");
    fs = fs.slice(0, end) + `\n gl_FragColor.rgb = toPhoto(gl_FragColor.rgb, vHoldZ);${keepAlpha ? "" : " gl_FragColor.a = clamp(fdH, 0.0, 1.0);"}\n}`;
    sh.fragmentShader = fs;
  };
  if (keepAlpha) Object.assign(mat, { transparent: true, depthWrite: false, ...KEEP_ALPHA, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor });
  return mat;
}

// light matched to the photo: low sun ahead-left (backlight), warm bounce, sky fill
const SUN_DIR = new THREE.Vector3(-0.47, 0.13, -1).normalize();
const sun = new THREE.DirectionalLight(new THREE.Color(1.0, 0.74, 0.5), 2.6);
sun.target.position.set(0.2, 0.6, -2.9);
sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 12);
scene3.add(sun, sun.target);
scene3.add(new THREE.HemisphereLight(new THREE.Color(0.62, 0.66, 0.78), new THREE.Color(0.55, 0.38, 0.24), 0.95));

// environment for reflections: dark workshop behind the camera, the bright opening ahead
{
  const c = document.createElement("canvas"); c.width = 512; c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#2b1d14"; g.fillRect(0, 0, 512, 256);
  g.fillStyle = "#1a120c"; g.fillRect(0, 0, 512, 90);
  const sky = g.createLinearGradient(0, 70, 0, 128); sky.addColorStop(0, "#8aa6c4"); sky.addColorStop(1, "#f2c38c");
  g.fillStyle = sky; g.fillRect(40, 70, 220, 58);
  g.fillStyle = "#7d6a4c"; g.fillRect(40, 128, 220, 26);
  g.fillStyle = "#6b4a2e"; g.fillRect(0, 154, 512, 102);
  const t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  const pm = new THREE.PMREMGenerator(renderer);
  scene3.environment = pm.fromEquirectangular(t).texture;
  pm.dispose();
}

// helpers
const std = (o) => holdout(new THREE.MeshStandardMaterial(o));
function rbox(w, h, d, r = 0.004, seg = 2) {
  const s = new THREE.Shape();
  const x = -w / 2 + r, y = -h / 2 + r, ww = w - 2 * r, hh = h - 2 * r;
  s.moveTo(x, y - r + r); s.absarc(x + ww, y, r, -Math.PI / 2, 0); s.absarc(x + ww, y + hh, r, 0, Math.PI / 2); s.absarc(x, y + hh, r, Math.PI / 2, Math.PI); s.absarc(x, y, r, Math.PI, Math.PI * 1.5);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.0001, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.98, bevelSegments: seg, curveSegments: 4 });
  g.translate(0, 0, -(d - 2 * r) / 2);
  return g;
}
function mesh(geo, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
const DESK_Y = 0.585;

/* --- contact shadows: soft darkening where objects meet the photo's surfaces --- */
const blobTex = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d"); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.5, "rgba(255,255,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
// w × d metres, rotated to the object's heading, nudged towards the camera-right (away from the low sun)
function contact(parent, w, d, opacity, x = 0, z = 0, y = 0.002) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), holdout(new THREE.MeshBasicMaterial({ color: 0x120802, map: blobTex, opacity }), { keepAlpha: true, bias: 0.08 }));
  m.rotation.x = -Math.PI / 2; m.scale.set(w, d, 1); m.position.set(x, y, z); m.renderOrder = -1;
  parent.add(m);
  return m;
}

/* --- birds: the odd flock crossing the sky, plus a single bird now and then --- */
const birdMat = std({ color: 0x1b1714, roughness: 1, side: THREE.DoubleSide });
function makeBird() {
  const g = new THREE.Group();
  mesh(new THREE.CapsuleGeometry(0.06, 0.22, 3, 6).rotateZ(Math.PI / 2), birdMat, 0, 0, 0, g);
  const wing = new THREE.BufferGeometry();
  wing.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0.12, 0, 0, -0.06, 0, 0.5, 0.06, 0, 0, -0.1, 0, 0.45, -0.02, 0, 0.5], 3));
  wing.computeVertexNormals();
  const L = mesh(wing, birdMat, 0, 0.01, 0.03, g), R = mesh(wing.clone().scale(1, 1, -1), birdMat, 0, 0.01, -0.03, g);
  L.castShadow = R.castShadow = false;
  g.children[0].castShadow = false;
  return { g, L, R, ph: Math.random() * 10 };
}
const flocks = [];
let nextFlock = 6;
function spawnFlock() {
  const dir = Math.random() < 0.5 ? 1 : -1;
  const Z = rand(55, 110), yImg = rand(70, 230);
  const n = Math.random() < 0.3 ? 1 : 3 + Math.floor(Math.random() * 5);
  const startX = ((dir > 0 ? -60 : W + 60) - CX) * Z / F;
  const Y = HC + ((YH - yImg) * Z) / F;
  const birds = [];
  for (let i = 0; i < n; i++) {
    const b = makeBird();
    const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
    b.off = new THREE.Vector3(-dir * row * 1.3, rand(-0.3, 0.3), side * row * 1.1);
    b.flap = rand(3.2, 4.2); b.scale = rand(1.6, 2.2);
    b.g.scale.setScalar(b.scale);
    add3("bird", b.g); birds.push(b);
  }
  flocks.push({ birds, pos: new THREE.Vector3(startX, Y, -Z), vel: new THREE.Vector3(dir * rand(9, 13), rand(-0.4, 0.6), rand(-2, 2)), dir });
}
function updateBirds(dt, t) {
  nextFlock -= dt;
  if (nextFlock < 0) { spawnFlock(); nextFlock = rand(16, 38); }
  for (let k = flocks.length - 1; k >= 0; k--) {
    const f = flocks[k];
    f.pos.addScaledVector(f.vel, dt);
    for (const b of f.birds) {
      const p = f.pos.clone().add(b.off); p.y += Math.sin(t * 0.7 + b.ph) * 0.4;
      b.g.position.copy(p);
      b.g.rotation.y = f.dir > 0 ? 0 : Math.PI;
      // flap in bursts, then glide
      const gl = Math.sin(t * 0.45 + b.ph) > 0.55 ? 0.15 : 1;
      const a = Math.sin(t * b.flap * Math.PI * 2 + b.ph) * 0.75 * gl + 0.12;
      b.L.rotation.x = a; b.R.rotation.x = -a;
    }
    const [sx] = project(f.pos);
    if ((f.dir > 0 && sx > W + 300) || (f.dir < 0 && sx < -300)) { f.birds.forEach((b) => scene3.remove(b.g)); flocks.splice(k, 1); }
  }
}

/* ------------------------------------------------------------------ *
 *  Final pass: focus pull, hover, grade, lens
 * ------------------------------------------------------------------ */
const postU = {
  tRT: { value: rt.texture }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: uniforms.uTime,
  uFocusDepth: { value: 0.5 }, uFocusAmt: { value: 0 }, uHover: { value: new THREE.Vector4(-999, -999, 1, 1) }, uHoverAmt: { value: 0 },
  uView: H_UNI.uViewH, uPxPerImg: { value: 1 },
};
const postScene = new THREE.Scene();
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: postU, depthTest: false, depthWrite: false,
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tRT; uniform vec2 uRes; uniform float uTime, uFocusDepth, uFocusAmt, uHoverAmt, uPxPerImg; uniform vec4 uHover, uView;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){
      vec4 s = texture2D(tRT, vUv);
      vec3 col = s.rgb;
      if (uFocusAmt > 0.001) {
        float coc = clamp(abs(s.a - uFocusDepth) * 2.6 - 0.05, 0.0, 1.0) * uFocusAmt;
        vec2 r = (7.5 * uPxPerImg / uRes) * coc;
        vec3 acc = col; float wsum = 1.0;
        float rot = hash(gl_FragCoord.xy) * 6.2831;
        for (int i = 1; i < 20; i++) {
          float fi = float(i), rr = sqrt(fi / 19.0), a = fi * 2.39996 + rot;
          vec4 sm = texture2D(tRT, vUv + vec2(cos(a), sin(a)) * rr * r);
          // don't let sharp foreground smear over the blurred background
          float w = 1.0 - 0.7 * smoothstep(0.08, 0.2, abs(sm.a - uFocusDepth) < 0.05 ? 1.0 : 0.0) * step(0.5, coc);
          acc += sm.rgb * w; wsum += w;
        }
        col = acc / wsum;
      }
      vec2 P = vec2(uView.x + vUv.x * uView.z, uView.y + (1.0 - vUv.y) * uView.w);
      vec2 e = (P - uHover.xy) / uHover.zw;
      col *= 1.0 + uHoverAmt * 0.09 * smoothstep(1.0, 0.55, length(e));
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(l), col, 0.94);
      col = (col - 0.5) * 1.03 + 0.5;
      vec2 q = vUv - 0.5;
      col *= 1.0 - 0.3 * smoothstep(0.3, 0.9, length(q * vec2(1.15, 1.0)));
      col += (hash(gl_FragCoord.xy + fract(uTime) * 100.0) - 0.5) * 0.022;
      gl_FragColor = vec4(col, 1.0);
    }`,
})));

/* ------------------------------------------------------------------ *
 *  Camera: views in image px (y down), mirrored by the 3D camera
 * ------------------------------------------------------------------ */
const view = { cx: 860, cy: 470, hh: 400 };
let target = { cx: 860, cy: 470, hh: 400 };
let panX = 0;
const aspect = () => window.innerWidth / window.innerHeight;
function baseHH() { return Math.min(H / 2, W / (2 * aspect())) * 0.955; }
function clampView(v) {
  const hh = v.hh, hw = hh * aspect();
  const m = 0.015 * W, ml = 4; // let the left edge (whiteboard, caps) come fully into view
  return { cx: Math.min(W - hw - m, Math.max(hw + ml, v.cx)), cy: Math.min(H - hh - m * 0.6, Math.max(hh + m * 0.6, v.cy)), hh };
}
function homeView() {
  const hh = baseHH();
  const narrow = aspect() < 1.2;
  return clampView({ cx: (narrow ? 1000 : W / 2 - 30) + panX, cy: H / 2 + (narrow ? 0 : 10), hh });
}
function focusView(h) {
  const hh = baseHH() * (aspect() < 1.2 ? 0.8 : 0.58);
  return clampView({ cx: h.x + (aspect() > 1.2 ? hh * aspect() * 0.28 : 0), cy: h.y, hh });
}
function seatedView() {
  // as if you've pulled the chair in: both screens and the keyboard fill the view
  const narrow = aspect() < 1.2;
  const hw = narrow ? 230 : 340;
  return clampView({ cx: narrow ? 1000 : 1010, cy: narrow ? 480 : 500, hh: Math.max(hw / aspect(), narrow ? 200 : 170) });
}
function monitorView() {
  const w = SCREEN[1][0] - SCREEN[0][0], hgt = SCREEN[3][1] - SCREEN[1][1];
  return { cx: SCREEN_C[0], cy: SCREEN_C[1], hh: Math.max(hgt / 2, w / 2 / aspect()) * 1.0 };
}
function applyCamera() {
  const hw = view.hh * aspect();
  camera.left = view.cx - hw; camera.right = view.cx + hw;
  camera.top = H - (view.cy - view.hh); camera.bottom = H - (view.cy + view.hh);
  camera.updateProjectionMatrix();
  const pxPerImg = window.innerHeight / (2 * view.hh);
  uniforms.uTexel.value = pxPerImg;
  dust.material.uniforms.uScale.value = pxPerImg * renderer.getPixelRatio();
  postU.uPxPerImg.value = pxPerImg;
  // the 3D camera sees exactly the same window of the photo, and moves with the parallax
  const x0 = view.cx - hw, y0 = view.cy - view.hh, w = 2 * hw, h = 2 * view.hh;
  H_UNI.uViewH.value.set(x0, y0, w, h);
  const m = uniforms.uMouse.value;
  const cxp = CX - m.x * PAR * W * FOCUS_D, yhp = YH + m.y * PAR * H * FOCUS_D;
  cam3.position.set(-(m.x * PAR * W) / F, HC - (m.y * PAR * H) / F, 0);
  cam3.updateMatrixWorld();
  const n = 0.05, f = 4000;
  cam3.projectionMatrix.set(
    (2 * F) / w, 0, -((2 * (cxp - x0)) / w - 1), 0,
    0, (2 * F) / h, -(1 - (2 * (yhp - y0)) / h), 0,
    0, 0, -(f + n) / (f - n), (-2 * f * n) / (f - n),
    0, 0, -1, 0
  );
  cam3.projectionMatrixInverse.copy(cam3.projectionMatrix).invert();
}
function imgToScreen(x, y, withParallax = true) {
  let ox = 0, oy = 0;
  if (withParallax) {
    const d = depthAt(x, y);
    ox = uniforms.uMouse.value.x * (d - FOCUS_D) * PAR * W;
    oy = -uniforms.uMouse.value.y * (d - FOCUS_D) * PAR * H;
  }
  const hw = view.hh * aspect();
  return [((x + ox - (view.cx - hw)) / (2 * hw)) * window.innerWidth, ((y + oy - (view.cy - view.hh)) / (2 * view.hh)) * window.innerHeight];
}
function screenToImg(sx, sy) {
  const hw = view.hh * aspect();
  return [view.cx - hw + (sx / window.innerWidth) * 2 * hw, view.cy - view.hh + (sy / window.innerHeight) * 2 * view.hh];
}

/* ------------------------------------------------------------------ *
 *  State + interaction
 * ------------------------------------------------------------------ */
let mode = "intro"; // intro | explore | seated | monitor | os
let focused = null, hoverId = null, pendingOpen = null;
const mouse = new THREE.Vector2(), mouseSmooth = new THREE.Vector2();
const tooltip = $("#tooltip");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function hitTest(sx, sy) {
  const [ix, iy] = screenToImg(sx, sy);
  let best = null, bestD = 1;
  for (const [id, h] of Object.entries(HOTSPOTS)) {
    const d = Math.hypot((ix - h.x) / h.rx, (iy - h.y) / h.ry);
    if (d < bestD) { bestD = d; best = id; }
  }
  return best;
}
function setHover(id) {
  hoverId = id;
  document.body.classList.toggle("hovering", !!id);
  if (id) { const h = HOTSPOTS[id]; postU.uHover.value.set(h.x, h.y, h.rx, h.ry); }
  const sh = id === "monitor";
  if (sh !== screenHover) { screenHover = sh; drawScreen(); }
}
function activate(id) {
  sound.start();
  if (mode === "monitor" || mode === "os") return;
  if (mode !== "seated") return takeSeat();   // first you sit down at the desk...
  sitDown();                                    // ...then you jump into the computer
}
const hintEl = $("#hint");
const HINTS = {
  explore: "Move your mouse to look around · click the computer to take a seat · ? for help",
  seated: "Click the screen to log in · Esc to stand up",
};
function takeSeat() {
  sound.start();
  hideHelp();
  setMode("seated");
  target = seatedView();
  sound.whoosh();
}
function setMode(m) {
  mode = m;
  document.body.classList.toggle("exploring", m !== "intro");
  document.body.classList.toggle("away", m === "monitor" || m === "os");
  document.body.classList.toggle("seated", m === "seated");
  if (HINTS[m]) hintEl.textContent = aspect() < 1.2 ? (m === "seated" ? "Tap the screen to log in" : "Drag to look around · tap the computer · ? for help") : HINTS[m];
  postU.uFocusAmt.value = 0;
}
function backToRoom() {
  if (mode === "os") return standUp();
  focused = null;
  sound.setFocus(null);
  setMode("explore");
  target = homeView();
}
function sitDown() {
  sound.start();
  hideHelp();
  focused = null;
  setMode("monitor");
  sound.setFocus("monitor");
  target = monitorView();
  sound.whoosh();
  sound.boot();
}
const osLayer = $("#os-layer"), osFrame = $("#os-frame"), backBtn = $("#back-btn");
function openOS() {
  setMode("os");
  osLayer.classList.add("on");
  osLayer.setAttribute("aria-hidden", "false");
  backBtn.hidden = false;
  setTimeout(() => {
    osFrame.focus();
    osFrame.contentWindow?.postMessage({ type: "host", action: "focus" }, "*");
    if (pendingOpen) { osFrame.contentWindow?.postMessage({ type: "host", action: "open", ...pendingOpen }, "*"); pendingOpen = null; }
  }, 250);
}
function standUp() {
  osLayer.classList.remove("on");
  osLayer.setAttribute("aria-hidden", "true");
  backBtn.hidden = true;
  osFrame.contentWindow?.postMessage({ type: "host", action: "blur" }, "*");
  setMode("seated");
  sound.setFocus(null);
  target = seatedView();
  sound.whoosh();
}
backBtn.onclick = standUp;

canvas.addEventListener("pointermove", (e) => {
  mouse.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
  if (mode === "intro" || mode === "explore" || mode === "seated") {
    const id = hitTest(e.clientX, e.clientY);
    if (id !== hoverId) setHover(id);
    if (id) {
      tooltip.textContent = mode === "seated" ? HOTSPOTS[id].label : "Take a seat";
      tooltip.style.transform = `translate(${e.clientX + 16}px, ${e.clientY + 14}px)`;
      tooltip.hidden = false;
    } else tooltip.hidden = true;
  }
});
canvas.addEventListener("pointerleave", () => { setHover(null); tooltip.hidden = true; });
let drag = null;
canvas.addEventListener("pointerdown", (e) => { sound.start(); drag = { x: e.clientX, pan: panX, moved: false }; });
window.addEventListener("pointermove", (e) => {
  if (!drag || !(mode === "intro" || mode === "explore")) return;
  const dx = e.clientX - drag.x;
  if (Math.abs(dx) > 6) drag.moved = true;
  if (drag.moved) {
    const hw = view.hh * aspect();
    panX = drag.pan - (dx / window.innerWidth) * 2 * hw;
    const hv = homeView();
    panX = hv.cx - (aspect() < 1.2 ? 1000 : W / 2 - 30);
    target = hv;
  }
});
window.addEventListener("pointerup", () => setTimeout(() => (drag = null), 0));
canvas.addEventListener("click", (e) => {
  if (drag && drag.moved) return;
  sound.click();
  const id = hitTest(e.clientX, e.clientY);
  if (id) activate(id);
  else if (mode === "seated") backToRoom();     // click away from the screens to stand up
  else if (mode === "intro") setMode("explore");
  hideHelp();
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { if (!vrDone) return; if (!helpCard.hidden) return hideHelp(); if (mode === "os") standUp(); else if (mode === "seated" || mode === "monitor") backToRoom(); }
});
window.addEventListener("message", (e) => {
  const m = e.data;
  if (!m || m.type !== "os") return;
  if (m.action === "zoom-out" || m.action === "shutdown") standUp();
  if (m.action === "click") sound.click();
  if (m.action === "key") sound.key();
  if (m.action === "sfx" && sound[m.name]) sound[m.name]();
});
/* ------------------------------------------------------------------ *
 *  Intro: a dull office -> put on the headset -> my world fades in
 * ------------------------------------------------------------------ */
const vr = $("#vr"), vrOffice = $(".vr-office"), vrHands = $(".vr-hands"), vrBlack = $(".vr-black"), vrLens = $(".vr-lens"), vrWelcome = $(".vr-welcome");
const vrMute = $("#vr-mute");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
let vrT0 = -1, vrDone = false;
if (P.intro && P.intro.headline) $("#vr-title").textContent = P.intro.headline;
document.body.classList.add("vr");
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const span = (t, a, b) => ease((t - a) / (b - a));
function finishIntro() {
  if (vrDone) return;
  vrDone = true;
  vr.classList.add("gone");
  canvas.style.filter = "";
  document.body.classList.remove("vr");
  sound.nature = 1;
  setMode("explore");
}
function fadeOutIntro() {
  // skip / reduced motion: a simple, calm crossfade
  vr.classList.add("playing");
  vr.style.transition = "opacity .7s"; vr.style.opacity = "0";
  sound.start(); sound.nature = 1;
  setTimeout(finishIntro, 720);
}
function putOnHeadset() {
  sound.start();
  if (reduceMotion) return fadeOutIntro();
  sound.headset();
  vr.classList.add("playing");
  vrT0 = performance.now();
}
// runs every frame from the main loop while the intro is playing (about 4.6 s)
function updateIntro() {
  if (vrT0 < 0 || vrDone) return;
  const t = (performance.now() - vrT0) / 1000;
  // 1. reach for the headset: the view leans in
  vrOffice.style.transform = `scale(${1.02 + 0.28 * span(t, 0, 1.0)})`;
  // 2. hands lift it towards your face, it fills the view
  vrHands.style.opacity = span(t, 0.55, 0.85);
  vrHands.style.transform = `scale(${1.08 + 1.6 * span(t, 0.7, 2.25) ** 1.6})`;
  // 3. the padding closes around your eyes: dark
  const dark = span(t, 1.6, 2.25) * (1 - span(t, 2.35, 2.8));
  vrBlack.style.opacity = dark;
  if (t > 2.3) { vrOffice.style.visibility = vrHands.style.visibility = "hidden"; }
  // 4. my world comes into focus inside the lenses, then the headset's edge falls away
  if (t > 2.3) {
    vrLens.style.opacity = 1 - span(t, 3.9, 4.55);
    vrLens.style.setProperty("--r", `${18 + 120 * span(t, 2.35, 4.45) ** 1.3}%`);
    canvas.style.filter = `blur(${(10 * (1 - span(t, 2.35, 3.9))).toFixed(2)}px) saturate(${(0.6 + 0.4 * span(t, 2.35, 3.6)).toFixed(2)})`;
    vr.style.background = "transparent";
  }
  vrWelcome.style.opacity = span(t, 2.9, 3.4) * (1 - span(t, 4.1, 4.55));
  // sound: the office fades out as the birds, breeze and pond fade in
  sound.nature = span(t, 1.8, 4.4);
  if (t > 4.6) finishIntro();
}
// first click: the office (and its noise) comes to life — browsers only allow sound after a click
const vrGate = $("#vr-gate");
vr.classList.add("gated");
$("#vr-enter").onclick = (e) => {
  e.stopPropagation();
  sound.start();
  sound.nature = 0;
  vrGate.classList.add("out");
  vr.classList.remove("gated");
  setTimeout(() => $("#vr-go").focus(), 900);
};
$("#vr-go").onclick = (e) => { e.stopPropagation(); putOnHeadset(); };
$("#vr-skip").onclick = (e) => { e.stopPropagation(); fadeOutIntro(); };
const syncVrMute = () => { vrMute.textContent = sound.enabled ? "Sound on" : "Sound off"; vrMute.setAttribute("aria-pressed", String(sound.enabled)); };
syncVrMute();
vrMute.onclick = (e) => { e.stopPropagation(); sound.start(); sound.toggle(); syncVrMute(); syncSound && syncSound(); };
window.addEventListener("keydown", (e) => { if (!vrDone && e.key === "Escape") fadeOutIntro(); });
if (params.has("skip")) { vrGate.classList.add("out"); vr.classList.add("gone"); vrDone = true; document.body.classList.remove("vr"); sound.nature = 1; queueMicrotask(() => setMode("explore")); }
$("#cv-btn").onclick = (e) => { e.stopPropagation(); pendingOpen = { page: "resume" }; sitDown(); };
const helpBtn = $("#help-btn"), helpCard = $("#card");
function showHelp() {
  const Hp = P.help || {};
  helpCard.innerHTML = `
    <button class="card-close" aria-label="Close">✕</button>
    <div class="card-kicker">How this works</div>
    <h2>${esc(Hp.title || "Welcome to my workshop")}</h2>
    <ol class="help-steps">${(Hp.steps || []).map((x) => `<li><b>${esc(x[0])}</b> ${esc(x[1])}</li>`).join("")}</ol>
    ${Hp.tips ? `<ul>${Hp.tips.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    <div class="card-actions"><button class="card-btn solid" data-seat>Take a seat</button><button class="card-btn" data-close>Keep looking around</button></div>`;
  helpCard.hidden = false;
  requestAnimationFrame(() => helpCard.classList.add("show"));
  helpCard.querySelector(".card-close").onclick = (e) => { e.stopPropagation(); hideHelp(); };
  helpCard.querySelector("[data-close]").onclick = (e) => { e.stopPropagation(); hideHelp(); if (mode === "intro") setMode("explore"); };
  helpCard.querySelector("[data-seat]").onclick = (e) => { e.stopPropagation(); takeSeat(); };
}
function hideHelp() { if (helpCard.hidden) return; helpCard.classList.remove("show"); setTimeout(() => !helpCard.classList.contains("show") && (helpCard.hidden = true), 350); }
helpBtn.onclick = (e) => { e.stopPropagation(); sound.start(); sound.click(); helpCard.hidden ? showHelp() : hideHelp(); };
const soundBtn = $("#sound-btn");
const syncSound = () => { soundBtn.textContent = sound.enabled ? "Sound on" : "Sound off"; soundBtn.setAttribute("aria-pressed", String(sound.enabled)); };
syncSound();
soundBtn.onclick = (e) => { e.stopPropagation(); sound.start(); sound.toggle(); syncSound(); syncVrMute(); };

/* ------------------------------------------------------------------ *
 *  Loading
 * ------------------------------------------------------------------ */
const fill = $("#ld-fill"), ldText = $("#ld-text");
manager.onProgress = (u, l, t) => { fill.style.width = `${Math.round((l / t) * 100)}%`; };
manager.onLoad = () => {
  fill.style.width = "100%";
  ldText.textContent = "Welcome";
  setTimeout(() => $("#loader").classList.add("done"), 350);
  Object.assign(view, clampView({ ...homeView(), hh: baseHH() * 0.86 }));
  target = homeView();
  drawScreen();
};
manager.onError = (url) => { if (!/tex\//.test(url)) { ldText.textContent = "Couldn't load the workshop — opening the simple version"; setTimeout(() => location.replace("os/index.html"), 1500); } };
wallpaper.onload = () => drawScreen();

/* ------------------------------------------------------------------ *
 *  Loop
 * ------------------------------------------------------------------ */
function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  const pr = renderer.getPixelRatio();
  rt.setSize(Math.round(window.innerWidth * pr), Math.round(window.innerHeight * pr));
  postU.uRes.value.set(window.innerWidth * pr, window.innerHeight * pr);
  H_UNI.uResH.value.set(Math.round(window.innerWidth * pr), Math.round(window.innerHeight * pr));
  target = mode === "monitor" || mode === "os" ? monitorView() : mode === "seated" ? seatedView() : homeView();
  if (!manager.isLoading) Object.assign(view, clampView(view));
}
window.addEventListener("resize", onResize);
onResize();
Object.assign(view, homeView());

const clock = new THREE.Clock();
let lastScreenMin = -1;
const blinks = [0, 1, 2].map((i) => ({ next: 1.5 + i * 1.7 + Math.random() * 2, at: -9 }));
const ears = [0, 1, 2, 3].map(() => ({ next: 4 + Math.random() * 8, at: -9, amp: 0 }));
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  uniforms.uTime.value = t;

  const k = 1 - Math.pow(mode === "monitor" ? 0.035 : mode === "seated" ? 0.045 : 0.06, dt);
  view.cx += (target.cx - view.cx) * k;
  view.cy += (target.cy - view.cy) * k;
  view.hh += (target.hh - view.hh) * k;
  if (mode === "monitor") {
    const done = Math.abs(view.hh - target.hh) < 1.2 && Math.abs(view.cx - target.cx) < 1.2;
    if (done) openOS();
  }

  // parallax: follows the mouse (or drifts slowly on touch screens); calmer when focused
  const amt = mode === "monitor" || mode === "os" ? 0 : mode === "seated" ? 0.3 : 1;
  const want = coarse ? new THREE.Vector2(Math.sin(t * 0.21) * 0.5, Math.sin(t * 0.15) * 0.25) : mouse;
  mouseSmooth.lerp(want.clone().multiplyScalar(-amt), 1 - Math.pow(0.12, dt));
  uniforms.uMouse.value.copy(mouseSmooth);
  applyCamera();

  // wind: one gust value drives the trees, the grass and the wind sound
  const gust = 0.5 + 0.5 * Math.sin(t * 0.21) * Math.sin(t * 0.083 + 1.3);
  uniforms.uGust.value = gust; sound.gust = gust;

  postU.uHoverAmt.value += ((hoverId && mode !== "monitor" && mode !== "os" ? 1 : 0) - postU.uHoverAmt.value) * Math.min(1, dt * 8);
  // sitting at the desk: the screens are sharp, the view outside goes soft
  if (mode === "seated") postU.uFocusDepth.value = 0.37;
  postU.uFocusAmt.value += ((mode === "seated" ? (aspect() < 1.2 ? 0.35 : 0.6) : 0) - postU.uFocusAmt.value) * Math.min(1, dt * 3);
  screenU.uWake.value += ((mode === "monitor" || mode === "os" || screenHover ? 1 : 0) - screenU.uWake.value) * Math.min(1, dt * 4);

  const min = new Date().getMinutes();
  if (min !== lastScreenMin) { lastScreenMin = min; drawScreen(); }

  // living things
  updateBirds(dt, t);
  // each dog blinks on its own clock (sometimes a quick double blink)
  blinks.forEach((b, i) => {
    if (t > b.next) { b.at = t; b.next = t + 2.8 + Math.random() * 5; if (Math.random() < 0.18) b.next = t + 0.38; }
    const bp = (t - b.at) / 0.17;
    uniforms.uBlink.value.setComponent(i, bp >= 0 && bp < 1 ? Math.sin(bp * Math.PI) : 0);
  });
  // the odd ear flick: a quick turn and a slower settle
  ears.forEach((e, i) => {
    if (t > e.next) { e.at = t; e.amp = (i % 2 ? 1 : -1) * (0.12 + Math.random() * 0.1); e.next = t + 6 + Math.random() * 12; }
    const ep = t - e.at;
    const v = ep < 0 ? 0 : ep < 0.08 ? ep / 0.08 : Math.exp(-(ep - 0.08) * 6) * Math.cos((ep - 0.08) * 18);
    uniforms.uEar.value.setComponent(i, e.amp * v);
  });
  uniforms.uDrone.value.set(Math.sin(t * 0.37) * 1.6 + Math.sin(t * 1.1) * 0.4, Math.sin(t * 1.25) * 1.1);

  {
    const show = mode === "intro" || mode === "explore" || mode === "seated";
    helpBtn.style.display = show ? "" : "none";
    if (show) { const [hx2, hy2] = imgToScreen(560, 565); helpBtn.style.transform = `translate(${hx2}px, ${hy2}px)`; }
  }
  updateIntro();
  sound.view = { cx: view.cx, hw: view.hh * aspect() };
  sound.update(dt);

  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.clear(true, true, true);
  renderer.render(photoScene, camera);
  renderer.clearDepth();
  if (!params.has("no3d")) renderer.render(scene3, cam3);
  renderer.setRenderTarget(null);
  renderer.render(postScene, postCam);
}
frame();
