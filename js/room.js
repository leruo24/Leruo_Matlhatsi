import * as THREE from 'three';
import { PHOTO, MONITOR, TABLET } from './photo-layer.js';

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
export const WIDE = Object.freeze({ left: 240, right: 242, top: 144, bottom: 210, width: W + 482, height: H + 354, feather: 90 });
export const ROOM = Object.freeze({
  eye: [0, HC, 0],
  minX: -4.6, maxX: 3.4, front: -3.8, back: 3.0, height: 2.9,
  // the glass sliding door in the right wall, slid open
  door: { x: 3.4, start: -3.4, end: -0.6, height: 2.3 },
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
  const wood = (rx, ry) => mat({ color: 0xffffff, map: tex('assets/room/wood-planks.jpg', { repeat: [rx, ry] }), roughness: 0.82 });
  const concrete = mat({ color: 0xfee0bf, map: tex('assets/tex/concrete.jpg', { repeat: [3, 3] }), roughness: 0.62, metalness: 0 });
  const darkWood = mat({ color: 0x6a5240, map: tex('assets/tex/oak.png', { repeat: [4, 1] }), roughness: 0.75 });
  const steel = mat({ color: 0x2b2d2f, roughness: 0.45, metalness: 0.75 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xc8d6d2, roughness: 0.05, metalness: 0, transmission: 0, transparent: true, opacity: 0.22, depthWrite: false });
  const grass = mat({ color: 0xa9c486, map: tex('assets/room/grass.jpg', { repeat: [40, 40] }), roughness: 1 });

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
  for (let z = front + 0.6; z < back; z += 1.2) box(width, 0.18, 0.09, darkWood, midX, height - 0.09, z, 'rafter');

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


  /* ---- the outdoor view through the door: sky, and the farm's tree line ---- */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { tBack: { value: tex('assets/room/backdrop.jpg') } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `precision highp float; uniform sampler2D tBack; varying vec3 vDir;
      void main(){
        float el = asin(clamp(vDir.y, -1.0, 1.0)), az = atan(vDir.x, -vDir.z);
        vec3 c = mix(vec3(0.93, 0.74, 0.60), vec3(0.47, 0.50, 0.62), smoothstep(0.05, 0.9, el));
        c = mix(vec3(0.38, 0.30, 0.19), c, smoothstep(-0.02, 0.02, el));
        // the photo's tree line and mountains, between 1.3 and 16 degrees above the horizon
        float v = (el - 0.023) / (0.28 - 0.023);
        float u = az / 1.57;
        vec3 strip = texture2D(tBack, vec2(fract(u), clamp(v, 0.002, 0.998))).rgb;
        float wgt = step(0.0, v) * (1.0 - smoothstep(0.82, 1.0, v)) + step(v, 0.0) * smoothstep(-0.25, 0.0, v);
        c = mix(c, strip, wgt);
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  sky.name = 'sky'; sky.renderOrder = 5; root.add(sky);   // after the room, so hidden sky isn't shaded

  /* ---- light, matched to the photo: low sun from the front left, warm bounce inside ---- */
  const sunDir = new THREE.Vector3((300 - CX) / F, (YH - 196) / F, -1).normalize();
  const sun = new THREE.DirectionalLight(0xffc89a, 4.2); sun.name = 'sun';
  sun.position.copy(sunDir).multiplyScalar(20); sun.target.position.set(0, 0, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 5, bottom: -5, near: 5, far: 40 });
  root.add(sun, sun.target);
  root.add(new THREE.HemisphereLight(0xffd7b0, 0x6a4a30, 2.4));
  const lamp = new THREE.PointLight(0xffb070, 9, 8, 2); lamp.position.set(-1.2, 2.5, 1.6); lamp.name = 'workshop-lamp'; root.add(lamp);

  /* ---- Poly Haven props (CC0) where the photo can't see ---- */
  const props = [
    ['steel_frame_shelves_01', [-3.6, 0, 2.7], Math.PI, 0.1],
    ['steel_frame_shelves_01', [-2.4, 0, 2.7], Math.PI, 0.1],
    ['steel_frame_shelves_01', [-4.33, 0, -1.9], Math.PI / 2, 0.1],
    ['wooden_table_03', [1.3, 0, 2.45], Math.PI],
    ['wooden_stool_01', [0.35, 0, 2.1], 0.4],
    ['wooden_crate_01', [-4.0, 0, 0.9], 0.2],
    ['wooden_crate_01', [-3.95, 0.5, 0.95], -0.1],
    ['cardboard_box_01', [-0.9, 0, 2.6], 0.3],
    ['cardboard_box_01', [2.6, 0, 2.55], -0.5],
    ['jug_01', [1.0, 0.75, 2.4], 0.6],
    ['lantern_01', [1.7, 0.75, 2.45], 0],
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
    uPx: { value: new THREE.Vector2(WIDE.width, WIDE.height) }, uFeather: { value: WIDE.feather },
  };
  const shellFrag = (rim) => `precision highp float; uniform sampler2D tWide, tLive; uniform vec4 uInner, uLiveRect; uniform vec2 uPx, uLiveFill; uniform float uFeather, uLiveOn; varying vec2 vUv;
      void main(){
        vec2 edge = min(vUv, 1.0 - vUv) * uPx;                          // distance to the shell's border, px
        float a = smoothstep(0.0, uFeather, min(edge.x, edge.y));
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
  const f = WIDE.feather, coreGeo = new THREE.PlaneGeometry(br.x - tl.x - 2 * f * pxW, tl.y - br.y - 2 * f * pxW);
  { const uv = coreGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (f + uv.getX(i) * (WIDE.width - 2 * f)) / WIDE.width, (f + uv.getY(i) * (WIDE.height - 2 * f)) / WIDE.height); }
  const core = new THREE.Mesh(coreGeo, new THREE.ShaderMaterial({ uniforms: shellU, depthWrite: true, fog: false, vertexShader: shellVert, fragmentShader: shellFrag(false) }));
  core.name = 'photo-shell-core'; core.renderOrder = -10; core.frustumCulled = false; core.userData.photo = true;
  core.position.copy(centre); root.add(core);

  /* ---- the screens you can open: hit quads exactly over the photo's monitor and tablet ---- */
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
  device('tablet', TABLET, 2.7);

  const modelled = () => root.children.filter((o) => !o.userData.photo && !o.isLight);
  const room = {
    root, devices, focus, eye, shell, core, shellUniforms: shellU, sun, onChange: null,
    // photo px covered by the opaque core (inside the feathered rim)
    coreBounds: [x0 + f, y0 + f, x1 - f, y1 - f],
    setModelVisible(on) { if (on === room.modelVisible) return; room.modelVisible = on; for (const o of modelled()) o.visible = on; shell.visible = on; },
    modelVisible: true,
  };
  return room;
}

/** the view that frames the photo the way the main experience does */
export function homeView(aspect) {
  const pitch = -Math.atan(((H / 2) - YH) / F);
  const vfov = 2 * Math.atan((H / 2) / F);
  // keep the horizontal view inside the photo plus its margin on very wide screens
  const maxH = 2 * Math.atan(((W / 2) + WIDE.left - WIDE.feather) / F);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
  const fov = hfov > maxH ? 2 * Math.atan(Math.tan(maxH / 2) / aspect) : vfov;
  // narrow (portrait) screens see a slice of the photo: centre it between the dogs and the monitor
  const yaw = aspect < 1 ? -Math.atan((930 - CX) / F) : 0;
  return { pitch, yaw, fov: THREE.MathUtils.radToDeg(fov) };
}
