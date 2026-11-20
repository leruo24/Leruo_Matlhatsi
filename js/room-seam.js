import * as THREE from 'three';
import { PHOTO } from './photo-layer.js';

/*
 * Objects that cross the photo's edge, continued in 3D so they don't stop at the seam.
 * Every position comes from measured photo pixels, unprojected from the photo's camera
 * (F = 1000 px, eye 1.3 m up). From the eye these line up with the photo by construction.
 *
 *  - ESP32 bench (right / bottom edge): top back edge level at y 716, front edge reaches
 *    y 925 at the right edge, 40 px thick at the front. At a 0.76 m worktop that is a
 *    0.58 m deep, 4 cm top. Its left end is hidden inside the photo.
 *  - Shade tree trunk (right edge): about 75 px wide where it leaves the frame, meeting the
 *    grass near y 540, so about 7.5 m away and 0.56 m across.
 *  - Pond (right edge): near shore at y 555, far shore at y 425 where it leaves the frame.
 */
const { F, CX, YH, HC } = PHOTO;
/** distance in front of the eye of a horizontal surface at height h seen at photo row y */
const depthAt = (y, h = 0) => F * (HC - h) / (y - YH);
const xAt = (x, Z) => (x - CX) * Z / F;

export const BENCH = (() => {
  const top = 0.76, thick = 0.04;
  const back = depthAt(716, top), frontZ = depthAt(925, top);
  return Object.freeze({ top, thick, back, front: frontZ, left: 0.36, right: 2.3 });
})();
export const TRUNK = Object.freeze({ x: xAt(1670, 7.5), z: 7.5, radius: 0.28 });
export const POND = Object.freeze({ near: depthAt(555), far: depthAt(425) });

export function addSeamContinuations({ root, timber }) {
  const group = new THREE.Group(); group.name = 'seam-continuations'; root.add(group);
  const add = (mesh, name, shadow = true) => { mesh.name = name; mesh.castShadow = shadow; mesh.receiveShadow = true; group.add(mesh); return mesh; };

  /* ---- the ESP32 bench, continued past the right edge ---- */
  const b = BENCH, len = b.right - b.left, depth = b.back - b.front;
  const benchTop = timber.clone(); benchTop.color.setRGB(0.62, 0.6, 0.64);   // matched to the photo's bench top (85,59,39)
  benchTop.onBeforeCompile = (shader) => {   // the oak texture is far more orange than the photo's bench
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15))), 0.45);`);
  };
  const top = add(new THREE.Mesh(new THREE.BoxGeometry(len, b.thick, depth), benchTop), 'bench-top');
  top.position.set((b.left + b.right) / 2, b.top - b.thick / 2, -(b.front + b.back) / 2);
  const frame = timber.clone(); frame.color.setRGB(0.55, 0.36, 0.22);
  // Legs under the corners of the bench as the photo draws it: its left end runs from (1224, 900)
  // at the front to (1377, 719) at the back, so the left legs sit there, hidden by the photo's top.
  const legGeo = new THREE.BoxGeometry(0.07, b.top - b.thick, 0.07);
  const frontLeft = xAt(1224, b.front), backLeft = xAt(1377, b.back);
  for (const [x, z] of [[b.right - 0.06, b.front + 0.06], [b.right - 0.06, b.back - 0.06], [frontLeft + 0.06, b.front + 0.06], [backLeft + 0.06, b.back - 0.06]]) {
    const leg = add(new THREE.Mesh(legGeo, frame), 'bench-leg'); leg.position.set(x, (b.top - b.thick) / 2, -z);
  }
  const rail = add(new THREE.Mesh(new THREE.BoxGeometry(len - 0.1, 0.08, 0.03), frame), 'bench-apron');
  rail.position.set((b.left + b.right) / 2, b.top - b.thick - 0.04, -(b.front + 0.03));
  const stretcher = add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, depth - 0.12), frame), 'bench-stretcher');
  stretcher.position.set(b.right - 0.06, 0.2, -(b.front + b.back) / 2);

  /* ---- the shade tree's trunk ---- */
  const t = TRUNK, trunkGeo = new THREE.CylinderGeometry(t.radius * 0.82, t.radius, 5, 24, 10);
  { // a slightly irregular, not machined, trunk
    const p = trunkGeo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i); const a = Math.atan2(v.z, v.x);
      const k = 1 + 0.06 * Math.sin(a * 3 + v.y * 0.9) + 0.035 * Math.sin(a * 7 - v.y * 1.7);
      p.setXYZ(i, v.x * k, v.y, v.z * k);
    }
    trunkGeo.computeVertexNormals();
  }
  const bark = new THREE.MeshStandardMaterial({ color: 0x6e5038, roughness: 0.95 });
  bark.onBeforeCompile = (shader) => {   // fine vertical fissures, no image texture to stretch
    shader.vertexShader = 'varying vec3 vBark;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBark = position;');
    shader.fragmentShader = 'varying vec3 vBark;\n' + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float ang = atan(vBark.z, vBark.x);
      float fissure = sin(ang * 26.0 + sin(vBark.y * 3.1) * 1.4) * 0.5 + 0.5;
      diffuseColor.rgb *= 0.72 + 0.36 * smoothstep(0.15, 0.85, fissure);`);
  };
  const trunk = add(new THREE.Mesh(trunkGeo, bark), 'tree-trunk');
  trunk.position.set(t.x, 2.5, -t.z);
  const flare = add(new THREE.Mesh(new THREE.CylinderGeometry(t.radius, t.radius * 1.45, 0.45, 24), bark), 'tree-root-flare');
  flare.position.set(t.x, 0.225, -t.z);   // base on the ground

  /* ---- the pond, continued to the right ---- */
  const shape = new THREE.Shape();
  const nearZ = POND.near, farZ = POND.far, x0 = 3.5, x1 = 42;
  shape.moveTo(x0, nearZ);
  for (let i = 1; i <= 24; i++) { const x = x0 + (x1 - x0) * i / 24; shape.lineTo(x, nearZ + 0.6 * Math.sin(i * 1.7) + 0.3 * Math.sin(i * 4.1)); }
  shape.lineTo(x1, farZ + 4);
  for (let i = 24; i >= 0; i--) { const x = x0 + (x1 - x0) * i / 24; shape.lineTo(x, farZ + 1.2 * Math.sin(i * 0.9) + (i / 24) * 4); }
  const pondGeo = new THREE.ShapeGeometry(shape); pondGeo.rotateX(Math.PI / 2);   // shape y -> world +z, so negate below
  pondGeo.scale(1, 1, -1);
  const water = new THREE.ShaderMaterial({
    fog: false, side: THREE.DoubleSide,   // the mirrored shape flips its winding
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `precision highp float; varying vec3 vW;   // cameraPosition is provided by three.js
      float h(float x){ return fract(sin(x * 91.7) * 43758.5); }
      float n(float x){ float i = floor(x), f = fract(x); return mix(h(i), h(i + 1.0), f * f * (3.0 - 2.0 * f)); }
      void main(){
        float dist = length(vW.xz - cameraPosition.xz);
        // measured from the photo's pond: bright warm near the shore, darker mid-water, warm far reflections
        vec3 c = mix(vec3(0.588, 0.467, 0.318), vec3(0.322, 0.247, 0.176), smoothstep(${POND.near.toFixed(1)}, 12.0, dist));
        c = mix(c, vec3(0.40, 0.31, 0.165), smoothstep(12.0, ${POND.far.toFixed(1)}, dist));
        // horizontal reflection streaks, like the photo's, irregular along the shore
        c *= 0.9 + 0.22 * n(vW.z * 3.1) * n(vW.x * 0.35 + 7.0);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const pond = new THREE.Mesh(pondGeo, water); pond.name = 'pond'; pond.position.y = -0.005; pond.receiveShadow = false; group.add(pond);
  return group;
}
