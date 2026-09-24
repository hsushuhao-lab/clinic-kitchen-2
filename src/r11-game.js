/* R11 M5: doctor select + consult + deliberate prep + manual wok + serve/delivery/result + patient pressure/failure. */
(() => {
  'use strict';
  const rules=window.CKClinicRules;
  const world=window.CKR11World;
  if(!rules||!world) throw new Error('R11 dependencies missing');

  const $=id=>document.getElementById(id);
  const stagePanel=$('stagePanel');
  const gameMain=$('gameMain');
  const statusBar=$('statusBar');
  const rail=$('patientRail');
  const railToggle=$('patientRailToggle');
  const soundToggle=$('soundToggle');
  const eventOverlay=$('eventOverlay');
  const eventArt=$('eventArt');
  const eventKicker=$('eventKicker');
  const eventTitle=$('eventTitle');
  const eventBody=$('eventBody');
  const eventDismissBtn=$('eventDismissBtn');
  const introOverlay=$('introOverlay');
  const introArt=$('introArt');
  const introKicker=$('introKicker');
  const introTitle=$('introTitle');
  const introBody=$('introBody');
  const introProgress=$('introProgress');
  const introNextBtn=$('introNextBtn');
  const introSkipBtn=$('introSkipBtn');
  const introReplayBtn=$('introReplayBtn');
  const mobilePatientPortrait=$('mobilePatientPortrait');
  const mobilePatientName=$('mobilePatientName');
  const mobilePatientSpeech=$('mobilePatientSpeech');
  const patientInterference=$('patientInterference');
  const foodOrder=['tofu','pork','douban','garlic','scallion','chili','pepper'];
  const food={
    tofu:{name:'豆腐',target:'Craving',symptom:'craving',img:'assets/ingredients/mapo_tofu/tofu.png',wok:'assets/cooking/tofu_cubes.png'},
    pork:{name:'絞肉',target:'Appetite',symptom:'appetite',img:'assets/ingredients/mapo_tofu/pork.png',wok:'assets/cooking/pork_raw_mound.png'},
    douban:{name:'豆瓣醬',target:'Craving',symptom:'craving',img:'assets/ingredients/mapo_tofu/douban.png',wok:'assets/ingredients/mapo_tofu/douban.png'},
    garlic:{name:'蒜末',target:'Irritability',symptom:'irritability',img:'assets/ingredients/mapo_tofu/garlic.png',wok:'assets/cooking/garlic_mince.png'},
    scallion:{name:'青蔥',target:'Concentration',symptom:'concentration',img:'assets/ingredients/mapo_tofu/scallion.png',wok:'assets/cooking/scallion_rings.png'},
    chili:{name:'辣椒',target:'Restlessness',symptom:'restlessness',img:'assets/ingredients/mapo_tofu/chili.png',wok:'assets/ingredients/mapo_tofu/chili.png'},
    pepper:{name:'花椒',target:'Anxiety',symptom:'anxiety',img:'assets/ingredients/mapo_tofu/pepper.png',wok:'assets/ingredients/mapo_tofu/pepper.png'}
  };
  const doctors={
    speed:{id:'speed',name:'DR. SPEED',tag:'快速料理',ability:'病人煩躁累積速度 −15%',detail:'適合把整段流程壓快。',sprite:'assets/chibi/speed.webp',art:'assets/r11/doctors/doctor_speed.webp',bump:'assets/r11/doctors/doctor_speed_bump.webp'},
    heat:{id:'heat',name:'DR. HEAT',tag:'火候專家',ability:'收汁 PERFECT 判定窗口 +50%',detail:'PERFECT 收汁窗口由 1.0 秒擴大為 1.5 秒。',sprite:'assets/chibi/heat.webp',art:'assets/r11/doctors/doctor_heat.webp',bump:'assets/r11/doctors/doctor_heat_bump.webp'},
    strategy:{id:'strategy',name:'DR. STRATEGY',tag:'配料專家',ability:'小幅配料偏差扣分降低',detail:'半份偏差 -3；整份偏差 -12，提升處方容錯。',sprite:'assets/chibi/strategy.webp',art:'assets/r11/doctors/doctor_strategy.webp',bump:'assets/r11/doctors/doctor_strategy_bump.webp'}
  };
  const symptomMeta=[
    ['craving','Craving','菸癮'],['irritability','Irritability','煩躁'],['anxiety','Anxiety','焦慮'],['concentration','Concentration','注意力'],['restlessness','Restlessness','坐立難安'],['appetite','Appetite','食慾'],['sleep','Sleep','睡眠']
  ];
  const difficulties={
    easy:{id:'easy',name:'實習醫 · EASY',tag:'穩定值班',detail:'症狀與建議份量完整顯示。'},
    normal:{id:'normal',name:'主治醫 · NORMAL',tag:'正常夜班',detail:'症狀資訊完整，病人等待照常累積。'},
    hard:{id:'hard',name:'夜班急診 · HARD',tag:'高壓值班',detail:'病人更沒耐心，煩躁速度 +20%。'}
  };
  const INTRO_KEY='clinic_kitchen_intro_seen_v11';
  const introSeenAtLoad=(()=>{try{return localStorage.getItem(INTRO_KEY)==='true';}catch(_){return false;}})();
  const blankPortions=()=>Object.fromEntries(foodOrder.map(id=>[id,0]));
  const blankTouched=()=>Object.fromEntries(foodOrder.map(id=>[id,false]));
  const state={
    version:'R11_INTERACTIVE_KITCHEN_M5',ticket:1,patientIndex:0,doctor:null,difficulty:'easy',stage:'doctor-select',traveling:false,
    portions:blankPortions(),touched:blankTouched(),activeFood:'tofu',prepResult:null,
    irritation:0,paused:document.hidden,lastTick:performance.now(),gameOver:false,
    heatLevel:'off',wokPhase:'heat',stirCount:0,stirPulse:false,dropPulse:false,lastStirAt:0,lastDropAt:0,heatSamples:[],dropIndex:0,dropScores:[],combo:0,maxCombo:0,lastStirTiming:'',microEvent:null,eventSchedule:[],rescuedEvents:0,eventMisses:0,actionFeedback:'',simmerSeconds:0,simmerQuality:null,cookingResult:null,
    rice:null,miso:null,serviceResult:null,finalResult:null,won:null,ordersCompleted:0,streak:0,
    musicEnabled:true,cutInActive:false,complaintShown:{55:false,75:false,90:false},
    nextInterferenceAt:0,interferenceText:'',
    introStep:0,introFinished:false,introSeen:introSeenAtLoad,introReplay:false
  };

  const introSlides=[
    {art:'assets/r11/intro/title.webp',alt:'Clinic Kitchen 遊戲封面',kicker:'CLINIC KITCHEN',title:'MAPO RESCUE SHIFT',body:'夜班開始。候診區已經坐滿人，今晚沒有慢慢來的空間。',button:'PRESS START ▶'},
    {art:'assets/r11/intro/intro01.webp',alt:'夜班開始的診所等待區',kicker:'INTRO 01 · NIGHT SHIFT',title:'病人開始不耐煩',body:'門診還沒結束，飢餓和戒菸不適一起累積。先看懂病人，再決定怎麼下料。',button:'點擊繼續 →'},
    {art:'assets/r11/events/complaint_55.webp',alt:'病人催單與抱怨',kicker:'INTRO 02 · PRESSURE',title:'他們會一直催你',body:'備料、炒鍋、配餐途中，病人的抱怨會不斷插進來。別讓節奏被打亂。',button:'我知道了 →'},
    {art:'assets/r11/intro/intro02.webp',alt:'醫師進入廚房準備麻婆豆腐',kicker:'INTRO 03 · YOUR MISSION',title:'在煩躁度爆表前完成出餐',body:'看症狀分數、選份量、穩住炒鍋，最後把餐點送到病人面前。',button:'開始值班 ▶'}
  ];
  function renderIntro(){
    const s=introSlides[state.introStep]||introSlides[0];
    introArt.src=s.art;introArt.alt=s.alt;introKicker.textContent=s.kicker;introTitle.textContent=s.title;introBody.textContent=s.body;introNextBtn.textContent=s.button;
    Array.from(introProgress.children).forEach((dot,i)=>dot.classList.toggle('is-active',i===state.introStep));
  }
  function markIntroSeen(){
    state.introSeen=true;
    try{localStorage.setItem(INTRO_KEY,'true');}catch(_){}
  }
  function finishIntro(){
    markIntroSeen();state.introReplay=false;state.introFinished=true;introOverlay.hidden=true;statusBar.textContent='SHIFT START · 選擇值班醫師';stagePanel.querySelector('.doctor-card')?.focus();
  }
  function advanceIntro(){
    if(state.introSeen&&!state.introReplay&&state.introStep===0){finishIntro();return;}
    if(state.introStep<introSlides.length-1){state.introStep+=1;renderIntro();return;}
    finishIntro();
  }
  function replayIntro(){
    state.introReplay=true;state.introFinished=false;state.introStep=0;introOverlay.hidden=false;renderIntro();
  }
  introNextBtn?.addEventListener('click',advanceIntro);
  introSkipBtn?.addEventListener('click',finishIntro);
  introReplayBtn?.addEventListener('click',replayIntro);

  const complaintEvents={
    55:{art:'assets/r11/events/complaint_55.webp',kicker:'PATIENT ALERT · 55%',title:'病人在催單！',body:'動作快一點，煩躁度正在上升。'},
    75:{art:'assets/r11/events/complaint_75.webp',kicker:'COMPLAINT EVENT · 75%',title:'抱怨升級！',body:'火候與節奏別亂，病人已經很不耐煩。'},
    90:{art:'assets/r11/events/complaint_90.webp',kicker:'FINAL WARNING · 90%',title:'最後警告！',body:'病人快離開了，立刻完成訂單！'}
  };
  let audioCtx=null,musicTimer=null,musicStep=0;

  function musicInterval(){return state.irritation>=90?210:state.irritation>=75?285:state.irritation>=55?370:520;}
  function scheduleTone(freq,dur=.08,vol=.018,type='square'){
    if(!audioCtx||!state.musicEnabled)return;
    const o=audioCtx.createOscillator(),g=audioCtx.createGain(),t=audioCtx.currentTime;
    o.type=type;o.frequency.setValueAtTime(freq,t);
    g.gain.setValueAtTime(Math.max(.0001,vol),t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g);g.connect(audioCtx.destination);o.start(t);o.stop(t+dur+.01);
  }
  function musicBeat(){
    if(!audioCtx||!state.musicEnabled){musicTimer=null;return;}
    const seq=[196,220,196,247,196,262,220,247];
    scheduleTone(seq[musicStep%seq.length],.075,.015,'square');
    if(state.irritation>=55&&musicStep%2===0)scheduleTone(state.irritation>=90?523:392,.05,.009,'sawtooth');
    if(state.irritation>=75&&musicStep%4===3)scheduleTone(98,.11,.02,'triangle');
    musicStep=(musicStep+1)%seq.length;
    musicTimer=setTimeout(musicBeat,musicInterval());
  }
  function startMusic(){
    if(!state.musicEnabled)return;
    try{
      const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;
      if(!audioCtx)audioCtx=new Ctx();
      audioCtx.resume?.();
      if(!musicTimer)musicBeat();
    }catch(_){}
    renderSoundToggle();
  }
  function stopMusic(){if(musicTimer)clearTimeout(musicTimer);musicTimer=null;}
  function renderSoundToggle(){
    if(!soundToggle)return;
    soundToggle.setAttribute('aria-pressed',String(state.musicEnabled));
    soundToggle.textContent=state.musicEnabled?'♪ 緊張音樂 ON':'♪ 音樂 OFF';
  }
  function toggleMusic(){
    state.musicEnabled=!state.musicEnabled;
    if(state.musicEnabled)startMusic();else stopMusic();
    renderSoundToggle();
  }
  function playVictoryJingle(){
    stopMusic();
    if(!state.musicEnabled||!audioCtx)return;
    [523,659,784,1047].forEach((f,i)=>setTimeout(()=>scheduleTone(f,.18,.028,'triangle'),i*130));
  }
  function playFailureSting(){
    stopMusic();
    if(!state.musicEnabled||!audioCtx)return;
    [220,165,110].forEach((f,i)=>setTimeout(()=>scheduleTone(f,.18,.025,'sawtooth'),i*120));
  }
  soundToggle?.addEventListener('click',toggleMusic);

  function showComplaintCutIn(level){
    level=Number(level);
    const meta=complaintEvents[level];
    if(!meta||state.complaintShown[level]||state.gameOver)return false;
    Object.keys(complaintEvents).forEach(k=>{if(Number(k)<=level)state.complaintShown[k]=true;});state.cutInActive=true;state.lastTick=performance.now();
    eventArt.src=meta.art;eventArt.alt=meta.title;
    eventKicker.textContent=meta.kicker;eventTitle.textContent=meta.title;eventBody.textContent=meta.body;
    eventOverlay.hidden=false;
    statusBar.textContent='PATIENT COMPLAINT · '+level+'%';
    if(audioCtx&&state.musicEnabled){scheduleTone(level>=90?659:523,.12,.024,'sawtooth');scheduleTone(level>=75?440:392,.16,.018,'square');}
    return true;
  }
  function dismissComplaintCutIn(){
    eventOverlay.hidden=true;state.cutInActive=false;state.lastTick=performance.now();
    statusBar.textContent='R11 M5 · 病人等候計時中';
  }
  function checkComplaintCutIns(){
    if(state.cutInActive||state.gameOver)return;
    if(state.irritation>=90&&!state.complaintShown[90])return showComplaintCutIn(90);
    if(state.irritation>=75&&!state.complaintShown[75])return showComplaintCutIn(75);
    if(state.irritation>=55&&!state.complaintShown[55])return showComplaintCutIn(55);
  }
  eventDismissBtn?.addEventListener('click',dismissComplaintCutIn);

  function patient(){return rules.patients[state.patientIndex%rules.patients.length];}
  function rx(){return rules.buildR11ClinicalPrescription(patient());}
  function portionLabel(v){return Number(v)===0?'0份':Number(v)===.5?'半份':'1份';}
  function mood(){const v=state.irritation;return v<30?['🙂','耐心等候']:v<60?['😐','開始等久了']:v<82?['😠','明顯煩躁']:['🤬','快要爆炸'];}
  function irritationRate(){
    const p=patient(),s=p.clinicalStatus||{},f=p.ftnd||{};
    const base=.65+(Number(f.total)||0)*.04+(Number(s.irritability)||0)*.08+(Number(s.restlessness)||0)*.06+(Number(s.craving)||0)*.04;
    const doctorAdjusted=state.doctor==='speed'?base*.85:base;
    return state.difficulty==='hard'?doctorAdjusted*1.20:doctorAdjusted;
  }
  function qualitativeSymptom(v){
    v=Number(v)||0;
    return v===0?'無':v<=2?'輕–中':'重';
  }
  function symptomScore100(key){return rules.symptomSeverity100((patient().clinicalStatus||{})[key]);}
  function suggestedPortionForFood(id){return rules.severity100ToPortion(symptomScore100(food[id].symptom));}
  const interferenceLines={
    consult:['「有看到我嗎？我真的很餓。」','「醫師，可以快一點嗎？」','「我今天真的沒耐心等太久。」'],
    prep:['「你有記住我的需求吧？」','「還要選多久？我快受不了了。」','「那個份量真的對嗎？」','「拜託不要弄錯，我已經很煩了。」'],
    wok:['「好香…但到底還要多久？」','「不要燒焦啊！」','「火是不是太大了？」','「快一點，我真的快翻桌了！」'],
    serve:['「我的餐好了沒？」','「飯跟湯別送錯喔。」','「拜託現在就送過來。」']
  };
  function scheduleInterference(now=performance.now()){state.nextInterferenceAt=now+4000+Math.random()*4000;}
  function showPatientInterference(text){
    const pool=interferenceLines[state.stage]||interferenceLines.prep;
    state.interferenceText=text||pool[Math.floor(Math.random()*pool.length)];
    patientInterference.textContent=state.interferenceText;patientInterference.hidden=false;
    if(mobilePatientSpeech)mobilePatientSpeech.textContent=state.interferenceText.replace(/[「」]/g,'');
    setTimeout(()=>{state.interferenceText='';patientInterference.hidden=true;if(mobilePatientSpeech)mobilePatientSpeech.textContent=mood()[1];},2300);
    scheduleInterference();
  }
  function maybePatientInterference(now){
    if(!state.doctor||state.paused||state.gameOver||state.cutInActive)return;
    if(!['consult','prep','wok','serve'].includes(state.stage))return;
    if(!state.nextInterferenceAt)scheduleInterference(now);
    if(now>=state.nextInterferenceAt)showPatientInterference();
  }
  function setDifficulty(id){
    if(state.doctor||!difficulties[id])return;
    state.difficulty=id;renderPatient();renderStage();
  }
  function renderPressure(){
    const value=Math.max(0,Math.min(100,state.irritation)),[emoji,label]=mood();
    $('irritationText').textContent=state.doctor?`${Math.round(value)}% · ${label}`:'選醫師後開始計時';
    $('irritationFill').style.width=value+'%';
    $('pressureHud').dataset.level=value>=82?'danger':value>=60?'warn':'ok';
    $('patientMood').textContent=`${emoji} ${label}`;
  }
  function tick(now){
    const dt=Math.min(1,(now-state.lastTick)/1000);state.lastTick=now;
    if(state.doctor&&!state.paused&&!state.gameOver&&!state.cutInActive){
      state.irritation=Math.min(100,state.irritation+irritationRate()*dt);
      if(state.wokPhase==='simmer'&&state.stage==='wok')state.simmerSeconds+=dt;
      renderPressure();
      maybePatientInterference(now);
      checkComplaintCutIns();
      if(!state.cutInActive){
        if(state.irritation>=100)failTimeout();
        else if(state.stage==='wok'&&state.wokPhase==='simmer')updateWokLive();
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  function handleVisibility(hidden=document.hidden){
    state.paused=!!hidden;state.lastTick=performance.now();
    if(audioCtx){if(state.paused)audioCtx.suspend?.();else if(state.musicEnabled)audioCtx.resume?.();}
    statusBar.textContent=state.paused?'遊戲暫停：切回頁面後繼續計時':'R11 M5 · 病人等候計時中';
  }
  document.addEventListener('visibilitychange',()=>handleVisibility(document.hidden));

  function setCompactRail(force){
    const compact=typeof force==='boolean'?force:matchMedia('(max-width: 720px)').matches;
    rail.classList.toggle('is-compact',compact);railToggle.setAttribute('aria-expanded',String(!compact));
  }
  railToggle.addEventListener('click',()=>setCompactRail(!rail.classList.contains('is-compact')));
  const mq=matchMedia('(max-width: 720px)');mq.addEventListener?.('change',()=>setCompactRail());setCompactRail();

  function renderPatient(){
    const p=patient();
    rail.dataset.difficulty=state.difficulty;
    $('ticketNumber').textContent=String(state.ticket).padStart(3,'0');
    $('patientPortrait').src=`assets/service/${p.id}.webp`;$('patientPortrait').alt=p.name;
    $('patientRole').textContent=`CURRENT PATIENT · ${difficulties[state.difficulty].name}`;$('patientName').textContent=p.name;$('patientComplaint').textContent=p.complaint;
    $('ftndScore').textContent=p.ftnd.total;$('ftndSeverity').textContent=p.ftnd.severity;
    if(mobilePatientPortrait){mobilePatientPortrait.src=`assets/service/${p.id}.webp`;mobilePatientPortrait.alt=p.name;}
    if(mobilePatientName)mobilePatientName.textContent=p.name;
    if(mobilePatientSpeech)mobilePatientSpeech.textContent=state.interferenceText||mood()[1];
    $('ftndItems').innerHTML=Array.from({length:6},(_,i)=>`<span>Q${i+1}<b>${p.ftnd['q'+(i+1)]}</b></span>`).join('');
    $('symptomList').innerHTML=symptomMeta.map(([key,en,zh])=>{
      const v=p.clinicalStatus[key];
      if(state.difficulty==='hard')return `<div class="symptom-row is-qualitative"><div class="symptom-label"><b>${zh}</b><span>${en}</span></div><strong>${qualitativeSymptom(v)}</strong></div>`;
      return `<div class="symptom-row"><div class="symptom-label"><b>${zh}</b><span>${en}</span></div><div class="symptom-bar"><i style="width:${v/4*100}%"></i></div><strong>${state.difficulty==='easy'?v:'?'}</strong></div>`;
    }).join('');
    const pres=rx(),grid=$('prescriptionGrid');
    grid.innerHTML=foodOrder.map(id=>{
      const score=symptomScore100(food[id].symptom),suggested=rules.severity100ToPortion(score);
      return `<div class="rx-chip"><img src="${food[id].img}" alt=""><div><small>${food[id].target} ${score}分</small><strong>${food[id].name} · 建議 ${portionLabel(suggested)}</strong></div></div>`;
    }).join('');
    renderPressure();
  }
  function updateShiftHud(){
    const el=$('shiftHud');if(!el)return;
    el.innerHTML=`<span>SHIFT</span><strong>${state.ordersCompleted} CLEAR · STREAK ${state.streak}</strong>`;
    el.dataset.streak=state.streak>1?'hot':'normal';
  }
  function updateDoctorHud(){const d=state.doctor?doctors[state.doctor]:null;$('doctorHud').innerHTML=d?`<span>DOCTOR</span><strong>${d.name}</strong>`:'<span>DOCTOR</span><strong>尚未選擇</strong>';updateShiftHud();}
  function shell(kicker,title,desc){const n=document.createElement('div');n.className='stage-shell';n.innerHTML=`<div class="stage-head"><small>${kicker}</small><h1>${title}</h1><p>${desc}</p></div>`;return n;}
  function actionRow(...items){const row=document.createElement('div');row.className='stage-actions';row.append(...items);return row;}
  function button(id,text,klass='primary-action',disabled=false){const b=document.createElement('button');b.type='button';if(id)b.id=id;b.className=klass;b.textContent=text;b.disabled=disabled;return b;}

  function doctorCard(d){const card=document.createElement('button');card.type='button';card.className='doctor-card';card.dataset.doctor=d.id;card.innerHTML=`<img class="doctor-art" src="${d.art}" alt="${d.name}"><span class="doctor-copy"><small>${d.tag}</small><strong>${d.name}</strong><b>${d.ability}</b><em>${d.detail}</em></span><span class="choose-badge">選這位</span>`;card.addEventListener('click',()=>chooseDoctor(d.id));return card;}
  function chooseDoctor(id){
    if(!doctors[id])return;state.doctor=id;state.stage='consult';state.irritation=0;state.lastTick=performance.now();state.paused=document.hidden;state.gameOver=false;
    state.cutInActive=false;state.complaintShown={55:false,75:false,90:false};eventOverlay.hidden=true;
    scheduleInterference();startMusic();world.setDoctor(id);world.reset();updateDoctorHud();renderPatient();renderStage();statusBar.textContent='R11 M5 · 病人等候計時中';
  }
  function renderDoctorSelect(){
    const n=shell('SHIFT START · CHOOSE YOUR DOCTOR','今天由誰值班？','選擇今晚的值班強度與主角醫師。');
    const difficulty=document.createElement('div');difficulty.className='difficulty-select';
    Object.values(difficulties).forEach(d=>{const b=button('',d.name,'difficulty-btn');b.dataset.difficulty=d.id;b.setAttribute('aria-pressed',String(state.difficulty===d.id));b.innerHTML=`<small>${d.tag}</small><strong>${d.name}</strong><span>${d.detail}</span>`;b.addEventListener('click',()=>setDifficulty(d.id));difficulty.append(b);});
    n.append(difficulty);
    const grid=document.createElement('div');grid.className='doctor-grid';Object.values(doctors).forEach(d=>grid.append(doctorCard(d)));n.append(grid);
    const note=document.createElement('div');note.className='game-note';note.innerHTML=`<strong>${difficulties[state.difficulty].name}</strong><span>看病人 → 選配料 → 炒鍋 → 配餐 → 送餐。</span>`;n.append(note);return n;
  }
  function renderConsult(){
    const p=patient(),pres=rx(),d=difficulties[state.difficulty];
    const desc=state.difficulty==='hard'?'病人今晚特別沒耐心，先抓住最嚴重的症狀。':'先看主訴與症狀分數，再決定今晚的配料。';
    const n=shell(`01 CONSULT · 問診 · ${d.name}`,'先讀病人，再決定配料',desc);
    const layout=document.createElement('div');layout.className='consult-layout';
    const quote=document.createElement('article');quote.className='consult-box quote-box';quote.innerHTML=`<small>PATIENT SAYS</small><blockquote>「${p.wish}」</blockquote><p>${p.complaint}</p>`;
    const target=document.createElement('article');target.className='consult-box target-box';
    target.innerHTML=`<small>PORTION RULE</small><strong>0–40分 → 0份 · 41–70分 → 半份 · 71–100分 → 1份</strong><p>每張食材卡都會顯示目前症狀分數，照病人狀態下判斷。</p><div class="doctor-ability-inline">${doctors[state.doctor].name}：${doctors[state.doctor].ability}</div>`;
    layout.append(quote,target);n.append(layout);
    const b=button('consultConfirmBtn',state.traveling?'醫師前往備料檯…':'看懂需求 → 前往備料檯','primary-action',state.traveling);
    b.addEventListener('click',async()=>{if(state.traveling)return;state.traveling=true;renderStage();await world.goTo('prep',{messageText:'Q版醫師跑向備料檯'});state.traveling=false;state.stage='prep';renderStage();});n.append(actionRow(b));return n;
  }

  function ingredientCard(id){
    const m=food[id],score=symptomScore100(m.symptom),suggested=rules.severity100ToPortion(score),card=document.createElement('article');card.className='ingredient-card'+(state.activeFood===id?' is-active':'')+(state.touched[id]?' is-decided':'');card.dataset.food=id;
    card.innerHTML=`<img src="${m.img}" alt="${m.name}"><div class="ingredient-copy"><small>${m.target}</small><strong>${m.name}</strong><span class="severity-score">症狀 ${score}分</span><b class="severity-advice">建議 ${portionLabel(suggested)}</b></div>`;
    card.addEventListener('click',e=>{if(e.target.closest('button'))return;state.activeFood=id;renderStage();});
    const row=document.createElement('div');row.className='portion-row';[0,.5,1].forEach(v=>{const b=button('',v===0?'0':v===.5?'半份':'1份','portion-btn');b.dataset.food=id;b.dataset.portion=String(v);b.setAttribute('aria-pressed',String(state.touched[id]&&state.portions[id]===v));b.addEventListener('click',e=>{e.stopPropagation();state.portions[id]=v;state.touched[id]=true;state.activeFood=id;renderStage();});row.append(b);});card.append(row);return card;
  }
  function decidedCount(){return foodOrder.filter(id=>state.touched[id]).length;}
  function renderTray(target){target.innerHTML='';foodOrder.forEach(id=>{if(!state.touched[id])return;const v=state.portions[id],chip=document.createElement('span');chip.className=v===0?'tray-chip is-zero':'tray-chip';chip.innerHTML=`<img src="${food[id].img}" alt="">${food[id].name} ${portionLabel(v)}`;target.append(chip);});if(!target.children.length)target.innerHTML='<em>尚未選擇任何食材</em>';}
  function renderPrep(){
    const n=shell('02 PREP · 備料','看分數，下份量','0–40分選 0份；41–70分選半份；71–100分選1份。病人正在旁邊等你。');
    const pressure=document.createElement('div');pressure.className='prep-banner';pressure.innerHTML=`<strong>病人在等餐 · ${Math.round(state.irritation)}%</strong><span>已決定 ${decidedCount()}/7 種食材</span>`;n.append(pressure);
    const layout=document.createElement('div');layout.className='prep-layout';const pantry=document.createElement('div');pantry.className='pantry';foodOrder.forEach(id=>pantry.append(ingredientCard(id)));
    const station=document.createElement('aside');station.className='prep-station';const active=food[state.activeFood];station.innerHTML=`<div class="prep-visual"><img class="board-img" src="assets/cooking/board_empty.png" alt="砧板"><img class="board-food-preview" src="${active.img}" alt="${active.name}"><img class="knife-img" src="assets/cooking/chef_knife.png" alt="菜刀"></div><div class="prep-station-copy"><small>NOW PREPPING</small><strong>${active.name}</strong><span>${state.touched[state.activeFood]?'你選了 '+portionLabel(state.portions[state.activeFood]):'尚未決定份量'}</span><div id="prepTray" class="prep-tray"></div></div>`;renderTray(station.querySelector('#prepTray'));layout.append(pantry,station);n.append(layout);
    const b=button('prepDoneBtn',decidedCount()<7?`還有 ${7-decidedCount()} 樣未決定`:'備料完成 → 端去炒鍋','primary-action',decidedCount()<7||state.traveling);b.addEventListener('click',finishPrepAndMove);n.append(actionRow(b));return n;
  }
  function scorePrep(){return rules.evaluateR11Portions(state.portions,patient(),{doctor:state.doctor});}
  async function finishPrepAndMove(){
    if(decidedCount()<7||state.traveling)return;state.prepResult=scorePrep();state.traveling=true;renderStage();world.setCarry(true);await world.goTo('wok',{carry:true,messageText:'端著備料跑向炒鍋'});world.setCarry(false);state.traveling=false;state.stage='wok';state.heatLevel='off';state.wokPhase='heat';state.stirCount=0;state.stirPulse=false;state.dropPulse=false;state.lastStirAt=0;state.lastDropAt=0;state.heatSamples=[];state.dropIndex=0;state.dropScores=[];state.combo=0;state.maxCombo=0;state.lastStirTiming='';state.microEvent=null;state.eventSchedule=buildEventSchedule();state.rescuedEvents=0;state.eventMisses=0;state.actionFeedback='';state.simmerSeconds=0;state.simmerQuality=null;state.cookingResult=null;renderStage();
  }

  const wokBatchTemplate=[
    {id:'aroma',name:'肉末＋蒜末爆香',foods:['pork','garlic']},
    {id:'spice',name:'豆瓣＋辣椒＋花椒',foods:['douban','chili','pepper']},
    {id:'tofu',name:'豆腐下鍋',foods:['tofu']},
    {id:'finish',name:'青蔥收尾',foods:['scallion']}
  ];
  function activeWokBatches(){return wokBatchTemplate.map(x=>({...x,foods:x.foods.filter(id=>Number(state.portions[id])>0)})).filter(x=>x.foods.length);}
  function heatLabel(level){return level==='low'?'小火':level==='medium'?'中火':level==='high'?'大火':'關火';}
  function setHeat(level){
    if(state.stage!=='wok'||state.wokPhase==='done'||state.wokPhase==='simmer')return;
    state.heatLevel=level;
    if(state.wokPhase==='heat'&&level!=='off'){state.wokPhase='drop';state.lastDropAt=performance.now();state.actionFeedback='🔥 鍋熱了！開始下料';}
    renderStage();
  }
  function droppedFoods(){
    const batches=activeWokBatches(),done=batches.slice(0,state.dropIndex);
    return new Set(done.flatMap(x=>x.foods));
  }
  function wokFoodLayer(){
    const dropped=droppedFoods();
    return foodOrder.filter(id=>dropped.has(id)).map((id,i)=>`<img class="wok-food wok-food-${i%4}" data-food="${id}" src="${food[id].wok}" alt="${food[id].name}">`).join('');
  }
  function dropNextBatch(){
    if(state.stage!=='wok'||state.wokPhase!=='drop'||state.heatLevel==='off'||state.dropPulse)return;
    const batches=activeWokBatches();if(state.dropIndex>=batches.length)return;
    const now=performance.now(),delta=state.lastDropAt?now-state.lastDropAt:700;
    const score=delta>=280&&delta<=1800?100:75;
    state.dropScores.push(score);state.lastDropAt=now;state.dropIndex+=1;state.dropPulse=true;
    state.actionFeedback=score===100?'PERFECT DROP! ✦':'GOOD DROP';
    if(state.dropIndex>=batches.length)state.wokPhase='stir';
    renderStage();
    setTimeout(()=>{state.dropPulse=false;if(state.stage==='wok')renderStage();},180);
  }
  const earlyEventPool=[
    {id:'stick',title:'鍋底快黏了！',action:'快速推炒救鍋'},
    {id:'tofu',title:'豆腐快碎了！',action:'放輕動作救回口感'}
  ];
  const lateEventPool=[
    {id:'flare',title:'火焰突然竄高！',action:'穩住火候'},
    {id:'watery',title:'醬汁突然出水！',action:'快速翻炒拉回濃度'}
  ];
  function randomPick(list){return list[Math.floor(Math.random()*list.length)];}
  function buildEventSchedule(){
    return [
      {slot:'early',stir:Math.random()<.5?2:3,...randomPick(earlyEventPool),fired:false},
      {slot:'late',stir:Math.random()<.5?4:5,...randomPick(lateEventPool),fired:false}
    ];
  }
  function qaSetEventSchedule(first=3,second=5){
    state.eventSchedule=[
      {slot:'early',stir:Number(first),...earlyEventPool[0],fired:false},
      {slot:'late',stir:Number(second),...lateEventPool[0],fired:false}
    ];
  }
  function canStir(){return state.heatLevel!=='off'&&state.wokPhase==='stir'&&state.stirCount<6;}
  function triggerMicroEvent(){
    if(state.microEvent)return;
    const scheduled=state.eventSchedule.find(e=>!e.fired&&e.stir===state.stirCount);
    if(!scheduled)return;
    scheduled.fired=true;
    state.microEvent={id:scheduled.id,title:scheduled.title,action:scheduled.action,slot:scheduled.slot,stir:scheduled.stir};
  }
  function rescueEvent(){
    if(state.stage!=='wok'||!state.microEvent)return;
    const id=state.microEvent.id;
    state.rescuedEvents+=1;state.microEvent=null;state.actionFeedback='SAVE IT! +15 ✦';
    if(id==='flare')state.heatLevel='medium';
    renderStage();
  }
  function doStir(){
    if(!canStir())return;
    let missedEvent=false;
    if(state.microEvent){state.eventMisses+=1;state.microEvent=null;state.combo=0;missedEvent=true;}
    const now=performance.now(),delta=state.lastStirAt?now-state.lastStirAt:520;
    const timing=delta<300?'fast':delta>1100?'slow':'perfect';
    state.lastStirTiming=timing;
    if(missedEvent){state.combo=0;state.actionFeedback='MISS EVENT! COMBO RESET';}
    else if(timing==='fast'){state.combo=0;state.actionFeedback='TOO FAST! COMBO RESET';}
    else if(timing==='slow'){state.combo=0;state.actionFeedback='TOO SLOW! COMBO RESET';}
    else{state.combo+=1;state.maxCombo=Math.max(state.maxCombo,state.combo);state.actionFeedback=state.combo>=3?`PERFECT! COMBO ×${state.combo}`:'GREAT!';}
    state.stirCount+=1;state.stirPulse=true;state.lastStirAt=now;state.heatSamples.push(state.heatLevel);
    triggerMicroEvent();renderStage();
    setTimeout(()=>{state.stirPulse=false;if(state.stage==='wok')renderStage();},220);
  }
  function startSimmer(){if(state.stage!=='wok'||state.stirCount<6||state.heatLevel==='off'||state.microEvent)return;state.wokPhase='simmer';state.simmerSeconds=0;state.lastTick=performance.now();state.actionFeedback='收汁開始！盯緊 PERFECT 區';renderStage();}
  function simmerBand(seconds){
    const heatDoctor=state.doctor==='heat',perfectLo=heatDoctor?4.25:4.5,perfectHi=heatDoctor?5.75:5.5;
    if(seconds<3)return {key:'raw',label:'太生',score:35};
    if(seconds<perfectLo)return {key:'good',label:'GOOD',score:82};
    if(seconds<=perfectHi)return {key:'perfect',label:'PERFECT',score:100};
    if(seconds<=7)return {key:'dry',label:'稍乾',score:68};
    return {key:'burnt',label:'過火',score:30};
  }
  function heatScore(){if(!state.heatSamples.length)return 0;const values=state.heatSamples.map(x=>x==='medium'?100:x==='high'?84:76);return Math.round(values.reduce((a,b)=>a+b,0)/values.length);}
  function ingredientTimingScore(){return state.dropScores.length?Math.round(state.dropScores.reduce((a,b)=>a+b,0)/state.dropScores.length):0;}
  function comboScore(){return Math.min(100,Math.round(state.maxCombo/6*100));}
  function rescueScore(){const total=state.rescuedEvents+state.eventMisses;return total?Math.round(state.rescuedEvents/total*100):70;}
  async function finishSimmer(){
    if(state.stage!=='wok'||state.wokPhase!=='simmer'||state.traveling)return;
    const band=simmerBand(state.simmerSeconds);
    state.simmerQuality=band;state.heatLevel='off';state.wokPhase='done';
    const h=heatScore(),ingredient=ingredientTimingScore(),combo=comboScore(),rescue=rescueScore();
    const cook=Math.round(h*.20+ingredient*.20+combo*.25+rescue*.15+band.score*.20);
    state.cookingResult={heatScore:h,ingredientTimingScore:ingredient,comboScore:combo,rescueScore:rescue,simmerScore:band.score,simmerLabel:band.label,simmerKey:band.key,simmerSeconds:Number(state.simmerSeconds.toFixed(2)),maxCombo:state.maxCombo,rescuedEvents:state.rescuedEvents,eventMisses:state.eventMisses,cookingQuality:cook};
    state.rice=null;state.miso=null;state.serviceResult=null;state.finalResult=null;state.won=null;
    state.traveling=true;renderStage();world.setCarry(true);
    await world.goTo('serve',{carry:true,messageText:'起鍋！端去配餐檯'});
    world.setCarry(false);state.traveling=false;state.stage='serve';world.setMessage('配飯、味噌湯，再送餐');
    renderStage();statusBar.textContent='R11 M5 · 配餐中，病人仍在等待';
  }
  function updateWokLive(){
    const timer=$('simmerSeconds');if(timer)timer.textContent=state.simmerSeconds.toFixed(1)+' 秒';
    const band=$('simmerBand');if(band){const q=simmerBand(state.simmerSeconds);band.textContent=q.label;band.dataset.band=q.key;}
    const needle=stagePanel.querySelector('.simmer-track .needle');if(needle)needle.style.left=Math.min(100,state.simmerSeconds/8*100)+'%';
  }
  function renderWok(){
    const batches=activeWokBatches(),nextBatch=batches[state.dropIndex];
    const phaseLabel=state.wokPhase==='heat'?'① 熱鍋':state.wokPhase==='drop'?`② 下料 ${Math.min(state.dropIndex+1,batches.length)}/${batches.length}`:state.wokPhase==='stir'?`③ 翻炒 ${state.stirCount}/6`:'④ 收汁';
    const n=shell('03 WOK · 熱炒挑戰','把這鍋炒出節奏！','火候、下料、連擊、救場與收汁都會影響 Cooking 分數。保持節奏，別讓病人等太久。');
    const layout=document.createElement('div');layout.className='wok-layout-r11';
    const visual=document.createElement('div');
    visual.className=`wok-visual-r11 heat-${state.heatLevel}${state.stirPulse?' is-stirring':''}${state.dropPulse?' is-dropping':''}${state.wokPhase==='simmer'?' is-simmering':''}${state.combo>=3?' combo-hot':''}`;
    visual.innerHTML=`
      <img class="wok-doctor-avatar" src="${doctors[state.doctor].art}" alt="">
      <div class="wok-patient-peek"><img src="assets/service/${patient().id}.webp" alt=""><span>${Math.round(state.irritation)}%</span></div>
      <img class="wok-stove" src="assets/chibi/stove.webp" alt="爐台">
      <div class="flame-r11"><i></i><i></i><i></i><i></i><i></i></div>
      <div class="heat-haze"></div>
      <img class="wok-pan" src="assets/cooking/wok_empty.png" alt="炒鍋">
      <div class="wok-food-layer">${wokFoodLayer()}</div>
      <div class="sizzle-particles">${'<b></b>'.repeat(12)}</div>
      <span class="steam"></span><span class="steam s2"></span><span class="steam s3"></span>
      <img class="spatula-img" src="assets/cooking/metal_spatula.png" alt="鍋鏟">
      ${state.combo>1?`<div class="combo-badge">COMBO ×${state.combo}</div>`:''}
      ${state.actionFeedback?`<div class="wok-feedback-pop">${state.actionFeedback}</div>`:''}
      ${state.microEvent?`<div class="micro-event-overlay"><small>⚠ QUICK EVENT</small><strong>${state.microEvent.title}</strong></div>`:''}`;
    const controls=document.createElement('div');controls.className='wok-controls-r11';
    controls.innerHTML=`
      <div class="wok-phase-strip"><span class="${state.wokPhase==='heat'?'is-current':''}">熱鍋</span><span class="${state.wokPhase==='drop'?'is-current':''}">下料</span><span class="${state.wokPhase==='stir'?'is-current':''}">翻炒</span><span class="${state.wokPhase==='simmer'?'is-current':''}">收汁</span></div>
      <div class="wok-mission"><small>NOW</small><strong>${phaseLabel}</strong><em>${state.wokPhase==='heat'?'選火力把鍋燒熱':state.wokPhase==='drop'?(nextBatch?'下一批：'+nextBatch.name:'下料完成'):state.wokPhase==='stir'?'保持約 0.3–1.1 秒節奏，累積 Combo':'PERFECT 約 4.5–5.5 秒'}</em></div>
      <div class="wok-status-row"><span>火力 <b id="heatStatus">${heatLabel(state.heatLevel)}</b></span><span>Combo <b id="comboStatus">×${state.combo}</b></span><span>救場 <b id="rescueStatus">${state.rescuedEvents}/2</b></span><span>病人 <b>${Math.round(state.irritation)}%</b></span></div>
      <div class="heat-buttons" id="heatButtons"></div>
      <div class="simmer-meter"><small>收汁秒數</small><strong id="simmerSeconds">${state.simmerSeconds.toFixed(1)} 秒</strong><b id="simmerBand" data-band="${state.wokPhase==='simmer'?simmerBand(state.simmerSeconds).key:'idle'}">${state.wokPhase==='simmer'?simmerBand(state.simmerSeconds).label:'尚未開始'}</b><div class="simmer-track"><i class="z raw"></i><i class="z good"></i><i class="z perfect"></i><i class="z dry"></i><i class="z burnt"></i><span class="needle" style="left:${Math.min(100,state.simmerSeconds/8*100)}%"></span></div><em>${state.doctor==='heat'?'DR. HEAT：PERFECT 窗口 1.0s → 1.5s（+50%）':'抓準綠色區起鍋'}</em></div>`;
    const heatButtons=controls.querySelector('#heatButtons');
    [['low','小火'],['medium','中火'],['high','大火']].forEach(([id,label])=>{const b=button('',label,'heat-btn');b.dataset.heat=id;b.setAttribute('aria-pressed',String(state.heatLevel===id));b.addEventListener('click',()=>setHeat(id));heatButtons.append(b);});
    const off=button('heatOffBtn','關火','heat-btn');off.dataset.heat='off';off.setAttribute('aria-pressed',String(state.heatLevel==='off'));off.addEventListener('click',()=>setHeat('off'));heatButtons.append(off);

    const actionSlot=document.createElement('div');actionSlot.className='wok-main-action-slot';
    if(state.wokPhase==='drop'){
      const drop=button('dropIngredientBtn',nextBatch?'下料！ '+nextBatch.name:'下料完成','wok-action ingredient-drop-action',!nextBatch||state.heatLevel==='off'||state.dropPulse);drop.addEventListener('click',dropNextBatch);actionSlot.append(drop);
    }else if(state.wokPhase==='stir'){
      if(state.microEvent){
        const rescue=button('rescueBtn','⚡ '+state.microEvent.action,'wok-action rescue-action');rescue.addEventListener('click',rescueEvent);actionSlot.append(rescue);
      }else if(state.stirCount>=6){
        const simmer=button('startSimmerBtn','🔥 進入收汁階段','wok-action');simmer.addEventListener('click',startSimmer);actionSlot.append(simmer);
      }else{
        const stir=button('stirBtn',`翻炒！ ${state.stirCount}/6`,'wok-action stir-action',!canStir());stir.addEventListener('click',doStir);actionSlot.append(stir);
      }
    }else if(state.wokPhase==='simmer'){
      const plate=button('finishSimmerBtn','起鍋！','wok-action danger-action');plate.addEventListener('click',finishSimmer);actionSlot.append(plate);
    }
    controls.append(actionSlot);
    layout.append(visual,controls);n.append(layout);return n;
  }
  function serviceReady(){return state.rice!==null&&state.miso!==null;}
  function setRice(value){if(state.stage!=='serve'||state.traveling)return;state.rice=value;renderStage();}
  function setMiso(value){if(state.stage!=='serve'||state.traveling)return;state.miso=!!value;renderStage();}
  function scoreService(){
    const pres=rx(),riceOk=state.rice===pres.rice,misoOk=state.miso===pres.miso;
    const fidelity=Math.max(0,100-(riceOk?0:25)-(misoOk?0:18));
    return {riceOk,misoOk,fidelity,pass:riceOk&&misoOk,expectedRice:pres.rice,expectedMiso:pres.miso};
  }
  function renderServe(){
    const pres=rx(),n=shell('04 SERVE · 配餐','最後一站：配飯＋味噌湯','飯量與湯都要親自選；餐盤會立即變化。完成後才送餐結算。');
    const layout=document.createElement('div');layout.className='serve-layout-r11';
    const preview=document.createElement('div');preview.className='serve-preview-r11';
    preview.innerHTML=`<div class="serve-counter"><img class="plated-mapo" src="assets/cooking/dish_plated.png" alt="麻婆豆腐">${state.rice?`<img id="trayRice" class="tray-rice" src="assets/service/${state.rice==='半碗飯'?'rice-half.webp':'rice-full.webp'}" alt="${state.rice}">`:'<div class="serve-placeholder rice-placeholder">選擇飯量</div>'}${state.miso===null?'<div class="serve-placeholder soup-placeholder">選擇味噌湯</div>':state.miso?'<img id="traySoup" class="tray-soup" src="assets/service/miso_yes.webp" alt="味噌湯">':'<img id="trayNoSoup" class="tray-soup no-soup" src="assets/service/miso_no.webp" alt="不要味噌湯">'}</div><div class="serve-preview-copy"><small>TRAY PREVIEW</small><strong>${state.rice||'尚未選飯'} · ${state.miso===null?'尚未選湯':state.miso?'味噌湯':'不要湯'}</strong><span>病人煩躁 ${Math.round(state.irritation)}%</span></div>`;
    const controls=document.createElement('div');controls.className='serve-controls-r11';
    const rice=document.createElement('section');rice.className='service-choice-group';rice.innerHTML=`<small>APPETITE → RICE</small><strong>白飯</strong><span>處方目標：${pres.rice}</span><div class="service-buttons"></div>`;
    const riceButtons=rice.querySelector('.service-buttons');
    [['riceHalfBtn','半碗飯','半碗飯'],['riceFullBtn','一碗飯','正常飯']].forEach(([id,label,value])=>{const b=button(id,label,'service-choice-btn');b.setAttribute('aria-pressed',String(state.rice===value));b.addEventListener('click',()=>setRice(value));riceButtons.append(b);});
    const soup=document.createElement('section');soup.className='service-choice-group';soup.innerHTML=`<small>SLEEP → MISO</small><strong>味噌湯</strong><span>處方目標：${pres.miso?'要':'不要'}</span><div class="service-buttons"></div>`;
    const soupButtons=soup.querySelector('.service-buttons');
    [['misoYesBtn','要',true],['misoNoBtn','不要',false]].forEach(([id,label,value])=>{const b=button(id,label,'service-choice-btn');b.setAttribute('aria-pressed',String(state.miso===value));b.addEventListener('click',()=>setMiso(value));soupButtons.append(b);});
    controls.append(rice,soup);layout.append(preview,controls);n.append(layout);
    const send=button('serveDoneBtn',serviceReady()?'送餐給病人':'先選飯與湯','primary-action',!serviceReady()||state.traveling);send.addEventListener('click',deliverMeal);n.append(actionRow(send));return n;
  }
  function deliverMeal(){
    if(!serviceReady()||state.stage!=='serve'||state.gameOver)return;
    state.serviceResult=scoreService();state.stage='delivery';world.setMessage('送餐中…');renderStage();statusBar.textContent='DELIVERY · 餐點送往病人';
    setTimeout(()=>{if(state.stage==='delivery'&&!state.gameOver)finalizeResult();},520);
  }
  function renderDelivery(){
    const n=shell('DELIVERY','送餐中…','最後幾步也算等待時間，快把餐點送到病人面前。');
    const scene=document.createElement('div');scene.className='delivery-scene';scene.innerHTML=`<img src="assets/cooking/tray_served.png" alt="送餐托盤"><div><small>NOW SERVING</small><strong>${patient().name}</strong><span>${state.rice} · ${state.miso?'味噌湯':'不要湯'}</span></div>`;n.append(scene);return n;
  }
  function scoreFinalMetrics({prescriptionFidelity,cookingQuality,serviceFidelity,speedScore,patientMood,gateBPass,servicePass}){
    const total=Math.round(prescriptionFidelity*.25+cookingQuality*.25+serviceFidelity*.20+speedScore*.15+patientMood*.15);
    const won=!!gateBPass&&cookingQuality>=60&&!!servicePass;
    const rawRank=total>=92?'S':total>=82?'A':total>=70?'B':'C';
    return {total,won,valid:won,rawRank,rank:won?rawRank:'—',stars:won?(total>=90?3:total>=75?2:1):0};
  }
  function finalizeResult(){
    const prescriptionFidelity=state.prepResult.fidelity,cookingQuality=state.cookingResult.cookingQuality,serviceFidelity=state.serviceResult.fidelity;
    const speedScore=Math.max(0,Math.round(100-state.irritation));
    const patientMood=Math.max(0,Math.min(100,Math.round(100-state.irritation*.65-(state.prepResult.gateB_pass?0:22)-(state.serviceResult.pass?0:18)-(cookingQuality>=60?0:20))));
    const scored=scoreFinalMetrics({prescriptionFidelity,cookingQuality,serviceFidelity,speedScore,patientMood,gateBPass:state.prepResult.gateB_pass,servicePass:state.serviceResult.pass});
    const {total,won,valid,rawRank,rank,stars}=scored;
    const problems=[];
    if(!state.prepResult.gateB_pass)problems.push('配料處方未達 Gate B');
    if(cookingQuality<60)problems.push('料理品質不足');
    if(!state.serviceResult.riceOk)problems.push('飯量不符合處方');
    if(!state.serviceResult.misoOk)problems.push('味噌湯不符合處方');
    if(!problems.length&&speedScore<70)problems.push('送餐速度還能更快');
    const metrics={Prescription:prescriptionFidelity,Cooking:cookingQuality,Service:serviceFidelity,Speed:speedScore,'Patient Mood':patientMood};
    const weakest=Object.entries(metrics).sort((a,b)=>a[1]-b[1])[0];
    state.streak=won?state.streak+1:0;if(won)state.ordersCompleted+=1;
    state.finalResult={prescriptionFidelity,cookingQuality,serviceFidelity,speedScore,patientMood,total,won,valid,rawRank,rank,stars,problems,weakest};
    state.won=won;state.gameOver=true;state.stage=won?'victory':'rejected-cutin';world.setMessage(won?'成功過關！MAPO RESCUE CLEAR':'ORDER REJECTED!');
    if(won)playVictoryJingle();else playFailureSting();
    renderStage();statusBar.textContent=won?'MAPO RESCUE CLEAR!':'ORDER REJECTED · 醫師被揍了';
  }
  function renderVictory(){
    const n=document.createElement('div');n.className='stage-shell victory-shell';
    n.innerHTML=`<div class="victory-art-wrap"><img id="victoryArt" class="victory-art" src="assets/r11/events/victory.webp" alt="醫師成功過關"><div class="victory-native-copy"><small>MAPO RESCUE CLEAR</small><strong>成功過關！</strong><span>${doctors[state.doctor].name} 順利完成出餐 · ${state.finalResult.total} 分 · RANK ${state.finalResult.rank}</span></div></div>`;
    const b=button('victoryContinueBtn','查看完整成績 →','primary-action');b.addEventListener('click',()=>{state.stage='result';renderStage();statusBar.textContent='R11 · RESULT';});
    n.append(actionRow(b));return n;
  }
  function renderRejected(){
    const r=state.finalResult,n=shell('ORDER REJECTED','病人氣炸，醫師被揍了！','關鍵規格出錯，先看清楚哪裡被退回。');
    n.classList.add('rejected-shell');
    const scene=document.createElement('div');scene.className='rejected-scene';
    const reason=(r.problems&&r.problems.length?r.problems:['餐點規格不符']).map(x=>'• '+x).join('<br>');
    scene.innerHTML=`<img class="rejected-bg" src="assets/r11/events/complaint_90.webp" alt="病人暴怒"><img class="rejected-doctor" src="${doctors[state.doctor].bump}" alt="${doctors[state.doctor].name} 頭上腫包"><div class="rejected-impact">砰！</div><div class="rejected-copy"><small>ORDER REJECTED</small><strong>${doctors[state.doctor].name} 被揍得頭上腫一包！</strong><span>${reason}</span></div>`;
    n.append(scene);
    const b=button('rejectedContinueBtn','查看退回原因 →','primary-action');b.addEventListener('click',()=>{state.stage='result';renderStage();statusBar.textContent='R11 M5 · RESULT';});n.append(actionRow(b));return n;
  }
  function renderResult(){
    const r=state.finalResult;
    const reason=r.won?(r.rank==='S'?'完美出餐！':'送餐成功！'):(r.problems[0]||'差一點！再試一次');
    const n=shell(r.won?'ORDER COMPLETE · SUCCESS':'ORDER REJECTED · INVALID',reason,r.won?`總分 ${r.total} · RANK ${r.rank} · ${'★'.repeat(r.stars)}${'☆'.repeat(3-r.stars)}`:`RAW PERFORMANCE ${r.total} · FINAL RESULT INVALID · 先修復關鍵規格錯誤`);
    n.classList.add('result-shell');
    const hero=document.createElement('div');hero.className='result-hero-r11'+(r.won?' is-win':' is-retry');
    hero.classList.toggle('is-invalid',!r.valid);
    hero.innerHTML=`<img src="${r.won?'assets/finale/success_clinic_meal.webp':'assets/cooking/dish_plated.png'}" alt="${r.won?'病人滿意用餐':'餐點需要調整'}"><div class="result-score-main"><small>${r.valid?'FINAL SCORE':'RAW SCORE'}</small><strong>${r.total}</strong><span>${r.won?'SUCCESS':'INVALID'}</span></div><div class="result-rank"><small>${r.valid?'RANK':'HARD GATE'}</small><strong>${r.rank}</strong><span class="result-stars">${r.valid?('★'.repeat(r.stars)+'☆'.repeat(3-r.stars)):'ORDER REJECTED'}</span><em>${state.streak>1?'STREAK ×'+state.streak:state.ordersCompleted+' ORDER'+(state.ordersCompleted>1?'S':'')+' CLEARED'}</em></div>`;n.append(hero);

    const values=[['Prescription',r.prescriptionFidelity],['Cooking',r.cookingQuality],['Service',r.serviceFidelity],['Speed',r.speedScore],['Patient Mood',r.patientMood]];
    const min=Math.min(...values.map(x=>x[1])),max=Math.max(...values.map(x=>x[1]));
    const scores=document.createElement('div');scores.className='result-score-grid';
    values.forEach(([label,value])=>{const card=document.createElement('div');card.className='score-card'+(value===min?' is-weak':'')+(value===max?' is-best':'');card.dataset.score=label;card.innerHTML=`<small>${label}</small><strong>${value}</strong><span>/100</span><i><b style="width:${value}%"></b></i>`;scores.append(card);});n.append(scores);

    const challenge=r.problems.length?r.problems.map(x=>'• '+x).join('<br>'):(r.weakest[0]==='Cooking'?'• 下一輪把收汁停在 PERFECT 區':r.weakest[0]==='Speed'?'• 下一輪在病人煩躁 20% 前送餐':'• 下一輪挑戰總分 '+Math.min(100,r.total+8)+'+');
    const quote=r.won?(r.rank==='S'?'「太厲害了，完全是我想吃的！」':'「這次有對味，謝謝醫師！」'):(!state.serviceResult.pass?'「味道不錯，但配餐跟我點的不一樣喔。」':r.cookingQuality<60?'「火候還差一點，再試一次吧。」':'「配料好像跟我的需求不太一樣。」');
    const cookBreak=document.createElement('div');cookBreak.className='cooking-breakdown';const c=state.cookingResult;[['Heat Control',c.heatScore],['Ingredient Timing',c.ingredientTimingScore],['Stir Combo',c.comboScore],['Rescue Events',c.rescueScore],['Finishing',c.simmerScore]].forEach(([label,value])=>{const chip=document.createElement('div');chip.className='cook-breakdown-chip';chip.innerHTML=`<small>${label}</small><strong>${value}</strong>`;cookBreak.append(chip);});n.append(cookBreak);
    const detail=document.createElement('div');detail.className='result-detail-grid';
    detail.innerHTML=`<section class="result-feedback"><small>WHY THIS RESULT</small><strong>${r.won?'本輪亮點':'主要失分原因'}</strong><p>${r.won?'處方、配餐與料理已達過關條件。':challenge}</p></section><section class="result-challenge"><small>NEXT CHALLENGE</small><strong>${r.won?'衝更高分':'再挑戰一次'}</strong><p>${r.won?'把最低分的 '+r.weakest[0]+' 拉到 90+，挑戰 S Rank。':'修正上面的失分點，目標 '+Math.min(100,r.total+10)+' 分以上。'}</p></section><section class="result-patient-response"><img src="assets/service/${patient().id}.webp" alt="${patient().name}"><div><small>PATIENT REACTION</small><strong>${patient().name}</strong><p>${quote}</p></div></section>`;n.append(detail);

    const note=document.createElement('div');note.className='result-note';note.innerHTML=`<strong>SERVICE ${state.serviceResult.fidelity}</strong><span>飯：${state.serviceResult.riceOk?'✓':'✕'} · 味噌湯：${state.serviceResult.misoOk?'✓':'✕'} · PREP Gate B：${state.prepResult.gateB_pass?'PASS':'FAIL'}</span>`;n.append(note);
    const retry=button('retryPatientBtn',r.won?'再挑戰這位病人':'再挑戰一次 · 目標 '+Math.min(100,r.total+10)+'+ ',r.won?'secondary-action':'primary-action');retry.addEventListener('click',resetCurrentPatient);
    const next=button('nextPatientBtn','下一號病人 →',r.won?'primary-action':'secondary-action');next.addEventListener('click',nextPatient);n.append(actionRow(retry,next));return n;
  }
  function nextPatient(){
    state.ticket+=1;state.patientIndex=(state.patientIndex+1)%rules.patients.length;resetCurrentPatient();
  }

  function failTimeout(){
    if(state.gameOver||!state.doctor)return;state.gameOver=true;state.cutInActive=false;eventOverlay.hidden=true;state.heatLevel='off';state.wokPhase='failed';state.stage='fail-table-flip';playFailureSting();world.setMessage('病人等太久：TABLE FLIP!');renderStage();statusBar.textContent='PATIENT TIMEOUT · TABLE FLIP';
  }
  function renderFailure(){
    const n=shell('PATIENT TIMEOUT','病人翻桌！','等太久了，病人當場爆氣，值班醫師也被波及。');
    const scene=document.createElement('div');scene.className='failure-scene';scene.innerHTML=`<img class="failure-table" src="assets/finale/failure_table_flip.webp" alt="病人翻桌"><img class="failure-doctor" src="${doctors[state.doctor].bump}" alt="${doctors[state.doctor].name} 頭上腫一包"><div class="comic-stars">✦ ★ ✦</div><div class="failure-copy"><strong>等待太久！</strong><span>${doctors[state.doctor].name} 被波及，頭上腫了一包。</span></div>`;n.append(scene);
    const retry=button('retryPatientBtn','重試這位病人','primary-action');retry.addEventListener('click',resetCurrentPatient);n.append(actionRow(retry));return n;
  }
  function resetCurrentPatient(){
    state.stage='consult';state.traveling=false;state.portions=blankPortions();state.touched=blankTouched();state.activeFood='tofu';state.prepResult=null;state.irritation=0;state.gameOver=false;
    state.heatLevel='off';state.wokPhase='heat';state.stirCount=0;state.stirPulse=false;state.dropPulse=false;state.lastStirAt=0;state.lastDropAt=0;state.heatSamples=[];state.dropIndex=0;state.dropScores=[];state.combo=0;state.maxCombo=0;state.lastStirTiming='';state.microEvent=null;state.eventSchedule=buildEventSchedule();state.rescuedEvents=0;state.eventMisses=0;state.actionFeedback='';state.simmerSeconds=0;state.simmerQuality=null;state.cookingResult=null;
    state.rice=null;state.miso=null;state.serviceResult=null;state.finalResult=null;state.won=null;state.cutInActive=false;state.complaintShown={55:false,75:false,90:false};state.interferenceText='';patientInterference.hidden=true;eventOverlay.hidden=true;state.lastTick=performance.now();
    scheduleInterference();startMusic();world.reset();world.setDoctor(state.doctor);renderStage();statusBar.textContent='R11 M5 · 病人等候計時中';
  }

  function renderStage(){
    renderPatient();updateDoctorHud();
    gameMain.classList.toggle('is-result-mode',state.stage==='result');
    gameMain.classList.toggle('is-victory-mode',state.stage==='victory');
    const views={'doctor-select':renderDoctorSelect,consult:renderConsult,prep:renderPrep,wok:renderWok,serve:renderServe,delivery:renderDelivery,victory:renderVictory,'rejected-cutin':renderRejected,result:renderResult,'fail-table-flip':renderFailure};
    const view=views[state.stage];if(!view)throw new Error('Unknown R11 stage '+state.stage);stagePanel.replaceChildren(view());
  }

  window.CKR11={
    snapshot:()=>({version:state.version,ticket:state.ticket,patient:patient(),prescription:rx(),doctor:state.doctor,difficulty:state.difficulty,irritationRate:Number(irritationRate().toFixed(4)),stage:state.stage,traveling:state.traveling,portions:{...state.portions},touched:{...state.touched},prepResult:state.prepResult,irritation:Number(state.irritation.toFixed(3)),paused:state.paused,gameOver:state.gameOver,heatLevel:state.heatLevel,wokPhase:state.wokPhase,stirCount:state.stirCount,simmerSeconds:Number(state.simmerSeconds.toFixed(3)),simmerQuality:state.simmerQuality,cookingResult:state.cookingResult,dropIndex:state.dropIndex,wokBatchCount:activeWokBatches().length,combo:state.combo,maxCombo:state.maxCombo,lastStirTiming:state.lastStirTiming,microEvent:state.microEvent,eventSchedule:state.eventSchedule.map(e=>({...e})),rescuedEvents:state.rescuedEvents,eventMisses:state.eventMisses,rice:state.rice,miso:state.miso,serviceResult:state.serviceResult,finalResult:state.finalResult,won:state.won,ordersCompleted:state.ordersCompleted,streak:state.streak,musicEnabled:state.musicEnabled,musicInterval:musicInterval(),cutInActive:state.cutInActive,complaintShown:{...state.complaintShown},interferenceText:state.interferenceText,introStep:state.introStep,introFinished:state.introFinished,introSeen:state.introSeen,introReplay:state.introReplay,world:world.snapshot()}),
    __qaSetHidden:v=>handleVisibility(!!v),
    __qaSetIrritation:v=>{state.irritation=Math.max(0,Math.min(100,Number(v)||0));renderPressure();},
    __qaTriggerComplaint:v=>showComplaintCutIn(Number(v)),
    __qaDismissComplaint:()=>dismissComplaintCutIn(),
    __qaSetEventSchedule:(first,second)=>qaSetEventSchedule(first,second),
    __qaScoreFinal:m=>scoreFinalMetrics(m),
    __qaTriggerInterference:t=>{showPatientInterference(t);return state.interferenceText;},
    __qaShowRejected:()=>{if(!state.doctor)return false;state.finalResult=state.finalResult||{total:88,won:false,valid:false,rawRank:'A',rank:'—',stars:0,problems:['配料份量不符'],weakest:['Prescription',50],prescriptionFidelity:50,cookingQuality:90,serviceFidelity:100,speedScore:90,patientMood:70};state.stage='rejected-cutin';state.gameOver=true;renderStage();return true;}
  };
  renderSoundToggle();renderIntro();world.setMessage('先選擇值班醫師');renderStage();
})();