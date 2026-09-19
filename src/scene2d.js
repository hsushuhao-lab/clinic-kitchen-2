/* Fixed 2D clinic plan. Coordinates are shared with the cooking state machine.
   Legacy *3D method names below are adapters only; no WebGL or GLB is loaded. */
(function () {
  'use strict';
  const state = { initialized: false, renderer: 'canvas2d', usingGlb: false,
    playerPos: { x: -8, y: 0, z: -.2 }, playerFacing: 0, isMoving: false,
    missionStage: 0, interactiveTarget: null, carryingTray: false,
    patientDishVisible: false, doctorId: 'speed' };
  window.scene3DState = state;
  window.scene2DState = state;
  const obstacles = [
    [-9.9,-8.1,-2.6,-1.4],[-9.4,-8.6,-3,-2.4],[-7.6,-7,-1.7,-1.1],
    [-12.3,-11,-3,-2.2],[-11.6,-9.4,1.5,2.5],[-2.6,-1.4,-3.2,-2.4],
    [-.5,.9,-3.3,-2.3],[-1.3,-.3,1.4,2.2],[1.7,2.3,-3.1,-2.5],
    [3.8,6.2,-3.1,-2.1],[6.2,7.8,-3.5,-3],[8.2,10.2,-3.1,-2],
    [11,12,-3.1,-2.1],[7.2,9.8,1.7,2.7]
  ];
  const stations = [
    {id:'patient',name:'病人椅',label:'看診・送餐',x:-7.3,z:-1.4,at:[-7.3,-.65],r:1.35},
    {id:'desk',name:'醫師桌',label:'開立料理單',x:-9,z:-1.8,at:[-9.2,-1],r:1.5},
    {id:'fridge',name:'冰箱',label:'冰箱取材',x:.2,z:-2.4,at:[.2,-1.4],r:1.6},
    {id:'prep',name:'備料檯',label:'備料',x:5,z:-2.2,at:[5,-1.4],r:1.6},
    {id:'wok',name:'炒鍋爐台',label:'炒鍋',x:9,z:-2.2,at:[9,-1.35],r:1.6},
    {id:'rice',name:'電子鍋',label:'配飯・裝盤',x:11.5,z:-2.2,at:[11.5,-1.35],r:1.6}
  ];
  const targets = ['patient','desk','fridge','prep','wok','wok','patient','patient'];
  let canvas,ctx,host,buttons=[],images={},route=[],view={x:0,y:0,w:1,h:1},last=0;
  let routeStage=null, width=1,height=1;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function point(x,z) { return [view.x+(x+12.6)/25.5*view.w,view.y+(z+3.65)/7.3*view.h]; }
  function stand(x,z) {
    if(x< -11.48 || x>11.98 || z< -2.38 || z>2.38)return false;
    return obstacles.every(([a,b,c,d])=>x+.28<=a||x-.28>=b||z+.28<=c||z-.28>=d);
  }
  function nearby(x,z) {
    let best=null,distance=Infinity;
    for(const s of stations){const d=Math.hypot(x-s.x,z-s.z);if(d<=s.r&&d<distance){distance=d;best=s;}}
    return best?{...best,prompt:'E — '+best.label}:null;
  }
  function step(dx,dz,dt,speed=1) {
    const l=Math.hypot(dx,dz)||1,p=state.playerPos;
    const nx=p.x+dx/l*4.2*speed*dt,nz=p.z+dz/l*4.2*speed*dt;
    const oldX=p.x,oldZ=p.z;
    if(stand(nx,p.z))p.x=nx;
    if(stand(p.x,nz))p.z=nz;
    state.isMoving=Math.hypot(p.x-oldX,p.z-oldZ)>.0001;
    if(state.isMoving)state.playerFacing=Math.atan2(dx,dz);
    state.interactiveTarget=nearby(p.x,p.z);
  }
  function go(s){
    if(window.CKShift?.isFrozen()||!document.getElementById('dialogModal').hidden)return;
    route=[[state.playerPos.x,0],[s.at[0],0],s.at];routeStage=state.missionStage;
    host.focus({preventScroll:true});
  }
  function resize(){
    width=host.clientWidth;height=host.clientHeight;
    const scale=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
    canvas.style.width=width+'px';canvas.style.height=height+'px';ctx.setTransform(scale,0,0,scale,0,0);
    view={x:width<700?10:232,y:10,w:Math.max(1,width-(width<700?20:246)),h:Math.max(1,height-(width<700?84:70))};
    const ordered=['desk','patient','fridge','prep','wok','rice'];
    for(const {button,s} of buttons){
      const index=ordered.indexOf(s.id),x=view.x+view.w*(index+.5)/6;
      button.style.left=x+'px';button.style.top=(height-42)+'px';
    }
  }
  function round(x,y,w,h,r,fill,stroke){
    ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}
  }
  function cover(image,x,y,w,h){
    if(!image?.complete||!image.naturalWidth)return;
    const ratio=Math.max(w/image.naturalWidth,h/image.naturalHeight);
    const sw=w/ratio,sh=h/ratio;
    ctx.drawImage(image,(image.naturalWidth-sw)/2,(image.naturalHeight-sh)/2,sw,sh,x,y,w,h);
  }
  function draw(now){
    ctx.clearRect(0,0,width,height);
    // Four photographic-style illustrations of the SAME approved clinic/workstations.
    // This is explicitly a location navigator. Never slide a cropped torso as an avatar.
    const y=width<700?60:view.y,h=Math.max(24,height-y-67),x=view.x,w=view.w;
    const portions=[.34,.20,.23,.23],ids=['clinic','storage','prep','wok'];
    const names=['診間 · CONSULTATION','收納 · INGREDIENTS','備料 · PREPARATION','爐台 · COOKING'];
    ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,10);ctx.clip();
    let offset=0;
    ids.forEach((id,i)=>{
      const cw=w*portions[i];cover(images[id],x+offset,y,cw,h);
      const shade=ctx.createLinearGradient(0,y,0,y+h);shade.addColorStop(0,'#102d454a');shade.addColorStop(.5,'#102d4500');shade.addColorStop(1,'#112c4cba');
      ctx.fillStyle=shade;ctx.fillRect(x+offset,y,cw,h);
      ctx.fillStyle='#fff9ec';ctx.font=`600 ${width<700?9:11}px system-ui`;ctx.textAlign='left';
      ctx.fillText(width<700?names[i].split(' ·')[0]:names[i],x+offset+10,y+h-12);
      offset+=cw;if(i<3){ctx.fillStyle='#ffffff7a';ctx.fillRect(x+offset-1,y,2,h);}
    });
    ctx.restore();
    // Continuous position feedback for the unchanged physical navigation. The dot is
    // labeled POSITION, not an animated doctor; vertical movement has a short depth tick.
    const anchors=[[-9,.5],[-7.3,1.5],[.2,2.5],[5,3.5],[9,4.5],[11.5,5.5]];
    const px=state.playerPos.x;let u=px<anchors[0][0]?0:6;
    for(let i=0;i<anchors.length-1;i++)if(px>=anchors[i][0]&&px<=anchors[i+1][0])u=anchors[i][1]+(px-anchors[i][0])/(anchors[i+1][0]-anchors[i][0]);
    const mx=x+w*Math.max(.04,Math.min(.96,u/6)),my=height-53;
    ctx.strokeStyle='#b8a686';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+9,my);ctx.lineTo(x+w-9,my);ctx.stroke();
    ctx.strokeStyle='#335466';ctx.beginPath();ctx.moveTo(mx,my-6);ctx.lineTo(mx,my+Math.max(-6,Math.min(6,state.playerPos.z*4)));ctx.stroke();
    ctx.beginPath();ctx.arc(mx,my,4,0,Math.PI*2);ctx.fillStyle='#b17732';ctx.fill();
    const desired=targets[state.missionStage];
    for(const {button,s} of buttons){button.classList.toggle('is-objective',s.id===desired);button.classList.toggle('is-near',s.id===state.interactiveTarget?.id);}
    host.dataset.presentation='illustrated-location-navigator';
  }
  function loop(now){
    const dt=last?Math.min((now-last)/1000,.05):0;last=now;
    if(route.length){
      if(routeStage!==state.missionStage||window.CKShift?.isFrozen()||!document.getElementById('dialogModal').hidden){route=[];state.isMoving=false;}
      else {const [x,z]=route[0],p=state.playerPos;const dx=x-p.x,dz=z-p.z;
        if(Math.hypot(dx,dz)<.07){route.shift();state.isMoving=false;}
        else step(dx,dz,Math.min(dt,Math.hypot(dx,dz)/4.2));}
    }
    draw(now);requestAnimationFrame(loop);
  }
  function init(world){
    host=world;canvas=document.createElement('canvas');canvas.id='scene2dCanvas';canvas.setAttribute('aria-label','固定平面診間與後廚');
    host.append(canvas);ctx=canvas.getContext('2d');
    for(const [id,path] of Object.entries({clinic:'workspace/clinic-view.webp',storage:'workspace/storage-view.webp',prep:'workspace/prep-view.webp',wok:'workspace/wok-view.webp'})){
      const im=new Image();im.src='assets/'+path;images[id]=im;
    }
    for(const s of stations){const button=document.createElement('button');button.className='map-station';button.type='button';button.dataset.station=s.id;button.textContent=s.label;button.title='點擊走向'+s.label+'；到達後 E 互動';button.setAttribute('aria-label','走向'+s.label);button.addEventListener('click',()=>go(s));host.append(button);buttons.push({button,s});}
    state.initialized=true;state.interactiveTarget=nearby(state.playerPos.x,state.playerPos.z);
    new ResizeObserver(resize).observe(host);resize();requestAnimationFrame(loop);
  }
  window.update3DPlayerMovement=(dx,dz,dt,speed)=>{if(dx||dz){route=[];step(dx,dz,dt,speed);}else if(!route.length)state.isMoving=false;};
  window.set3DPlayerPosition=(x,z)=>{route=[];state.playerPos.x=x;state.playerPos.z=z;state.interactiveTarget=nearby(x,z);};
  window.setMissionStage=n=>{state.missionStage=n;};
  window.setCarryingTray=value=>{state.carryingTray=!!value;};
  window.setPatientDishVisible=value=>{state.patientDishVisible=!!value;};
  window.setDoctorRole=id=>{state.doctorId=id;};
  window.getNearbyTarget=nearby;
  window.getSceneStatus=()=>({...state,playerPos:{...state.playerPos},obstacleCount:obstacles.length,routeLength:route.length,imagesReady:Object.keys(images).length===4 && Object.values(images).every(im=>im.complete && im.naturalWidth>0)});
  window.get3DStatus=window.getSceneStatus; // Historical test/engine API; renderer is explicitly canvas2d.
  window.initScene3D=init;
})();
