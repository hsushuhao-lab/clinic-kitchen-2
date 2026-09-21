/* R7 clinical-workflow layer.
   Gameplay remains fictional: symptom values are game-state indicators, not diagnostic scales,
   and the food/prescription metaphor is not medical treatment advice. */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const profiles={
    office:{complaint:'最近工作壓力很大，腦中一直想著抽菸，坐著也很難專心。',anxiety:72,impulsivity:61,language:92,memory:76,sleepiness:44},
    student:{complaint:'報告快到期了，越焦躁越想抽菸，注意力一直被打斷。',anxiety:66,impulsivity:58,language:94,memory:71,sleepiness:55},
    driver:{complaint:'跑車久了很煩躁，休息時最容易突然想抽一根。',anxiety:48,impulsivity:74,language:86,memory:82,sleepiness:63},
    auntie:{complaint:'最近睡不好又心煩，嘴饞和想抽菸的感覺一起上來。',anxiety:64,impulsivity:42,language:90,memory:78,sleepiness:68},
    quiet:{complaint:'不太想說話，但心裡一直有一股想抽菸的念頭，很難轉移注意。',anxiety:55,impulsivity:39,language:74,memory:84,sleepiness:46},
    repeat:{complaint:'今天又來了，知道會過去，但 craving 上來時還是很難忍住。',anxiety:51,impulsivity:69,language:93,memory:88,sleepiness:41}
  };
  const burden=new Set(['CRAVING','ANXIETY','IMPULSIVITY','SLEEPINESS']);
  let activeFood='tofu', routedStage=null, deliveryWatch=0, consultWatch=0;

  function patientId(){
    return window.CKClinic?.snapshot?.().patient?.id || 'office';
  }
  function values(){
    const round=window.CKShift?.snapshot?.()||{};
    return {
      CRAVING:Math.round(round.craving ?? 40),
      FOCUS:Math.round(round.focus ?? 24),
      ANXIETY:profiles[patientId()]?.anxiety ?? 50,
      IMPULSIVITY:profiles[patientId()]?.impulsivity ?? 50,
      LANGUAGE:profiles[patientId()]?.language ?? 80,
      MEMORY:profiles[patientId()]?.memory ?? 80,
      SLEEPINESS:profiles[patientId()]?.sleepiness ?? 45
    };
  }
  function metricMarkup(v){
    return Object.entries(v).map(([k,n])=>'<div class="clinical-metric" data-burden="'+String(burden.has(k))+'"><b>'+k+'</b><span class="clinical-bar"><i style="--value:'+n+'%"></i></span><output>'+n+'</output></div>').join('');
  }
  function ensureObservation(){
    if(!$('clinicalObservation')){
      const box=document.createElement('section');
      box.id='clinicalObservation';box.className='clinical-observation';
      box.innerHTML='<header><strong>個案狀態觀察</strong><small>遊戲指標 0–100</small></header><div id="clinicalMetricRows"></div>';
      const anchor=document.querySelector('#patientHUD .clinic-next') || $('patientHUD').lastElementChild;
      $('patientHUD').insertBefore(box,anchor);
    }
    $('clinicalMetricRows').innerHTML=metricMarkup(values());
  }
  function ensureConsultCard(){
    if(!$('clinicalConsultCard')){
      const card=document.createElement('div');card.id='clinicalConsultCard';
      card.innerHTML='<section class="clinical-chief-complaint"><small>主訴 CHIEF COMPLAINT</small><blockquote id="clinicalComplaint"></blockquote></section><section class="clinical-snapshot-card"><small>OBSERVATION SNAPSHOT</small><div class="clinical-observation"><div id="clinicalConsultMetrics"></div></div></section>';
      $('clinicWelcome').insertBefore(card,$('clinicGo'));
    }
    const p=profiles[patientId()]||profiles.office;
    $('clinicalComplaint').textContent='「'+p.complaint+'」';
    $('clinicalConsultMetrics').innerHTML=metricMarkup(values());
    $('clinicWelcome').querySelector('small').textContent='EMR 問診 · 聽主訴並觀察個案狀態';
    $('clinicWelcome').querySelector('h2').textContent='先在電腦前完成問診，再依料理處方備料。';
    $('clinicGo').textContent='開始問診';
  }
  function ensurePortionPicker(){
    if($('visualPortionPicker')) return;
    const picker=document.createElement('div');picker.id='visualPortionPicker';
    picker.innerHTML='<strong id="portionFoodName">豆腐份量</strong><button class="visual-portion" data-portion="0" type="button">○ 不放</button><button class="visual-portion" data-portion="0.5" type="button">◐ 半份</button><button class="visual-portion" data-portion="1" type="button">● 一份</button>';
    const tray=document.querySelector('#panel-prep .ingredient-tray');
    tray.after(picker);
    document.querySelectorAll('#panel-prep .ingredient-tray button[data-food]').forEach(btn=>btn.addEventListener('click',()=>{activeFood=btn.dataset.food;renderPortionPicker();}));
    picker.querySelectorAll('[data-portion]').forEach(btn=>btn.addEventListener('click',()=>{
      const target=Number(btn.dataset.portion);
      let guard=0;
      while(window.preparedTray?.[activeFood]!==target && guard++<4) window.cyclePortion?.(activeFood);
      renderPortionPicker();
    }));
    renderPortionPicker();
  }
  function renderPortionPicker(){
    if(!$('visualPortionPicker')) return;
    const names={tofu:'豆腐',pork:'絞肉',douban:'豆瓣醬',garlic:'蒜頭',scallion:'青蔥',pepper:'花椒'};
    $('portionFoodName').textContent=(names[activeFood]||activeFood)+'份量';
    const current=window.preparedTray?.[activeFood] ?? 0;
    $('visualPortionPicker').querySelectorAll('[data-portion]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.portion)===current)));
  }
  function goTo(id){
    const btn=document.querySelector('[data-station="'+id+'"]');
    if(btn && !window.CKShift?.isFrozen?.()) btn.click();
  }
  function autoConsult(){
    clearInterval(consultWatch);
    goTo('consult');
    consultWatch=setInterval(()=>{
      const st=window.getSceneStatus?.();
      if(st?.interactiveTarget?.id==='consult'){
        clearInterval(consultWatch);consultWatch=0;
        window.handleInteraction?.('consult');
      }
    },120);
    setTimeout(()=>{if(consultWatch){clearInterval(consultWatch);consultWatch=0;}},10000);
  }
  function autoDeliver(){
    clearInterval(deliveryWatch);
    goTo('consult');
    deliveryWatch=setInterval(()=>{
      const st=window.getSceneStatus?.(),c=window.getCookingStatus?.();
      if(st?.interactiveTarget?.id==='consult' && c?.plated){
        clearInterval(deliveryWatch);deliveryWatch=0;
        window.CKClinic?.deliver?.();
      }
    },120);
    setTimeout(()=>{if(deliveryWatch){clearInterval(deliveryWatch);deliveryWatch=0;}},12000);
  }
  function onStage(){
    const stage=Number($('cookingDeck')?.dataset.clinicStage);
    if(!Number.isFinite(stage) || stage===routedStage) return;
    routedStage=stage;
    if(stage===3){document.querySelector('[data-clinic-panel="prep"]')?.click();goTo('prep');}
    if(stage===4){document.querySelector('[data-clinic-panel="wok"]')?.click();goTo('wok');}
    if(stage===5){document.querySelector('[data-clinic-panel="serve"]')?.click();goTo('serve');}
    if(stage===6)setTimeout(autoDeliver,150);
    ensureObservation();ensureConsultCard();renderPortionPicker();
  }
  function ensureResultRating(){
    const dlg=$('clinicResult');if(!dlg||!dlg.open) return;
    let box=$('patientSelfRating');
    if(!box){box=document.createElement('section');box.id='patientSelfRating';const score=dlg.querySelector('.clinic-result-score');score?.after(box);}
    const snap=window.CKClinic?.snapshot?.(),result=snap?.result,quality=Math.round(result?.quality||0);
    const checks=result?.checks||[];
    const spicy=checks.find(x=>x.label==='辣度調味');
    const mala=spicy?.ok?5:Math.max(1,Math.round(quality/25));
    const taste=Math.max(1,Math.min(5,Math.round(quality/20)));
    const relief=Math.max(1,Math.min(5,Math.round((quality*0.5)/10)));
    const overall=Math.max(1,Math.min(5,Math.round((taste+relief)/2)));
    const words=['','完全沒有','一點點','普通','有改善','很明顯'];
    box.innerHTML=
      '<div class="patient-rating-card"><small>麻感合不合口味</small><strong>'+mala+' / 5</strong></div>'+
      '<div class="patient-rating-card"><small>整體味道</small><strong>'+taste+' / 5</strong></div>'+
      '<div class="patient-rating-card"><small>吃完舒服一點嗎</small><strong>'+relief+' / 5</strong></div>'+
      '<div class="patient-rating-card"><small>整體滿意</small><strong>'+overall+' / 5</strong></div>'+
      '<p id="patientReliefNote">病人主觀回饋：「'+words[relief]+'。」這是虛構角色的遊戲回饋，不代表真實症狀治療效果。</p>';
  }

  $('clinicGo')?.addEventListener('click',e=>{
    const stage=Number($('cookingDeck')?.dataset.clinicStage);
    if(stage===0){e.preventDefault();e.stopImmediatePropagation();autoConsult();}
  },true);


  // Clicking/auto-routing to a workstation always exposes its lower interaction panel immediately.
  document.querySelectorAll('[data-station]').forEach(btn=>btn.addEventListener('click',()=>{
    const id=btn.dataset.station;
    if(['prep','wok','serve'].includes(id)) document.querySelector('[data-clinic-panel="'+id+'"]')?.click();
  }));

  const deck=$('cookingDeck');
  if(deck)new MutationObserver(onStage).observe(deck,{attributes:true,attributeFilter:['data-clinic-stage','data-panel']});
  const result=$('clinicResult');
  if(result)new MutationObserver(()=>{ensureResultRating();ensureObservation();}).observe(result,{attributes:true,attributeFilter:['open','data-satisfaction']});

  // Keep the left clinical values current while craving/focus change.
  setInterval(()=>{ensureObservation();if($('clinicResult')?.open)ensureResultRating();},750);
  ensureObservation();ensureConsultCard();ensurePortionPicker();onStage();
})();
