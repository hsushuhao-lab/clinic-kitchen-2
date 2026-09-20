/* R6: consolidated clinic flow, single consultation, batch cooking,
   physical delivery return to patient, and dual feast/table-flip outcomes. */
(function(){
  'use strict';
  const el=id=>document.getElementById(id),
    {patients,stations,evaluate,evaluateR6,calculateMealOutcome}=CKClinicRules;
  let number=1,patientIndex=0,result=null,last='',previousStation='',panel='prep';
  const original={interact:window.handleInteraction,reset:window.resetAll,cook:window.updateCooking,tick:CKShift.tick};
  const person=()=>patients[patientIndex%patients.length];
  const preference=()=>CKRush.prescribedOrder()||person();
  const summary=p=>`${p.spicy==='正常'?'正常辣':p.spicy}・${p.scallion?'要蔥':'不要蔥'}・${p.rice}・${p.miso?'附味噌湯':'不要湯'}`;
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
  tabs.innerHTML='<div><button type="button" class="shift-control" data-clinic-panel="prep">1 備料</button><button type="button" class="shift-control" data-clinic-panel="wok">2 炒鍋</button><button type="button" class="shift-control" data-clinic-panel="serve">3 配飯・盛湯</button></div><span id="clinicOrderSummary"></span>';
  el('rushStrip').after(tabs);
  const welcome=document.createElement('section');welcome.id='clinicWelcome';
  welcome.innerHTML='<small>聽病人說口味</small><h2>照病人的口味，做一碗麻婆豆腐。</h2><p id="clinicInstruction"></p><button class="shift-control" id="clinicGo" type="button">走向病人 · E 問診</button>';
  el('cookingDeck').append(welcome);

  // Plating button on serve panel
  const plate=document.createElement('button');plate.id='clinicPlateBtn';plate.className='shift-control';plate.type='button';plate.textContent='盛盤裝托盤';el('panel-serve').append(plate);
  const serveNote=document.createElement('p');serveNote.id='clinicServeNote';el('panel-serve').append(serveNote);
  const finish=document.createElement('dialog');finish.id='clinicResult';finish.setAttribute('aria-labelledby','clinicResultTitle');
  finish.innerHTML='<header><small>本號料理已結算</small><h2 id="clinicResultTitle"></h2><p id="clinicResultMessage"></p></header><div class="clinic-result-score"><strong id="clinicQuality"></strong><span id="clinicAward"></span></div><table><thead><tr><th>項目</th><th>病人想要</th><th>實際出餐</th><th>結果</th></tr></thead><tbody id="clinicComparison"></tbody></table><p id="clinicBonus"></p><small class="clinic-disclaimer">這是虛構料理遊戲，麻婆豆腐不是戒菸治療。</small><footer><button type="button" class="shift-control" id="clinicNextBtn">叫下一號</button></footer>';
  document.body.append(finish);

  function selectPanel(value){
    panel=value;el('cookingDeck').dataset.panel=value;
    document.querySelectorAll('[data-clinic-panel]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.clinicPanel===value)));
  }
  function announce(){
    const p=preference(),who=person();
    currentOrder={spicy:p.spicy,scallion:p.scallion,rice:p.rice,miso:p.miso};
    syncOrderTicketUI();
    if (el('ticketMiso')) el('ticketMiso').textContent = currentOrder.miso ? '附味噌湯' : '不要湯';
    hud.querySelector('.patient-portrait').src=`assets/clinic/${who.id}.webp`;
    hud.querySelector('.patient-portrait').alt=who.name;
    hud.querySelector('.patient-heading strong').textContent=who.name;
    el('clinicAnnouncement').textContent=`請 ${numberText(number)} 號 ${who.name} 到診間。`;
    window.setClinicPatient?.(who.id);
    CKAudio.cue('ticket');
    last='';
    render();
  }
  function render(){
    const s=CKShift.snapshot(),c=getCookingStatus(),p=preference(),who=person();
    const station=getSceneStatus().interactiveTarget?.id||'';
    if(station&&station!==previousStation){
      if(['prep','wok','serve'].includes(station)) selectPanel(station);
    }
    previousStation=station;
    // Overwrite only presentation after the engine's panel selection and guard update.
    el('cookingDeck').dataset.panel=panel;el('cookingDeck').dataset.clinicStage=String(c.stage);
    const atWokOrServe=['wok','serve'].includes(station)&&!CKShift.isFrozen();
    const canPlateDish = atWokOrServe && (c.ready || window.wok?.hasFood) && (c.stirs>=3 || (window.wok?.stirs>=3)) && (cookedDish.isSimmered || (window.wok?.isSimmered)) && !c.plated && !window.isPlating;
    el('clinicPlateBtn').disabled=!canPlateDish;
    el('clinicPlateBtn').textContent=c.plated ? '已盛盤入托盤' : (window.isPlating ? '盛盤中...' : '盛盤裝托盤');
    el('riceHalfBtn').disabled=el('riceFullBtn').disabled=!(c.stage>=3&&!c.plated);
    if(el('misoToggleBtn')) el('misoToggleBtn').disabled = !(c.stage>=3&&!c.plated);
    el('heatBtn').disabled ||= !c.atWok;
    el('addBtn').disabled ||= (!c.atWok || window.wok?.hasFood);
    el('stirBtn').disabled ||= (!c.atWok || !window.wok?.hasFood);
    el('cutBtn').disabled ||= !c.atPrep;
    const key=[number,who.id,p.spicy,p.scallion,p.rice,p.miso,s.status,c.stage,station,c.rice,c.miso,c.heated,cookedDish.isSimmered,c.plated].join('|');
    if(key!==last){
      last=key;text('clinicNumber',numberText(number));text('clinicName',who.name);
      text('clinicStatus',s.status==='won'?'共餐成功':s.status==='lost'?'翻桌待重試':s.status==='active'?'製作中':'已叫號');
      text('clinicWish',`「${who.wish||summary(p)}」`);text('clinicPreferences',summary(p));
      text('clinicNext',`${numberText(number+1)}　${patients[(patientIndex+1)%patients.length].name} · 候診中`);
      text('clinicOrderSummary',`${numberText(number)} ${who.name}｜${summary(p)}`);
      const instructions=[
        '走到最左側病人椅 (X: -10.5) 按 E 問診與開單。',
        '需求已記錄。請前往備料檯 (X: 5.0) 準備食材。',
        '前往備料檯 (X: 5.0) 選料與份量，接著到炒鍋爐台全料下鍋。',
        '前往備料檯切配，全料下鍋並翻炒收汁。',
        '炒鍋翻炒與大小火收汁，完成後盛盤裝托盤。',
        '已盛盤！請端著托盤走回最左側診間交給病人 (X: -10.5)。',
        '端著托盤走回診間病人椅按 E 交餐給病人品嚐。',
        '病患品嚐完成。'
      ];
      text('clinicInstruction',instructions[c.stage]||'依目前工作站製作料理。');
      text('clinicGo',c.stage===0?'走向病人 · E 問診':c.plated?'走回診間 · E 交餐':'繼續料理');
      el('clinicGo').dataset.target=c.stage===0?'consult':c.plated?'consult':'prep';
      text('clinicServeNote',c.plated?'已盛入托盤！請端著托盤走回最左側診間 (X: -10.5) 按 E 送餐給病人。':!cookedDish.isSimmered?'請先在炒鍋完成4等效秒收汁。':c.rice==='未盛飯'?'請依病人偏好選擇白飯份量。':'完成配餐後點擊盛盤裝托盤，再端回診間。');
    }
    if(result&&s.status==='won')el('sessionOverlay').hidden=true;
  }
  window.updateCooking=function(){original.cook();render();};
  CKShift.tick=function(dt,dialogOpen){original.tick.call(CKShift,dt,dialogOpen);render();};

  function onPlate() {
    const c=getCookingStatus();
    if(c.plated||window.isPlating||CKShift.isFrozen()) return;
    if($('plateBtn') && !$('plateBtn').disabled) {
      $('plateBtn').click();
    } else {
      window.isPlating = true;
      setTimeout(() => {
        window.isPlating = false;
        c.plated = true;
        window.plated = true;
        if(window.setCarryingTray) window.setCarryingTray(true);
        setStage(STAGES.SERVE);
        cookLog('麻婆豆腐已盛入托盤！請端著托盤走回最左側診間 (X: -10.5) 按 E 送餐給病人');
        $('log').textContent = '盛盤完成！端著托盤走回最左側診間病人椅按 E 送餐';
        render();
      }, 400);
    }
  }

  function deliver(){
    const c=getCookingStatus(), st=getSceneStatus();
    const atConsult = st.interactiveTarget?.id==='consult' || Math.abs(st.playerPos.x - (-10.5)) <= 2.2;
    if(!atConsult){
      $('log').textContent = '未到病人旁：請端著托盤走回最左側病人旁 (X: -10.5) 才能交餐！';
      cookLog('提示：必須走回診間病人旁才能交餐');
      return;
    }
    if(!c.plated || CKShift.isFrozen()) return;

    // Freeze player & carrying state
    keys.clear();
    window.setCarryingTray(false);
    if(window.setPatientDishVisible) window.setPatientDishVisible(true);
    window.stopShiftCooking?.();

    // Freeze craving before meal
    const beforeCraving = Math.round(CKShift.craving);
    const dishSnapshot = {
      contents: { ...(window.wok?.contents || {}) },
      stirs: window.wok?.stirs || c.stirs || 0,
      flame: window.wok?.flame || 'off',
      eqSimmerTime: window.wok?.eqSimmerTime || c.simmerTimer || 0,
      highHeatSeconds: window.wok?.highHeatSeconds || 0,
      lowHeatSeconds: window.wok?.lowHeatSeconds || 0,
      isSimmered: !!(window.wok?.isSimmered || cookedDish.isSimmered),
      isBurnt: !!(window.wok?.isBurnt || cookedDish.isBurnt),
      rice: cookedDish.ricePortion,
      miso: !!cookedDish.miso
    };

    result = evaluateR6(currentOrder, dishSnapshot);
    const quality = result.quality;
    const afterCraving = Math.max(0, Number((beforeCraving * (1 - 0.5 * quality / 100)).toFixed(1)));
    const mealOutcome = calculateMealOutcome({ beforeCraving, afterCraving, metricMode: 'relative' });
    const won = mealOutcome.success;

    CKShift.finishR6({ won, quality, cravingBefore: beforeCraving, cravingAfter: afterCraving });
    setStage(STAGES.FIRST_BITE);

    const who = person();
    text('clinicResultTitle', won ? `${numberText(number)} 號 ${who.name} · 舒壓共餐成功！` : `${numberText(number)} 號 ${who.name} · 料理翻桌失敗！`);
    text('clinicResultMessage', won
      ? '「就是我想吃的口味！熱騰騰的麻婆豆腐，搭配剛好的米飯與味噌湯，肩膀的緊繃感全都散開了！」'
      : '「這根本不是我想吃的口味！」病人憤怒翻桌，盤碗與紅油熱湯直接濺到醫師白袍上！');
    text('clinicQuality', `${quality}%`);
    const s = CKShift.snapshot();
    text('clinicAward', won
      ? `舒壓達標（降幅 ${(mealOutcome.relativeReduction * 100).toFixed(1)}% ≥ 25%）· +${s.lastEarned} 分 · 連勝 ${s.streak}`
      : `未達舒壓門檻（降幅 ${(mealOutcome.relativeReduction * 100).toFixed(1)}% < 25%）· 連勝歸零`);

    el('clinicComparison').innerHTML = result.checks.map(c => `<tr><th>${c.label}</th><td>${c.expected}</td><td>${c.actual}</td><td class="${c.ok ? 'match' : 'mismatch'}">${c.ok ? '符合' : '−' + c.penalty + '%'}</td></tr>`).join('');
    text('clinicBonus', CKRush.resultText() + (CKRush.snapshot().mode === 'rush' ? ` · 本班 ${CKRush.snapshot().sessionPoints} 分` : ''));
    text('clinicNextBtn', CKRush.snapshot().complete ? '三單完成 · 再開一班' : '叫下一號');

    el('sessionOverlay').hidden = true;
    finish.showModal();
    if (window.CKService?.showReaction) {
      window.CKService.showReaction(won, mealOutcome);
    }
    el('clinicNextBtn').focus();
    render();
  }

  window.handleInteraction=function(name){
    if(!CKShift.canInteract())return;
    const stage=getMissionStage(),p=preference(),who=person(),c=getCookingStatus();
    if(name.includes('病人')||name.includes('consult')){
      if(c.plated){
        deliver();
        return;
      }
      if(stage===0){
        showDialog({
          badge:'CLINIC EMR — 門診處方開單',
          title:`${numberText(number)} 號 · ${who.name}`,
          content:`
            <p class="clinic-consult-wish">「${who.wish||summary(p)}」</p>
            <p><strong>問診主訴與處方明細：</strong></p>
            <ul>
              <li>辣度偏好：【${p.spicy==='正常'?'正宗川味（正常辣）':p.spicy}】</li>
              <li>青蔥配置：【${p.scallion?'翠綠蔥花提香':'純粹豆腐（不要蔥）'}】</li>
              <li>越光米飯：【${p.rice}】</li>
              <li>暖心湯品：【${p.miso?'附熱味噌湯':'免附湯品'}】</li>
            </ul>
            <p><em>請至右側備料檯 (X: 5.0) 準備食材，全料下鍋並翻炒收汁。</em></p>
          `,
          confirmText:'確認處方開單並開始備料 (Enter / E)',
          onConfirm:()=>{
            currentOrder={spicy:p.spicy,scallion:p.scallion,rice:p.rice,miso:p.miso};
            syncOrderTicketUI();
            if (el('ticketMiso')) el('ticketMiso').textContent = currentOrder.miso ? '附味噌湯' : '不要湯';
            setStage(STAGES.PREP);
            CKShift.begin();
            cookLog(`已確認開立料理處方：${summary(currentOrder)}，前往備料檯 (X: 5.0) 備料`);
          }
        });
        return;
      }
      if(stage>0&&!c.plated){
        cookLog('尚未完成料理：請先至備料檯與爐台完成麻婆豆腐裝盤！');
        $('log').textContent = '料理尚未完成：請至後廚備料與烹調！';
        return;
      }
    }
    if(name.includes('電子鍋')||name.includes('serve')){selectPanel('serve');return;}
    original.interact(name);
  };

  window.resetAll=function(){
    const status=CKShift.snapshot().status;
    if(status==='won'){number++;patientIndex++;}
    if(finish.open)finish.close();result=null;
    original.reset();last='';previousStation='';selectPanel('prep');announce();
  };

  el('clinicPlateBtn').addEventListener('click', onPlate);
  el('clinicNextBtn').addEventListener('click',()=>window.resetAll());
  finish.addEventListener('cancel',e=>e.preventDefault());
  finish.addEventListener('keydown',e=>{if(['Enter','e','E'].includes(e.key)&&!e.repeat){e.preventDefault();e.stopPropagation();el('clinicNextBtn').click();}});
  document.querySelectorAll('[data-clinic-panel]').forEach(b=>b.addEventListener('click',()=>{selectPanel(b.dataset.clinicPanel);render();}));
  el('clinicGo').addEventListener('click',()=>{
    const t=el('clinicGo').dataset.target;
    document.querySelector(`[data-station="${t}"]`)?.click();
  });
  el('rushMode').addEventListener('click',()=>announce());
  el('doctorDialog').addEventListener('close',()=>el('world').focus({preventScroll:true}));
  window.CKClinic={
    snapshot:()=>({number,patient:{...person()},order:{...currentOrder},panel,result:result&&JSON.parse(JSON.stringify(result)),resultOpen:finish.open}),
    deliver,
    render
  };
  selectPanel('prep');announce();
})();
