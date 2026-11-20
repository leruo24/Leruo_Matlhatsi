import * as THREE from 'three';
import { addRoomDetail } from './room-detail.js';
import { addSeamContinuations } from './room-seam.js';
import { PHOTO, MONITOR } from './photo-layer.js';

/*
 * The 3D preview room, anchored to the workshop photo.
 *
 * The eye stays where the photo was taken (1.3 m up, looking down -Z) and only turns, so the
 * photo shell is pixel-exact from every angle: the desk, dogs, cows, sprinklers, drone and farm are
 * the live, animated photo, not stand-in models. The shell is the photo plus an outpainted margin.
 * Everything the photo never saw (side walls, back wall, ceiling, floor under the chair, the open
 * sliding door and the view through it) is modelled, with surfaces sampled from the photo and
 * Poly Haven (CC0) props, and the shell's edge is feathered into it.
 */
const { W, H, F, CX, YH, HC } = PHOTO;
// the outpainted plate: the photo sits inside a margin generated around it
// Only a thin band of generated margin is kept around the photo: further out LaMa's guesses smear
// (blotchy foliage, a bench turned into a floor slab). Modelled geometry takes over from there.
// feather: how far each edge fades into the modelled room (px, may reach into the photo itself)
export const WIDE = Object.freeze({ left: 60, right: 40, top: 40, bottom: 60, width: W + 100, height: H + 100,
  feather: Object.freeze({ left: 80, right: 70, top: 60, bottom: 80 }) });
/** photo px covered by the shell's fully opaque core, [x0, y0, x1, y1] */
export const CORE = Object.freeze([-WIDE.left + WIDE.feather.left, -WIDE.top + WIDE.feather.top, W + WIDE.right - WIDE.feather.right, H + WIDE.bottom - WIDE.feather.bottom]);
export const ROOM = Object.freeze({
  eye: [0, HC, 0],
  minX: -4.6, maxX: 3.4, front: -3.8, back: 3.0, height: 2.9,
  // the glass sliding door in the right wall, slid open
  // the opening starts at the front corner, so no wall sits inside the photo's feathered edge
  door: { x: 3.4, start: -3.74, end: -0.6, height: 2.3 },
  shellDistance: 0.3,
});

/** photo pixel (x, y) at distance Z in front of the eye -> world point */
export const unproject = (x, y, Z) => new THREE.Vector3((x - CX) * Z / F, HC - (y - YH) * Z / F, -Z);
/** world point -> photo pixel, as the photo's camera saw it */
export const project = (v) => [CX + F * v.x / -v.z, YH - F * (v.y - HC) / -v.z];

export function createRoom({ scene, loader = null, gltf = null, photoTexture = null, maxAnisotropy = 4 } = {}) {
  // photoTexture: { texture, rect, fill } from createLivePhoto
  const root = new THREE.Group(); root.name = 'workshop-room'; scene.add(root);
  const eye = new THREE.Vector3(...ROOM.eye);
  const tex = (url, { repeat = [1, 1], color = true } = {}) => {
    if (!loader) return null;
    const t = loader.load(url); t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = maxAnisotropy; return t;
  };
  const mat = (o) => new THREE.MeshStandardMaterial(o);
  const add = (mesh, name, parent = root) => { mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh; };
  const box = (w, h, d, m, x, y, z, name, parent) => { const b = add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), name, parent); b.position.set(x, y, z); return b; };
  const plane = (w, h, m, name) => add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), m), name);

  /* ---- surfaces, colour-matched to the photo next to each seam ---- */
  const boardTexture = tex('assets/tex/oak.png', { repeat: [.12, 1.5] });
  if (boardTexture) { boardTexture.center.set(.5,.5); boardTexture.rotation = Math.PI / 2; }
  const timber = mat({ color: 0xb7afa0, map: boardTexture, roughness: .78 });
  // Wall planes are the dark backing behind narrow physical board joints.
  const wood = () => mat({color:0x473c31,roughness:.95});
  // tinted to the photo's floor where they meet (measured across the bottom seam)
  const concrete = mat({ color: 0x978375, roughness: .78, metalness: 0 });
  concrete.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 vFloorPosition;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvFloorPosition = position;');
    shader.fragmentShader = 'varying vec3 vFloorPosition;\n' + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float cloud = sin(vFloorPosition.x * 1.7 + sin(vFloorPosition.y * 2.1)) * sin(vFloorPosition.y * 1.3);
      float grain = fract(sin(dot(vFloorPosition.xy, vec2(127.1,311.7))) * 43758.5453);
      diffuseColor.rgb *= 0.96 + cloud * 0.025 + grain * 0.018;`);
  };
  const darkWood = mat({ color: 0x867967, map: tex('assets/tex/oak.png', { repeat: [4, 1] }), roughness: 0.75 });
  const steel = mat({ color: 0x2b2d2f, roughness: 0.45, metalness: 0.75 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xc8d6d2, roughness: 0.05, metalness: 0, transmission: 0, transparent: true, opacity: 0.22, depthWrite: false });
  const grass = mat({ color: 0xe3d6b8, map: tex('assets/room/grass.jpg', { repeat: [60, 60] }), roughness: 1 });
  // A flat plane lit at the sun's grazing angle renders about 2-3x darker than the photo's upright,
  // sunlit blades (measured: 79,53,22 vs 118,92,44 sRGB), so the albedo carries that difference.
  grass.color.setRGB(1.75, 1.95, 1.5);
  // large-scale patches of drier and greener grass, so the texture's tiling doesn't read as a grid
  grass.onBeforeCompile = (shader) => {
    shader.vertexShader = 'varying vec2 vGround;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGround = (modelMatrix * vec4(position, 1.0)).xz;');
    shader.fragmentShader = 'varying vec2 vGround;\nfloat gh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\nfloat gn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(gh(i), gh(i + vec2(1, 0)), f.x), mix(gh(i + vec2(0, 1)), gh(i + vec2(1, 1)), f.x), f.y); }\n'
      + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float patchy = gn(vGround * 0.11) * 0.6 + gn(vGround * 0.37) * 0.4;
      diffuseColor.rgb *= mix(vec3(0.86, 0.92, 0.8), vec3(1.1, 1.0, 0.86), patchy);`);
  };

  const { minX, maxX, front, back, height, door } = ROOM;
  const width = maxX - minX, depth = back - front, midX = (minX + maxX) / 2, midZ = (front + back) / 2;

  // floor, and the meadow outside
  const floor = plane(width, depth, concrete, 'floor'); floor.rotation.x = -Math.PI / 2; floor.position.set(midX, 0, midZ);
  const apron = plane(1.6, door.end - door.start + 1, concrete, 'apron'); apron.rotation.x = -Math.PI / 2; apron.position.set(maxX + 0.8, 0.001, (door.start + door.end) / 2);
  const meadow = plane(160, 160, grass, 'meadow'); meadow.rotation.x = -Math.PI / 2; meadow.position.set(0, -0.02, 0); meadow.castShadow = false;

  // walls: vertical planks like the wall in the photo
  const left = plane(depth, height, wood(depth / 1.1, 1.6), 'left-wall'); left.rotation.y = Math.PI / 2; left.position.set(minX, height / 2, midZ);
  const backWall = plane(width, height, wood(width / 1.1, 1.6), 'back-wall'); backWall.rotation.y = Math.PI; backWall.position.set(midX, height / 2, back);
  // front wall: only the piece left of the big opening (the photo shows the rest is open)
  const frontW = -2.7 - minX;
  const frontWall = plane(frontW, height, wood(frontW / 1.1, 1.6), 'front-wall'); frontWall.position.set(minX + frontW / 2, height / 2, front);
  box(maxX + 2.7, 0.42, 0.22, darkWood, (maxX - 2.7) / 2, 2.62, front, 'header-beam');
  // ceiling with exposed rafters
  const ceiling = plane(width, depth, darkWood, 'ceiling'); ceiling.rotation.x = Math.PI / 2; ceiling.position.set(midX, height, midZ);
  // first rafter sits just beyond the photo's top edge, not inside its feathered rim
  for (let z = front + 1.2; z < back; z += 1.2) box(width, 0.18, 0.09, darkWood, midX, height - 0.09, z, 'rafter');

  // right wall with the open sliding door
  const rightWall = new THREE.Group(); rightWall.name = 'right-wall'; root.add(rightWall);
  const rw = (z0, z1, y0, y1, name) => { const w = z1 - z0, h = y1 - y0; const p = plane(w, h, wood(w / 1.1, h / 1.8), name); p.rotation.y = -Math.PI / 2; p.position.set(maxX, (y0 + y1) / 2, (z0 + z1) / 2); rightWall.add(p); return p; };
  rw(front, door.start, 0, height, 'right-wall-front');
  rw(door.end, back, 0, height, 'right-wall-back');
  rw(door.start, door.end, door.height, height, 'door-lintel');
  // door frame (dark aluminium) and the glass panel, parked open beside the aperture
  const frame = new THREE.Group(); frame.name = 'door-frame'; root.add(frame);
  box(0.12, 0.05, door.end - door.start + 0.1, steel, maxX, door.height + 0.025, (door.start + door.end) / 2, 'door-track-top', frame);
  box(0.12, 0.02, door.end - door.start + 0.1, steel, maxX, 0.01, (door.start + door.end) / 2, 'door-track-floor', frame);
  box(0.12, door.height, 0.05, steel, maxX, door.height / 2, door.start - 0.025, 'door-jamb', frame);
  box(0.12, door.height, 0.05, steel, maxX, door.height / 2, door.end + 0.025, 'door-jamb', frame);
  const parked = new THREE.Group(); parked.name = 'parked-glass'; root.add(parked);
  const pw = door.end - door.start, pz = door.end + 0.06 + pw / 2;
  const pane = add(new THREE.Mesh(new THREE.PlaneGeometry(pw - 0.08, door.height - 0.1), glass), 'glass', parked); pane.rotation.y = -Math.PI / 2; pane.position.set(maxX - 0.09, door.height / 2, pz); pane.castShadow = false;
  box(0.04, door.height, 0.04, steel, maxX - 0.09, door.height / 2, pz - pw / 2 + 0.02, 'panel-stile', parked);
  box(0.04, door.height, 0.04, steel, maxX - 0.09, door.height / 2, pz + pw / 2 - 0.02, 'panel-stile', parked);
  box(0.04, 0.05, pw, steel, maxX - 0.09, door.height - 0.025, pz, 'panel-rail', parked);
  box(0.04, 0.05, pw, steel, maxX - 0.09, 0.025, pz, 'panel-rail', parked);


  /* ---- the outdoor view through the door: sky, distant ridges and a tree line ----
   * Procedural and non-repeating (no copied strip of the photo), in colours sampled from the
   * photo's own sky, mountains, trees and meadow. */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `precision highp float; varying vec3 vDir;
      float h1(float x){ return fract(sin(x * 127.1) * 43758.5453); }
      float n1(float x){ float i = floor(x), f = fract(x); return mix(h1(i), h1(i + 1.0), f * f * (3.0 - 2.0 * f)); }
      float fbm(float x){ float v = 0.0, a = 0.5; for (int k = 0; k < 5; k++){ v += a * n1(x); x = x * 2.03 + 11.7; a *= 0.5; } return v; }
      void main(){
        float el = asin(clamp(vDir.y, -1.0, 1.0)), az = atan(vDir.x, -vDir.z);
        vec3 horizon = vec3(0.94, 0.78, 0.68), zenith = vec3(0.50, 0.52, 0.62);
        vec3 c = mix(horizon, zenith, smoothstep(0.04, 0.9, el));
        // far mountains (2-6 degrees), softened toward the sky by haze
        float far = 0.032 + 0.075 * fbm(az * 2.6 + 3.1);
        c = mix(c, mix(vec3(0.49, 0.455, 0.478), horizon, 0.35 + 0.4 * smoothstep(far - 0.03, far, el)), step(el, far));
        // nearer hills
        float hill = 0.016 + 0.03 * fbm(az * 5.3 + 17.0);
        c = mix(c, vec3(0.43, 0.39, 0.37), step(el, hill) * 0.85);
        // tree line: irregular crowns above the meadow, never a repeated pattern
        float crowns = 0.004 + 0.016 * pow(fbm(az * 38.0 + 5.0), 1.6) + 0.005 * n1(az * 160.0);
        vec3 tree = vec3(0.298, 0.227, 0.102) * (0.8 + 0.4 * n1(az * 70.0));
        c = mix(c, tree, step(el, crowns));
        // meadow below the horizon (mostly covered by the ground plane)
        c = mix(vec3(0.482, 0.40, 0.247), c, smoothstep(-0.004, 0.002, el));
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  sky.name = 'sky'; sky.renderOrder = 5; root.add(sky);   // after the room, so hidden sky isn't shaded

  /* ---- light, matched to the photo: low sun from the front left, warm bounce inside ---- */
  const sunDir = new THREE.Vector3((300 - CX) / F, (YH - 196) / F, -1).normalize();
  const sun = new THREE.DirectionalLight(0xffdebb, 2.4); sun.name = 'sun';
  sun.position.copy(sunDir).multiplyScalar(20); sun.target.position.set(0, 0, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 5, bottom: -5, near: 5, far: 40 });
  root.add(sun, sun.target);
  // warm-neutral sky and a bounce from the sunlit floor, matched to the photo's interior tones
  root.add(new THREE.HemisphereLight(0xefe4d4, 0x857462, 1.25));
  // bounce from the sunlit gravel and floor at the open front: the photo shows the front wall warmly lit
  const bounce = new THREE.PointLight(0xffeedd, 3.2, 5.5, 2); bounce.position.set(-3.3, 1.4, -2.5); bounce.name = 'front-bounce'; root.add(bounce);
  const lamp = new THREE.PointLight(0xffd7aa, 12, 7, 2); lamp.position.set(.75, 2.15, 2.3); lamp.name = 'workshop-lamp'; root.add(lamp);

  /* ---- Poly Haven props (CC0) where the photo can't see ---- */
  const props = [
    ['steel_frame_shelves_01', [-3.6, 0, 2.7], Math.PI, 0.1],
    ['steel_frame_shelves_01', [-2.4, 0, 2.7], Math.PI, 0.1],
    ['steel_frame_shelves_01', [-4.33, 0, -1.9], Math.PI / 2, 0.1],
    
    ['wooden_stool_01', [0.35, 0.014, 1.5], 0.4],
    ['wooden_crate_01', [-4.0, 0, 0.9], 0.2],
    ['wooden_crate_01', [-3.95, 0.337, 0.95], -0.1],   // on the lower crate's lid
    ['cardboard_box_01', [-0.9, 0, 2.6], 0.3],
    ['cardboard_box_01', [2.6, 0, 2.55], -0.5],
    ['jug_01', [-.42, 0.93, 2.55], 0.6],
    ['lantern_01', [2.0, 0.93, 2.55], 0],
  ];
  if (gltf) {
    const cache = new Map();
    for (const [name, pos, rot, scale = 1] of props) {
      if (!cache.has(name)) cache.set(name, new Promise((ok) => gltf.load(`assets/models/${name}.glb`, (g) => ok(g.scene), undefined, () => ok(null))));
      cache.get(name).then((src) => {
        if (!src) return;
        const o = src.clone(true); o.name = name; o.position.set(...pos); o.rotation.y = rot; o.scale.setScalar(scale);
        o.traverse((m) => { if (m.isMesh) { m.castShadow = m.receiveShadow = true; } });
        root.add(o); room.onChange?.();
      });
    }
  }

  // ceiling boards: the same timber, a little lighter and less red, like the photo's roof underside
  const ceilingTimber = timber.clone(); ceilingTimber.color.setRGB(1.05, 0.92, 0.74);
  ceilingTimber.onBeforeCompile = (shader) => {   // keep the grain, lose most of the oak texture's orange
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15))), 0.55);`);
  };
  addRoomDetail({root, limits:ROOM, oak:timber, ceiling:ceilingTimber, concrete, steel});
  addSeamContinuations({ root, timber });

  /* ---- the photo shell: the live photo inside its outpainted margin ----
   * Drawn very close to the eye (it only ever turns, so distance doesn't change what you see):
   * the opaque core goes first and hides the room behind it from the depth test, the feathered
   * rim goes last and blends into the modelled room. */
  const D = ROOM.shellDistance;
  const x0 = -WIDE.left, x1 = W + WIDE.right, y0 = -WIDE.top, y1 = H + WIDE.bottom;
  const shellU = {
    tWide: { value: tex('assets/room/photo-wide.jpg', { color: false }) }, tLive: { value: photoTexture?.texture ?? null },
    uLiveRect: { value: photoTexture?.rect ?? new THREE.Vector4(0, 0, 1, 1) }, uLiveFill: { value: photoTexture?.fill ?? new THREE.Vector2(1, 1) },
    uLiveOn: { value: 0 },
    uInner: { value: new THREE.Vector4(WIDE.left / WIDE.width, WIDE.bottom / WIDE.height, (WIDE.left + W) / WIDE.width, (WIDE.bottom + H) / WIDE.height) },
    uPx: { value: new THREE.Vector2(WIDE.width, WIDE.height) }, uFeather: { value: new THREE.Vector4(WIDE.feather.left, WIDE.feather.right, WIDE.feather.top, WIDE.feather.bottom) },
  };
  const shellFrag = (rim) => `precision highp float; uniform sampler2D tWide, tLive; uniform vec4 uInner, uLiveRect, uFeather; uniform vec2 uPx, uLiveFill; uniform float uLiveOn; varying vec2 vUv;
      void main(){
        vec2 px = vUv * uPx;                                             // canvas px, y up
        float a = smoothstep(0.0, uFeather.x, px.x) * smoothstep(0.0, uFeather.y, uPx.x - px.x)
                * smoothstep(0.0, uFeather.z, uPx.y - px.y) * smoothstep(0.0, uFeather.w, px.y);
        ${rim ? 'if (a >= 1.0) discard;' : ''}
        vec3 c = texture2D(tWide, vUv).rgb;
        vec2 q = (vUv - uInner.xy) / (uInner.zw - uInner.xy);             // photo uv
        vec2 inPx = min(q, 1.0 - q) * (uInner.zw - uInner.xy) * uPx;    // distance inside the photo, px
        vec2 l = (q - uLiveRect.xy) / (uLiveRect.zw - uLiveRect.xy);
        float live = uLiveOn * smoothstep(0.0, 14.0, min(inPx.x, inPx.y)) * step(0.0, l.x) * step(l.x, 1.0) * step(0.0, l.y) * step(l.y, 1.0);
        if (live > 0.0) c = mix(c, texture2D(tLive, l * uLiveFill).rgb, live);
        gl_FragColor = vec4(c, ${rim ? 'a' : '1.0'});
      }`;
  const shellVert = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const tl = unproject(x0, y0, D), br = unproject(x1, y1, D), pxW = (br.x - tl.x) / WIDE.width;
  const centre = new THREE.Vector3((tl.x + br.x) / 2, (tl.y + br.y) / 2, -D);
  const shell = new THREE.Mesh(new THREE.PlaneGeometry(br.x - tl.x, tl.y - br.y), new THREE.ShaderMaterial({
    uniforms: shellU, transparent: true, depthTest: false, depthWrite: false, fog: false, vertexShader: shellVert, fragmentShader: shellFrag(true),
  }));
  shell.name = 'photo-shell'; shell.renderOrder = 10; shell.frustumCulled = false; shell.userData.photo = true;
  shell.position.copy(centre); root.add(shell);
  // the opaque core: the shell inset by the feather, with matching uvs
  const fe = WIDE.feather, coreGeo = new THREE.PlaneGeometry(br.x - tl.x - (fe.left + fe.right) * pxW, tl.y - br.y - (fe.top + fe.bottom) * pxW);
  coreGeo.translate((fe.left - fe.right) / 2 * pxW, (fe.bottom - fe.top) / 2 * pxW, 0);
  { const uv = coreGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (fe.left + uv.getX(i) * (WIDE.width - fe.left - fe.right)) / WIDE.width, (fe.bottom + uv.getY(i) * (WIDE.height - fe.top - fe.bottom)) / WIDE.height); }
  const core = new THREE.Mesh(coreGeo, new THREE.ShaderMaterial({ uniforms: shellU, depthWrite: true, fog: false, vertexShader: shellVert, fragmentShader: shellFrag(false) }));
  core.name = 'photo-shell-core'; core.renderOrder = -10; core.frustumCulled = false; core.userData.photo = true;
  core.position.copy(centre); root.add(core);

  /* ---- the screens you can open: hit quads exactly over the photo's monitor ---- */
  const devices = [], focus = {};
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  function device(kind, quad, Z) {
    const pts = quad.map(([x, y]) => unproject(x, y, Z));
    const g = new THREE.BufferGeometry().setFromPoints([pts[0], pts[3], pts[1], pts[1], pts[3], pts[2]]);
    g.computeVertexNormals(); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, hitMat); m.name = `${kind}-screen`; m.userData.device = kind; root.add(m); devices.push(m);
    const point = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(0.25);
    // zoom so the screen fills about 80% of the view height
    const ys = quad.map((p) => p[1]), span = Math.max(...ys) - Math.min(...ys);
    const fov = THREE.MathUtils.radToDeg(2 * Math.atan(span / 0.8 / 2 / F));
    focus[kind] = { point, position: eye.clone(), fov };
  }
  device('pc', MONITOR, 3.1);


  const modelled = () => root.children.filter((o) => !o.userData.photo && !o.isLight);
  const room = {
    root, devices, focus, eye, shell, core, shellUniforms: shellU, sun, onChange: null,
    // photo px covered by the opaque core (inside the feathered rim)
    coreBounds: CORE,
    setModelVisible(on) { if (on === room.modelVisible) return; room.modelVisible = on; for (const o of modelled()) o.visible = on; shell.visible = on; },
    modelVisible: true,
  };
  return room;
}

/**
 * Which part of the photo the camera sees (image px), and whether the photo's opaque core fills the
 * view. Returns null when none of the photo is in view (for example facing the back wall).
 * `coreBounds` is room.coreBounds.
 */
export function photoInView(camera, coreBounds) {
  const c = coreBounds, d = new THREE.Vector3();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, hits = 0, covers = true;
  for (let i = 0; i < 9; i++) {
    d.set((i % 3) - 1, Math.floor(i / 3) - 1, 0.5).unproject(camera).sub(camera.position).normalize();
    if (d.z < -0.02) {
      hits++;
      const x = CX + F * d.x / -d.z, y = YH - F * d.y / -d.z;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      if (x < c[0] || x > c[2] || y < c[1] || y > c[3]) covers = false;
    } else {
      covers = false;   // this edge of the view looks past the photo's plane: open that side fully
      if (d.x < 0) x0 = -Infinity; if (d.x > 0) x1 = Infinity;
      if (d.y > 0) y0 = -Infinity; if (d.y < 0) y1 = Infinity;
    }
  }
  // the view is convex: if no sample reaches the photo's side, nothing between them does either
  if (!hits) return null;
  x0 = Math.max(0, x0 - 4); y0 = Math.max(0, y0 - 4); x1 = Math.min(W, x1 + 4); y1 = Math.min(H, y1 + 4);
  if (!(x1 > x0 && y1 > y0)) return null;
  return { rect: [x0, y0, x1, y1], covers };
}

/**
 * The view that frames the photo the way the main experience does: as much of the photo's height as
 * fits, centred on the opaque core so no feathered edge shows. Narrow (portrait) screens see a slice
 * of the photo, centred between the dogs and the monitor.
 */
export function homeView(aspect) {
  const top = Math.atan((YH - CORE[1]) / F), bottom = Math.atan((CORE[3] - YH) / F);
  const pitch = (top - bottom) / 2;
  const yaw = aspect < 1 ? -Math.atan((930 - CX) / F) : (Math.atan((CX - CORE[0]) / F) - Math.atan((CORE[2] - CX) / F)) / 2;
  const cam = new THREE.PerspectiveCamera(50, aspect, 0.05, 10);
  cam.position.set(...ROOM.eye); cam.rotation.set(pitch, yaw, 0, 'YXZ');
  let fov = THREE.MathUtils.radToDeg(top + bottom);
  for (; fov > 10; fov -= 0.25) {   // shrink until the whole view sits on the opaque core
    cam.fov = fov; cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    if (photoInView(cam, CORE)?.covers) break;
  }
  return { pitch, yaw, fov };
}
