/* R11 top-strip chibi renderer. Presentation only; gameplay lives in r11-game.js. */
(() => {
  'use strict';
  const canvas=document.getElementById('worldCanvas');
  const host=document.getElementById('worldStrip');
  const message=document.getElementById('worldMessage');
  if(!canvas||!host) throw new Error('R11 world host missing');
  const ctx=canvas.getContext('2d');
  const CW=112,CH=144;
  const positions={consult:.125,prep:.375,wok:.625,serve:.875};
  const stationAssets={consult:'desk',prep:'prep',wok:'stove',serve:'rice'};
  const stationSizes={consult:[160,126],prep:[170,120],wok:[150,122],serve:[92,126]};
  const images={};
  let ready=false,width=1,height=1,dpr=1,last=0,clock=0;
  const state={stage:'consult',x:positions.consult,targetX:positions.consult,moving:false,carry:false,direction:'east',doctor:null,workUntil:0,resolveMove:null};
  const waiters=[];

  function load(name,src){
    const im=new Image();images[name]=im;
    im.onload=checkReady;im.onerror=checkReady;im.src=src;
  }
  ['room-back','desk','prep','stove','rice','speed','heat','strategy'].forEach(name=>load(name,'assets/chibi/'+name+'.webp'));

  function checkReady(){
    if(Object.values(images).every(im=>im.complete)){
      ready=Object.values(images).every(im=>im.naturalWidth>0);
      while(waiters.length)waiters.shift()(ready);
    }
  }
  function whenReady(){return ready?Promise.resolve(true):new Promise(resolve=>waiters.push(resolve));}

  function resize(){
    const r=host.getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);dpr=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);canvas.style.width=width+'px';canvas.style.height=height+'px';ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  new ResizeObserver(resize).observe(host);resize();

  function drawBackground(){
    ctx.clearRect(0,0,width,height);
    const bg=images['room-back'];
    if(bg?.naturalWidth) ctx.drawImage(bg,0,0,width,height);
    else {ctx.fillStyle='#e8f3ef';ctx.fillRect(0,0,width,height);}
    ctx.fillStyle='#fff8e5bf';ctx.fillRect(0,height-38,width,38);
    ctx.strokeStyle='#72a9a2';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(width*.08,height-40);ctx.lineTo(width*.92,height-40);ctx.stroke();
  }

  function drawStations(){
    Object.entries(positions).forEach(([id,xn])=>{
      const im=images[stationAssets[id]], [dw,dh]=stationSizes[id], x=width*xn, y=height-42;
      ctx.fillStyle=id===state.stage?'#ffd65a66':'#ffffff00';
      ctx.beginPath();ctx.ellipse(x,y-8,Math.max(42,dw*.34),12,0,0,Math.PI*2);ctx.fill();
      if(im?.naturalWidth)ctx.drawImage(im,x-dw/2,y-dh,dw,dh);
    });
  }

  function drawDoctor(){
    if(!state.doctor)return;
    const im=images[state.doctor];if(!im?.naturalWidth)return;
    const anim=state.carry?'carry':state.moving?'run':clock<state.workUntil?'work':'idle';
    const map={idle:[0,2,2],run:[8,6,12],carry:[14,6,8],work:[20,4,8]};
    const [offset,count,fps]=map[anim],frame=Math.floor(clock*fps)%count;
    const row=state.direction==='west'?1:2;
    const x=width*state.x,y=height-44,dw=68,dh=88;
    ctx.fillStyle='#173f4d2a';ctx.beginPath();ctx.ellipse(x,y,24,6,0,0,Math.PI*2);ctx.fill();
    ctx.drawImage(im,(offset+frame)*CW,row*CH,CW,CH,x-dw/2,y-dh,dw,dh);
  }

  function loop(now){
    const dt=last?Math.min((now-last)/1000,.05):0;last=now;clock+=dt;
    if(state.moving){
      const dir=Math.sign(state.targetX-state.x),speed=.42;
      const next=state.x+dir*speed*dt;
      if((dir>0&&next>=state.targetX)||(dir<0&&next<=state.targetX)){
        state.x=state.targetX;state.moving=false;state.workUntil=clock+.6;
        if(state.resolveMove){const fn=state.resolveMove;state.resolveMove=null;fn();}
      }else state.x=next;
      state.direction=dir<0?'west':'east';
    }
    drawBackground();drawStations();drawDoctor();requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  async function goTo(stage,{carry=false,messageText=''}={}){
    if(!positions[stage])throw new Error('Unknown R11 world stage '+stage);
    await whenReady();state.stage=stage;state.carry=carry;state.targetX=positions[stage];message.textContent=messageText||('前往 '+stage.toUpperCase());
    if(Math.abs(state.x-state.targetX)<.002){state.x=state.targetX;state.moving=false;state.workUntil=clock+.5;return;}
    state.moving=true;
    await new Promise(resolve=>state.resolveMove=resolve);
    message.textContent=stage==='consult'?'抵達診間':stage==='prep'?'抵達備料檯':stage==='wok'?'抵達炒鍋':'抵達配餐檯';
  }

  function reset(){
    state.stage='consult';state.x=positions.consult;state.targetX=positions.consult;state.moving=false;state.carry=false;state.direction='east';state.workUntil=clock+.4;state.resolveMove=null;
    message.textContent=state.doctor?'醫師待命':'先選擇值班醫師';
  }
  function setDoctor(id){state.doctor=images[id]?id:null;message.textContent=state.doctor?'醫師已就位':'先選擇值班醫師';}
  function setMessage(text){message.textContent=String(text||'');}

  window.CKR11World={goTo,reset,setCarry:v=>state.carry=!!v,setDoctor,setMessage,whenReady,snapshot:()=>({ready,stage:state.stage,x:state.x,targetX:state.targetX,moving:state.moving,carry:state.carry,direction:state.direction,doctor:state.doctor})};
})();