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
    const compact=width<700;
    view={x:compact?8:246,y:compact?66:10,w:Math.max(1,width-(compact?16:258)),h:Math.max(1,height-(compact?99:48))};
    for(const {button,s} of buttons){const [x,y]=point(s.x,s.z);button.style.left=x+'px';button.style.top=(y+(s.id==='patient'?22:13))+'px';}
  }
  function round(x,y,w,h,r,fill,stroke){
    ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}
  }
  function box(a,b,c,d,fill){const [x,y]=point(a,c),[xx,yy]=point(b,d);round(x,y,xx-x,yy-y,3,fill,'#b6b1a6');return [x,y,xx-x,yy-y];}
  function label(text,x,y,size=11){ctx.font=`600 ${size}px system-ui`;ctx.textAlign='center';ctx.fillStyle='#20354a';ctx.fillText(text,x,y);}
  function tile(img,x,y,w,h){if(img?.complete&&img.naturalWidth){ctx.drawImage(img,x,y,w,h);}}
  function portrait(id,x,y,r){
    // Native illustrated bust marker, NOT a synthetic full-body walking sprite.
    const im=window.CKCharacterArt?.image(id);
    if(im?.complete&&im.naturalWidth){
      const h=r*3.5,w=h*im.naturalWidth/im.naturalHeight;
      ctx.save();ctx.shadowColor='#18344736';ctx.shadowBlur=3;
      ctx.drawImage(im,x-w/2,y+r-h,w,h);ctx.restore();
    } else {
      const face=images[id];
      if(face?.complete&&face.naturalWidth){
        ctx.save();ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.clip();
        ctx.drawImage(face,x-r,y-r,r*2,r*2);ctx.restore();
      }
    }
  }
  function draw(now){
    ctx.clearRect(0,0,width,height);
    const [left,top]=point(-12.5,-3.55),[right,bottom]=point(12.5,3.35);
    round(left,top,right-left,bottom-top,8,'#f4f0e6','#b8b4a9');
    const [split]=point(3,-3.55);ctx.fillStyle='#e6d7bd';ctx.fillRect(split,top,right-split,bottom-top);
    ctx.save();ctx.beginPath();ctx.rect(left,top,right-left,bottom-top);ctx.clip();
    ctx.strokeStyle='#d9d3c4';ctx.lineWidth=.7;
    for(let x=-12;x<13;x+=1){const [a]=point(x,0);ctx.beginPath();ctx.moveTo(a,top);ctx.lineTo(a,bottom);ctx.stroke();}
    for(let z=-3;z<4;z+=1){const [,a]=point(0,z);ctx.beginPath();ctx.moveTo(left,a);ctx.lineTo(right,a);ctx.stroke();}
    ctx.restore();
    for(const [x,title] of [[-7.6,'診間'],[0,'洗手・取材'],[8,'後廚']]){const [xx]=point(x,0);label(title,xx,Math.max(10,top-1),width<700?9:11);}
    // Desk with monitor and records; sink, fridge, timber board, burner and rice cooker.
    const desk=box(-9.9,-8.1,-2.6,-1.4,'#c3935b');round(desk[0]+4,desk[1]-6,Math.max(16,desk[2]*.55),12,2,'#314756','#142c40');
    round(desk[0]+desk[2]*.68,desk[1]+3,10,13,1,'#fffdf3','#c4bdb1');
    box(-9.4,-8.6,-3.1,-2.6,'#718d9c');box(-7.7,-6.9,-1.8,-1,'#6e8a9b');
    const bed=box(-11.6,-9.4,1.5,2.5,'#e5ebed');round(bed[0]+3,bed[1]+2,bed[2]*.24,Math.max(2,bed[3]-4),2,'#fffdf7');
    const cab=box(-12.3,-11,-3,-2.2,'#dddeda');for(let i=1;i<4;i++)round(cab[0]+4,cab[1]+i*cab[3]/4,cab[2]-8,1,0,'#adb4b7');
    const sink=box(-2.6,-1.4,-3.2,-2.4,'#c0ccd0');round(sink[0]+3,sink[1]+3,Math.max(2,sink[2]-6),Math.max(2,sink[3]-6),3,'#8c9a9d');
    const fridge=box(-.5,.9,-3.3,-2.3,'#dde3e0');round(fridge[0]+fridge[2]*.8,fridge[1]+2,2,Math.max(3,fridge[3]-4),1,'#71868c');
    box(-1.3,-.3,1.4,2.2,'#a6b7b9');box(1.7,2.3,-3.1,-2.5,'#f6f6ec');
    const prep=box(3.8,6.2,-3.1,-2.1,'#b8c4c5');tile(images.board,prep[0]+3,prep[1]-3,prep[2]-6,prep[3]+6);
    const rack=box(6.2,7.8,-3.5,-3,'#a77e53');for(let i=0;i<4;i++)round(rack[0]+2+i*rack[2]/4,rack[1]+1,Math.max(2,rack[2]/5),Math.max(3,rack[3]-2),1,['#a83223','#aab480','#e6d2a6','#733821'][i]);
    const wok=box(8.2,10.2,-3.1,-2,'#bac4c3');
    const cx=wok[0]+wok[2]/2,cy=wok[1]+wok[3]/2,r=Math.max(7,Math.min(wok[2],wok[3])*.52);
    if(document.getElementById('flame').classList.contains('is-on')){ctx.beginPath();ctx.arc(cx,cy,r+3,0,7);ctx.fillStyle='#edb053';ctx.fill();}
    ctx.beginPath();ctx.ellipse(cx,cy,r*1.4,r,0,0,7);ctx.fillStyle='#2d353a';ctx.fill();round(cx+r,cy-1,10,3,1,'#71513c');
    if(document.getElementById('wokFoodLayer').children.length) {ctx.beginPath();ctx.ellipse(cx,cy,r*.8,r*.6,0,0,7);ctx.fillStyle='#b44724';ctx.fill();}
    const rice=box(11,12,-3.1,-2.1,'#cdd5d3');round(rice[0]+2,rice[1]+1,Math.max(3,rice[2]-4),rice[3]-2,6,'#f9f7ef','#8f9eaa');
    box(7.2,9.8,1.7,2.7,'#c69d6f');
    // A fixed shared walkway: selection moves the portrait marker continuously, never teleports.
    const p=point(state.playerPos.x,state.playerPos.z),pat=point(-7.3,-1.4);
    const craving=window.CKShift?.craving||40;
    const shake=reduced.matches||craving<70?0:Math.sin(now*.014)*(craving>=90?2:1);
    const size=width<700?9:15;
    portrait('patient',pat[0]+shake,pat[1],size);
    if(state.patientDishVisible){tile(images.dish,pat[0]+size,pat[1]+3,size*2,size*1.4);}
    ctx.beginPath();ctx.ellipse(p[0],p[1]+size,Math.max(10,size*1.1),4,0,0,7);ctx.fillStyle='#193c5429';ctx.fill();
    const bob=!reduced.matches&&state.isMoving?Math.sin(now*.018)*1.3:0;
    portrait(state.doctorId,p[0],p[1]+bob,size);
    ctx.strokeStyle='#c89438';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p[0],p[1]+size+1,size*.8,3,0,0,7);ctx.stroke();
    if(state.carryingTray)tile(images.dish,p[0]+size,p[1],size*2,size*1.3);
    const desired=targets[state.missionStage];
    for(const {button,s} of buttons){button.classList.toggle('is-objective',s.id===desired);button.classList.toggle('is-near',s.id===state.interactiveTarget?.id);}
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
    for(const [id,path] of Object.entries({speed:'ui/doctor-speed.webp',heat:'ui/doctor-heat.webp',strategy:'ui/doctor-strategy.webp',patient:'ui/patient-office.webp',board:'ui/board-clean.webp',dish:'cooking/dish_plated.png'})){
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
  window.getSceneStatus=()=>({...state,playerPos:{...state.playerPos},obstacleCount:obstacles.length,routeLength:route.length,imagesReady:Object.keys(images).length===6 && Object.values(images).every(im=>im.complete && im.naturalWidth>0)});
  window.get3DStatus=window.getSceneStatus; // Historical test/engine API; renderer is explicitly canvas2d.
  window.initScene3D=init;
})();
