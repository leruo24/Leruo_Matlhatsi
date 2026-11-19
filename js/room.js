import * as THREE from 'three';

// Metres. One scene graph is authoritative for every camera angle and device target.
export const ROOM = Object.freeze({width:8,depth:8,height:3.4,eye:[0,1.65,1.8],door:{x:4,start:0,end:2}});
export function createRoom({scene,loader}={}) {
 const root=new THREE.Group();root.name='workshop';scene.add(root);
 const materials={wood:new THREE.MeshStandardMaterial({color:0xc0a58b,roughness:.68}),dark:new THREE.MeshStandardMaterial({color:0x242825,roughness:.65}),metal:new THREE.MeshStandardMaterial({color:0x414747,roughness:.4,metalness:.65}),white:new THREE.MeshStandardMaterial({color:0xd9d8cb,roughness:.6}),green:new THREE.MeshStandardMaterial({color:0x254c32,roughness:.8}),floor:new THREE.MeshStandardMaterial({color:0x999185,roughness:.92}),screen:new THREE.MeshStandardMaterial({color:0x113a27,emissive:0x123b29,emissiveIntensity:.5,roughness:.3})};
 // Shared bevelled geometry catches light at furniture edges without per-object allocations.
 const profile=new THREE.Shape();profile.moveTo(-.46,-.46);profile.lineTo(.46,-.46);profile.lineTo(.46,.46);profile.lineTo(-.46,.46);profile.closePath();
 const cube=new THREE.ExtrudeGeometry(profile,{depth:.92,bevelEnabled:true,bevelThickness:.04,bevelSize:.04,bevelSegments:2,steps:1});cube.translate(0,0,-.46);
 const cylinder=new THREE.CylinderGeometry(1,1,1,16),sphere=new THREE.SphereGeometry(1,24,16);
 function mesh(name,g,m,pos,scale,parent=root){const o=new THREE.Mesh(g,m);o.name=name;o.position.set(...pos);o.scale.set(...scale);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
 const box=(name,pos,size,mat=materials.wood,parent=root)=>mesh(name,cube,mat,pos,size,parent);
 const round=(name,pos,size,mat=materials.dark,parent=root)=>mesh(name,cylinder,mat,pos,size,parent);
 box('floor',[0,-.1,0],[8.2,.2,8.2],materials.floor);
 box('rear-wall',[0,1.7,4],[8,.0+3.4,.16]);box('left-wall',[-4,1.7,0],[.16,3.4,8]);
 // Right wall has a real 2 m aperture; no invisible wall spans the doorway.
 box('right-wall-front',[4,1.7,-2],[.16,3.4,4]);box('right-wall-rear',[4,1.7,3],[.16,3.4,2]);box('door-lintel',[4,3,1],[.16,.8,2]);
 box('ceiling',[0,3.5,0],[8.3,.15,8.3]);
 for(const z of [-4,-2,0,2,4])box('ceiling-beam',[0,3.25,z],[8.2,.22,.16],materials.dark);
 for(const x of [-3.9,3.9])box('front-post',[x,1.65,-4],[.18,3.3,.18]);
 box('door-track',[3.88,2.63,2],[.12,.07,4],materials.metal);
 box('door-threshold',[4,.015,1],[.2,.03,2],materials.metal);
 const glass=new THREE.MeshStandardMaterial({color:0x9ebcc0,transparent:true,opacity:.16,roughness:.12,metalness:.15,depthWrite:false});
 // Sliding leaf stays fully parked alongside the rear wall, z=2..4.
 box('parked-glass',[3.84,1.3,3],[.035,2.55,1.9],glass);
 for(const z of [2.03,3.97])box('door-frame',[3.84,1.3,z],[.065,2.6,.045],materials.dark);
 for(const y of [.025,2.575])box('door-frame',[3.84,y,3],[.065,.05,2],materials.dark);
 box('door-handle',[3.74,1.15,2.17],[.05,.25,.04],materials.metal);
 function table(name,x,z,w,d){const g=new THREE.Group();g.name=name;g.position.set(x,0,z);root.add(g);box('top',[0,.76,0],[w,.09,d],materials.wood,g);for(const a of [-1,1])for(const b of [-1,1])box('leg',[a*(w/2-.1),.36,b*(d/2-.1)],[.09,.72,.09],materials.dark,g);return g;}
 const desk=table('desk',0,-1.35,2.8,.9),bench=table('electronics-bench',2.95,-1.4,1.25,2.1);
 const monitor=new THREE.Group();monitor.name='monitor';monitor.position.set(-.2,.82,-1.58);root.add(monitor);
 box('monitor-foot',[0,.015,.02],[.36,.03,.22],materials.dark,monitor);box('monitor-neck',[0,.17,0],[.06,.3,.05],materials.dark,monitor);
 box('monitor-case',[0,.43,0],[.68,.42,.045],materials.dark,monitor);
 const pc=box('pc-screen',[0,.43,.026],[.625,.36,.008],materials.screen,monitor);pc.userData.device='pc';
 if(typeof document!=='undefined'){
  const c=document.createElement('canvas');c.width=1024;c.height=576;const g=c.getContext('2d');
  g.fillStyle='#12291f';g.fillRect(0,0,1024,576);g.fillStyle='#dfe8cf';g.textAlign='center';g.font='120px Georgia';g.fillText('lm.',512,260);g.font='20px sans-serif';g.fillText('LERUO / WORKSPACE',512,325);g.strokeStyle='#74866d';g.strokeRect(362,385,300,60);g.font='18px sans-serif';g.fillText('ENTER COMPUTER',512,423);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;pc.material=new THREE.MeshBasicMaterial({map:texture});
 }
 const tablet=new THREE.Group();tablet.name='tablet';tablet.position.set(.64,.81,-1.1);tablet.rotation.x=-.2;root.add(tablet);
 box('tablet-case',[0,.15,0],[.21,.3,.014],materials.dark,tablet);
 const tab=box('tablet-screen',[0,.15,.009],[.185,.267,.003],materials.screen,tablet);tab.userData.device='tablet';
 if(typeof document!=='undefined'){
  const c=document.createElement('canvas');c.width=384;c.height=560;const g=c.getContext('2d');g.fillStyle='#e9ecdf';g.fillRect(0,0,384,560);g.fillStyle='#203c2e';g.font='24px sans-serif';g.fillText('LERUO',36,65);g.font='56px Georgia';g.fillText('Field',36,190);g.fillText('notes.',36,253);g.font='16px sans-serif';g.fillText('PROJECTS / IDEAS / PEOPLE',36,320);g.fillRect(36,390,312,2);g.fillText('OPEN MY PROJECTS',36,440);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;tab.material=new THREE.MeshBasicMaterial({map:texture});
 }
 box('tablet-foot',[0,.015,-.05],[.22,.03,.16],materials.dark,tablet);
 box('keyboard',[-.2,.827,-1.08],[.46,.028,.16],materials.dark);round('mouse',[.22,.831,-1.03],[.035,.022,.052]);
 box('console',[1.03,.965,-1.55],[.15,.3,.065],materials.white);const vent=round('console-vent',[1.03,.985,-1.512],[.058,.004,.058]);vent.rotation.x=Math.PI/2;
 round('tumbler',[-1,.96,-1.28],[.045,.28,.045],materials.green);
 round('lamp-base',[-1.05,.82,-1.64],[.10,.025,.10]);box('lamp-stem',[-1.05,1.06,-1.64],[.025,.45,.025],materials.metal);round('lamp-shade',[-1.05,1.3,-1.64],[.12,.08,.12]);
 // The chair is clear of the fixed eye position and angled toward the desk.
 const chair=new THREE.Group();chair.name='chair';chair.position.set(-.65,0,.05);chair.rotation.y=.18;root.add(chair);
 round('chair-base',[0,.06,0],[.33,.05,.33],materials.dark,chair);round('chair-column',[0,.28,0],[.04,.4,.04],materials.metal,chair);box('chair-seat',[0,.5,0],[.53,.10,.5],materials.dark,chair);box('chair-back',[0,.86,.22],[.5,.7,.09],materials.dark,chair);
 for(const x of [-.31,.31])box('armrest',[x,.7,.04],[.07,.06,.35],materials.dark,chair);
 // Small physical details retain their positions from every angle.
 for(let row=0;row<5;row++)for(let col=0;col<14;col++)box('key',[-.41+col*.031,.846,-1.14+row*.028],[.024,.009,.020],materials.metal);
 box('wallet',[.9,.835,-1.06],[.17,.035,.105],materials.wood);
 const keyRing=new THREE.Mesh(new THREE.TorusGeometry(.018,.003,6,16),materials.metal);keyRing.rotation.x=Math.PI/2;keyRing.position.set(.98,.833,-.94);root.add(keyRing);box('key',[1.02,.832,-.94],[.05,.005,.012],materials.metal);
 const controller=new THREE.Group();controller.position.set(1.1,.86,-1.15);controller.rotation.x=-.25;root.add(controller);
 box('controller-body',[0,0,0],[.16,.045,.08],materials.white,controller);for(const x of [-.055,.055]){const grip=box('controller-grip',[x,-.01,.035],[.045,.05,.08],materials.white,controller);grip.rotation.y=x<0?-.2:.2;round('thumbstick',[x,.03,-.005],[.012,.012,.012],materials.dark,controller);}
 const lampGlow=new THREE.PointLight(0xffcf8c,8,2.5,2);lampGlow.position.set(-1.05,1.23,-1.64);root.add(lampGlow);
 // Wall joinery, desk drawers and hardware shelf trim add depth without flat photo layers.
 for(let z=-3.8;z<4;z+=.4)box('wall-batten',[-3.90,1.7,z],[.025,3.36,.018],materials.wood);
 for(let x=-3.8;x<4;x+=.4)box('rear-batten',[x,1.7,3.90],[.018,3.36,.025],materials.wood);
 for(const y of [.22,.43,.64]){box('drawer',[-1,.0+y,-1.35],[.55,.19,.72]);box('drawer-handle',[-1,y,-.974],[.17,.02,.025],materials.metal);}
 for(let i=0;i<10;i++)box('book',[-1.2+i*.14,1.48,3.69],[.09,.6-(i%3)*.05,.27],i%2?materials.green:materials.white);
 box('breadboard',[2.95,.83,-1.1],[.2,.045,.13],materials.white);box('esp32',[2.9,.84,-1.55],[.055,.02,.09],materials.green);box('multimeter',[3.1,.84,-1.8],[.12,.06,.19],materials.dark);
 box('whiteboard',[-3.89,1.9,-2.4],[.04,.8,.65],materials.white);
 for(const y of [.4,1.1,1.8,2.5])box('rear-shelf',[0,y,3.7],[3,.06,.5]);
 for(const x of [-1.4,1.4])box('shelf-upright',[x,1.4,3.7],[.05,2.8,.5],materials.dark);
 for(let i=0;i<6;i++)box('storage-box',[-1.05+(i%3)*1.05,.62+Math.floor(i/3)*.7,3.7],[.75,.35,.4],materials.dark);
 // Outdoor geometry has real depth too; no photo with a duplicate desk wraps the room.
 box('garden',[0,-.23,-10],[70,.22,70],materials.green);
 const water=new THREE.MeshStandardMaterial({color:0x557b81,roughness:.24,metalness:.35});round('pond',[8,-.095,-11],[5,.025,3],water);
 const leaves=new THREE.MeshStandardMaterial({color:0x3b532c,roughness:1});
 for(let i=0;i<20;i++){const angle=i*2.399,x=Math.cos(angle)*(12+i*.5),z=-12+Math.sin(angle)*(7+i*.3);if(Math.abs(x)<5&&z>-5)continue;round('tree-trunk',[x,1.3,z],[.17,2.6,.17],materials.wood);mesh('canopy',sphere,leaves,[x,3.1,z],[1.6,1.8,1.6]);}
 const house=box('farmhouse',[6,1,-19],[5,2,3],materials.wood);box('house-roof',[6,2.1,-19],[5.4,.22,3.5],materials.dark);
 box('garage',[-7,1.6,-14],[5,3.2,.15]);for(const x of [-9.5,-4.5])box('garage-side',[x,1.6,-12],[.15,3.2,4]);box('garage-roof',[-7,3.25,-12],[5.3,.15,4.4],materials.dark);
 const truck=box('land-cruiser-body',[-5,.9,-7],[1.8,.65,3.6],materials.white);box('land-cruiser-cab',[-5,1.5,-7.4],[1.7,.75,1.8],materials.white);
 for(const x of [-5.9,-4.1])for(const z of [-8.1,-5.9]){const w=round('wheel',[x,.43,z],[.43,.2,.43]);w.rotation.z=Math.PI/2;}
 scene.background=new THREE.Color(0xc9b799);scene.fog=new THREE.Fog(0xc9b799,24,65);
 scene.add(new THREE.HemisphereLight(0xffe8bd,0x55533d,2));
 const sun=new THREE.DirectionalLight(0xffce92,3);sun.position.set(-8,10,-6);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-6,right:6,top:6,bottom:-6,near:.5,far:35});sun.shadow.bias=-.001;scene.add(sun);
 if(loader){const wood=loader.load('assets/tex/oak.png');wood.colorSpace=THREE.SRGBColorSpace;wood.wrapS=wood.wrapT=THREE.RepeatWrapping;wood.repeat.set(1,1);materials.wood.map=wood;materials.wood.needsUpdate=true;const concrete=loader.load('assets/tex/concrete.jpg');concrete.colorSpace=THREE.SRGBColorSpace;concrete.wrapS=concrete.wrapT=THREE.RepeatWrapping;concrete.repeat.set(4,4);materials.floor.map=concrete;materials.floor.needsUpdate=true;}
 root.updateMatrixWorld(true);
 const focus={};for(const [kind,screen] of [['pc',pc],['tablet',tab]]){const point=screen.getWorldPosition(new THREE.Vector3());const normal=new THREE.Vector3(0,0,1).applyQuaternion(screen.getWorldQuaternion(new THREE.Quaternion()));focus[kind]={point,position:point.clone().addScaledVector(normal,kind==='pc'?.65:.38)};}
 return {root,devices:[pc,tab],focus,eye:new THREE.Vector3(...ROOM.eye)};
}
