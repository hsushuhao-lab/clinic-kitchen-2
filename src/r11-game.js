/* R11 M1: doctor selection + consult + deliberate prep + patient pressure. */
(() => {
  'use strict';
  const rules=window.CKClinicRules;
  const world=window.CKR11World;
  if(!rules||!world) throw new Error('R11 dependencies missing');

  const $=id=>document.getElementById(id);
  const stagePanel=$('stagePanel');
  const statusBar=$('statusBar');
  const rail=$('patientRail');
  const railToggle=$('patientRailToggle');
  const foodOrder=['tofu','pork','douban','garlic','scallion','chili','pepper'];
  const food={
    tofu:{name:'豆腐',target:'基底',img:'assets/ingredients/mapo_tofu/tofu.png'},
    pork:{name:'絞肉',target:'基底',img:'assets/ingredients/mapo_tofu/pork.png'},
    douban:{name:'豆瓣醬',target:'Craving',img:'assets/ingredients/mapo_tofu/douban.png'},
    garlic:{name:'蒜末',target:'Irritability',img:'assets/ingredients/mapo_tofu/garlic.png'},
    scallion:{name:'青蔥',target:'Concentration',img:'assets/ingredients/mapo_tofu/scallion.png'},
    chili:{name:'辣椒',target:'Restlessness',img:'assets/ingredients/mapo_tofu/chili.png'},
    pepper:{name:'花椒',target:'Anxiety',img:'assets/ingredients/mapo_tofu/pepper.png'}
  };
  const doctors={
    speed:{id:'speed',name:'DR. SPEED',tag:'快速料理',ability:'病人煩躁累積速度 −15%',detail:'適合想把整段流程壓快的玩家。',sprite:'assets/chibi/speed.webp'},
    heat:{id:'heat',name:'DR. HEAT',tag:'火候專家',ability:'M2：收汁 Perfect Zone 較寬',detail:'本里程碑先完成角色選擇；火候能力在 M2 啟用。',sprite:'assets/chibi/heat.webp'},
    strategy:{id:'strategy',name:'DR. STRATEGY',tag:'配料專家',ability:'PREP 目標提示更醒目',detail:'適合先看症狀、再精準配料。',sprite:'assets/chibi/strategy.webp'}
  };
  const symptomMeta=[
    ['craving','Craving','菸癮'],['irritability','Irritability','煩躁'],['anxiety','Anxiety','焦慮'],['concentration','Concentration','注意力'],['restlessness','Restlessness','坐立難安'],['appetite','Appetite','食慾'],['sleep','Sleep','睡眠']
  ];
  const state={
    version:'R11_INTERACTIVE_KITCHEN_M1',ticket:1,patientIndex:0,doctor:null,stage:'doctor-select',traveling:false,
    portions:Object.fromEntries(foodOrder.map(id=>[id,0])),touched:Object.fromEntries(foodOrder.map(id=>[id,false])),activeFood:'tofu',
    irritation:0,paused:document.hidden,lastTick:performance.now(),m1Complete:false,prepResult:null
  };

  function patient(){return rules.patients[state.patientIndex%rules.patients.length];}
  function rx(){return rules.buildClinicalPrescription(patient());}
  function portionLabel(v){return Number(v)===0?'0份':Number(v)===.5?'半份':'1份';}
  function mood(){const v=state.irritation;return v<30?['🙂','耐心等候']:v<60?['😐','開始等久了']:v<82?['😠','明顯煩躁']:['🤬','快要爆炸'];}
  function irritationRate(){
    const p=patient(),s=p.clinicalStatus||{},f=p.ftnd||{};
    const base=.65+(Number(f.total)||0)*.04+(Number(s.irritability)||0)*.08+(Number(s.restlessness)||0)*.06+(Number(s.craving)||0)*.04;
    return state.doctor==='speed'?base*.85:base;
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
    if(state.doctor&&!state.paused&&!state.m1Complete){
      state.irritation=Math.min(98.5,state.irritation+irritationRate()*dt);
      renderPressure();
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  function handleVisibility(hidden=document.hidden){
    state.paused=!!hidden;state.lastTick=performance.now();
    statusBar.textContent=state.paused?'遊戲暫停：切回頁面後繼續計時':'R11 M1 · 病人等候計時中';
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
    $('ticketNumber').textContent=String(state.ticket).padStart(3,'0');
    $('patientPortrait').src=`assets/service/patient-${p.id}.webp`;$('patientPortrait').alt=p.name;
    $('patientRole').textContent='CURRENT PATIENT';$('patientName').textContent=p.name;$('patientComplaint').textContent=p.complaint;
    $('ftndScore').textContent=p.ftnd.total;$('ftndSeverity').textContent=p.ftnd.severity;
    $('ftndItems').innerHTML=Array.from({length:6},(_,i)=>`<span>Q${i+1}<b>${p.ftnd['q'+(i+1)]}</b></span>`).join('');
    $('symptomList').innerHTML=symptomMeta.map(([key,en,zh])=>{
      const v=p.clinicalStatus[key];return `<div class="symptom-row"><div class="symptom-label"><b>${zh}</b><span>${en}</span></div><div class="symptom-bar"><i style="width:${v/4*100}%"></i></div><strong>${v}</strong></div>`;
    }).join('');
    const pres=rx();
    $('prescriptionGrid').innerHTML=foodOrder.map(id=>`<div class="rx-chip"><img src="${food[id].img}" alt=""><div><small>${food[id].target}</small><strong>${food[id].name} ${portionLabel(pres.portions[id])}</strong></div></div>`).join('');
    renderPressure();
  }

  function updateDoctorHud(){
    const d=state.doctor?doctors[state.doctor]:null;
    $('doctorHud').innerHTML=d?`<span>DOCTOR</span><strong>${d.name}</strong>`:'<span>DOCTOR</span><strong>尚未選擇</strong>';
  }
  function shell(kicker,title,desc){
    const n=document.createElement('div');n.className='stage-shell';
    n.innerHTML=`<div class="stage-head"><small>${kicker}</small><h1>${title}</h1><p>${desc}</p></div>`;return n;
  }
  function actionRow(...items){const row=document.createElement('div');row.className='stage-actions';row.append(...items);return row;}
  function button(id,text,klass='primary-action',disabled=false){const b=document.createElement('button');b.type='button';if(id)b.id=id;b.className=klass;b.textContent=text;b.disabled=disabled;return b;}

  function doctorCard(d){
    const card=document.createElement('button');card.type='button';card.className='doctor-card';card.dataset.doctor=d.id;
    card.innerHTML=`<span class="doctor-sprite" style="--doctor-sprite:url('${d.sprite}')"></span><span class="doctor-copy"><small>${d.tag}</small><strong>${d.name}</strong><b>${d.ability}</b><em>${d.detail}</em></span><span class="choose-badge">選這位</span>`;
    card.addEventListener('click',()=>chooseDoctor(d.id));return card;
  }
  async function chooseDoctor(id){
    if(!doctors[id])return;
    state.doctor=id;state.stage='consult';state.irritation=0;state.lastTick=performance.now();state.paused=document.hidden;
    world.setDoctor(id);world.reset();updateDoctorHud();renderPatient();renderStage();statusBar.textContent='R11 M1 · 病人等候計時中';
  }
  function renderDoctorSelect(){
    const n=shell('SHIFT START · CHOOSE YOUR DOCTOR','今天由誰值班？','三位醫師都是主角；其他人物全部是病人。選定後整個 shift 使用同一位醫師。');
    const grid=document.createElement('div');grid.className='doctor-grid';Object.values(doctors).forEach(d=>grid.append(doctorCard(d)));n.append(grid);
    const note=document.createElement('div');note.className='game-note';note.innerHTML='<strong>R11 改版重點</strong><span>不再是一鍵自動料理；M1 先把角色、問診、手動備料與時間壓力做成可玩的核心。</span>';n.append(note);return n;
  }

  function renderConsult(){
    const p=patient(),pres=rx(),n=shell('01 CONSULT · 問診','先讀病人，再決定配料','病人叫號後煩躁會持續累積；Easy mode 先保留完整處方提示，讓玩法先成立。');
    const layout=document.createElement('div');layout.className='consult-layout';
    const quote=document.createElement('article');quote.className='consult-box quote-box';quote.innerHTML=`<small>PATIENT SAYS</small><blockquote>「${p.wish}」</blockquote><p>${p.complaint}</p>`;
    const target=document.createElement('article');target.className='consult-box target-box';target.innerHTML=`<small>EASY PRESCRIPTION</small><strong>豆腐 ${portionLabel(pres.portions.tofu)} · 絞肉 ${portionLabel(pres.portions.pork)}</strong><p>所有七種食材到 PREP 都必須由玩家親自選 0／半份／1份；不會自動套用。</p><div class="doctor-ability-inline">${doctors[state.doctor].name}：${doctors[state.doctor].ability}</div>`;
    layout.append(quote,target);n.append(layout);
    const b=button('consultConfirmBtn',state.traveling?'醫師前往備料檯…':'看懂需求 → 前往備料檯','primary-action',state.traveling);
    b.addEventListener('click',async()=>{
      if(state.traveling)return;state.traveling=true;renderStage();
      await world.goTo('prep',{messageText:'Q版醫師跑向備料檯'});
      state.traveling=false;state.stage='prep';renderStage();
    });
    n.append(actionRow(b));return n;
  }

  function ingredientCard(id){
    const pres=rx(),m=food[id],card=document.createElement('article');
    card.className='ingredient-card'+(state.activeFood===id?' is-active':'')+(state.touched[id]?' is-decided':'');card.dataset.food=id;
    card.innerHTML=`<img src="${m.img}" alt="${m.name}"><div class="ingredient-copy"><small>${m.target}</small><strong>${m.name}</strong><span>處方目標 ${portionLabel(pres.portions[id])}</span></div>`;
    card.addEventListener('click',e=>{if(e.target.closest('button'))return;state.activeFood=id;renderStage();});
    const row=document.createElement('div');row.className='portion-row';
    [0,.5,1].forEach(v=>{
      const b=button('',v===0?'0':v===.5?'半份':'1份','portion-btn');b.dataset.food=id;b.dataset.portion=String(v);b.setAttribute('aria-pressed',String(state.touched[id]&&state.portions[id]===v));
      b.addEventListener('click',e=>{e.stopPropagation();state.portions[id]=v;state.touched[id]=true;state.activeFood=id;renderStage();});row.append(b);
    });
    card.append(row);return card;
  }
  function decidedCount(){return foodOrder.filter(id=>state.touched[id]).length;}
  function renderTray(target){
    target.innerHTML='';
    foodOrder.forEach(id=>{if(!state.touched[id])return;const v=state.portions[id],chip=document.createElement('span');chip.className=v===0?'tray-chip is-zero':'tray-chip';chip.innerHTML=`<img src="${food[id].img}" alt="">${food[id].name} ${portionLabel(v)}`;target.append(chip);});
    if(!target.children.length)target.innerHTML='<em>尚未選擇任何食材</em>';
  }
  function renderPrep(){
    const n=shell('02 PREP · 備料','每一樣都要自己選','豆腐與絞肉已解除 hard lock；七種食材全部都能選 0／半份／1份。每張卡都要做一次決定。');
    const pressure=document.createElement('div');pressure.className='prep-banner';pressure.innerHTML=`<strong>病人在等餐 · ${Math.round(state.irritation)}%</strong><span>已決定 ${decidedCount()}/7 種食材</span>`;n.append(pressure);
    const layout=document.createElement('div');layout.className='prep-layout';
    const pantry=document.createElement('div');pantry.className='pantry';foodOrder.forEach(id=>pantry.append(ingredientCard(id)));
    const station=document.createElement('aside');station.className='prep-station';
    const active=food[state.activeFood];station.innerHTML=`<div class="prep-visual"><img class="board-img" src="assets/cooking/board_empty.png" alt="砧板"><img class="board-food-preview" src="${active.img}" alt="${active.name}"><img class="knife-img" src="assets/cooking/chef_knife.png" alt="菜刀"></div><div class="prep-station-copy"><small>NOW PREPPING</small><strong>${active.name}</strong><span>${state.touched[state.activeFood]?'你選了 '+portionLabel(state.portions[state.activeFood]):'尚未決定份量'}</span><div id="prepTray" class="prep-tray"></div></div>`;
    renderTray(station.querySelector('#prepTray'));layout.append(pantry,station);n.append(layout);
    const b=button('prepDoneBtn',decidedCount()<7?`還有 ${7-decidedCount()} 樣未決定`:'備料完成 → M1 CHECKPOINT','primary-action',decidedCount()<7);
    b.addEventListener('click',completePrep);n.append(actionRow(b));return n;
  }

  function scorePrep(){
    const expected=rx().portions;let penalty=0;const checks=[];
    foodOrder.forEach(id=>{
      const actual=Number(state.portions[id]),target=Number(expected[id]),diff=Math.abs(actual-target),p=diff>=1?15:diff>=.5?7:0;penalty+=p;
      checks.push({id,name:food[id].name,target,actual,diff,penalty:p,ok:p===0});
    });
    return {fidelity:Math.max(0,100-penalty),checks,gateB_pass:Math.max(0,100-penalty)>=70};
  }
  function completePrep(){
    if(decidedCount()<7)return;
    state.prepResult=scorePrep();state.m1Complete=true;state.stage='m1-complete';world.setMessage('M1 備料完成 · M2 將接手動炒鍋');renderStage();statusBar.textContent='R11 M1 PLAYABLE CHECKPOINT';
  }
  function renderComplete(){
    const r=state.prepResult,n=shell('M1 PLAYABLE CHECKPOINT','備料完成，R11 核心已重建','這個線上版本刻意停在 M1：下一里程碑才加入手動火力、翻炒與收汁，不會退回一鍵自動料理。');
    const hero=document.createElement('div');hero.className='checkpoint-hero';hero.innerHTML=`<div class="score-ring"><strong>${r.fidelity}</strong><span>PREP</span></div><div><small>PRESCRIPTION FIDELITY</small><h2>${r.gateB_pass?'備料邏輯通過':'配料需要再修正'}</h2><p>病人煩躁停在 ${Math.round(state.irritation)}%。目前醫師：${doctors[state.doctor].name}。</p></div>`;n.append(hero);
    const grid=document.createElement('div');grid.className='prep-result-grid';r.checks.forEach(c=>{const row=document.createElement('div');row.className='prep-result '+(c.ok?'is-ok':'is-wrong');row.innerHTML=`<strong>${c.name}</strong><span>${portionLabel(c.actual)} / 目標 ${portionLabel(c.target)}</span><b>${c.ok?'✓':'−'+c.penalty}</b>`;grid.append(row);});n.append(grid);
    const retry=button('retryPrepBtn','重新備料','secondary-action');retry.addEventListener('click',()=>{state.m1Complete=false;state.prepResult=null;state.stage='prep';state.portions=Object.fromEntries(foodOrder.map(id=>[id,0]));state.touched=Object.fromEntries(foodOrder.map(id=>[id,false]));state.activeFood='tofu';state.lastTick=performance.now();renderStage();statusBar.textContent='R11 M1 · 病人等候計時中';});
    const locked=button('m2LockedBtn','M2 · 手動炒鍋（下一里程碑）','primary-action',true);n.append(actionRow(retry,locked));return n;
  }

  function renderStage(){
    renderPatient();updateDoctorHud();
    stagePanel.replaceChildren(state.stage==='doctor-select'?renderDoctorSelect():state.stage==='consult'?renderConsult():state.stage==='prep'?renderPrep():renderComplete());
  }

  window.CKR11={
    snapshot:()=>({version:state.version,ticket:state.ticket,patient:patient(),prescription:rx(),doctor:state.doctor,stage:state.stage,traveling:state.traveling,portions:{...state.portions},touched:{...state.touched},irritation:Number(state.irritation.toFixed(3)),paused:state.paused,m1Complete:state.m1Complete,prepResult:state.prepResult,world:world.snapshot()}),
    __qaSetHidden:v=>handleVisibility(!!v)
  };
  world.setMessage('先選擇值班醫師');renderStage();
})();