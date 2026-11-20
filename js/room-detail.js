import * as THREE from 'three';

// Small repeated parts share instanced geometry and materials: visual detail without
// a separate draw call for every board, tool, cabinet pull or shelf item.
export function addRoomDetail({root, limits, oak, ceiling = oak, concrete, steel}) {
  const group = new THREE.Group(); group.name='room-joinery'; root.add(group);
  const batches = new Map(), cube=new THREE.BoxGeometry(1,1,1);
  const cylinder=new THREE.CylinderGeometry(1,1,1,16);
  const material=(color,roughness=.7,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
  const cedar=oak, trim=material(0x44352a), green=material(0x293b33,.58), black=material(0x181e1c,.55,.25);
  const cream=material(0xb3b3a4), rubber=material(0x282b27,.95), copper=material(0x9c6643,.4,.5), paper=material(0xccc6b4);
  const pcb=material(0x174d3c,.55), brass=material(0xa38b53,.4,.6);
  const glow=new THREE.MeshStandardMaterial({color:0xffe2ab,emissive:0xffd29b,emissiveIntensity:1.4});
  function item(name,geo,mat,size,pos,rot=[0,0,0],shade=true){
    const key=mat.uuid+geo.uuid+(shade?'s':'n');if(!batches.has(key))batches.set(key,{geo,mat,shade,items:[]});
    batches.get(key).items.push({name,size,pos,rot});
  }
  const box=(name,mat,size,pos,rot,shade)=>item(name,cube,mat,size,pos,rot,shade);
  const tube=(name,mat,size,pos,rot,shade)=>item(name,cylinder,mat,size,pos,rot,shade);
  const {minX,maxX,front,back,height,door}=limits;
  // Physical vertical boards with narrow shadow gaps and restrained colour variation.
  const boards=[];
  function wall(x,z,length,rotation,h=height,y=height/2){
    const count=Math.ceil(length/.19), pitch=length/count;
    for(let i=0;i<count;i++){
      const offset=-length/2+(i+.5)*pitch;
      const pos=[x+Math.cos(rotation)*offset,y,z-Math.sin(rotation)*offset];
      boards.push({name:'wall-board',size:[pitch-.004,h,.028],pos,rot:[0,rotation,0]});
    }
  }
  wall(minX+.02,(front+back)/2,back-front,Math.PI/2);
  wall((minX+maxX)/2,back-.02,maxX-minX,0);
  wall(maxX-.02,(door.end+back)/2,back-door.end,Math.PI/2);
  wall(maxX-.02,(front+door.start)/2,door.start-front,Math.PI/2);
  wall(maxX-.02,(door.start+door.end)/2,door.end-door.start,Math.PI/2,height-door.height,(height+door.height)/2);
  wall((minX-2.7)/2,front+.02,-2.7-minX,0);
  const obj=new THREE.Object3D();
  const boardMesh=new THREE.InstancedMesh(cube,cedar,boards.length);boardMesh.name='individual-timber-boards';
  boards.forEach((b,i)=>{obj.position.set(...b.pos);obj.scale.set(...b.size);obj.rotation.set(...b.rot);obj.updateMatrix();boardMesh.setMatrixAt(i,obj.matrix);const tint=.82+(i*17%13)/65;boardMesh.setColorAt(i,new THREE.Color(tint,tint*.98,tint*.94));});
  boardMesh.castShadow=boardMesh.receiveShadow=true;group.add(boardMesh);
  // Skirting, cornice and structural posts make the room read as built joinery.
  for(const y of [.055,height-.07]){
    box('left-trim',trim,[.055,.11,back-front],[minX+.055,y,(front+back)/2]);
    box('rear-trim',trim,[maxX-minX,.11,.055],[(minX+maxX)/2,y,back-.055]);
    box('right-trim',trim,[.055,.11,back-door.end],[maxX-.055,y,(back+door.end)/2]);
  }
  for(const x of [minX+.085,maxX-.085]) box('rear-post',trim,[.16,height,.16],[x,height/2,back-.085]);
  // Slender ceiling boards, laid perpendicular to the existing exposed rafters.
  for(let x=minX+.1;x<maxX;x+=.2)box('ceiling-board',ceiling,[.193,.024,back-front],[x,height-.018,(front+back)/2]);
  // Rear maker bench: normal 0.9 m working height, 0.68 m depth, usable clear floor.
  box('worktop',cedar,[3.1,.06,.74],[.75,.90,back-.50]);
  for(const x of [-.55,2.05]){
    box('base-cabinet',green,[.55,.84,.64],[x,.45,back-.49]);
    box('plinth',black,[.48,.07,.53],[x,.045,back-.48]);
    for(let j=0;j<3;j++){
      const y=.20+j*.25;
      box('drawer',green,[.515,.231,.025],[x,y,back-.826]);
      box('drawer-pull',steel,[.19,.014,.028],[x,y+.025,back-.85]);
    }
  }
  // Shadow-backed slatted tool panel rather than a flat stretched texture.
  box('tool-panel',black,[2.6,.80,.035],[.75,1.63,back-.09]);
  for(let x=-.5;x<2.03;x+=.055)box('panel-slat',trim,[.026,.78,.025],[x,1.63,back-.12]);
  box('tool-rail',steel,[2.4,.025,.06],[.75,1.49,back-.17]);
  for(let i=0;i<5;i++){
    const x=-.32+i*.15;
    tube('screwdriver-shaft',steel,[.008,.16,.008],[x,1.43,back-.21]);
    tube('screwdriver-grip',i%2?green:rubber,[.025,.115,.025],[x,1.565,back-.21]);
  }
  box('hammer-handle',cedar,[.028,.30,.025],[.78,1.48,back-.20],[0,0,-.12]);
  box('hammer-head',steel,[.15,.045,.055],[.80,1.64,back-.20]);
  // Two small storage ledges, labelled by shape instead of unreadable fake text.
  for(const y of [1.25,2.12])box('tool-ledge',cedar,[2.62,.035,.18],[.75,y,back-.19]);
  for(let i=0;i<5;i++){
    box('parts-bin',green,[.20,.12,.13],[.98+i*.23,1.33,back-.20]);
    box('bin-label',paper,[.10,.035,.002],[.98+i*.23,1.34,back-.267],undefined,false);
  }
  // ESP32 maker station and spool stand on the rear bench.
  box('bench-mat',rubber,[1.15,.004,.48],[.85,.933,back-.50]);
  box('breadboard',cream,[.23,.025,.11],[.90,.95,back-.52]);
  box('pcb',pcb,[.075,.009,.13],[.60,.95,back-.48]);
  box('radio-shield',steel,[.04,.014,.05],[.60,.962,back-.46]);
  for(let i=0;i<8;i++)for(const x of [.565,.635])box('pin',brass,[.004,.018,.004],[x,.956,back-.535+i*.014]);
  tube('wire-spool',copper,[.075,.10,.075],[1.44,.985,back-.40]);
  for(const y of [.94,1.035])tube('spool-rim',black,[.085,.008,.085],[1.44,y,back-.40]);
  // Under-shelf warm strip and two overhead fixtures. Lights themselves are cheap;
  // only the sun casts a shadow map, reused while the static room stays still.
  box('under-shelf-light',glow,[2.38,.008,.025],[.75,2.096,back-.25],undefined,false);
  for(const z of [0.45,2.25]){
    box('ceiling-light-housing',black,[1.2,.06,.12],[-.6,height-.13,z]);
    box('ceiling-diffuser',glow,[1.14,.008,.08],[-.6,height-.164,z],undefined,false);
  }
  // Shelves carry actual workshop supplies; no oversized decorative objects.
  for(const x of [-3.6,-2.4])for(let row=0;row<3;row++){
    const y=.219+row*.506;
    for(let i=0;i<3;i++){
      const px=x-.31+i*.31;
      box('storage-case',row===1?green:rubber,[.26,.17,.28],[px,y,2.63]);
      box('case-latch',steel,[.035,.025,.01],[px,y,2.485]);
    }
  }
  for(let row=0;row<3;row++)for(let i=0;i<3;i++){
    const y=.219+row*.506, z=-1.9-.31+i*.31;
    box('side-storage-case',row===1?green:rubber,[.28,.17,.26],[-4.28,y,z]);
    box('side-case-latch',steel,[.01,.025,.035],[-4.135,y,z]);
  }
  // A low felt runner grounds the rear workspace; bevelled-looking border via inset.
  box('runner-edge',black,[3.5,.009,1.03],[.75,.006,1.57],undefined,false);
  box('runner-inset',rubber,[3.43,.003,.96],[.75,.012,1.57],undefined,false);
  // Door handle and complete track beyond the parked glass.
  box('door-handle',steel,[.045,.24,.035],[maxX-.15,1.05,door.end+.18]);
  box('extended-track',steel,[.12,.035,door.end-door.start],[maxX,door.height+.025,door.end+(door.end-door.start)/2]);
  for(const {geo,mat,items,shade} of batches.values()){
    const mesh=new THREE.InstancedMesh(geo,mat,items.length);mesh.name='details-'+items[0].name;
    items.forEach((b,i)=>{obj.position.set(...b.pos);obj.rotation.set(...b.rot);obj.scale.set(...b.size);obj.updateMatrix();mesh.setMatrixAt(i,obj.matrix);});
    mesh.castShadow=shade;mesh.receiveShadow=true;group.add(mesh);
  }
  return group;
}
