// A fixed photograph with local, independent motion. No full-frame image sequence.
export class OfficeMotion {
  constructor(canvas) {
    this.canvas=canvas; this.ctx=canvas.getContext("2d", { alpha:false });
    this.photo=new Image(); this.photo.src="assets/intro-office-clean.png";
    this.person=new Image(); this.person.src="assets/office-walker.png";
    this.time=0; this.next=2; this.walk=null; this.dirty=true;
    this.photo.onload=()=>{this.src=null;this.dirty=true;};
    this.photo.onerror=()=>{if(!this.photo.src.endsWith("intro-office.jpg"))this.photo.src="assets/intro-office.jpg";};
    this.resize=()=>{
      const ratio=Math.min(devicePixelRatio,2);
      canvas.width=Math.min(1600,Math.round(innerWidth*ratio));
      canvas.height=Math.round(canvas.width*innerHeight/innerWidth);
      this.src=null; this.dirty=true;
    };
    this.resize(); addEventListener("resize",this.resize);
  }
  draw(dt, active, reduced) {
    if(!this.photo.complete || !this.photo.naturalWidth)return;
    if(!active && !this.dirty)return;
    if(reduced && !this.dirty)return;
    if(active && !reduced)this.time+=dt;
    const t=this.time,c=this.ctx,w=1648,h=858,W=this.canvas.width,H=this.canvas.height;
    // Portrait screens: a cover crop would leave only the middle quarter of the photo and cut the
    // headset off at both sides. Instead the photo is scaled so the headset fills about 80% of the
    // width, its top and bottom edges are feathered, and a soft, darkened copy fills the rest.
    const portrait=W/H<0.8;
    if(!this.src){
      const src=document.createElement("canvas"); src.width=w; src.height=h;
      const g=src.getContext("2d"); g.drawImage(this.photo,0,0,w,h);
      if(portrait){
        g.globalCompositeOperation="destination-in";
        const f=g.createLinearGradient(0,0,0,h); f.addColorStop(0,"rgba(0,0,0,0)"); f.addColorStop(.12,"#000"); f.addColorStop(.9,"#000"); f.addColorStop(1,"rgba(0,0,0,0)");
        g.fillStyle=f; g.fillRect(0,0,w,h);
        const tiny=document.createElement("canvas"); tiny.width=48; tiny.height=25;   // drawn tiny, shown large = a cheap blur that works in every browser
        tiny.getContext("2d").drawImage(this.photo,0,0,48,25); this.back=tiny;
      }
      this.src=src;
    }
    const src=this.src;
    let scale;
    if(portrait){
      c.setTransform(1,0,0,1,0,0); c.imageSmoothingEnabled=true;
      const bs=Math.max(W/48,H/25); c.drawImage(this.back,(W-48*bs)*.52,(H-25*bs)*.6,48*bs,25*bs);
      c.fillStyle="rgba(0,0,0,.28)"; c.fillRect(0,0,W,H);
      scale=W*0.8/420;
      c.setTransform(scale,0,0,scale,W*.52-854*scale,H*.6-540*scale);
    } else {
      scale=Math.max(W/w,H/h);
      c.setTransform(scale,0,0,scale,(W-w*scale)*.52,(H-h*scale)*.60);
    }
    c.drawImage(src,0,0,w,h);
    if(!reduced){
      // Workers already in the photo make small independent head/shoulder motions.
      const patches=[{x:187,y:171,w:139,h:173,p:1},{x:466,y:228,w:84,h:104,p:3.7},{x:1468,y:204,w:139,h:169,p:7.3}];
      for(const p of patches){
        const dx=Math.sin(t*.47+p.p)*.9,dy=Math.sin(t*.71+p.p)*.65;
        c.save(); c.beginPath(); c.ellipse(p.x+p.w/2,p.y+p.h/2,p.w*.48,p.h*.48,0,0,Math.PI*2); c.clip();
        c.drawImage(src,p.x,p.y,p.w,p.h,p.x+dx,p.y+dy,p.w,p.h);c.restore();
      }
      if(!this.walk && t>this.next && this.person.complete && this.person.naturalWidth){
        this.walk={start:t,duration:11+Math.random()*5,dir:Math.random()<.5?1:-1};
      }
      if(this.walk){
        const p=(t-this.walk.start)/this.walk.duration;
        if(p>=1){this.walk=null;this.next=t+7+Math.random()*16;}
        else {
          const travel=this.walk.dir>0?p:1-p;
          const x=-190+travel*2030, y=74+Math.sin(t*7)*1.8;
          // Walker is in the aisle BEHIND the foreground desk/headset and seated people.
          c.save();c.beginPath();c.rect(380,0,1030,428);c.clip();
          c.translate(x+150,y);c.scale(this.walk.dir,1);
          c.globalAlpha=Math.min(1,p*12,(1-p)*12);
          c.drawImage(this.person,-150,0,300,450);c.restore();
          // Redraw the desk / headset silhouette and nearby colleagues as occluders.
          for(const p of [{x:0,y:332,w:575,h:526},{x:1070,y:350,w:578,h:508},{x:610,y:342,w:488,h:516}]){
            c.drawImage(src,p.x,p.y,p.w,p.h,p.x,p.y,p.w,p.h);
          }
        }
      }
    }
    this.dirty=false;
  }
}
