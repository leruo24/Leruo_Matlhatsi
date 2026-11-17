import * as THREE from "three";
import { Sound } from "./sound.js";

/*
 * Leruo's workshop: a photograph that behaves like a real place.
 *
 *  1. The photo is drawn with an AI depth map, so it shifts in true depth as you look around.
 *  2. A 3D camera is matched to the photo (focal length, horizon, camera height), so real 3D
 *     objects can stand in it: the second monitor, the home-lab rack, the longboard, the
 *     whiteboard, walking cows, birds and sprinkler water. Each 3D pixel is tested against
 *     the photo's depth, so the chair, fence posts and leaves pass in front of them correctly.
 *  3. Moving water, trees, grass and clouds are animated inside the photo, at speeds that
 *     match their distance from the camera.
 *  4. Everything is graded together in one final pass (focus pull, vignette, grain).
 */
const P = window.PORTFOLIO || {};
const W = 1670, H = 942; // image size (px)
const SCREEN = [[872, 391], [1144, 389], [1144, 529], [872, 544]]; // TL TR BR BL of the main monitor
const SCREEN_C = [1008, 466];
const PAR = 0.011; // parallax strength (uv units at full mouse travel)
const FOCUS_D = 0.3; // depth that stays still while you look around
// camera matched to the photo: focal length (px), principal point / horizon (px), height (m)
const F = 1000, CX = 835, YH = 318, HC = 1.3;
const BREATH = 3.6; // the dog's breathing period (s)

const HOTSPOTS = {
  monitor: { label: "Use the computer", x: 1008, y: 466, rx: 150, ry: 95 },
  monitor2: { label: "Play Overland Run", x: 1262, y: 470, rx: 110, ry: 80 },
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
  uScreen2: { value: new THREE.Vector3(1290, 590, 0) }, uScreen2Col: { value: new THREE.Color(0.4, 0.6, 0.9) },
  uLook: { value: new THREE.Vector2() }, uBlink: { value: 0 }, uWag: { value: 0 },
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
      uniform vec3 uScreen2, uScreen2Col;
      uniform vec2 uLook; uniform float uBlink, uWag;
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

        // the dog breathes (back rises, belly stays on the floor)
        float br = 0.5 - 0.5 * cos(6.28318 * t / ${BREATH.toFixed(2)});
        vec2 de = (P - vec2(212.0, 702.0)) / vec2(100.0, 58.0);
        float dfall = smoothstep(1.0, 0.3, length(de)) * smoothstep(768.0, 652.0, P.y);
        uv.y -= dfall * br * 1.4 * ipx.y;

        // his eyes follow you (the iris slides inside each eye), and he blinks
        for (int i = 0; i < 2; i++) {
          vec2 ec = i == 0 ? vec2(275.0, 734.5) : vec2(305.5, 731.0);
          vec2 er = vec2(4.4, 2.7);
          vec2 q2 = (P - ec) / er;
          float ein = smoothstep(1.15, 0.55, length(q2));
          uv -= ein * vec2(uLook.x * 1.6, -uLook.y * 0.8) * ipx;
          // eyelid: fur from just above the eye slides down over it
          float lid = step(P.y, ec.y - er.y + 2.0 * er.y * uBlink) * smoothstep(1.35, 0.8, length(q2)) * step(0.02, uBlink);
          uv = mix(uv, toUv(P - vec2(0.0, 2.2 * er.y)), lid);
        }
        // tail thumps when you come near
        float tw = smoothstep(26.0, 10.0, length(P - vec2(146.0, 724.0)));
        uv.y += tw * uWag * sin(t * 13.0) * 1.6 * ipx.y;
        uv.x += tw * uWag * cos(t * 13.0) * 0.8 * ipx.x;

        // the hanging lamp sways a touch on its cord
        float ang = 0.010 * sin(t * 0.8) + 0.004 * sin(t * 1.9 + 1.0);
        float lm = smoothstep(1432.0, 1442.0, P.x) * smoothstep(1572.0, 1562.0, P.x) * smoothstep(122.0, 110.0, P.y);
        vec2 pv = vec2(1502.0, -70.0), q = P - pv;
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
        // the river flows downstream (towards the camera, to the right); nearer water moves faster on screen
        if (m.r > 0.02) {
          vec2 fdir = normalize(vec2(1.0, -0.38));
          float spd = 0.004 + dd * 0.28;
          vec2 rip = (vec2(noise(P * vec2(0.09, 0.18) - fdir * t * 9.0), noise(P * vec2(0.18, 0.09) - fdir * t * 9.0 + 3.0)) - 0.5) * 1.6 * ipx;
          vec3 flow = advect(uv + rip, fdir * spd, 1.4, 0.0);
          float edge = texture2D(tMask, uv - fdir * spd * 0.7).r * texture2D(tMask, uv + fdir * spd * 0.7).r;
          col = mix(col, mix(flow, texture2D(tImg, uv + rip).rgb, 0.25), m.r * edge);
          // glints ride the current
          vec2 gq = P * vec2(0.55, 1.1) - vec2(fdir.x, -fdir.y) * t * (30.0 + dd * 600.0);
          float sp = smoothstep(0.86, 0.99, noise(gq)) * smoothstep(0.55, 1.0, noise(P * 0.05 + t * 0.3));
          col += m.r * sp * vec3(1.0, 0.92, 0.78) * 0.7 * smoothstep(0.35, 0.7, lum(col));
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
        col += vec3(1.0, 0.72, 0.42) * 0.08 * glow(P, vec2(305.0, 198.0), 70.0);
        col += vec3(1.0, 0.72, 0.42) * 0.13 * glow(P, vec2(760.0, 448.0), 34.0);
        col += vec3(1.0, 0.70, 0.40) * 0.08 * glow(P, vec2(1503.0, 98.0), 40.0);
        col += vec3(1.0, 0.75, 0.45) * 0.05 * glow(P, vec2(745.0, 520.0), 120.0);
        col += vec3(0.55, 0.9, 0.7) * 0.04 * glow(P, vec2(1008.0, 575.0), 110.0);
        col += uScreen2Col * 0.06 * glow(P, uScreen2.xy, 75.0);                     // second monitor on the desk
        float led = step(0.5, fract(t * 0.9));
        col += vec3(0.3, 0.6, 1.0) * 0.55 * glow(P, vec2(1238.0, 803.0), 3.2) * led; // ESP32
        col += vec3(0.6, 0.9, 1.0) * 0.08 * glow(P, vec2(1430.0, 773.0), 10.0);      // multimeter display
        float act = step(0.55, noise(vec2(t * 7.0, 2.0)));
        col += vec3(0.2, 0.55, 1.0) * 0.07 * glow(P, vec2(975.0, 705.0), 55.0);     // home-lab LEDs on the panel
        col += vec3(0.3, 1.0, 0.5) * 0.04 * glow(P, vec2(1000.0, 735.0), 40.0) * (0.6 + 0.4 * act);
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
    const sx = 560, sy = 18, sw = 480, sh = 480 / (w / h);
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

/* --- second monitor: butted up against the main screen and angled in, like a real dual setup --- */
const gameCanvas = document.createElement("canvas"); gameCanvas.width = 640; gameCanvas.height = 360;
const gameTex = new THREE.CanvasTexture(gameCanvas); gameTex.colorSpace = THREE.SRGBColorSpace; gameTex.anisotropy = 4;
const monitor2 = new THREE.Group();
{
  const black = std({ color: 0x0c0c0d, roughness: 0.5, metalness: 0.0 });
  const darker = std({ color: 0x080808, roughness: 0.65 });
  const sw = 0.597, sh = 0.336, bz = 0.007, by = 0.011; // 27" panel, thin bezels like the main screen
  const panelY = 0.105 + sh / 2 + by;               // screen bottoms line up with the main monitor
  mesh(rbox(sw + bz * 2, sh + bz + by, 0.022, 0.004), black, 0, panelY - (by - bz) / 2, 0, monitor2);
  mesh(rbox(0.36, 0.2, 0.045, 0.02, 3), darker, 0, panelY - 0.01, -0.03, monitor2); // rear housing
  const scr = mesh(new THREE.PlaneGeometry(sw, sh), std({ color: 0x000000, roughness: 0.3, emissive: 0xffffff, emissiveMap: gameTex, emissiveIntensity: 1.15 }), 0, panelY, 0.0115, monitor2);
  scr.castShadow = false;
  mesh(rbox(0.05, 0.2, 0.022, 0.006), black, 0, 0.105, -0.055, monitor2); // neck
  mesh(rbox(0.25, 0.012, 0.18, 0.005), black, 0, 0.006, -0.04, monitor2); // foot
  const led = mesh(new THREE.BoxGeometry(0.004, 0.002, 0.001), std({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: 1.5 }), sw / 2 - 0.02, panelY - sh / 2 - by + 0.004, 0.0115, monitor2);
  led.castShadow = false;
  // cable down the back
  const cable = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.2, -0.07), new THREE.Vector3(0, 0.06, -0.1), new THREE.Vector3(0.05, 0.01, -0.22), new THREE.Vector3(0.12, 0.0, -0.45)]);
  mesh(new THREE.TubeGeometry(cable, 16, 0.0035, 6), darker, 0, 0, 0, monitor2);
  contact(monitor2, 0.34, 0.26, 0.55, 0.02, 0.0); contact(monitor2, 0.7, 0.42, 0.18, 0.06, 0.06);
  // the main monitor's right edge, measured from the photo (its screen is ~0.41 m tall)
  const zR = 410 / (529 - 389), rightEdge = unproject(1150, 459, zR);
  const yaw = -0.44; // 25° in towards the chair; the main screen itself is turned ~17°
  const dir = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const c = rightEdge.clone().addScaledVector(dir, sw / 2 + bz + 0.008);
  monitor2.position.set(c.x, DESK_Y, c.z);
  monitor2.rotation.y = yaw;
  add3("mon", monitor2);
  monitor2.updateMatrixWorld(true);
  const [hx, hy] = project(monitor2.localToWorld(new THREE.Vector3(0, panelY, 0)));
  Object.assign(HOTSPOTS.monitor2, { x: hx, y: hy, rx: 115, ry: 85 });
}

/* --- home-lab rack under the desk: router, switch, mini server --- */
const blinkers = [];
const rack = new THREE.Group();
{
  const steel = std({ color: 0x1b1c1e, roughness: 0.55, metalness: 0.6 });
  const plastic = std({ color: 0x141416, roughness: 0.6 });
  const greyBox = std({ color: 0x2b2c2f, roughness: 0.5, metalness: 0.2 });
  const w = 0.46, d = 0.3;
  for (const y of [0.03, 0.24, 0.44]) mesh(new THREE.BoxGeometry(w, 0.012, d), steel, 0, y, 0, rack);
  for (const x of [-w / 2 + 0.01, w / 2 - 0.01]) for (const z of [-d / 2 + 0.01, d / 2 - 0.01]) mesh(new THREE.BoxGeometry(0.014, 0.46, 0.014), steel, x, 0.23, z, rack);
  // mini server / NAS (bottom shelf)
  mesh(rbox(0.17, 0.19, 0.22, 0.008), greyBox, -0.1, 0.036 + 0.095, 0.01, rack);
  mesh(new THREE.BoxGeometry(0.13, 0.15, 0.002), plastic, -0.1, 0.13, 0.121, rack);
  // UPS (bottom shelf)
  mesh(rbox(0.13, 0.17, 0.25, 0.01), plastic, 0.13, 0.036 + 0.085, 0.0, rack);
  // switch + router (top shelf)
  mesh(rbox(0.3, 0.035, 0.16, 0.004), greyBox, -0.03, 0.246 + 0.018, 0.04, rack);
  mesh(rbox(0.24, 0.045, 0.17, 0.01), plastic, 0.0, 0.446 + 0.023, 0.03, rack);
  for (const [x, a] of [[-0.09, 0.25], [-0.03, 0.08], [0.03, -0.08], [0.09, -0.25]]) {
    const ant = mesh(new THREE.CylinderGeometry(0.006, 0.007, 0.075, 8), plastic, x, 0.5, -0.04, rack);
    ant.rotation.z = a; ant.rotation.x = -0.25;
  }
  const ledMat = (c) => holdout(new THREE.MeshStandardMaterial({ color: 0x000000, emissive: c, emissiveIntensity: 2.2 }));
  const addLed = (x, y, z, c, rate) => { const m = mesh(new THREE.BoxGeometry(0.006, 0.004, 0.002), ledMat(c), x, y, z, rack); m.castShadow = false; blinkers.push({ m, rate, ph: Math.random() * 10 }); };
  for (let i = 0; i < 8; i++) addLed(-0.15 + i * 0.022, 0.256, 0.121, 0x2cff6a, 6 + Math.random() * 8);
  for (let i = 0; i < 4; i++) addLed(-0.06 + i * 0.03, 0.46, 0.116, i === 0 ? 0xffffff : 0x3aa0ff, i === 0 ? 0 : 2 + Math.random() * 5);
  addLed(-0.16, 0.2, 0.121, 0x3aa0ff, 0); addLed(-0.16, 0.18, 0.121, 0x2cff6a, 9); addLed(-0.16, 0.16, 0.121, 0x2cff6a, 4);
  addLed(0.13, 0.18, 0.126, 0x2cff6a, 0);
  contact(rack, 0.62, 0.42, 0.5, 0, 0.02);
  const p = onGround(990, 785);
  rack.position.set(p.x - 0.02, 0, -2.66);
  rack.rotation.y = -0.12;
  add3("rack", rack);
}

/* --- a longboard leaning against the post behind the dog --- */
const deckCanvas = document.createElement("canvas"); deckCanvas.width = 256; deckCanvas.height = 1024;
const deckTex = new THREE.CanvasTexture(deckCanvas); deckTex.colorSpace = THREE.SRGBColorSpace; deckTex.anisotropy = 8;
{
  // wood veneer underside: grain, white pinstripe, a soft teal wash (original artwork)
  const g = deckCanvas.getContext("2d"), w = 256, h = 1024;
  g.fillStyle = "#8a5a3a"; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * w, a = 0.05 + Math.random() * 0.12;
    g.strokeStyle = Math.random() < 0.5 ? `rgba(60,32,16,${a})` : `rgba(190,130,90,${a})`;
    g.lineWidth = 0.6 + Math.random() * 2.2; g.beginPath(); g.moveTo(x, 0);
    for (let y = 0; y <= h; y += 64) g.lineTo(x + Math.sin(y * 0.01 + i) * 3, y);
    g.stroke();
  }
  g.strokeStyle = "rgba(245,240,230,.9)"; g.lineWidth = 6;
  g.beginPath(); g.ellipse(w / 2, h / 2, w * 0.36, h * 0.44, 0, 0, Math.PI * 2); g.stroke();
  const tg = g.createLinearGradient(0, h * 0.2, 0, h * 0.75);
  tg.addColorStop(0, "rgba(16,110,104,.95)"); tg.addColorStop(0.55, "rgba(24,140,128,.85)"); tg.addColorStop(1, "rgba(24,140,128,0)");
  g.fillStyle = tg; g.beginPath(); g.ellipse(w / 2, h * 0.46, w * 0.27, h * 0.28, 0, 0, Math.PI * 2); g.fill();
}
const longboard = new THREE.Group();
{
  // tighter depth test: it has to slip between the dog (in front) and the post (behind)
  // only the dog (lower down) may cover it; the post and wall behind it never should
  const std = (o) => holdout(new THREE.MeshStandardMaterial(o), { bias: 0.01, onlyBelow: 636 });
  const L = 0.98, Wd = 0.235, T = 0.012;
  // drop-through deck outline (y along the board)
  const sh = new THREE.Shape();
  const pts = [[0, -L / 2], [0.05, -L / 2 + 0.01], [0.07, -L / 2 + 0.05], [0.065, -L / 2 + 0.16], [Wd / 2, -L / 2 + 0.24], [Wd / 2, L / 2 - 0.24], [0.065, L / 2 - 0.16], [0.07, L / 2 - 0.05], [0.05, L / 2 - 0.01], [0, L / 2]];
  sh.moveTo(0, -L / 2);
  pts.forEach(([x, y]) => sh.lineTo(x, y));
  [...pts].reverse().forEach(([x, y]) => sh.lineTo(-x, y));
  const geo = new THREE.ExtrudeGeometry(sh, { depth: T, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 8 });
  // UVs for the underside graphic
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / Wd + 0.5, pos.getY(i) / L + 0.5);
  geo.translate(0, 0, -T / 2);
  const wood = std({ color: 0xffffff, map: deckTex, roughness: 0.42 });
  const grip = std({ color: 0x141414, roughness: 0.95 });
  const deck = new THREE.Mesh(geo, [wood, grip]);
  // extrude groups: 0 = caps (front/back), 1 = sides; front cap faces +z (the underside, towards us)
  deck.castShadow = true;
  longboard.add(deck);
  const sideGrip = new THREE.Mesh(new THREE.ShapeGeometry(sh), grip); sideGrip.position.z = -T / 2 - 0.0025; sideGrip.rotation.y = Math.PI; longboard.add(sideGrip);
  const metal = std({ color: 0xc8cacc, roughness: 0.3, metalness: 1 });
  const dark = std({ color: 0x2a2a2a, roughness: 0.6 });
  const wheelM = std({ color: 0x2a9c90, roughness: 0.35, emissive: 0x06302c, emissiveIntensity: 0.25 });
  for (const y of [-L / 2 + 0.2, L / 2 - 0.2]) {
    mesh(new THREE.BoxGeometry(0.07, 0.09, 0.014), metal, 0, y, T / 2 + 0.007, longboard);            // baseplate
    mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.035, 10).rotateX(Math.PI / 2), dark, 0, y, T / 2 + 0.03, longboard); // bushing
    mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.25, 10).rotateZ(Math.PI / 2), metal, 0, y, T / 2 + 0.05, longboard); // hanger + axle
    for (const x of [-0.145, 0.145]) {
      const wl = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 20).rotateZ(Math.PI / 2), wheelM, x, y, T / 2 + 0.05, longboard);
      wl.castShadow = false;
    }
  }
  // stand it on its tail, leaning back against the post, underside facing the room
  // the dog is ~3.05-3.15 m away and the post ~3.3 m (from the depth map), so the board stands at ~3.2 m
  const lean = 0.05, Zc = 3.22;
  longboard.position.set(((163 - CX) * Zc) / F, 0.035 + (L / 2) * Math.cos(lean), -Zc);
  longboard.rotation.set(-lean, 0.1, 0.04);
  add3("lb", longboard);
}

/* --- whiteboard on the wall above the caps --- */
const boardCanvas = document.createElement("canvas"); boardCanvas.width = 760; boardCanvas.height = 980;
const boardTex = new THREE.CanvasTexture(boardCanvas); boardTex.colorSpace = THREE.SRGBColorSpace; boardTex.anisotropy = 8;
const whiteboard = new THREE.Group();
{
  const alu = std({ color: 0xa4a7ab, roughness: 0.38, metalness: 1.0 });
  const bw = 0.4, bh = 0.56;
  mesh(new THREE.PlaneGeometry(bw, bh), std({ color: new THREE.Color(0.56, 0.54, 0.52), map: boardTex, roughness: 0.25 }), 0, 0, 0.006, whiteboard);
  for (const [x, y, w, h] of [[0, bh / 2, bw + 0.02, 0.014], [0, -bh / 2, bw + 0.02, 0.014], [bw / 2, 0, 0.014, bh], [-bw / 2, 0, 0.014, bh]]) mesh(rbox(w, h, 0.014, 0.003), alu, x, y, 0.007, whiteboard);
  mesh(rbox(0.22, 0.012, 0.035, 0.004), alu, 0.08, -bh / 2 - 0.008, 0.02, whiteboard); // marker tray
  const mk = (x, c) => { const m = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.11, 10), std({ color: c, roughness: 0.4 }), x, -bh / 2 + 0.002, 0.028, whiteboard); m.rotation.z = Math.PI / 2 + 0.05; };
  mk(0.03, 0x1d3f8a); mk(0.11, 0xb3261e);
  const p = unproject(111, 140, 2.95);
  whiteboard.position.copy(p);
  whiteboard.rotation.y = 0.1;
  add3("wb", whiteboard);
}
function drawBoard() {
  const g = boardCanvas.getContext("2d"), w = boardCanvas.width, h = boardCanvas.height;
  g.fillStyle = "#f6f6f3"; g.fillRect(0, 0, w, h);
  g.globalAlpha = 0.06; g.strokeStyle = "#556"; g.lineWidth = 10; g.beginPath(); g.moveTo(80, 900); g.bezierCurveTo(260, 820, 420, 980, 690, 860); g.stroke(); g.globalAlpha = 1;
  const hand = "'Segoe Print', 'Bradley Hand', 'Comic Neue', 'Chalkboard SE', 'Comic Sans MS', cursive";
  g.fillStyle = "#1d3f8a"; g.font = `700 104px ${hand}`; g.fillText("TO DO", 40, 118);
  g.strokeStyle = "#1d3f8a"; g.lineWidth = 7; g.beginPath(); g.moveTo(38, 138); g.lineTo(400, 130); g.stroke();
  const items = [["Finish my CV site", true], ["Upload the CV", false], ["ESP32 relay build", false], ["Service the Cruiser", false], ["Walk the dog", true]];
  g.font = `600 58px ${hand}`;
  items.forEach(([t, done], i) => {
    const y = 236 + i * 96;
    g.strokeStyle = "#222"; g.lineWidth = 5; g.strokeRect(40, y - 44, 46, 46);
    if (done) { g.strokeStyle = "#1e7a35"; g.lineWidth = 8; g.beginPath(); g.moveTo(47, y - 22); g.lineTo(62, y - 4); g.lineTo(96, y - 54); g.stroke(); }
    g.fillStyle = done ? "#5c5c5c" : "#111"; g.fillText(t, 104, y);
    if (done) { g.strokeStyle = "#5c5c5c"; g.lineWidth = 4; g.beginPath(); g.moveTo(104, y - 18); g.lineTo(104 + g.measureText(t).width, y - 18); g.stroke(); }
  });
  g.fillStyle = "#b3261e"; g.font = `700 66px ${hand}`; g.fillText("WINS", 40, 776);
  g.font = `600 48px ${hand}`;
  ["★ 2nd — UCT BPM '26", "★ UCT Plus Bronze '24"].forEach((t, i) => g.fillText(t, 44, 850 + i * 66));
  // sticky note + magnet
  g.save(); g.translate(500, 690); g.rotate(-0.06);
  g.fillStyle = "rgba(0,0,0,.12)"; g.fillRect(6, 8, 200, 180); g.fillStyle = "#ffe680"; g.fillRect(0, 0, 200, 180);
  g.fillStyle = "#333"; g.font = `500 38px ${hand}`; g.fillText("Coffee", 26, 78); g.fillText("first ☕", 26, 130);
  g.restore();
  g.fillStyle = "#c0392b"; g.beginPath(); g.arc(600, 696, 14, 0, 7); g.fill();
  const lg = g.createLinearGradient(0, 0, w, h * 0.5); lg.addColorStop(0, "rgba(40,25,10,.24)"); lg.addColorStop(0.6, "rgba(40,25,10,.05)"); lg.addColorStop(1, "rgba(255,220,170,.10)");
  g.fillStyle = lg; g.fillRect(0, 0, w, h);
  boardTex.needsUpdate = true;
}

/* --- cows: the photo's own cows, lifted out of the picture so they can graze and wander --- */
// (the plate has them painted out; these sprites are their original pixels)
const COWS = [
  { src: "assets/cow0.png", box: [680, 327, 729, 359] },
  { src: "assets/cow1.png", box: [777, 325, 822, 353] },
];
const cowShader = {
  vertexShader: /* glsl */ `
    uniform float uBob; varying vec2 vUv; varying float vHoldZ;
    void main(){ vUv = uv; vec3 p = position; p.y += uBob;
      vec4 mv = modelViewMatrix * vec4(p, 1.0); vHoldZ = -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: H_GLSL + "\n" + /* glsl */ `
    uniform sampler2D tCow; uniform float uStep, uGraze, uFlip, uTime;
    varying vec2 vUv;
    void main(){
      float fd = 1.0 / max(vHoldZ, 0.01);
      if (photoDisp() > fd * 1.06 + 0.001) discard;
      vec2 uv = vUv;
      // walking: front and back legs swing in opposite phase (bottom third of the sprite)
      float legs = clamp((0.36 - uv.y) / 0.36, 0.0, 1.0);
      float front = smoothstep(0.5, 0.62, uv.x), back = 1.0 - smoothstep(0.38, 0.5, uv.x);
      uv.x += legs * uStep * (front - back) * 0.06;
      // grazing: the head nods a little
      float head = smoothstep(0.78, 0.9, uv.x) * smoothstep(0.55, 0.35, uv.y);
      uv.y += head * uGraze * (sin(uTime * 1.3) * 0.5 + 0.5) * 0.04;
      vec4 c = texture2D(tCow, uv);
      if (c.a < 0.02) discard;
      gl_FragColor = c;
    }`,
};
const cows = COWS.map((cfg, i) => {
  const [x0, y0, x1, y1] = cfg.box;
  const Z0 = (F * HC) / (y1 - 1 - YH); // the cow's original distance (its hooves on the ground)
  const w = ((x1 - x0) * Z0) / F, h = ((y1 - y0) * Z0) / F;
  const tex = loader.load(cfg.src); tex.colorSpace = THREE.NoColorSpace; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const u = { ...H_UNI, tCow: { value: tex }, uStep: { value: 0 }, uGraze: { value: 1 }, uFlip: { value: 1 }, uTime: uniforms.uTime, uBob: { value: 0 } };
  const geo = new THREE.PlaneGeometry(w, h); geo.translate(0, h / 2, 0);
  const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: u, ...cowShader, transparent: true, depthWrite: true, ...KEEP_ALPHA, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor }));
  const g = new THREE.Group(); g.add(m);
  // soft contact shadow (the painted-out originals took theirs with them)
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), holdout(new THREE.MeshBasicMaterial({ color: 0x000000, map: blobTex, opacity: 0.28 }), { keepAlpha: true, bias: 0.25 }));
  sh.rotation.x = -Math.PI / 2; sh.scale.set(w * 1.15, w * 0.9, 1); sh.position.set(w * 0.08, 0.02, 0.5); g.add(sh);
  const home = onGround((x0 + x1) / 2, y1 - 1);
  const c = { g, m, u, w, pos: new THREE.Vector2(home.x, home.z), target: new THREE.Vector2(home.x, home.z), dir: 1, state: "graze", timer: 6 + i * 9, phase: 0 };
  g.position.set(home.x, 0, home.z);
  add3("cow", g);
  return c;
});
// paddock: between the fences (metres), and the image x-range it spans
const PAD = { z0: -30.5, z1: -40, xl: 650, xr: 885 };
function updateCows(dt, t) {
  for (const c of cows) {
    c.timer -= dt;
    if (c.state === "graze" && c.timer < 0) {
      const z = rand(PAD.z1, PAD.z0);
      const xImg = rand(PAD.xl, PAD.xr);
      c.target.set(((xImg - CX) * -z) / F, z);
      if (c.target.distanceTo(c.pos) < 2) c.target.x += c.target.x > c.pos.x ? 3 : -3;
      // don't walk into the other cow
      const other = cows.find((o) => o !== c);
      if (other && c.target.distanceTo(other.pos) < 2.2) c.target.x += 2.5 * Math.sign(c.target.x - other.pos.x || 1);
      c.state = "walk";
      if (Math.random() < 0.45) setTimeout(() => sound.moo(project(new THREE.Vector3(c.pos.x, 1, c.pos.y))[0], 2.4), rand(400, 3000));
    }
    let speed = 0;
    if (c.state === "walk") {
      const to = c.target.clone().sub(c.pos);
      const d = to.length();
      speed = Math.min(0.55, d * 0.6);
      to.normalize();
      c.pos.addScaledVector(to, speed * dt);
      if (Math.abs(to.x) > 0.25) c.dir = to.x > 0 ? 1 : -1;
      if (d < 0.15) { c.state = "graze"; c.timer = rand(8, 18); }
    }
    c.phase += speed * dt * 5.2;
    c.u.uStep.value = Math.sin(c.phase) * Math.min(1, speed * 3);
    c.u.uBob.value = Math.abs(Math.sin(c.phase)) * 0.015 * Math.min(1, speed * 3);
    c.u.uGraze.value += ((c.state === "graze" ? 1 : 0) - c.u.uGraze.value) * Math.min(1, dt * 2);
    c.m.scale.x += (c.dir - c.m.scale.x) * Math.min(1, dt * 4); // turns around (sprites face right)
    c.g.position.set(c.pos.x, 0, c.pos.y);
  }
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

/* --- sprinklers: impact sprinklers in the crop rows, a rotor in the riverside garden --- */
function makeSprinkler({ x, y, v, elev, a0, a1, sweep, n, size, height = 0.6, alpha = 0.3, spread = 0.35 }) {
  const base = onGround(x, y);
  const nozzle = new THREE.Vector3(base.x, height, base.z);
  const geo = new THREE.BufferGeometry();
  const seeds = new Float32Array(n), pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) seeds[i] = Math.random();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  const u = { ...H_UNI, uTime: uniforms.uTime, uNozzle: { value: nozzle }, uV: { value: v }, uElev: { value: elev }, uA0: { value: a0 }, uA1: { value: a1 }, uSweep: { value: sweep }, uPx: { value: 1 }, uSz: { value: size }, uAlpha: { value: alpha }, uSpread: { value: spread } };
  const mat = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime, uV, uElev, uA0, uA1, uSweep, uPx, uSz, uSpread; uniform vec3 uNozzle;
      varying float vA; varying float vHoldZ;
      float sweepAngle(float te){
        float s = te * uSweep, ph = mod(s, 2.0);
        float k = ph < 1.0 ? ph : 1.0 - (ph - 1.0) * 1.0;
        if (ph < 1.0) { float st = 30.0; k = (floor(k * st) + smoothstep(0.0, 0.2, fract(k * st))) / st; } // ratchets forward, swings back smoothly
        return mix(uA0, uA1, k);
      }
      void main(){
        float T = 2.0 * uV * sin(uElev) / 9.8 + 0.25;
        float e = fract(uTime / T + aSeed * 7.13);
        float tau = e * T, te = uTime - tau;
        float ang = sweepAngle(te) + (fract(aSeed * 91.7) - 0.5) * 0.06 * (0.3 + e);
        float v = uV * (0.82 + 0.18 * fract(aSeed * 13.1)), el = uElev + (fract(aSeed * 37.3) - 0.5) * 0.1;
        vec3 dir = vec3(cos(ang), 0.0, -sin(ang));
        vec3 p = uNozzle + dir * v * cos(el) * tau + vec3(0.0, v * sin(el) * tau - 4.9 * tau * tau, 0.0);
        p += (vec3(fract(aSeed * 3.1), fract(aSeed * 5.7), fract(aSeed * 8.3)) - 0.5) * uSpread * (0.15 + e * e);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vHoldZ = -mv.z;
        gl_Position = projectionMatrix * mv;
        gl_PointSize = max(1.5, uSz * 1000.0 / vHoldZ * uPx * (0.7 + 0.6 * fract(aSeed * 29.0)));
        vA = (1.0 - e * 0.7) * step(0.0, p.y) * (0.45 + 0.55 * fract(aSeed * 17.0));
      }`,
    fragmentShader: H_GLSL + "\n" + /* glsl */ `
      varying float vA; uniform float uAlpha;
      void main(){
        float fd = 1.0 / max(vHoldZ, 0.01);
        if (photoDisp() > fd * 1.08 + 0.002) discard;
        float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard;
        // backlit droplets glow warm in the low sun
        gl_FragColor = vec4(vec3(1.0, 0.93, 0.8) * vA * uAlpha * smoothstep(0.5, 0.0, r), 1.0);
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  add3("spr", pts);
  return mat;
}
const sprinklers = [
  makeSprinkler({ x: 735, y: 382, v: 5.6, elev: 0.58, a0: 0.2, a1: 2.6, sweep: 0.07, n: 6000, size: 0.009, alpha: 0.09 }),
  makeSprinkler({ x: 735, y: 382, v: 5.0, elev: 0.6, a0: 0.2, a1: 2.6, sweep: 0.07, n: 1200, size: 0.1, alpha: 0.03, spread: 1.4 }),
  makeSprinkler({ x: 1000, y: 386, v: 5.4, elev: 0.58, a0: 0.5, a1: 2.9, sweep: 0.06, n: 6000, size: 0.009, alpha: 0.09 }),
  makeSprinkler({ x: 1000, y: 386, v: 4.8, elev: 0.6, a0: 0.5, a1: 2.9, sweep: 0.06, n: 1200, size: 0.1, alpha: 0.03, spread: 1.4 }),
];

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
  return clampView({ cx: (narrow ? 1000 : W / 2) + panX, cy: H / 2 + (narrow ? 0 : 10), hh });
}
function focusView(h) {
  const hh = baseHH() * (aspect() < 1.2 ? 0.8 : 0.58);
  return clampView({ cx: h.x + (aspect() > 1.2 ? hh * aspect() * 0.28 : 0), cy: h.y, hh });
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
  sprinklers.forEach((m) => (m.uniforms.uPx.value = pxPerImg * renderer.getPixelRatio()));
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
let mode = "intro"; // intro | explore | focus | monitor | os
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
  if (id === "monitor2") pendingOpen = { page: "game" };
  sitDown();
}
function setMode(m) {
  mode = m;
  document.body.classList.toggle("exploring", m !== "intro");
  document.body.classList.toggle("away", m === "focus" || m === "monitor" || m === "os");
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
  setMode("explore");
  sound.setFocus(null);
  target = homeView();
  sound.whoosh();
}
backBtn.onclick = standUp;

canvas.addEventListener("pointermove", (e) => {
  mouse.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
  if (mode === "intro" || mode === "explore" || mode === "focus") {
    const id = hitTest(e.clientX, e.clientY);
    if (id !== hoverId) setHover(id);
    if (id && mode !== "focus") {
      tooltip.textContent = HOTSPOTS[id].label;
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
    panX = hv.cx - (aspect() < 1.2 ? 1000 : W / 2);
    target = hv;
  }
});
window.addEventListener("pointerup", () => setTimeout(() => (drag = null), 0));
canvas.addEventListener("click", (e) => {
  if (drag && drag.moved) return;
  sound.click();
  if (mode === "focus") return backToRoom();
  const id = hitTest(e.clientX, e.clientY);
  if (id) activate(id);
  else if (mode === "intro") setMode("explore");
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { if (mode === "os") standUp(); else if (mode === "focus" || mode === "monitor") backToRoom(); }
});
window.addEventListener("message", (e) => {
  const m = e.data;
  if (!m || m.type !== "os") return;
  if (m.action === "zoom-out" || m.action === "shutdown") standUp();
  if (m.action === "click") sound.click();
  if (m.action === "key") sound.key();
  if (m.action === "sfx" && sound[m.name]) sound[m.name]();
});
$("#explore-btn").onclick = (e) => { e.stopPropagation(); sound.start(); setMode("explore"); };
$("#enter-btn").onclick = (e) => { e.stopPropagation(); sitDown(); };
$("#cv-btn").onclick = (e) => { e.stopPropagation(); pendingOpen = { page: "resume" }; sitDown(); };
const soundBtn = $("#sound-btn");
const syncSound = () => { soundBtn.textContent = sound.enabled ? "Sound on" : "Sound off"; soundBtn.setAttribute("aria-pressed", String(sound.enabled)); };
syncSound();
soundBtn.onclick = (e) => { e.stopPropagation(); sound.start(); sound.toggle(); syncSound(); };

/* ------------------------------------------------------------------ *
 *  The game on the second monitor (attract mode of Overland Run)
 * ------------------------------------------------------------------ */
const game = { x: 0, dust: [] };
function terrain(x) { return 250 + Math.sin(x * 0.006) * 28 + Math.sin(x * 0.017 + 1) * 12 + Math.sin(x * 0.041) * 5; }
function drawGame(t, dt) {
  const g = gameCanvas.getContext("2d"), w = gameCanvas.width, h = gameCanvas.height;
  game.x += dt * 150;
  const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#f2a65a"); sky.addColorStop(0.55, "#ffd29a"); sky.addColorStop(1, "#ffe6bf");
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  g.fillStyle = "#fff3d6"; g.beginPath(); g.arc(470, 120, 34, 0, 7); g.fill();
  const layer = (par, base, amp, f, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 8) g.lineTo(x, base + Math.sin((x + game.x * par) * f) * amp + Math.sin((x + game.x * par) * f * 2.7) * amp * 0.4); g.lineTo(w, h); g.fill(); };
  layer(0.15, 175, 22, 0.008, "#c98b62"); layer(0.35, 205, 18, 0.012, "#a9704d");
  // acacias
  g.fillStyle = "#4b3a2a";
  for (let i = 0; i < 5; i++) { const x = ((i * 190 - game.x * 0.5) % 950 + 950) % 950 - 120; g.fillRect(x, 190, 4, 30); g.beginPath(); g.ellipse(x + 2, 188, 30, 8, 0, 0, 7); g.fill(); }
  // ground
  g.fillStyle = "#7a5135"; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 6) g.lineTo(x, terrain(x + game.x)); g.lineTo(w, h); g.fill();
  // the 4x4
  const cx = 200, y1 = terrain(cx - 26 + game.x), y2 = terrain(cx + 26 + game.x);
  const ang = Math.atan2(y2 - y1, 52), cy = (y1 + y2) / 2 - 20 + Math.sin(t * 14) * 0.8;
  g.save(); g.translate(cx, cy); g.rotate(ang);
  g.fillStyle = "#efe7d6"; g.fillRect(-36, -14, 72, 16); g.fillRect(-28, -28, 40, 15);
  g.fillStyle = "#3d5466"; g.fillRect(-24, -25, 14, 9); g.fillRect(-7, -25, 15, 9);
  g.fillStyle = "#222"; g.fillRect(-30, -33, 34, 4);
  g.fillStyle = "#1a1a1a"; [-22, 22].forEach((x) => { g.beginPath(); g.arc(x, 4, 10, 0, 7); g.fill(); });
  g.fillStyle = "#777"; [-22, 22].forEach((x) => { g.beginPath(); g.arc(x, 4, 4, 0, 7); g.fill(); });
  g.restore();
  if (Math.random() < dt * 30) game.dust.push({ x: cx - 40, y: terrain(cx - 40 + game.x) - 4, r: 3, a: 0.5 });
  game.dust.forEach((d) => { d.x -= dt * 60; d.y -= dt * 8; d.r += dt * 10; d.a -= dt * 0.6; });
  game.dust = game.dust.filter((d) => d.a > 0);
  game.dust.forEach((d) => { g.fillStyle = `rgba(214,170,120,${d.a})`; g.beginPath(); g.arc(d.x, d.y, d.r, 0, 7); g.fill(); });
  // HUD
  g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(0, 0, w, 34);
  g.fillStyle = "#fff"; g.font = "bold 18px 'Courier New', monospace"; g.fillText("OVERLAND RUN", 14, 23);
  g.textAlign = "right"; g.fillText(String(Math.floor(game.x / 10)).padStart(6, "0") + " m", w - 14, 23); g.textAlign = "left";
  if (Math.floor(t * 1.5) % 2) { g.textAlign = "center"; g.font = "bold 22px 'Courier New', monospace"; g.fillStyle = "#3a2410"; g.fillText("PRESS START", w / 2, 92); g.textAlign = "left"; }
  gameTex.needsUpdate = true;
}

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
  drawBoard();
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
  target = mode === "monitor" || mode === "os" ? monitorView() : mode === "focus" && focused ? focusView(HOTSPOTS[focused]) : homeView();
  if (!manager.isLoading) Object.assign(view, clampView(view));
}
window.addEventListener("resize", onResize);
onResize();
Object.assign(view, homeView());

const clock = new THREE.Clock();
let lastScreenMin = -1, gameAcc = 0, nextBlink = 2, blinkT = -9, wag = 0;
const dogLook = new THREE.Vector2();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  uniforms.uTime.value = t;

  const k = 1 - Math.pow(mode === "monitor" ? 0.035 : 0.06, dt);
  view.cx += (target.cx - view.cx) * k;
  view.cy += (target.cy - view.cy) * k;
  view.hh += (target.hh - view.hh) * k;
  if (mode === "monitor") {
    const done = Math.abs(view.hh - target.hh) < 1.2 && Math.abs(view.cx - target.cx) < 1.2;
    if (done) openOS();
  }

  // parallax: follows the mouse (or drifts slowly on touch screens); calmer when focused
  const amt = mode === "monitor" || mode === "os" ? 0 : mode === "focus" ? 0.35 : 1;
  const want = coarse ? new THREE.Vector2(Math.sin(t * 0.21) * 0.5, Math.sin(t * 0.15) * 0.25) : mouse;
  mouseSmooth.lerp(want.clone().multiplyScalar(-amt), 1 - Math.pow(0.12, dt));
  uniforms.uMouse.value.copy(mouseSmooth);
  applyCamera();

  // wind: one gust value drives the trees, the grass and the wind sound
  const gust = 0.5 + 0.5 * Math.sin(t * 0.21) * Math.sin(t * 0.083 + 1.3);
  uniforms.uGust.value = gust; sound.gust = gust;

  postU.uHoverAmt.value += ((hoverId && mode !== "monitor" && mode !== "os" ? 1 : 0) - postU.uHoverAmt.value) * Math.min(1, dt * 8);
  postU.uFocusAmt.value += ((mode === "focus" ? (aspect() < 1.2 ? 0.45 : 1) : 0) - postU.uFocusAmt.value) * Math.min(1, dt * 3);
  screenU.uWake.value += ((mode === "monitor" || mode === "os" || screenHover ? 1 : 0) - screenU.uWake.value) * Math.min(1, dt * 4);

  const min = new Date().getMinutes();
  if (min !== lastScreenMin) { lastScreenMin = min; drawScreen(); }
  gameAcc += dt;
  if (gameAcc > 1 / 30) { drawGame(t, gameAcc); gameAcc = 0; }

  // living things
  updateCows(dt, t);
  updateBirds(dt, t);
  for (const b of blinkers) {
    b.m.material.emissiveIntensity = b.rate === 0 ? 2.0 : (Math.sin(t * b.rate + b.ph) + Math.sin(t * b.rate * 2.3 + b.ph * 2) > 0.2 ? 2.4 : 0.15);
  }
  // the dog watches the cursor, blinks now and then, and wags when you come near
  {
    const hx = 290, hy = 733;
    const [mx, my] = screenToImg((mouse.x * 0.5 + 0.5) * window.innerWidth, (0.5 - mouse.y * 0.5) * window.innerHeight);
    const dx = mx - hx, dy = my - hy, dist = Math.hypot(dx, dy);
    const k = Math.min(1, dist / 260);
    const want = mode === "os" || mode === "monitor" ? new THREE.Vector2(0.6, -0.3) : new THREE.Vector2((dx / (dist || 1)) * k, (dy / (dist || 1)) * k);
    dogLook.lerp(want, 1 - Math.pow(0.002, dt));
    uniforms.uLook.value.copy(dogLook);
    if (t > nextBlink) { blinkT = t; nextBlink = t + 2.5 + Math.random() * 4.5; if (Math.random() < 0.2) nextBlink = t + 0.35; }
    const bp = (t - blinkT) / 0.16;
    uniforms.uBlink.value = bp >= 0 && bp < 1 ? Math.sin(bp * Math.PI) : 0;
    const near = dist < 140 && (mode === "explore" || mode === "intro") ? 1 : 0;
    wag += (near - wag) * Math.min(1, dt * 3);
    uniforms.uWag.value = wag;
  }

  // the second monitor's glow on the desk follows the game's colours
  const [mx, my] = project(monitor2.localToWorld(new THREE.Vector3(0, 0.03, 0.1)));
  uniforms.uScreen2.value.set(mx, my, 0);

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
