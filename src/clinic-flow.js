/* R4: serial clinic appointments and one active workspace.
   Uses the existing classic-script controller's named functions as integration seams.
   Recipe preparation / heat / scoring and the R3 audio scheduler remain unchanged. */
(function(){
  'use strict';
  const el=id=>document.getElementById(id),{patients,stations,evaluate}=CKClinicRules;
  let number=1,patientIndex=0,result=null,last='',previousStation='',panel='prep';
  const original={interact:window.handleInteraction,reset:window.resetAll,cook:window.updateCooking,tick:CKShift.tick};
  const person=()=>patients[patientIndex%patients.length];
  const preference=()=>CKRush.prescribedOrder()||person();
  const summary=p=>`${p.spicy==='正常'?'正常辣':p.spicy}・${p.scallion?'要蔥':'不要蔥'}・${p.rice}`;
  const text=(id,value)=>{if(el(id).textContent!==String(value))el(id).textContent=value;};
  const numberText=n=>String(n).padStart(3,'0');

  // Keep existing HUD nodes so the original craving/focus renderer retains ownership.
  const hud=el('patientHUD');el('app').insertBefore(hud,el('world'));
  const heading=document.createElement('div');heading.className='clinic-call';
  heading.innerHTML='<small>門診料理 · 依序叫號</small><div><strong id="clinicNumber">001</strong><span id="clinicStatus">已叫號</span></div>';
  const identity=document.createElement('div');identity.className='clinic-identity';
  identity.append(hud.querySelector('.patient-portrait'));const name=document.createElement('strong');name.id='clinicName';identity.append(name);
  const wishes=document.createElement('div');wishes.className='clinic-wishes';wishes.innerHTML='<blockquote id="clinicWish"></blockquote><p id="clinicPreferences"></p>';
  const next=document.createElement('div');next.className='clinic-next';next.innerHTML='<small>下一位候診</small><p id="clinicNext"></p><p id="clinicAnnouncement" aria-live="polite"></p>';
  hud.prepend(heading,identity,wishes);hud.append(next);

  const tabs=document.createElement('nav');tabs.id='clinicWorktabs';tabs.setAttribute('aria-label','料理工作區');
  tabs.innerHTML='<div><button type="button" class="shift-control" data-clinic-panel="prep">1 備料</button><button type="button" class="shift-control" data-clinic-panel="wok">2 炒鍋</button><button type="button" class="shift-control" data-clinic-panel="serve">3 配飯・出餐</button></div><span id="clinicOrderSummary"></span>';
  el('rushStrip').after(tabs);
  const welcome=document.createElement('section');welcome.id='clinicWelcome';
  welcome.innerHTML='<small>聽病人說口味</small><h2>照病人的口味，做一碗麻婆豆腐。</h2><p id="clinicInstruction"></p><button class="shift-control" id="clinicGo" type="button">走向病人 · E 問診</button>';
  el('cookingDeck').append(welcome);
  // A distinct finish action replaces the old return-to-patient delivery action.
  const plate=document.createElement('button');plate.id='clinicPlateBtn';plate.className='shift-control';plate.type='button';plate.textContent='出餐並看評價';el('panel-serve').append(plate);
  const serveNote=document.createElement('p');serveNote.id='clinicServeNote';el('panel-serve').append(serveNote);
  const finish=document.createElement('dialog');finish.id='clinicResult';finish.setAttribute('aria-labelledby','clinicResultTitle');
  finish.innerHTML='<header><small>本號料理已完成</small><h2 id="clinicResultTitle"></h2><p id="clinicResultMessage"></p></header><div class="clinic-result-score"><strong id="clinicQuality"></strong><span id="clinicAward"></span></div><table><thead><tr><th>項目</th><th>病人想要</th><th>實際出餐</th><th>結果</th></tr></thead><tbody id="clinicComparison"></tbody></table><p id="clinicBonus"></p><small class="clinic-disclaimer">這是虛構料理遊戲，麻婆豆腐不是戒菸治療。</small><footer><button type="button" class="shift-control" id="clinicNextBtn">叫下一號</button></footer>';
  document.body.append(finish);

  function selectPanel(value){
    panel=value;el('cookingDeck').dataset.panel=value;
    document.querySelectorAll('[data-clinic-panel]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.clinicPanel===value)));
  }
  function announce(){
    const p=preference(),who=person();currentOrder={spicy:p.spicy,scallion:p.scallion,rice:p.rice};syncOrderTicketUI();
    hud.querySelector('.patient-portrait').src=`assets/clinic/${who.id}.webp`;
    hud.querySelector('.patient-portrait').alt=who.name;hud.querySelector('.patient-heading strong').textContent=who.name;
    el('clinicAnnouncement').textContent=`請 ${numberText(number)} 號 ${who.name} 到診間。`;
    window.setClinicPatient?.(who.id);CKAudio.cue('ticket');last='';render();
  }
  function render(){
    const s=CKShift.snapshot(),c=getCookingStatus(),p=preference(),who=person();
    const station=getSceneStatus().interactiveTarget?.id||'';
    if(station&&station!==previousStation){if(['prep','wok'].includes(station))selectPanel(station);else if(station==='rice')selectPanel('serve');}
    previousStation=station;
    // Overwrite only presentation after the engine's panel selection and guard update.
    el('cookingDeck').dataset.panel=panel;el('cookingDeck').dataset.clinicStage=String(c.stage);
    const atServe=station==='rice'&&!CKShift.isFrozen();
    el('clinicPlateBtn').disabled=!(atServe&&c.ready&&c.stirs>=3&&cookedDish.isSimmered&&c.rice!=='未盛飯'&&!c.plated);
    el('riceHalfBtn').disabled=el('riceFullBtn').disabled=!(atServe&&c.stage>=4&&!c.plated);
    el('heatBtn').disabled ||= !c.atWok;el('addBtn').disabled ||= !c.atWok;el('stirBtn').disabled ||= !c.atWok;el('cutBtn').disabled ||= !c.atPrep;
    const key=[number,who.id,p.spicy,p.scallion,p.rice,s.status,c.stage,station,c.rice,c.heated,cookedDish.isSimmered].join('|');
    if(key!==last){
      last=key;text('clinicNumber',numberText(number));text('clinicName',who.name);
      text('clinicStatus',s.status==='won'?'已完成':s.status==='lost'?'待重試':s.status==='active'?'製作中':'已叫號');
      text('clinicWish',`「${summary(p)}，謝謝醫師。」`);text('clinicPreferences',summary(p));
      text('clinicNext',`${numberText(number+1)}　${patients[(patientIndex+1)%patients.length].name} · 候診中`);
      text('clinicOrderSummary',`${numberText(number)} ${who.name}｜${summary(p)}`);
      const targets=['patient','desk','fridge'],instructions=['左側是本號需求。上方由左往右：病人 → 電腦 → 冰箱 → 備料 → 炒鍋 → 出餐。','需求已記錄。請前往病人右邊的電腦確認料理單。','請前往冰箱取材，接著到備料檯操作。'];
      text('clinicInstruction',instructions[c.stage]||'依目前工作站製作料理。');
      text('clinicGo',['走向病人 · E 問診','走向電腦 · E 開單','走向冰箱 · E 取材'][c.stage]||'繼續料理');el('clinicGo').dataset.target=targets[c.stage]||'prep';
      text('clinicServeNote',!atServe?'請走到最右側配飯・出餐區。':!cookedDish.isSimmered?'先完成炒鍋收汁。':c.rice==='未盛飯'?'先依病人偏好選擇飯量。':'按出餐直接結算，不必走回診間。');
    }
    if(result&&s.status==='won')el('sessionOverlay').hidden=true;
  }
  window.updateCooking=function(){original.cook();render();};
  CKShift.tick=function(dt,dialogOpen){original.tick.call(CKShift,dt,dialogOpen);render();};
  window.handleInteraction=function(name){
    if(!CKShift.canInteract())return;
    const stage=getMissionStage(),p=preference(),who=person();
    if(name.includes('病人')&&stage===0){
      showDialog({badge:'CLINIC ORDER',title:`${numberText(number)} 號 · ${who.name}`,content:`<p class="clinic-consult-wish">「${summary(p)}，謝謝醫師。」</p><p>口味由病人決定，醫師選擇配料。<br>正常辣：豆瓣醬；重辣：再加花椒。蔥花與飯量請照單準備。</p>`,confirmText:'記下需求，前往電腦',onConfirm:()=>{currentOrder={spicy:p.spicy,scallion:p.scallion,rice:p.rice};syncOrderTicketUI();setStage(STAGES.ORDER);}});return;
    }
    if((name.includes('醫師桌')||name.includes('處方'))&&stage===1){
      showDialog({badge:'CLINIC PRESCRIPTION',title:`${numberText(number)} 號 · 確認料理單`,content:`<p><strong>${summary(currentOrder)}</strong></p><p>必備：豆腐、絞肉、豆瓣醬、蒜。<br>蔥花與花椒由醫師依病人偏好選擇，不會自動加入。</p>`,confirmText:'確認並開始，前往冰箱',onConfirm:()=>setStage(STAGES.GATHER)});return;
    }
    if(name.includes('冰箱')&&stage===2){showDialog({badge:'CLINIC INGREDIENTS',title:'食材已取出',content:'<p>豆腐、絞肉、豆瓣醬、蒜、青蔥與花椒已備妥。<br>到右側備料檯挑選本號需要的材料。</p>',confirmText:'前往備料',onConfirm:()=>setStage(STAGES.PREP)});return;}
    if(name.includes('電子鍋')){selectPanel('serve');return;}
    original.interact(name);
  };
  function deliver(){
    const c=getCookingStatus();
    if(CKShift.isFrozen()||getSceneStatus().interactiveTarget?.id!=='rice'||!c.ready||c.stirs<3||!cookedDish.isSimmered||c.rice==='未盛飯'||c.plated)return;
    // One atomic delivery. Stop movement/heat before opening the terminal summary.
    result=evaluate(currentOrder,cookedDish);heated=false;plated=true;keys.clear();
    setStage(STAGES.FIRST_BITE);CKShift.finish(result.quality);window.stopShiftCooking();
    text('clinicResultTitle',`${numberText(number)} 號 ${person().name} · 出餐完成`);
    text('clinicResultMessage',result.quality===100?'「就是我想吃的口味，謝謝醫師！」':'「餐點收到了，下次再依我的偏好調整看看。」');
    text('clinicQuality',`${result.quality}%`);const s=CKShift.snapshot();text('clinicAward',`滿意度 · +${s.lastEarned} 分 · 連勝 ${s.streak}`);
    el('clinicComparison').innerHTML=result.checks.map(c=>`<tr><th>${c.label}</th><td>${c.expected}</td><td>${c.actual}</td><td class="${c.ok?'match':'mismatch'}">${c.ok?'符合':'−'+c.penalty+'%'}</td></tr>`).join('');
    text('clinicBonus',CKRush.resultText()+(CKRush.snapshot().mode==='rush'?` · 本班 ${CKRush.snapshot().sessionPoints} 分`:''));
    text('clinicNextBtn',CKRush.snapshot().complete?'三單完成 · 再開一班':'叫下一號');
    el('sessionOverlay').hidden=true;finish.showModal();el('clinicNextBtn').focus();render();
  }
  window.resetAll=function(){
    const status=CKShift.snapshot().status;
    if(status==='won'){number++;patientIndex++;}
    if(finish.open)finish.close();result=null;
    original.reset();last='';previousStation='';selectPanel('prep');announce();
  };
  el('clinicPlateBtn').addEventListener('click',deliver);
  el('clinicNextBtn').addEventListener('click',()=>window.resetAll());
  finish.addEventListener('cancel',e=>e.preventDefault());
  finish.addEventListener('keydown',e=>{if(['Enter','e','E'].includes(e.key)&&!e.repeat){e.preventDefault();e.stopPropagation();el('clinicNextBtn').click();}});
  document.querySelectorAll('[data-clinic-panel]').forEach(b=>b.addEventListener('click',()=>{selectPanel(b.dataset.clinicPanel);render();}));
  el('clinicGo').addEventListener('click',()=>document.querySelector(`[data-station="${el('clinicGo').dataset.target}"]`).click());
  el('rushMode').addEventListener('click',()=>announce());
  el('doctorDialog').addEventListener('close',()=>el('world').focus({preventScroll:true}));
  window.CKClinic={snapshot:()=>({number,patient:{...person()},order:{...currentOrder},panel,result:result&&JSON.parse(JSON.stringify(result)),resultOpen:finish.open}),render};
  selectPanel('prep');announce();
})();
