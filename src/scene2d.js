/* CK R2: a continuous playable chibi room. Legacy *3D names are engine adapters,
   not a claim of a 3D renderer. Recipe logic remains in main.js. */
(function(){
 'use strict';
 const TRACK_Z=-1.35;
 const state={initialized:false,renderer:'canvas2d',usingGlb:false,playerPos:{x:-10.5,y:0,z:TRACK_Z},playerFacing:Math.PI/2,isMoving:false,isRunning:false,missionStage:0,interactiveTarget:null,carryingTray:false,patientDishVisible:false,doctorId:'speed',activeFinale:null};
 window.scene3DState=state;window.scene2DState=state;
 const stations=CKClinicRules.stations;
 const obstacles=[[-11.1,-9.9,-1.7,-1.1],[-8.1,-6.1,-2.6,-1.4],[-3.4,-1.8,-3.2,-2.4],[-.5,.9,-3.3,-2.3],[3.8,6.2,-3.1,-2.1],[8.2,10.2,-3.1,-2],[11,12,-3.1,-2.1]];
 const targetIds=['consult','prep','prep','prep','wok','wok','consult','consult'];
 const furniture=[
  {img:'desk',x:-10.5,z:TRACK_Z,label:'01 CONSULT'},
  {img:'prep',x:5,z:TRACK_Z,label:'02 PREP'},
  {img:'stove',x:9,z:TRACK_Z,label:'03 WOK'},
  {img:'rice',x:11.5,z:TRACK_Z,label:'04 SERVE'}
 ];
 let clinicPatient='office';
 const CW=112,CH=144,root='assets/chibi/';
 const directions=['south','west','east','north'];
 const anim={idle:[0,2,2],walk:[2,6,8],run:[8,6,13],carry:[14,6,8],work:[20,4,9]};
 let host,canvas,ctx,buttons=[],images={},route=[],routeStage=null,width=1,height=1,last=0,clock=0,workUntil=0;
 let face='south',actor={},view={x:0,y:0,w:1,h:1},camera={x:0,y:0,scale:1},touch={x:0,z:0,run:false};
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const stationLogical=[-10.5,5,9,11.5];
 const stationVisual=[225,675,1125,1575];

 function displayX(x){
  if(x<=stationLogical[0])return stationVisual[0];
  if(x>=stationLogical[3])return stationVisual[3];

  for(let i=0;i<stationLogical.length-1;i++){
   const a=stationLogical[i];
   const b=stationLogical[i+1];

   if(x>=a && x<=b){
    const t=(x-a)/(b-a);
    return stationVisual[i]+
      (stationVisual[i+1]-stationVisual[i])*t;
   }
  }

  return stationVisual[0];
 }

 const worldPoint=(x,z)=>({
  x:displayX(x),
  y:218
 });
 const screenPoint=(x,z)=>{const p=worldPoint(x,z);return{x:view.x+(p.x-camera.x)*camera.scale,y:view.y+(p.y-camera.y)*camera.scale};};
 function frozen(){return !!window.CKShift?.isFrozen()||!document.getElementById('dialogModal').hidden;}
 function stand(x,z){return x>=-11.48&&x<=11.98&&z>=-2.38&&z<=2.38&&obstacles.every(([a,b,c,d])=>x+.28<=a||x-.28>=b||z+.28<=c||z-.28>=d);}
 function nearby(x,z){
  let best=null,dist=Infinity;
  for(const s of stations){const d=Math.hypot(x-s.x,z-s.z);if(d<=s.r&&d<dist){best=s;dist=d;}}
  if(!best)return null;
  const prompt=(best.id==='consult'&&state.carryingTray)?'E — 交餐給病人':('E — '+best.label);
  return {...best,prompt};
 }
 function step(dx,dz,dt,speed=1){
  const p=state.playerPos;
  const oldX=p.x;
  const direction=Math.sign(dx);

  if(direction){
   const distance=4.2*speed*Math.min(dt,.1);
   p.x+=direction*distance;
  }

  p.z=TRACK_Z;

  state.isMoving=Math.abs(p.x-oldX)>.0001;
  state.isRunning=false;

  if(direction<0){
   face='west';
   state.playerFacing=-Math.PI/2;
  }else if(direction>0){
   face='east';
   state.playerFacing=Math.PI/2;
  }

  state.interactiveTarget=nearby(p.x,TRACK_Z);
 }
 function go(s){
  if(frozen())return;

  touch.x=touch.z=0;

  if(state.interactiveTarget?.id===s.id){
   route=[];
   state.isMoving=false;
   state.isRunning=false;
   return;
  }

  route=[[s.at[0],TRACK_Z]];
  routeStage=state.missionStage;
 }
 function resize(){
  width=host.clientWidth;height=host.clientHeight;const dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);canvas.style.width=width+'px';canvas.style.height=height+'px';
  view={x:0,y:0,w:width,h:height};
  // Always fit the complete four-station workflow.
  camera.scale=Math.min(view.w/1800,view.h/280);
  buttons.forEach(({button},i)=>{button.style.left=(i+.5)*width/stations.length+'px';button.style.bottom='3px';button.style.top='auto';});
 }
 function updateCamera(){
  const ex=view.w/camera.scale;
  const ey=view.h/camera.scale;

  // Fixed overview. Camera never follows the doctor.
  camera.x=(1800-ex)/2;
  camera.y=(280-ey)/2;
 }
 function image(name,x,y,w,h){const im=images[name];if(im?.complete&&im.naturalWidth)ctx.drawImage(im,x,y,w??im.naturalWidth,h??im.naturalHeight);}
 function drawFurniture(f){
  const p=worldPoint(f.x,f.z);
  if(f.img==='patientSeat'){
   image('chair',p.x-45,p.y-130,90,135);
   // R7: the patient is represented in the persistent left clinical rail; keep the
   // upper world as a compact doctor/workstation progress strip without a duplicate chibi patient.
   if(state.patientDishVisible)image('meal',p.x-32,p.y-39,64,27);
  }else{const im=images[f.img];if(!im?.naturalWidth)return;image(f.img,p.x-im.naturalWidth/2,p.y-im.naturalHeight+8);}
  if(f.label){ctx.font='600 14px system-ui';ctx.textAlign='center';ctx.fillStyle='#2e5362';ctx.fillText(f.label,p.x,p.y+18);}
 }
 function drawDoctor(){
  const p=worldPoint(state.playerPos.x,state.playerPos.z);
  const reaction=window.CKService?.reaction();
  const animation=state.carryingTray?'carry':state.isMoving?(state.isRunning?'run':'walk'):clock<workUntil?'work':'idle';
  const [offset,count,fps]=anim[animation],frame=state.carryingTray&&!state.isMoving?0:Math.floor(clock*fps)%count,row=directions.indexOf(face),im=images[state.doctorId];
  ctx.fillStyle='#263c4b32';ctx.beginPath();ctx.ellipse(p.x,p.y,26,7,0,0,Math.PI*2);ctx.fill();
  if(state.isRunning&&!reduced.matches){ctx.fillStyle='#d6c7a37a';for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(p.x-Math.sin(state.playerFacing)*(22+i*7),p.y-Math.cos(state.playerFacing)*(6+i*3),2+i,0,Math.PI*2);ctx.fill();}}
  if(reaction&&images['bonk-'+state.doctorId]?.naturalWidth)ctx.drawImage(images['bonk-'+state.doctorId],reaction.frame*CW,0,CW,CH,p.x-56,p.y-132,CW,CH);
  else if(im?.naturalWidth)ctx.drawImage(im,(offset+frame)*CW,row*CH,CW,CH,p.x-56,p.y-132,CW,CH);
  const sp=screenPoint(state.playerPos.x,state.playerPos.z),scale=camera.scale;
  actor={fullBody:true,animation:reaction?'bonk':animation,frame:reaction?reaction.frame:frame,direction:face,spriteSheet:reaction?'assets/service/bonk-'+state.doctorId+'.webp':root+state.doctorId+'.webp',cell:[offset+frame,row],screenRect:{x:sp.x-56*scale,y:sp.y-132*scale,w:CW*scale,h:CH*scale},foot:sp};
  if(state.interactiveTarget){ctx.strokeStyle='#e3b95c';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y+1,29,9,0,0,Math.PI*2);ctx.stroke();}
 }
 function draw(){
  updateCamera();ctx.clearRect(0,0,width,height);ctx.fillStyle='#e3e5d9';ctx.fillRect(0,0,width,height);
  ctx.save();ctx.beginPath();ctx.rect(view.x,view.y,view.w,view.h);ctx.clip();ctx.translate(view.x-camera.x*camera.scale,view.y-camera.y*camera.scale);ctx.scale(camera.scale,camera.scale);
  image('room-back',0,0,1800,350);
  const target=stations.find(s=>s.id===targetIds[state.missionStage]);if(target){const p=worldPoint(...target.at);ctx.fillStyle='#d5bc6c40';ctx.beginPath();ctx.ellipse(p.x,p.y,34,12,0,0,Math.PI*2);ctx.fill();}
  const objects=furniture.map(f=>({z:f.z,draw:()=>drawFurniture(f)}));objects.push({z:state.playerPos.z,draw:drawDoctor});objects.sort((a,b)=>a.z-b.z).forEach(o=>o.draw());
  if(state.activeFinale==='feast'&&images['finale-feast']?.naturalWidth){
   const fp=worldPoint(-8,-0.5);const iw=images['finale-feast'].naturalWidth,ih=images['finale-feast'].naturalHeight;
   const scale=Math.min(320/iw,200/ih);const dw=iw*scale,dh=ih*scale;
   ctx.save();ctx.globalAlpha=0.96;ctx.drawImage(images['finale-feast'],fp.x-dw/2,fp.y-dh-20,dw,dh);ctx.restore();
  }else if(state.activeFinale==='flip'&&images['finale-flip']?.naturalWidth){
   const fp=worldPoint(-8,-0.5);const iw=images['finale-flip'].naturalWidth,ih=images['finale-flip'].naturalHeight;
   const scale=Math.min(320/iw,200/ih);const dw=iw*scale,dh=ih*scale;
   ctx.save();ctx.globalAlpha=0.96;ctx.drawImage(images['finale-flip'],fp.x-dw/2,fp.y-dh-20,dw,dh);ctx.restore();
  }
  if(document.getElementById('flame').classList.contains('is-on')){const p=worldPoint(9.2,-2);ctx.strokeStyle='#f09f47';ctx.lineWidth=3;for(let i=0;i<4;i++){const lift=reduced.matches?4:4+Math.sin(clock*8+i)*3;ctx.beginPath();ctx.moveTo(p.x-18+i*11,p.y-91);ctx.quadraticCurveTo(p.x-20+i*11,p.y-95-lift,p.x-14+i*11,p.y-99-lift);ctx.stroke();}}
  ctx.restore();
  for(const {button,s} of buttons){button.classList.toggle('is-objective',s.id===targetIds[state.missionStage]);button.classList.toggle('is-near',s.id===state.interactiveTarget?.id);}
  const interact=document.getElementById('sceneInteractBtn');interact.disabled=!state.interactiveTarget||frozen();interact.textContent=state.interactiveTarget?'E '+state.interactiveTarget.label:'E 互動';
 }
 function clearTouch(){touch.x=touch.z=0;state.isMoving=state.isRunning=false;}
 function loop(now){
  const dt=last?Math.min((now-last)/1000,.05):0;last=now;if(!frozen())clock+=dt;else clearTouch();
  if(route.length){
   const [tx,tz]=route[0],p=state.playerPos,dx=tx-p.x,dz=tz-p.z;
   if(Math.hypot(dx,dz)<.09){
    route.shift();
    if(!route.length){
     state.isMoving=state.isRunning=false;p.x=tx;p.z=tz;state.interactiveTarget=nearby(tx,tz);
     if(window.updateCooking) window.updateCooking();
     if(state.onArrivalCallback){const cb=state.onArrivalCallback;state.onArrivalCallback=null;cb();}
    }
   }else step(dx,dz,Math.min(dt,Math.hypot(dx,dz)/4.2),1.65);
  }
  draw();requestAnimationFrame(loop);
 }
 function init(world){
  host=world;host.dataset.presentation='chibi-playable-world';canvas=document.createElement('canvas');canvas.id='scene2dCanvas';canvas.setAttribute('aria-label','automatic clinic workflow animation');host.append(canvas);ctx=canvas.getContext('2d');
  for(const name of ['speed','heat','strategy','patient','room-back','desk','chair','fridge','printer','sink','cabinet','prep','stove','rice','table','bed']){const im=new Image();im.src=root+name+'.webp';images[name]=im;}
  for(const id of ['office','student','driver','auntie','quiet','repeat']){const im=new Image();im.src='assets/service/patient-'+id+'.webp';images['patient-'+id]=im;}
  for(const id of ['speed','heat','strategy']){const im=new Image();im.src='assets/service/bonk-'+id+'.webp';images['bonk-'+id]=im;}
  images.meal=new Image();images.meal.src='assets/cooking/tray_served.png';
  images['finale-feast']=new Image();images['finale-feast'].src='assets/finale/success_clinic_meal.webp';
  images['finale-flip']=new Image();images['finale-flip'].src='assets/finale/failure_table_flip.webp';
  for(const s of stations){
   const button=document.createElement('button');
   button.type='button';
   button.className='map-station';
   button.dataset.station=s.id;
   button.textContent=s.label;
   button.tabIndex=-1;
   button.disabled=true;
   button.setAttribute('aria-label',s.label);
   host.append(button);
   buttons.push({button,s});
  }
  document.querySelectorAll('[data-move]').forEach(button=>{
   const vector={north:[0,-1],south:[0,1],west:[-1,0],east:[1,0]}[button.dataset.move];
   button.addEventListener('pointerdown',e=>{if(frozen())return;e.preventDefault();route=[];[touch.x,touch.z]=vector;host.focus({preventScroll:true});if(e.isTrusted)button.setPointerCapture(e.pointerId);});
   for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,clearTouch);
  });
  document.getElementById('sceneRunBtn').addEventListener('click',e=>{touch.run=!touch.run;e.currentTarget.setAttribute('aria-pressed',String(touch.run));host.focus({preventScroll:true});});
  document.getElementById('sceneInteractBtn').addEventListener('click',()=>{if(!frozen()&&state.interactiveTarget)window.handleInteraction(state.interactiveTarget.name);});
  for(const id of ['cutBtn','stirBtn','plateBtn'])document.getElementById(id).addEventListener('click',e=>{if(!e.currentTarget.disabled&&!frozen())workUntil=clock+.6;},true);
  addEventListener('blur',()=>{clearTouch();route=[];});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTouch();route=[];}});
  state.initialized=true;state.interactiveTarget=nearby(state.playerPos.x,state.playerPos.z);new ResizeObserver(resize).observe(host);resize();requestAnimationFrame(loop);
 }
 window.autoWalkTo=(stationId,onArrival)=>{
  const s=stations.find(st=>st.id===stationId);

  if(!s){
   if(onArrival)onArrival();
   return;
  }

  touch.x=touch.z=0;
  route=[[s.at[0],TRACK_Z]];
  routeStage=state.missionStage;
  state.onArrivalCallback=onArrival;
 };
 window.setTopFinale=type=>{state.activeFinale=type?type.replace('finale-',''):null;window.topFinale=state.activeFinale;};
 window.update3DPlayerMovement=(dx,dz,dt,speed)=>{
  // Doctor movement is workflow-driven only.
  return;
 };
 window.set3DPlayerPosition=(x,z)=>{
  route=[];
  clearTouch();

  state.playerPos.x=x;
  state.playerPos.z=TRACK_Z;
  state.interactiveTarget=nearby(x,TRACK_Z);

  face='east';
  state.playerFacing=Math.PI/2;
  workUntil=0;
  touch.run=false;

  document.getElementById('sceneRunBtn')
    ?.setAttribute('aria-pressed','false');
 };
 window.setClinicPatient=id=>{clinicPatient=id;};
 window.setMissionStage=n=>{state.missionStage=n;};window.setCarryingTray=v=>{state.carryingTray=!!v;};window.setPatientDishVisible=v=>{state.patientDishVisible=!!v;};window.setDoctorRole=id=>{state.doctorId=id;};window.getNearbyTarget=nearby;
 window.getSceneStatus=()=>({...state,playerPos:{...state.playerPos},actor:{...actor},viewport:{...view},camera:{...camera},stations:stations.map(s=>({...s})),furniture:furniture.map(f=>({...f})),patientId:clinicPatient,obstacleCount:obstacles.length,routeLength:route.length,imagesReady:Object.keys(images).length>=26&&Object.values(images).every(im=>im.complete&&im.naturalWidth>0)});
 window.get3DStatus=window.getSceneStatus;window.initScene3D=init;
})();
