/* R7: Clinical Cooking UX Redesign
   Consolidated clinic flow, 7 clinical metrics, automated walking transitions,
   visual ingredients with portion pills, active wok cooking, tray preview,
   in-flow non-modal settlement, and dual feast/table-flip finales. */
(function(){
  'use strict';
  const el=id=>document.getElementById(id),
    {patients,stations,evaluateR6,evaluateR8,buildExpectedPortions,buildClinicalPrescription,calculateMealOutcome,calculateClinicalMetrics,generatePatientReview}=CKClinicRules;
  let number=1,patientIndex=0,result=null,last='',previousStation='',panel='prep';
  const original={interact:window.handleInteraction,reset:window.resetAll,cook:window.updateCooking,tick:CKShift.tick};
  const person=()=>patients[patientIndex%patients.length];
  const preference=()=>CKRush.prescribedOrder()||person();
  const prescription=()=>buildClinicalPrescription(person());
  const portionText=v=>v===0?'0':v===0.5?'1/2':'1';
  const summary=_p=>{
    const rx=prescription(),p=rx.portions;

    return [
      'Douban '+portionText(p.douban),
      'Garlic '+portionText(p.garlic),
      'Pepper '+portionText(p.pepper),
      'Scallion '+portionText(p.scallion),
      'Chili '+portionText(p.chili),
      rx.rice,
      rx.miso ? '\u5473\u564c\u6e6f YES' : '\u5473\u564c\u6e6f NO'
    ].join(' | ');
  };
  const text=(id,value)=>{if(el(id)&&el(id).textContent!==String(value))el(id).textContent=value;};
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
  tabs.innerHTML='<div><button type="button" class="shift-control" data-clinic-panel="prep" disabled>1 備料</button><button type="button" class="shift-control" data-clinic-panel="wok" disabled>2 炒鍋</button><button type="button" class="shift-control" data-clinic-panel="serve" disabled>3 配餐</button></div><span id="clinicOrderSummary"></span>';
  el('rushStrip').after(tabs);

  const welcome=document.createElement('section');welcome.id='clinicWelcome';welcome.className='clinic-consult-deck';
  welcome.innerHTML=`
    <div class="consult-banner">
      <small>PHASE 1 · 門診主訴與臨床判斷</small>
      <h2 id="welcomeTitle">照病人的主訴，開立舒壓料理處方</h2>
    </div>
    <div class="consult-content-box">
      <strong id="welcomePatientInfo"></strong>
      <blockquote id="welcomePatientComplaint"></blockquote>
      <div class="consult-order-preview" id="welcomeOrderPreview"></div>
      <p class="consult-notice">⚡ 左側已載入病人 7 項身心基準指標（無法由玩家直接更改）。料理契合度與火候將決定結算時的舒緩降幅。</p>
    </div>
    <div class="consult-action-row">
      <button class="shift-control r7-action-btn primary" id="consultConfirmBtn" type="button">確認處方開單 · 前往備料檯 (E / Enter)</button>
      <button class="shift-control" id="clinicGo" type="button" style="display:none">走向病人 · E 問診</button>
    </div>
  `;
  el('cookingDeck').append(welcome);

  // Plating button on serve panel
  const plate=document.createElement('button');plate.id='clinicPlateBtn';plate.className='shift-control r7-action-btn';plate.type='button';plate.textContent='盛盤裝托盤 · 送餐給病人';el('panel-serve').append(plate);
  const serveNote=document.createElement('p');serveNote.id='clinicServeNote';el('panel-serve').append(serveNote);

  // In-flow non-blocking settlement dialog
  const finish=document.createElement('dialog');finish.id='clinicResult';finish.setAttribute('aria-labelledby','clinicResultTitle');
  finish.innerHTML=`
    <header>
      <small>CLINIC EVALUATION · 臨床評估結算</small>
      <h2 id="clinicResultTitle"></h2>
      <blockquote class="patient-review-quote" id="patientReviewQuote"></blockquote>
      <div class="subjective-grid" id="subjectiveGrid">
        <span class="sub-chip">麻香風味：<b id="subNumbing">-</b></span>
        <span class="sub-chip">感官撫慰：<b id="subComfort">-</b></span>
        <span class="sub-chip">身心飽足：<b id="subSatiety">-</b></span>
        <span class="sub-chip">思緒放鬆：<b id="subMental">-</b></span>
      </div>
      <p id="clinicResultMessage" class="clinic-result-message"></p>
    </header>
    <div class="clinic-result-score">
      <div><strong id="clinicQuality"></strong><small>料理契合度</small></div>
      <div class="comfort-block">病人舒緩度：<strong id="patientComfortScore"></strong></div>
      <span id="clinicAward"></span>
    </div>
    <table>
      <thead><tr><th>項目</th><th>病人想要</th><th>實際出餐</th><th>結果</th></tr></thead>
      <tbody id="clinicComparison"></tbody>
    </table>
    <p id="clinicBonus"></p>
    <p class="clinic-disclaimer">【設定聲明】麻婆豆腐為虛構遊戲舒壓料理設定，提供感官撫慰與心理放鬆，非臨床戒菸戒斷醫療處方。</p>
    <footer><button type="button" class="shift-control r7-action-btn primary" id="clinicNextBtn">叫下一號 (Enter / E)</button></footer>
  `;
  document.body.append(finish);

  function selectPanel(value){
    panel=value;el('cookingDeck').dataset.panel=value;
    document.querySelectorAll('[data-clinic-panel]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.clinicPanel===value)));
  }

  function announce(){
    const p=preference(),who=person(),rx=prescription();
    currentOrder={spicy:p.spicy,scallion:p.scallion,rice:rx.rice,miso:rx.miso};
    syncOrderTicketUI();
    if (el('ticketMiso')) el('ticketMiso').textContent = currentOrder.miso ? '附味噌湯' : '不要湯';
    hud.querySelector('.patient-portrait').src=`assets/service/${who.id}.webp`;
    hud.querySelector('.patient-portrait').alt=who.name;
    hud.querySelector('.patient-heading strong').textContent=who.name;
    el('clinicAnnouncement').textContent=`請 ${numberText(number)} 號 ${who.name} 到診間。`;

    if (el('patientComplaintQuote')) el('patientComplaintQuote').textContent = who.complaint || who.wish || '';
    if (el('welcomePatientInfo')) el('welcomePatientInfo').textContent = `${numberText(number)} 號 ${who.name}`;
    if (el('welcomePatientComplaint')) el('welcomePatientComplaint').textContent = `「${who.complaint || who.wish || summary(p)}」`;
    if (el('welcomeOrderPreview')) el('welcomeOrderPreview').textContent = summary(p);

    if (who.ftnd) {
      if (el('ftndTotal')) el('ftndTotal').textContent = who.ftnd.total;
      if (el('ftndSeverity')) el('ftndSeverity').textContent = who.ftnd.severity;
      ['q1','q2','q3','q4','q5','q6'].forEach(q => {
        if (el(`ftnd-${q}`)) el(`ftnd-${q}`).textContent = who.ftnd[q];
      });
    }
    if (who.clinicalStatus) {
      const s = who.clinicalStatus;
      const r8Metrics = ['craving','irritability','anxiety','concentration','restlessness','appetite','sleep'];
      r8Metrics.forEach(m => {
        if (s[m] !== undefined) {
          const val = s[m];
          const textEl = el(`${m}Text`);
          const meterEl = el(`${m}Meter`);
          if (textEl) textEl.textContent = val;
          if (meterEl) meterEl.value = val;
        }
      });
    }
    ['craving','irritability','anxiety','concentration','restlessness','appetite','sleep'].forEach(m => {
      if (el(`${m}Delta`)) {
        el(`${m}Delta`).textContent = '';
        el(`${m}Delta`).className = 'metric-delta';
      }
    });

    window.setClinicPatient?.(who.id);
    CKAudio.cue('ticket');
    last='';
    render();
  }

  function render(){
    const s=CKShift.snapshot(),c=getCookingStatus(),p=preference(),who=person(),rx=prescription();
    const station=getSceneStatus().interactiveTarget?.id||'';
    if(station&&station!==previousStation){
      if(['prep','wok','serve'].includes(station)) selectPanel(station);
    }
    previousStation=station;
    // Overwrite only presentation after the engine's panel selection and guard update.
    el('cookingDeck').dataset.panel=panel;el('cookingDeck').dataset.clinicStage=String(c.stage);

    if(el('servePrescriptionBanner')){
      el('servePrescriptionBanner').textContent =
        '\u672c\u865f\u914d\u9910\u76ee\u6a19\uff1a' +
        (rx.rice === '\u534a\u7897\u98ef'
          ? '\u534a\u7897\u98ef'
          : '\u4e00\u7897\u98ef') +
        ' | ' +
        (rx.miso
          ? '\u8981\u5473\u564c\u6e6f'
          : '\u4e0d\u8981\u5473\u564c\u6e6f');
    }
    const atWokOrServe=['wok','serve'].includes(station)&&!CKShift.isFrozen();
    const canPlateDish = (c.ready || window.wok?.hasFood) && (c.stirs>=3 || (window.wok?.stirs>=3)) && (cookedDish.isSimmered || (window.wok?.isSimmered)) && !c.plated && !window.isPlating;
    const serviceReady =
      cookedDish.ricePortion !== '\u672a\u76db\u98ef' &&
      cookedDish.misoChoice !== null &&
      cookedDish.misoChoice !== undefined;

    el('clinicPlateBtn').disabled =
      !canPlateDish || !serviceReady;

    el('clinicPlateBtn').textContent =
      c.plated
        ? '\u5df2\u9001\u9910'
        : window.isPlating
          ? '\u76db\u76e4\u4e2d...'
          : serviceReady
            ? '\u5b8c\u6210\u914d\u9910 \u00b7 \u81ea\u52d5\u9001\u9910'
            : '\u8acb\u5148\u9078\u64c7\u98ef\u91cf\u8207\u6e6f\u54c1';

    if (el('wokCookDoneBtn')) {
      el('wokCookDoneBtn').disabled = !canPlateDish;
    }
    el('riceHalfBtn').disabled=el('riceFullBtn').disabled=!(c.stage>=3&&!c.plated);
    el('heatBtn').disabled = !c.atWok || (c.stage < 3) || !!c.plated;
    el('addBtn').disabled = !c.atWok || (c.stage < 3) || !!c.plated || !!window.isPlating || !!window.wok?.hasFood || window.wok?.flame === 'off';
    el('stirBtn').disabled = !c.atWok || (c.stage < 3) || !!c.plated || !!window.isPlating || !window.wok?.hasFood;
    const canCut = c.selectedFood && !window.prepped?.has(c.selectedFood) && !window.inWok?.has(c.selectedFood);
    el('cutBtn').disabled = !c.atPrep || (c.stage < 3) || !!c.plated || !canCut;

    // Update tray preview info
    if (el('platedDishPreview')) {
      const riceLabel =
        cookedDish.ricePortion === '\u672a\u76db\u98ef'
          ? '\u767d\u98ef\uff1a\u5c1a\u672a\u9078\u64c7'
          : '\u767d\u98ef\uff1a' + cookedDish.ricePortion;

      const soupLabel =
        cookedDish.misoChoice === null ||
        cookedDish.misoChoice === undefined
          ? '\u5473\u564c\u6e6f\uff1a\u5c1a\u672a\u9078\u64c7'
          : cookedDish.misoChoice
            ? '\u5473\u564c\u6e6f\uff1a\u8981'
            : '\u5473\u564c\u6e6f\uff1a\u4e0d\u8981';

      text(
        'trayStatusText',
        riceLabel + ' | ' + soupLabel
      );
    }

    const key=[number,who.id,p.spicy,p.scallion,p.rice,p.miso,s.status,c.stage,station,c.rice,c.miso,c.heated,cookedDish.isSimmered,c.plated].join('|');
    if(key!==last){
      last=key;text('clinicNumber',numberText(number));text('clinicName',who.name);
      text('clinicStatus',s.status==='won'?'共餐成功':s.status==='lost'?'翻桌待重試':s.status==='active'?'製作中':'已叫號');
      text('clinicWish',`「${who.complaint || who.wish || '今日依症狀調整料理份量。'}」`);text('clinicPreferences','');
      text('clinicNext',`${numberText(number+1)}　${patients[(patientIndex+1)%patients.length].name} · 候診中`);
      text('clinicOrderSummary',`${numberText(number)} ${who.name}｜依症狀處方備餐`);
      const instructions=[
        '點擊「確認處方開單」開始備料，或走到病人椅 (X: -10.5) 按 E 問診。',
        '需求已記錄。請前往備料檯 (X: 5.0) 準備食材。',
        '前往備料檯 (X: 5.0) 選料與份量，接著到炒鍋爐台全料下鍋。',
        '在備料檯選定食材份量，點擊全料下鍋走向炒鍋。',
        '炒鍋翻炒與大小火收汁，完成後盛盤裝托盤。',
        '已盛盤！醫師正端著托盤走回診間交給病人 (X: -10.5)。',
        '端著托盤走回診間病人椅按 E 交餐給病人品嚐。',
        '病患品嚐完成。'
      ];
      text('clinicInstruction',instructions[c.stage]||'依目前工作站製作料理。');
      text('clinicGo',c.stage===0?'走向病人 · E 問診':c.plated?'走回診間 · E 交餐':'繼續料理');
      el('clinicGo').dataset.target=c.stage===0?'consult':c.plated?'consult':'prep';
      text('clinicServeNote',c.plated?'已盛入托盤！醫師自動端餐走回診間送餐給病人。':!cookedDish.isSimmered?'請先在炒鍋完成4等效秒收汁。':c.rice==='未盛飯'?'請依病人偏好選擇白飯份量。':'完成配餐後點擊盛盤裝托盤，自動端回診間。');
    }
    if(result&&s.status==='won')el('sessionOverlay').hidden=true;
  }
  window.updateCooking=function(){original.cook();render();};
  CKShift.tick=function(dt,dialogOpen){original.tick.call(CKShift,dt,dialogOpen);original.cook();render();};

  function onConfirmConsult() {
    const p = preference();
    const rx = prescription();

    currentOrder = {
      spicy: p.spicy,
      scallion: p.scallion,
      rice: rx.rice,
      miso: rx.miso
    };
    syncOrderTicketUI();
    if (el('ticketMiso')) el('ticketMiso').textContent = currentOrder.miso ? '附味噌湯' : '不要湯';
    // R8: lock tofu and pork at 1 (fixed ingredients)
    if (window.setPortion) { window.setPortion('tofu', 1); window.setPortion('pork', 1); }
    if (window.preparedTray) { window.preparedTray.tofu = 1; window.preparedTray.pork = 1; }
    setStage(STAGES.PREP);
    CKShift.begin();
    cookLog(`已確認開立料理處方：${summary(currentOrder)}，前往備料檯 (X: 5.0) 備料`);
    if (window.autoWalkTo) {
      window.autoWalkTo('prep', () => selectPanel('prep'));
    } else {
      selectPanel('prep');
    }
    render();
  }

  function onPrepDone() {
    if (CKShift.isFrozen()) return;

    // PREP completion is an automatic batch transfer. Do not click #addBtn here:
    // at this moment the doctor is still at PREP, so the WOK proximity guard
    // correctly rejects that click and leaves the visual inWok state empty.
    if (!window.wok?.hasFood) {
      if (window.CKClinicRules?.addBatchToWok) {
        window.CKClinicRules.addBatchToWok(window.wok, window.preparedTray);
      } else {
        window.wok.contents = { ...window.preparedTray };
        window.wok.hasFood = true;
      }
    }
    if (window.syncWokFoodStateFromContents) {
      window.syncWokFoodStateFromContents();
    }
    if (window.wok && window.wok.flame === 'off') {
      window.wok.flame = 'low';
    }
    setStage(STAGES.COOK);
    cookLog('備料完成：食材已自動下鍋並以小火預熱，前往炒鍋翻炒。');
    if (window.autoWalkTo) {
      window.autoWalkTo('wok', () => selectPanel('wok'));
    } else {
      selectPanel('wok');
    }
    render();
  }

  function onWokCookDone() {
    if (CKShift.isFrozen()) return;
    let guard = 0;
    while (window.wok?.flame !== 'off' && guard < 3) {
      if (!el('heatBtn')?.disabled) el('heatBtn').click();
      else break;
      guard++;
    }
    if (getMissionStage() < STAGES.PLATE) setStage(STAGES.PLATE);
    cookLog('收汁完成並關火：前往配餐檯選擇白飯與味噌湯。');
    if (window.autoWalkTo) {
      window.autoWalkTo('serve', () => selectPanel('serve'));
    } else {
      selectPanel('serve');
    }
    render();
  }
  let finishOpenedAt = 0;

  function onPlate() {
    const c=getCookingStatus();
    if(CKShift.isFrozen()||window.isPlating) return;
    if(c.plated) {
      // Dish already plated into tray; clicking sends doctor back to consult
      if (window.autoWalkTo) {
        window.autoWalkTo('consult', () => deliver());
      }
      return;
    }
    window.isPlating = true;
    if(
      cookedDish.ricePortion === '\u672a\u76db\u98ef' ||
      cookedDish.misoChoice === null ||
      cookedDish.misoChoice === undefined
    ){
      $('log').textContent =
        '\u8acb\u5148\u9078\u64c7\u767d\u98ef\u4efd\u91cf\u8207\u5473\u564c\u6e6f\u3002';
      return;
    }
    setTimeout(() => {
      window.isPlating = false;
      c.plated = true;
      window.plated = true;
      if(window.setCarryingTray) window.setCarryingTray(true);
      setStage(STAGES.SERVE);
      cookLog('麻婆豆腐已盛入托盤！請端著托盤走回診間 (X: -10.5) 按 E 送餐給病人');
      $('log').textContent = '盛盤完成！端著托盤走回診間病人椅按 E 送餐';
      if (el('platedDishPreview')) el('platedDishPreview').hidden = false;
      render();
      if (window.autoWalkTo) {
        window.autoWalkTo('consult', () => deliver());
      }
    }, 300);
  }

  function deliver(){
    const c=getCookingStatus(), st=getSceneStatus();
    const atConsult = st.interactiveTarget?.id==='consult' || Math.abs(st.playerPos.x - (-10.5)) <= 2.2;
    if(!atConsult){
      $('log').textContent = '未到病人旁：請端著托盤走回最左側診間 (X: -10.5) 才能交餐！';
      return;
    }
    if(!c.plated || CKShift.isFrozen()) return;

    // Freeze player & carrying state
    keys.clear();
    window.setCarryingTray(false);
    if(window.setPatientDishVisible) window.setPatientDishVisible(true);
    window.stopShiftCooking?.();

    const who = person();
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
      miso: cookedDish.misoChoice === true
    };

    result = evaluateR8 ? evaluateR8(currentOrder, dishSnapshot, who) : evaluateR6(currentOrder, dishSnapshot);
    const quality = result.quality;
    const hardFail = result.hardFail || false;
    const afterCraving = Math.max(0, Number((beforeCraving * (1 - 0.5 * quality / 100)).toFixed(1)));
    const mealOutcome = calculateMealOutcome({ beforeCraving, afterCraving, metricMode: 'relative' });
    const won = hardFail ? false : mealOutcome.success;

    const clinicalOutcome = calculateClinicalMetrics(who.clinicalStatus, quality, result.checks, currentOrder, dishSnapshot);
    const patientReview = generatePatientReview(who, quality, result.checks, dishSnapshot, won);

    CKShift.finishR6({ won, quality, cravingBefore: beforeCraving, cravingAfter: afterCraving });
    setStage(STAGES.FIRST_BITE);

    // Update left HUD FTND (read-only, never modified by meal)
    // FTND stays unchanged — intentional by design
    // Update left HUD: R8 withdrawal symptoms before→after
    const r8Before = clinicalOutcome.before;
    const r8After = clinicalOutcome.after;
    const r8Metrics = ['craving','irritability','anxiety','concentration','restlessness','appetite','sleep'];
    r8Metrics.forEach(m => {
      const met = clinicalOutcome.metrics[m];
      if (!met) return;
      const textEl = el(`${m}Text`);
      const meterEl = el(`${m}Meter`);
      const deltaEl = el(`${m}Delta`);
      if (textEl) textEl.textContent = met.after.toFixed(1);
      if (meterEl) meterEl.value = met.after;
      if (deltaEl) {
        // All R8 symptoms: lower is better, so negative delta = improvement
        const isGood = met.delta <= 0;
        const sign = met.delta > 0 ? '+' : '';
        deltaEl.textContent = `${sign}${met.delta.toFixed(1)}`;
        deltaEl.className = `metric-delta ${isGood ? 'good' : 'bad'}`;
      }
    });

    // Top scene dual finale
    if (window.setTopFinale) {
      window.setTopFinale(won ? 'feast' : 'flip');
    }

    text('clinicResultTitle', won ? `${numberText(number)} 號 ${who.name} · 菸癮舒緩成功！` : `${numberText(number)} 號 ${who.name} · 料理未達標！`);
    text('patientReviewQuote', patientReview.quote || (patientReview.review ? `「${patientReview.review}」` : ''));
    text('clinicResultMessage', hardFail
      ? `【Gate B 未通過】${result.hardFailReason || '處方符合度不足 70%'}，藥膳調味與症狀嚴重度不符，無法有效舒緩戒斷反應！`
      : won
        ? '「菸癮被壓住了！熱騰騰的麻婆豆腐與精準的症狀調味，讓緊繃的戒斷感平靜下來！」'
        : '「這根本沒有對到我的症狀！調味完全不符合我的戒斷狀況！」病人憤怒翻桌！');
    text('subNumbing', patientReview.numbing || '-');
    text('subComfort', patientReview.comfort || '-');
    text('subSatiety', patientReview.satiety || '-');
    text('subMental', patientReview.mental || '-');
    text('clinicQuality', `${quality}%`);
    text('patientComfortScore', `${clinicalOutcome.comfortScore} 分`);

    // Update subjective chip labels to R8 withdrawal-focused
    const subChips = document.querySelectorAll('.subjective-grid .sub-chip');
    const r8Labels = ['菸癮緩解：', '身心舒緩：', '口感接受：', '煩躁緩解：'];
    subChips.forEach((chip, i) => {
      if (r8Labels[i]) {
        const b = chip.querySelector('b');
        const label = r8Labels[i];
        const existingB = b ? b.outerHTML : '';
        chip.innerHTML = label + existingB;
      }
    });

    const s = CKShift.snapshot();
    const fidText = result.prescriptionFidelity !== undefined ? ` · 處方符合度 ${result.prescriptionFidelity}%` : '';
    const gateText = result.gateB_pass === false ? ' · Gate B ❌' : (result.gateB_pass === true ? ' · Gate B ✓' : '');
    text('clinicAward', won
      ? `舒壓達標（降幅 ${(clinicalOutcome.relativeReduction * 100).toFixed(1)}% ≥ 25%）${fidText}${gateText} · +${s.lastEarned} 分 · 連勝 ${s.streak}`
      : `未達舒壓門檻（降幅 ${(clinicalOutcome.relativeReduction * 100).toFixed(1)}% < 25%）${fidText}${gateText} · 連勝歸零`);

    el('clinicComparison').innerHTML = result.checks.map(c => `<tr><th>${c.label}</th><td>${c.expected}</td><td>${c.actual}</td><td class="${c.ok ? 'match' : 'mismatch'}">${c.ok ? '符合' : '−' + c.penalty + '%'}</td></tr>`).join('');
    text('clinicBonus', CKRush.resultText() + (CKRush.snapshot().mode === 'rush' ? ` · 本班 ${CKRush.snapshot().sessionPoints} 分` : ''));
    text('clinicNextBtn', CKRush.snapshot().complete ? '三單完成 · 再開一班' : '叫下一號');

    el('sessionOverlay').hidden = true;
    finishOpenedAt = performance.now();
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
            <p class="clinic-consult-wish">「${who.complaint||who.wish||summary(p)}」</p>
            <p><strong>問診主訴與處方明細：</strong></p>
            <ul>
              <li>辣度偏好：【${p.spicy==='正常'?'正宗川味（正常辣）':p.spicy}】</li>
              <li>青蔥配置：【${p.scallion?'翠綠蔥花提香':'純粹豆腐（不要蔥）'}】</li>
              <li>越光米飯：【${p.rice}】</li>
              <li>暖心湯品：【${p.miso?'附熱味噌湯':'免附湯品'}】</li>
            </ul>
            <p><em>左側已鎖定 7 項臨床身心基準指標，點擊確認處方後醫師將自動走往備料檯。</em></p>
          `,
          confirmText:'確認處方開單並前往備料 (Enter / E)',
          onConfirm:()=>{
            onConfirmConsult();
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

  function resetCurrentPatient(){
    if(finish.open)finish.close();
    result=null;

    if(window.setTopFinale)window.setTopFinale(null);

    original.reset();

    last='';
    previousStation='';
    selectPanel('prep');
    announce();
  }

  function advanceToNextPatient(){
    number++;
    patientIndex=(patientIndex+1)%patients.length;
    resetCurrentPatient();
  }

  // R / restart keeps the current patient.
  window.resetAll=resetCurrentPatient;

  el('clinicPlateBtn').addEventListener('click', onPlate);

  // Next-patient action always advances after success or failure.
  el('clinicNextBtn').addEventListener('click',advanceToNextPatient);
  finish.addEventListener('cancel',e=>e.preventDefault());
  finish.addEventListener('keydown',e=>{
    if(['Enter','e','E'].includes(e.key)&&!e.repeat){
      if(performance.now()-finishOpenedAt < 500){
        e.preventDefault();
        return;
      }
      e.preventDefault();e.stopPropagation();el('clinicNextBtn').click();
    }
  });
  el('clinicGo').addEventListener('click',()=>{
    const t=el('clinicGo').dataset.target;
    document.querySelector(`[data-station="${t}"]`)?.click();
  });
  el('consultConfirmBtn').addEventListener('click', onConfirmConsult);
  if (el('prepDoneBtn')) el('prepDoneBtn').addEventListener('click', onPrepDone);
  if (el('wokCookDoneBtn')) el('wokCookDoneBtn').addEventListener('click', onWokCookDone);

  // Wire portion pills in tray
  document.querySelectorAll('.portion-pill').forEach(pill => {
    pill.addEventListener('click', e => {
      e.stopPropagation();
      const food = pill.dataset.food;
      const portion = Number(pill.dataset.portion);
      if (window.setPortion) window.setPortion(food, portion);
    });
  });

  el('rushMode').addEventListener('click',()=>announce());
  el('doctorDialog').addEventListener('close',()=>el('world').focus({preventScroll:true}));
  window.CKClinic={
    snapshot:()=>({
      number,
      patient:{...person()},
      order:{...currentOrder},
      prescription:JSON.parse(JSON.stringify(prescription())),
      panel,
      result:result&&JSON.parse(JSON.stringify(result)),
      resultOpen:finish.open
    }),
    deliver,
    render,
    onConfirmConsult
  };
  selectPanel('prep');announce();
})();
