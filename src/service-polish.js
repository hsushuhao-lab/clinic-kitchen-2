/* R5: illustrated requests, E-key station actions, cumulative heat penalties,
   and one non-graphic comic reaction per mismatched order. No second scheduler. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id),root='assets/service/';
 const icons=p=>[
  [p.spicy==='重辣'?'spicy-heavy':'spicy-normal',p.spicy==='重辣'?'重辣':'正常辣'],
  [p.scallion?'scallion-yes':'scallion-no',p.scallion?'要蔥':'不要蔥'],
  [p.rice==='半碗飯'?'rice-half':'rice-full',p.rice==='半碗飯'?'半碗飯':'正常飯']
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
 const shortcut=document.createElement('p');shortcut.id='stationKeyHelp';shortcut.textContent='1–6 選材料 · E 切配／舀取 · F 開關火';
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
  const help=at==='prep'?'1 豆腐 · 2 絞肉 · 3 豆瓣 · 4 蒜 · 5 青蔥 · 6 花椒｜E 切配／舀取':
   at==='wok'?'E 依序下料／翻炒 · F 開火／關火｜4秒收汁，繼續大火每滿1秒扣1%':
   at==='rice'?'1 半碗飯 · 2 正常飯｜E 出餐看評價':'WASD／方向鍵移動 · Shift 跑步 · 到站 E 互動';
  if(shortcut.textContent!==help)shortcut.textContent=help;
  // Core updateCooking owns button labels; add the shortcut after its update.
  if(!$('cutBtn').textContent.startsWith('E '))$('cutBtn').textContent='E '+$('cutBtn').textContent;
  const penalty=CKClinicRules.heatPenalty(cookedDish.overheatSeconds,cookedDish.isBurnt);
  const heatKey=[Math.floor(c.simmerTimer*10),penalty,c.heated,cookedDish.isSimmered].join('|');
  if(heatKey!==lastHeat){
   lastHeat=heatKey;
   fire.textContent=c.simmerTimer>0?`大火 ${c.simmerTimer.toFixed(1)}秒 · 火候扣分 −${penalty}%${c.heated?' · F 關火停止累積':' · 已關火，扣分保留'}`:'4秒收汁完成；不會自動關火。超過後每滿1秒扣1%，最多20%。';
   fire.dataset.penalty=String(penalty);
   if(cookedDish.isSimmered)$('simmerProgressText').textContent=`收汁完成 · 大火 ${c.simmerTimer.toFixed(1)}秒 · −${penalty}%`;
  }
 }
 // The existing engine calls CKShift.tick just before advancing simmerTimer.
 // Integrate only the excess portion; adding another ingredient cannot erase damage.
 const tick=CKShift.tick;
 CKShift.tick=function(dt,dialogOpen){
  const c=getCookingStatus();
  if(dt>0&&!dialogOpen&&!CKShift.isFrozen()&&CKShift.snapshot().status==='active'&&
    [4,5].includes(c.stage)&&c.heated&&c.stirs>=3&&c.ready){
   const over=Math.max(0,c.simmerTimer+dt-4)-Math.max(0,c.simmerTimer-4);
   cookedDish.overheatSeconds=(cookedDish.overheatSeconds||0)+over;
  }
  tick.call(CKShift,dt,dialogOpen);
 };
 const cook=window.updateCooking;
 window.updateCooking=function(){cook();render();};
 // Do not alter E in dialogs, a focused range input, pause or terminal results.
 function stationAction(key){
  if(CKShift.isFrozen()||!$('dialogModal').hidden||$('clinicResult').open)return false;
  const c=getCookingStatus(),at=getSceneStatus().interactiveTarget?.id;
  if(at==='prep'&&c.stage>=3){
   if(/^[1-6]$/.test(key)){
    document.querySelectorAll('.ingredient-tray button')[Number(key)-1].click();return true;
   }
   if(key==='e'){
    if(!c.selectedFood){document.querySelector('[data-food="tofu"]').click();}
    if(!$('cutBtn').disabled)$('cutBtn').click();return true;
   }
  }
  if(at==='wok'&&c.stage>=4){
   if(key==='f'){if(!$('heatBtn').disabled)$('heatBtn').click();return true;}
   if(key==='e'){
    const button=!c.heated?$('heatBtn'):!$('addBtn').disabled?$('addBtn'):c.stirs<3?$('stirBtn'):null;
    if(button&&!button.disabled)button.click();return true;
   }
  }
  if(at==='rice'&&c.stage>=4){
   const button=key==='1'?$('riceHalfBtn'):key==='2'?$('riceFullBtn'):key==='e'?$('clinicPlateBtn'):null;
   if(button){if(!button.disabled)button.click();return true;}
  }
  return false;
 }
 addEventListener('keydown',e=>{
  if(e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,textarea,select,[contenteditable="true"],dialog,.dialog-modal'))return;
  const key=e.key.toLowerCase();if(!['e','f','1','2','3','4','5','6'].includes(key))return;
  if(e.repeat){e.preventDefault();e.stopImmediatePropagation();return;}
  if(stationAction(key)){e.preventDefault();e.stopImmediatePropagation();}
 },true);
 // Mobile E button uses the same station action as the hardware keyboard.
 $('sceneInteractBtn').addEventListener('click',e=>{if(stationAction('e')){e.preventDefault();e.stopImmediatePropagation();}},true);
 function showReaction(){
  const state=CKClinic.snapshot();if(!state.resultOpen||!state.result||lastResultNumber===state.number)return;
  lastResultNumber=state.number;
  const mismatch=state.result.checks.some(c=>!c.ok),doctor=CKShift.snapshot().doctorId;
  resultArt.replaceChildren();$('clinicResult').dataset.satisfaction=mismatch?'unmet':'met';
  const patient=document.createElement('img');patient.className='result-patient';patient.src=root+state.patient.id+'.webp';patient.alt=state.patient.name;
  const note=document.createElement('p');note.className='reaction-caption';
  if(mismatch){
   reactionState={doctor,start:performance.now()};
   const actor=document.createElement('img');actor.className='bonk-actor';actor.alt='Q版醫師被輕敲後頭冒星星、揉頭恢復';actor.src=root+'bonk-'+doctor+'.webp';
   const stage=document.createElement('div');stage.className='bonk-stage';stage.append(actor);
   const mallet=document.createElement('span');mallet.className='foam-mallet';mallet.setAttribute('aria-hidden','true');stage.append(mallet);
   note.textContent='口味沒對上！敲一下——頭暈、揉揉頭，下次看清楚圖示。';
   resultArt.append(patient,stage,note);CKAudio.cue('early');
   $('clinicResultMessage').textContent='「這不是我點的口味！」以下列出需要調整的地方。';
  }else{
   reactionState=null;note.textContent='每一個需求都對上了，病人滿意！';resultArt.append(patient,note);
  }
  // Icon columns share exactly the same request mapping as the sidebar.
  const row=$('clinicComparison').rows;
  for(let i=0;i<3;i++){
   for(const [column,order] of [[1,state.order],[2,state.result.actual]]){
    const [file,label]=icons(order)[i],im=document.createElement('img');im.className='comparison-icon';im.src=root+file+'.webp';im.alt=label;row[i].cells[column].prepend(im);
   }
  }
 }
 $('clinicPlateBtn').addEventListener('click',showReaction);
 const reset=window.resetAll;
 window.resetAll=function(){reactionState=null;lastResultNumber=null;resultArt.replaceChildren();identity=request=lastHeat='';reset();render();};
 window.CKService={reaction,render,snapshot:()=>({version:'R5',reaction:reaction(),overheatSeconds:cookedDish.overheatSeconds||0,penalty:CKClinicRules.heatPenalty(cookedDish.overheatSeconds,cookedDish.isBurnt)})};
 render();
})();
