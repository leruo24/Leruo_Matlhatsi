import * as THREE from "three";

// Photo-space coordinates refer to the committed 1670 × 942 workshop, not the viewport.
// Geometry is allocated once. Only uniforms and two transforms change each frame.
export function createFarm({ scene, loader, uniforms, keepAlpha, depthAt, depthTexture }) {
  const blend = { transparent: true, depthTest: false, depthWrite: false,
    ...keepAlpha, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor };
  const texture = loader.load("assets/cow.png");
  texture.colorSpace = THREE.NoColorSpace;
  const animals = [
    { x: 715, y: 338, w: 49, h: 25, phase: 1.3, next: 4, target: 0, pose: 0 },
    { x: 817, y: 339, w: 44, h: 23, phase: 4.7, next: 9, target: 0.5, pose: 0.5 },
  ];
  const vertex = `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
  for (const a of animals) {
    a.mesh = new THREE.Mesh(new THREE.PlaneGeometry(a.w, a.h), new THREE.ShaderMaterial({
      ...blend,
      uniforms: { map: { value: texture }, time: uniforms.uTime, pose: { value: a.pose }, phase: { value: a.phase } },
      vertexShader: vertex,
      fragmentShader: `precision highp float; varying vec2 vUv;
        uniform sampler2D map; uniform float time,pose,phase;
        void main(){
          vec2 uv=vUv;
          // Tiny localized chewing / head lowering; hooves and body remain planted.
          float head=(1.-smoothstep(.22,.42,uv.x))*smoothstep(.18,.38,uv.y);
          uv.y+=head*(pose*.035+sin(time*2.7+phase)*.002);
          float body=smoothstep(.25,.45,uv.x)*(1.-smoothstep(.72,.9,uv.x));
          uv.y-=body*smoothstep(.3,.65,uv.y)*sin(time*1.3+phase)*.002;
          float tail=smoothstep(.85,.97,uv.x)*smoothstep(.2,.6,uv.y);
          uv.x+=tail*sin(time*1.8+phase)*.004;
          if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))discard;
          vec4 c=texture2D(map,uv); if(c.a<.01)discard;
          c.rgb=mix(c.rgb,vec3(.60,.49,.32),.12); gl_FragColor=c;
        }`,
    }));
    a.mesh.renderOrder = 2;
    scene.add(a.mesh);
  }

  // Two low rotating sprinklers between the foreground desk and the rear paddock.
  const heads = [{ x: 790, y: 380, phase: 0.7 }, { x: 1010, y: 380, phase: 3.1 }];
  const count = 320, seeds = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) { seeds[i*3]=i/count; seeds[i*3+1]=Math.random(); seeds[i*3+2]=Math.random(); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute("seed", new THREE.BufferAttribute(seeds, 3));
  for (const head of heads) {
    const u = { depthMap: {value:depthTexture}, time: uniforms.uTime, phase: { value: head.phase }, center: { value: new THREE.Vector2(head.x, 942-head.y) },
      mouse: uniforms.uMouse, par: uniforms.uPar, focus: uniforms.uFocusD, depth: { value: .055 }, pointScale: { value: 1 } };
    head.spray = new THREE.Points(geo, new THREE.ShaderMaterial({
      ...blend, uniforms: u,
      vertexShader: `attribute vec3 seed; uniform float time,phase,par,focus,depth,pointScale; uniform vec2 center,mouse;
        varying float opacity; varying vec2 photoUv;
        void main(){
          float life=.85+seed.y*.25, age=fract(seed.x+time/life)*life;
          float birth=time-age;
          float angle=sin(birth*.43+phase)*1.05 + sin(birth*.137+phase)*.17;
          float vx=sin(angle)*(43.+seed.z*12.);
          float vy=57.+seed.y*10.;
          vec2 p=center+vec2(vx*age,vy*age-64.*age*age);
          photoUv=p/vec2(1670.,942.);
          p+=vec2(mouse.x*1670.,mouse.y*942.)*(depth-focus)*par;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.,1.);
          gl_PointSize=clamp((.65+seed.z*.65)*pointScale,.65,2.5);
          opacity=(.18+seed.z*.32)*smoothstep(0.,.06,age)*(1.-smoothstep(life*.7,life,age));
        }`,
      fragmentShader: `precision highp float; varying float opacity; varying vec2 photoUv; uniform sampler2D depthMap; uniform float depth; void main(){if(texture2D(depthMap,photoUv).r>depth+.06)discard;float d=length(gl_PointCoord-.5); if(d>.5)discard; gl_FragColor=vec4(1.,.89,.67,opacity*(1.-smoothstep(.1,.5,d)));}`,
    }));
    head.spray.frustumCulled = false;
    head.spray.renderOrder = 3;
    scene.add(head.spray);
    head.stem = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 5), new THREE.MeshBasicMaterial({color:0x302c22, ...blend}));
    head.stem.renderOrder = 2;
    scene.add(head.stem);
  }
  return {
    update(dt, t, pixelScale, reduced) {
      const mouse = uniforms.uMouse.value;
      for (const a of animals) {
        if (!reduced && t > a.next) { a.target=Math.random(); a.next=t+8+Math.random()*15; }
        a.pose+=(a.target-a.pose)*(1-Math.exp(-dt*.7));
        a.mesh.material.uniforms.pose.value=a.pose;
        const d=depthAt(a.x,a.y)-uniforms.uFocusD.value;
        a.mesh.position.set(a.x+mouse.x*d*uniforms.uPar.value*1670,942-a.y+mouse.y*d*uniforms.uPar.value*942,1);
      }
      for (const head of heads) {
        const d=depthAt(head.x,head.y);
        head.spray.material.uniforms.depth.value=d;
        head.spray.material.uniforms.pointScale.value=pixelScale;
        head.stem.position.set(head.x+mouse.x*(d-uniforms.uFocusD.value)*uniforms.uPar.value*1670,
          942-head.y-2+mouse.y*(d-uniforms.uFocusD.value)*uniforms.uPar.value*942,1);
      }
    },
  };
}
