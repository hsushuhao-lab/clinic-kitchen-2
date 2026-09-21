/* R6: illustrated requests with miso soup, keyboard shortcuts (1-6, Q, E, F, Space),
   batch wok actions, flame cycle, carrying tray delivery, and dual feast/table-flip finales. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id),root='assets/service/';
 const icons=p=>[
  [p.spicy==='重辣'?'spicy-heavy':'spicy-normal',p.spicy==='重辣'?'重辣':'正常辣'],
  [p.scallion?'scallion-yes':'scallion-no',p.scallion?'要蔥':'不要蔥'],
  [p.rice==='半碗飯'?'portion_half':'portion_full',p.rice==='半碗飯'?'半碗飯':'正常飯'],
  [p.miso?'miso_yes':'miso_no',p.miso?'要附湯':'不要湯']
 ];
 function iconRow(order){
  const row=document.createElement('div');row.className='request-icons';row.setAttribute('aria-label','病人需求圖示');
  icons(order).forEach(([file,label])=>{
   const item=document.createElement('figure'),im=document.createElement('img'),cap=document.createElement('figcaption');
   im.src=root+file+'.webp';im.alt=label;im.width=144;im.height=120;cap.textContent=label;item.append(im,cap);row.append(item);
  });return row;
 }
 const wishes=document.createElement('div');wishes.id='requestIcons';
 $('clinicWish').after(wishes);
 const shortcut=document.createElement('p');shortcut.id='stationKeyHelp';shortcut.textContent='1–7 選材料 · Q 切換份量 (0/半/1) · E 切配備妥 · F 開關火';
 $('clinicWorktabs').after(shortcut);
 document.querySelectorAll('.ingredient-tray button').forEach((b,i)=>{
  const key=document.createElement('kbd');key.textContent=String(i+1);b.prepend(key);
 });
 $('cutBtn').textContent='E 切配／舀取';
 document.querySelector('.precision-info>span').textContent='精準判定 · E／Space';
 const fire=document.createElement('p');fire.id='overheatStatus';fire.setAttribute('role','status');$('wokStatusText').after(fire);
 const resultArt=document.createElement('div');resultArt.id='resultReaction';resultArt.setAttribute('aria-live','polite');
 $('clinicResult').querySelector('header').after(resultArt);
 let identity='',request='',lastHeat='',reactionState=null,lastResultNumber=null;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');

 function reaction(){
  if(!reactionState)return null;
  const elapsed=(performance.now()-reactionState.start)/1000;
  return {...reactionState,frame:reduced.matches?2:Math.min(3,Math.floor(elapsed/.55))};
 }

 function render(){
  const clinic=CKClinic.snapshot(),c=getCookingStatus(),s=CKShift.snapshot();
  const who=clinic.patient,id=who.id;
  const src=root+id+'.webp',portrait=$('patientHUD').querySelector('.patient-portrait');
  if(portrait.dataset.assetSource!==src){portrait.src=src;portrait.dataset.assetSource=src;}
  if(identity!==id){identity=id;portrait.alt=who.name+'，完整原稿人物插畫';}
  const key=JSON.stringify(clinic.order);
  if(key!==request){request=key;wishes.replaceChildren(iconRow(clinic.order));}
  const at=getSceneStatus().interactiveTarget?.id;
  const help=c.plated?'已盛入托盤！醫師自動端餐送回診間給病人':
   at==='prep'?'1–7 選材料 · Q 循環份量 (0/0.5/1) · E 切配放入備料盤':
   at==='wok'?'E 全料下鍋／翻炒／起鍋 · F 切換火力 (關/小/大)｜4等效秒收汁':
   at==='serve'?'1 半碗飯 · 2 正常飯 · Q 味噌湯｜完成後按盛盤裝托盤':
   'WASD／方向鍵移動 · Shift 跑步 · 到站 E 互動';
  if(shortcut.textContent!==help)shortcut.textContent=help;
  if(!$('cutBtn').textContent.startsWith('E '))$('cutBtn').textContent='E '+$('cutBtn').textContent;
  const penalty=CKClinicRules.heatPenaltyR6(c.eqSimmerTime||c.simmerTimer,c.wok?.isBurnt);
  const heatKey=[Math.floor((c.eqSimmerTime||c.simmerTimer)*10),penalty,c.heated,c.wok?.flame,cookedDish.isSimmered].join('|');
  if(heatKey!==lastHeat){
   lastHeat=heatKey;
   const mode=c.wok?.flame==='high'?'大火(1.0x)':c.wok?.flame==='low'?'小火(0.5x)':'爐火已關';
   fire.textContent=(c.eqSimmerTime||c.simmerTimer)>0?`等效收汁 ${(c.eqSimmerTime||c.simmerTimer).toFixed(1)}秒 [${mode}] · 火候扣分 −${penalty}%${c.heated?' · F 切換火力':' · 已關火，扣分保留'}`:'4等效秒收汁完成（小火8s或大火4s）；超過後每滿1秒扣1%，最多20%。';
   fire.dataset.penalty=String(penalty);
   if(cookedDish.isSimmered)$('simmerProgressText').textContent=`收汁完成 · 等效 ${(c.eqSimmerTime||c.simmerTimer).toFixed(1)}秒 · −${penalty}%`;
  }
 }

 const tick=CKShift.tick;
 CKShift.tick=function(dt,dialogOpen){
  tick.call(CKShift,dt,dialogOpen);
 };
 const cook=window.updateCooking;
 window.updateCooking=function(){cook();render();};

 function stationAction(key){
  if(CKShift.isFrozen()||!$('dialogModal').hidden||$('clinicResult').open)return false;
  const c=getCookingStatus(),at=getSceneStatus().interactiveTarget?.id,st=getSceneStatus();

  // If carrying tray, delivery check
  if(c.plated||st.carryingTray){
   const atConsult = at==='consult' || Math.abs(st.playerPos.x - (-10.5)) <= 2.2;
   if(key==='e'){
    if(atConsult){
     CKClinic.deliver();
     return true;
    } else {
     $('log').textContent = '未到病人旁：請端著托盤走回最左側診間 (X: -10.5) 才能交餐！';
     return true;
    }
   }
   return false;
  }

  if(at==='consult'&&c.stage===0&&key==='e'){
   window.handleInteraction('病人');
   return true;
  }

  if(at==='prep'){
   if(/^[1-7]$/.test(key)){
    document.querySelectorAll('.ingredient-tray button')[Number(key)-1]?.click();return true;
   }
   if(key==='q'){
    if(window.cyclePortion) window.cyclePortion(c.selectedFood);
    return true;
   }
   if(key==='e'){
    if(!c.selectedFood){document.querySelector('[data-food="tofu"]')?.click();}
    if(!$('cutBtn').disabled)$('cutBtn').click();
    return true;
   }
  }

  if(at==='wok'){
   if(key==='f'){if(!$('heatBtn').disabled)$('heatBtn').click();return true;}
   if(key==='e'||key===' '){
    if(!window.wok?.hasFood && !$('addBtn').disabled){
     $('addBtn').click();return true;
    }
    if(window.wok?.hasFood && window.wok.stirs < 3 && !$('stirBtn').disabled){
     $('stirBtn').click();return true;
    }
    if(window.wok?.hasFood && window.wok.stirs >= 3 && (window.wok.isSimmered || window.wok.eqSimmerTime>=4.0) && !$('plateBtn').disabled){
     $('plateBtn').click();return true;
    }
    if(!window.wok?.hasFood && window.wok?.flame==='off' && !$('heatBtn').disabled){
     $('heatBtn').click();return true;
    }
   }
  }

  if(at==='serve'){
   if(key==='1'){if(!$('riceHalfBtn').disabled)$('riceHalfBtn').click();return true;}
   if(key==='2'){if(!$('riceFullBtn').disabled)$('riceFullBtn').click();return true;}
   if(key==='q'){if($('misoToggleBtn')&&!$('misoToggleBtn').disabled)$('misoToggleBtn').click();return true;}
   if(key==='e'){
    if(!$('clinicPlateBtn').disabled){$('clinicPlateBtn').click();return true;}
    if(!$('plateBtn').disabled){$('plateBtn').click();return true;}
   }
  }
  return false;
 }

 addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,textarea,select,[contenteditable="true"],dialog,.dialog-modal'))return;
  const key=e.key.toLowerCase();
  if(!['e','f','q',' ','1','2','3','4','5','6','7'].includes(key))return;
  if(e.repeat){e.preventDefault();e.stopImmediatePropagation();return;}
  if(stationAction(key)){e.preventDefault();e.stopImmediatePropagation();}
 },true);

 $('sceneInteractBtn').addEventListener('click',e=>{if(stationAction('e')){e.preventDefault();e.stopImmediatePropagation();}},true);

 function showReaction(won, outcome){
  const state=CKClinic.snapshot();if(!state.result||lastResultNumber===state.number)return;
  lastResultNumber=state.number;
  const doctor=CKShift.snapshot().doctorId;
  resultArt.replaceChildren();$('clinicResult').dataset.satisfaction=won?'met':'unmet';

  const wrap=document.createElement('div');wrap.className='finale-banner-wrap';
  const banner=document.createElement('img');banner.className='finale-banner';
  banner.dataset.finale = won ? 'success' : 'failure';
  banner.src=won?'assets/finale/success_clinic_meal.webp':'assets/finale/failure_table_flip.webp';
  banner.alt=won?'醫師與病患在診間共餐，熱氣蒸騰，氣氛溫馨舒壓':'病患翻桌，麻婆豆腐與熱湯潑灑';
  wrap.append(banner);

  const note=document.createElement('p');note.className='finale-caption';
  if(!won){
   reactionState={doctor,start:performance.now()};
   const card=document.createElement('div');card.className='doctor-splashed-card';
   const splashed=document.createElement('img');splashed.className='doctor-splashed-img';
   splashed.dataset.type = 'splashed'; splashed.dataset.doctor = doctor;
   splashed.src=`assets/finale/doctor_${doctor}_splashed.webp`;splashed.alt='醫師白袍濺滿紅油與熱湯';
   const bump=document.createElement('img');bump.className='doctor-bump-img';
   bump.dataset.type = 'bump'; bump.dataset.doctor = doctor;
   bump.src=`assets/finale/doctor_${doctor}_bump.webp`;bump.alt='醫師頭上起腫包揉頭';
   card.append(splashed,bump);
   wrap.append(card);
   note.textContent='口味嚴重不符！病患氣憤翻桌，紅油熱湯潑灑在醫師白袍上，頭上起腫包揉頭！連勝歸零。';
   CKAudio.cue('early');
  }else{
   reactionState=null;
   note.textContent='料理完全契合偏好！熱騰騰麻婆豆腐撫慰了身心，病患與醫師一同在診間共餐享受美味。';
   CKAudio.cue('ticket');
  }
  wrap.append(note);
  resultArt.append(wrap);

  // Set icons in comparison rows for both requested and served items
  const rows=$('clinicComparison').rows;
  const iconLookup={
   '辣度調味':{req:state.order.spicy==='重辣'?'spicy-heavy':'spicy-normal',act:c=>(c?.actual?.includes('重辣')||cookedDish.hasPepper)?'spicy-heavy':'spicy-normal'},
   '花椒→Anxiety':{req:state.order.spicy==='重辣'?'spicy-heavy':'spicy-normal',act:c=>(c?.actual!=='0份'||cookedDish.hasPepper||(window.wok?.contents?.pepper||0)>0)?'spicy-heavy':'spicy-normal'},
   '蔥花偏好':{req:state.order.scallion?'scallion-yes':'scallion-no',act:c=>(c?.actual?.includes('有蔥')||cookedDish.hasScallion)?'scallion-yes':'scallion-no'},
   '蔥→Concentration':{req:state.order.scallion?'scallion-yes':'scallion-no',act:c=>(c?.actual!=='0份'||cookedDish.hasScallion||(window.wok?.contents?.scallion||0)>0)?'scallion-yes':'scallion-no'},
   '配飯份量':{req:state.order.rice==='半碗飯'?'portion_half':'portion_full',act:c=>(c?.actual==='半碗飯'||cookedDish.ricePortion==='半碗飯')?'portion_half':'portion_full'},
   '味噌湯':{req:state.order.miso?'miso_yes':'miso_no',act:c=>(c?.actual?.includes('有湯')||cookedDish.miso)?'miso_yes':'miso_no'}
  };
  const checks=state.result?.checks||[];
  for(let i=0;i<rows.length;i++){
   const title=rows[i].cells[0]?.textContent?.trim();
   const cfg=iconLookup[title];
   if(cfg){
    const chk=checks.find(x=>x.label===title);
    if(rows[i].cells[1] && !rows[i].cells[1].querySelector('.comparison-icon')){
     const im=document.createElement('img');im.className='comparison-icon';im.src=root+cfg.req+'.webp';im.alt='';
     rows[i].cells[1].prepend(im);
    }
    if(rows[i].cells[2] && !rows[i].cells[2].querySelector('.comparison-icon')){
     const im=document.createElement('img');im.className='comparison-icon';im.src=root+cfg.act(chk)+'.webp';im.alt='';
     rows[i].cells[2].prepend(im);
    }
   }
  }
 }

 const reset=window.resetAll;
 window.resetAll=function(){reactionState=null;lastResultNumber=null;resultArt.replaceChildren();identity=request=lastHeat='';reset();render();};
 window.CKService={reaction,render,showReaction,snapshot:()=>({version:'R6',reaction:reaction(),overheatSeconds:cookedDish.overheatSeconds||0,penalty:CKClinicRules.heatPenaltyR6(cookedDish.eqSimmerTime||(cookedDish.overheatSeconds?4.0+cookedDish.overheatSeconds:0),cookedDish.isBurnt)})};
 render();
})();
