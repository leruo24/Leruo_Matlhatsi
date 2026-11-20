import * as THREE from "three";
import { constrainFlight } from "./drone-control.js";
import { createFarm } from "./farm.js";
import { PHOTO_VERT, PHOTO_FRAG, droneMaterial, DogAnimator, homography } from "./photo-layer.js";
import { OfficeMotion } from "./office.js";
import { spring, blend, FrameBudget } from "./motion.js";
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
 *  4. Everything is graded together in one final pass (focus pull and vignette).
 */
const P = window.PORTFOLIO || {};
const W = 1670, H = 942; // image size (px)
const SCREEN = [[847, 392], [1143, 396], [1143, 554], [847, 541]]; // TL TR BR BL of the main monitor (its green screen)
const SCREEN_C = [995, 470];
const PAR = 0.017; // parallax strength (uv units at full mouse travel)
const FOCUS_D = 0.3; // depth that stays still while you look around
// camera matched to the photo: focal length (px), principal point / horizon (px), height (m)
const F = 1000, CX = 835, YH = 367, HC = 1.3;

const HOTSPOTS = {
  monitor: { label: "Use the computer", x: 995, y: 470, rx: 160, ry: 100 },
  dogA: { label: "Say hi", x: 250, y: 600, rx: 55, ry: 95, dog: 0 },
  dogB: { label: "Say hi", x: 262, y: 765, rx: 95, ry: 45, dog: 1 },
  dogC: { label: "Say hi", x: 410, y: 715, rx: 42, ry: 70, dog: 2 },
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
// render scale adapts to the device: starts sensible, drops if frames get slow, climbs back if there's headroom
const MAX_PR = Math.min(window.devicePixelRatio, coarse ? 1.25 : 1.5);
let prScale = MAX_PR;
renderer.setPixelRatio(prScale);
renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // the photo is display-ready; everything is composed in display space
renderer.autoClear = false;
// colour = photo + 3D in display space, alpha = disparity (1 / distance) for the focus pull
const rt = new THREE.WebGLRenderTarget(4, 4, { samples: 0, depthBuffer: true }); // no MSAA: the photo doesn't need it

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
  uBlink: { value: new THREE.Vector3() }, uEar: { value: new THREE.Vector4() }, uWag: { value: 0 }, uTilt: { value: 0 },
};
const KEEP_ALPHA = { blending: THREE.CustomBlending, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor };

const photo = new THREE.Mesh(
  new THREE.PlaneGeometry(W, H),
  new THREE.ShaderMaterial({
    uniforms, depthTest: false, depthWrite: false,
    vertexShader: PHOTO_VERT,
    fragmentShader: PHOTO_FRAG,

  })
);
photo.position.set(W / 2, H / 2, 0);
photoScene.add(photo);

/* ------------------------------------------------------------------ *
 *  The main monitor: a live screen mapped onto the photo
 * ------------------------------------------------------------------ */
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
const N_DUST = 380;
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

/* --- the drone: lifted out of the photo, now it actually flies --- */
const droneTex = raw(loader.load("assets/drone.png"));
const DRONE_W = 100, DRONE_H = 26;
const drone = new THREE.Mesh(new THREE.PlaneGeometry(DRONE_W, DRONE_H), droneMaterial({ droneTex, tMask, uTime: uniforms.uTime, keepAlpha: KEEP_ALPHA }));
drone.position.z = 1.5;
photoScene.add(drone);
const droneState = { x: 1035, y: 173, vx: 0, vy: 0, tx: 1035, ty: 173, next: 0, tilt: 0 };
const droneX={x:1035,v:0}, droneY={x:173,v:0};
const pilot={manual:false,angle:0,rotation:0};
const droneButton=$('#drone-btn'),dronePanel=$('#drone-panel');
droneButton.hidden=false;
function syncFlightControls(){
 $('#drone-x').value=droneState.tx;$('#drone-y').value=335-droneState.ty;$('#drone-angle').value=pilot.angle*180/Math.PI;
 $('#drone-auto').setAttribute('aria-pressed',String(!pilot.manual));
 $('#drone-status').textContent=pilot.manual?'Manual flight · release the sticks to hover.':'Autopilot · move either stick to take control.';
}
function closeFlight(){dronePanel.hidden=true;droneButton.setAttribute('aria-expanded','false');}
droneButton.onclick=()=>{
 if(!dronePanel.hidden){closeFlight();return;}
 pilot.manual=true;droneState.tx=droneState.x;droneState.ty=droneState.y;
 dronePanel.hidden=false;droneButton.setAttribute('aria-expanded','true');syncFlightControls();$('#flight-stick').focus();
};
$('#drone-close').onclick=()=>{closeFlight();droneButton.focus();};
for(const id of ['#drone-x','#drone-y','#drone-angle'])$(id).addEventListener('input',()=>{
 const f=constrainFlight(Number($('#drone-x').value),335-Number($('#drone-y').value),Number($('#drone-angle').value)*Math.PI/180);
 pilot.manual=true;droneState.tx=f.x;droneState.ty=f.y;pilot.angle=f.angle;syncFlightControls();
});
$('#drone-reset').onclick=()=>{pilot.manual=true;droneState.tx=1035;droneState.ty=173;pilot.angle=0;syncFlightControls();};
$('#drone-auto').onclick=()=>{pilot.manual=false;pilot.angle=0;droneState.next=-1;syncFlightControls();};

function updateDrone(dt, t) {
  const d = droneState;
  if (!pilot.manual && t > d.next) {
    // pick the next spot in the sky over the farm and the pond, sometimes hang still for a bit
    d.tx = rand(760, 1420); d.ty = rand(120, 215); d.next = t + rand(4, 9);
  }
  const bounded=constrainFlight(d.tx,d.ty,pilot.angle);d.tx=bounded.x;d.ty=bounded.y;pilot.angle=bounded.angle;
  if(pilot.manual&&reduceMotion){d.x=d.tx;d.y=d.ty;d.vx=d.vy=0;pilot.rotation=pilot.angle;}
  droneX.x=d.x; droneX.v=d.vx; droneY.x=d.y; droneY.v=d.vy;
  // autopilot drifts lazily; manual flight answers the sliders in about a second and a half
  const k=pilot.manual?3.2:.8;
  d.x=spring(droneX,d.tx,k,dt); d.vx=droneX.v;
  d.y=spring(droneY,d.ty,k*1.1,dt); d.vy=droneY.v;
  d.tilt += (-d.vx * 0.004 - d.tilt) * blend(3,dt);
  const hover = Math.sin(t * 1.9) * 1.2;
  // smaller when it's further away (higher in the sky)
  const sc = 0.75 + (d.y - 120) / 95 * 0.35;
  const off = uniforms.uMouse.value, depthOff = (0.01 - FOCUS_D) * PAR;
  drone.position.x = d.x + off.x * depthOff * W;
  drone.position.y = H - (d.y + hover) - off.y * depthOff * H;
  drone.scale.setScalar(Math.min(1.1,sc));
  pilot.rotation+=(pilot.angle-pilot.rotation)*blend(5,dt);
  drone.rotation.z=pilot.rotation;
  drone.material.uniforms.uTilt.value = d.tilt;
  const [mx, my] = screenToImg((mouse.x * 0.5 + 0.5) * window.innerWidth, (0.5 - mouse.y * 0.5) * window.innerHeight);
  sound.drone.x = d.x; sound.drone.speed = Math.hypot(d.vx, d.vy);
  sound.drone.near = Math.max(0, 1 - Math.hypot(mx - d.x, my - d.y) / 380);
}

/* --- birds: the odd flock crossing the sky, plus a single bird now and then --- */
const birdMat = std({ color: 0x1b1714, roughness: 1, side: THREE.DoubleSide });
const birdBody = new THREE.CapsuleGeometry(0.06, 0.22, 3, 6).rotateZ(Math.PI / 2);
const birdWing = new THREE.BufferGeometry();
birdWing.setAttribute("position", new THREE.Float32BufferAttribute([0,0,0,.12,0,0,-.06,0,.5,.06,0,0,-.1,0,.45,-.02,0,.5],3));
birdWing.computeVertexNormals();
const birdWingRight = birdWing.clone().scale(1,1,-1);
function makeBird() {
  const g = new THREE.Group();
  mesh(birdBody, birdMat, 0, 0, 0, g);
  const L=mesh(birdWing,birdMat,0,.01,.03,g), R=mesh(birdWingRight,birdMat,0,.01,-.03,g);
  L.castShadow = R.castShadow = false;
  g.children[0].castShadow = false;
  return { g, L, R, ph: Math.random() * 10 };
}
const farm = createFarm({scene:photoScene,loader,uniforms,keepAlpha:KEEP_ALPHA,depthAt,depthTexture:tDepth});
const flocks = [];
let nextFlock = 2.5;
function spawnFlock() {
  const dir = Math.random() < 0.5 ? 1 : -1;
  const Z = rand(55, 110), yImg = rand(70, 230);
  const n = Math.random() < 0.3 ? 1 : 2 + Math.floor(Math.random() * 3);
  const startX = ((dir > 0 ? -60 : W + 60) - CX) * Z / F;
  const Y = HC + ((YH - yImg) * Z) / F;
  const birds = [];
  for (let i = 0; i < n; i++) {
    const b = makeBird();
    const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;
    b.off = new THREE.Vector3(-dir * row * 1.3, rand(-0.3, 0.3), side * row * 1.1);
    b.flap = rand(3.2, 4.2); b.scale = rand(0.65, 1.0);
    b.g.scale.setScalar(b.scale);
    add3("bird", b.g); birds.push(b);
  }
  flocks.push({ birds, pos: new THREE.Vector3(startX, Y, -Z), vel: new THREE.Vector3(dir * rand(9, 13), rand(-0.4, 0.6), rand(-2, 2)), dir });
}
function updateBirds(dt, t) {
  nextFlock -= dt;
  if (nextFlock < 0) { if (flocks.length < 2) spawnFlock(); nextFlock = rand(12, 30); }
  for (let k = flocks.length - 1; k >= 0; k--) {
    const f = flocks[k];
    f.pos.addScaledVector(f.vel, dt);
    for (const b of f.birds) {
      const p = b.g.position.copy(f.pos).add(b.off); p.y += Math.sin(t * 0.7 + b.ph) * 0.4;
      b.g.position.copy(p);
      b.g.rotation.y = f.dir > 0 ? 0 : Math.PI;
      b.g.rotation.z = Math.sin(t * .37 + b.ph) * .065;
      // flap in bursts, then glide
      const gl = 1 - 0.85 * THREE.MathUtils.smoothstep(Math.sin(t * 0.45 + b.ph), 0.25, 0.75);
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
      // No temporal grain: retain clean detail during movement.
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
  if (id && HOTSPOTS[id].dog === undefined) { const h = HOTSPOTS[id]; postU.uHover.value.set(h.x, h.y, h.rx, h.ry); } else postU.uHover.value.set(-999, -999, 1, 1);
  const sh = id === "monitor";
  if (sh !== screenHover) { screenHover = sh; drawScreen(); }
}
function activate(id) {
  sound.start();
  if (mode === "monitor" || mode === "os") return;
  if (HOTSPOTS[id].dog !== undefined) return patDog(HOTSPOTS[id].dog);
  if (mode !== "seated") return takeSeat();   // first you sit down at the desk...
  sitDown();                                    // ...then you jump into the computer
}
// click a dog: it barks (each in its own voice), pricks its ears, the standing one wags
function patDog(i) {
  sound.dog(i, HOTSPOTS[["dogA", "dogB", "dogC"][i]].x);
  dogs.pat(i, sceneTime);
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
  if(m === "monitor" || m === "os" || m === "seated")closeFlight();
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
  osFrame.contentWindow?.postMessage({ type: "host", action: "mute", on: sound.enabled }, "*");
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

let lastMove = -1e9;
canvas.addEventListener("pointermove", (e) => {
  lastMove = performance.now();
  mouse.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
  if (mode === "intro" || mode === "explore" || mode === "seated") {
    const id = hitTest(e.clientX, e.clientY);
    if (id !== hoverId) setHover(id);
    if (id) {
      tooltip.textContent = HOTSPOTS[id].dog !== undefined || mode === "seated" ? HOTSPOTS[id].label : "Take a seat";
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
  if (e.key === "Escape" && !dronePanel.hidden){closeFlight();droneButton.focus();return;}
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
const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
let reduceMotion = motionQuery.matches, sceneryPaused = false;
motionQuery.addEventListener("change", e => { reduceMotion = e.matches; });
const officeMotion = new OfficeMotion(vrOffice);
const pauseButton = $("#pause-btn");
pauseButton.onclick = () => {
  sceneryPaused = !sceneryPaused;
  pauseButton.setAttribute("aria-pressed", String(sceneryPaused));
  pauseButton.textContent = sceneryPaused ? "Resume scenery" : "Pause scenery";
};
let audioWasRunning = false;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    audioWasRunning = sound.ctx?.state === "running";
    if (audioWasRunning) sound.ctx.suspend();
  } else if (audioWasRunning) sound.ctx?.resume();
});
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
const syncOSMute = () => osFrame.contentWindow?.postMessage({ type: "host", action: "mute", on: sound.enabled }, "*");
soundBtn.onclick = (e) => { e.stopPropagation(); sound.start(); sound.toggle(); syncSound(); syncVrMute(); syncOSMute(); };

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
let sceneTime = 0;
const cameraMotion = {cx:{x:view.cx,v:0},cy:{x:view.cy,v:0},hh:{x:view.hh,v:0}};
const lookX={x:0,v:0},lookY={x:0,v:0};
const drift=new THREE.Vector2(), want=new THREE.Vector2();
const budget=new FrameBudget(MAX_PR,prScale);
let lastScreenMin = -1;
const dogs = new DogAnimator(uniforms);
function frame() {
  requestAnimationFrame(frame);
  const elapsed = clock.getDelta();
  const dt = Math.min(0.05, elapsed);
  if (document.hidden) return;
  updateIntro();
  officeMotion.draw(dt, !vrDone && !vr.classList.contains("gated"), reduceMotion);
  sound.update(dt);
  if (mode === "os") return;
  if (!vrDone && !vr.classList.contains("playing")) return;
  const moving = !reduceMotion && !sceneryPaused;
  const motionDt = moving ? dt : 0;
  sceneTime += motionDt;
  const t = sceneTime;
  uniforms.uTime.value = t;
  sound.sprinklerMotion = t;

  // Camera acceleration and settling stay continuous when a new target is chosen.
  for (const key of ['cx','cy','hh']) {
    cameraMotion[key].x=view[key];
    view[key]=spring(cameraMotion[key],target[key],mode==='monitor'?8:6,dt);
  }
  if (mode === "monitor") {
    const done = Math.abs(view.hh - target.hh) < 1.2 && Math.abs(view.cx - target.cx) < 1.2;
    if (done) openOS();
  }

  // parallax: follows the mouse (or drifts slowly on touch screens); calmer when focused
  const amt = mode === "monitor" || mode === "os" ? 0 : mode === "seated" ? 0.3 : 1;
  // when the mouse rests (or on touch screens), the view keeps a slow, hand-held drift so it never freezes
  const idle = coarse ? 1 : Math.min(1, Math.max(0, (performance.now() - lastMove) / 1000 - 1.5) / 2);
  drift.set(Math.sin(t * .16) * .28 + Math.sin(t * .37) * .035, Math.cos(t * .16) * .13);
  want.copy(mouse).multiplyScalar(1 - idle * .6).addScaledVector(drift,idle).multiplyScalar(reduceMotion ? 0 : -amt);
  mouseSmooth.set(spring(lookX,want.x,9,dt),spring(lookY,want.y,9,dt));
  uniforms.uMouse.value.copy(mouseSmooth);
  applyCamera();

  // wind: one gust value drives the trees, the grass and the wind sound
  const gust = 0.5 + 0.5 * Math.sin(t * 0.21) * Math.sin(t * 0.083 + 1.3);
  uniforms.uGust.value = gust; sound.gust = gust;

  postU.uHoverAmt.value += ((hoverId && mode !== "monitor" && mode !== "os" ? 1 : 0) - postU.uHoverAmt.value) * blend(8,dt);
  // sitting at the desk: the screens are sharp, the view outside goes soft
  if (mode === "seated") postU.uFocusDepth.value = 0.37;
  postU.uFocusAmt.value += ((mode === "seated" ? (aspect() < 1.2 ? 0.35 : 0.6) : 0) - postU.uFocusAmt.value) * blend(3,dt);
  screenU.uWake.value += ((mode === "monitor" || mode === "os" || screenHover ? 1 : 0) - screenU.uWake.value) * blend(4,dt);

  const min = new Date().getMinutes();
  if (min !== lastScreenMin) { lastScreenMin = min; drawScreen(); }

  // living things
  updateBirds(motionDt, t);
  farm.update(motionDt, t, innerHeight / (view.hh * 2) * prScale, !moving);
  dogs.update(t, motionDt);
  updateDrone(motionDt, t);
  const nextScale=budget.sample(elapsed);
  if (Math.abs(nextScale-prScale)>.001) {
    prScale=nextScale; renderer.setPixelRatio(prScale); onResize();
  }

  {
    const show = mode === "intro" || mode === "explore" || mode === "seated";
    helpBtn.style.display = show ? "" : "none";
    if (show) { const [hx2, hy2] = imgToScreen(560, 565); helpBtn.style.transform = `translate(${hx2}px, ${hy2}px)`; }
  }
  sound.view = { cx: view.cx, hw: view.hh * aspect() };

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
