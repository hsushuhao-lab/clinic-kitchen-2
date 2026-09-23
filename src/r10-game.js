/* R10 clean gameplay: one-way clinic/kitchen loop with visible prep, wok and service actions. */
(() => {
  'use strict';
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const rules=window.CKClinicRules, world=window.CKR10World;
  if(!rules||!world)throw new Error('R10 dependencies missing');

  const dom={
    ticket:$('#ticketNumber'),portrait:$('#patientPortrait'),name:$('#patientName'),role:$('#patientRole'),
    complaint:$('#patientComplaint'),ftndScore:$('#ftndScore'),ftndSeverity:$('#ftndSeverity'),
    ftndItems:$('#ftndItems'),symptoms:$('#symptomList'),rx:$('#prescriptionGrid'),
    stage:$('#stagePanel'),status:$('#statusBar')
  };
  const symptomDefs=[
    ['craving','Craving','菸癮'],['irritability','Irritability','煩躁'],['anxiety','Anxiety','焦慮'],
    ['concentration','Concentration','集中困難'],['restlessness','Restlessness','坐立難安'],
    ['appetite','Appetite','食慾困難'],['sleep','Sleep','睡眠困擾']
  ];
  const foodOrder=['tofu','pork','douban','garlic','scallion','chili','pepper'];
  const food={
    tofu:{name:'豆腐',target:'固定基底',prep:'assets/ingredients/mapo_tofu/tofu.png',wok:'assets/cooking/tofu_cubes.png'},
    pork:{name:'絞肉',target:'固定基底',prep:'assets/ingredients/mapo_tofu/pork.png',wok:'assets/cooking/pork_raw_mound.png',browned:'assets/cooking/pork_browned.png'},
    douban:{name:'豆瓣醬',target:'Craving',prep:'assets/ingredients/mapo_tofu/douban.png',wok:'assets/ingredients/mapo_tofu/douban.png'},
    garlic:{name:'蒜',target:'Irritability',prep:'assets/ingredients/mapo_tofu/garlic.png',wok:'assets/cooking/garlic_mince.png'},
    scallion:{name:'青蔥',target:'Concentration',prep:'assets/ingredients/mapo_tofu/scallion.png',wok:'assets/cooking/scallion_rings.png'},
    chili:{name:'辣椒',target:'Restlessness',prep:'assets/ingredients/mapo_tofu/chili.png',wok:'assets/ingredients/mapo_tofu/chili.png'},
    pepper:{name:'花椒',target:'Anxiety',prep:'assets/ingredients/mapo_tofu/pepper.png',wok:'assets/ingredients/mapo_tofu/pepper.png'}
  };
  const state={
    ticket:1,patientIndex:0,stage:'consult',traveling:false,activeFood:'tofu',
    portions:{},fireOn:false,stirs:0,stirPulse:false,simmering:false,simmerReady:false,simmerTimer:null,
    rice:null,miso:null,result:null,clinical:null,review:null,won:null
  };
  const patient=()=>rules.patients[state.patientIndex%rules.patients.length];
  const rx=()=>rules.buildClinicalPrescription(patient());
  const ticketText=()=>String(state.ticket).padStart(3,'0');
  const portionText=v=>Number(v)===0?'0':Number(v)===.5?'半':'1';
  const resetPortions=()=>{state.portions={tofu:1,pork:1,douban:0,garlic:0,scallion:0,chili:0,pepper:0};};
  const clearTimers=()=>{if(state.simmerTimer)clearTimeout(state.simmerTimer);state.simmerTimer=null;};

  function makeButton(id,label,klass='primary-action',disabled=false){
    const b=document.createElement('button');b.type='button';if(id)b.id=id;b.className=klass;b.textContent=label;b.disabled=disabled;return b;
  }
  function shell(kicker,title,desc){
    const node=document.createElement('section');node.className='stage-shell';
    const head=document.createElement('header');head.className='stage-head';
    head.innerHTML='<small>'+kicker+'</small><h2>'+title+'</h2><p>'+desc+'</p>';node.append(head);return node;
  }
  function actionRow(button){const r=document.createElement('div');r.className='stage-actions';r.append(button);return r;}

  function renderRail(){
    const p=patient(),pres=rx();dom.ticket.textContent=ticketText();dom.portrait.src='assets/service/'+p.id+'.webp';dom.portrait.alt=p.name+' 人物插畫';
    dom.name.textContent=p.name;dom.role.textContent=ticketText()+' 號病人';dom.complaint.textContent=p.complaint||p.wish||'';
    dom.ftndScore.textContent=p.ftnd?.total??'-';dom.ftndSeverity.textContent=p.ftnd?.severity??'';
    dom.ftndItems.replaceChildren();for(let i=1;i<=6;i++){const s=document.createElement('span');s.textContent='Q'+i+' '+(p.ftnd?.['q'+i]??'-');dom.ftndItems.append(s);}
    dom.symptoms.replaceChildren();symptomDefs.forEach(([id,en,zh])=>{const v=Number(p.clinicalStatus?.[id]||0),row=document.createElement('div');row.className='symptom-row';row.innerHTML='<div class="symptom-label"><span>'+en+'</span><b>'+zh+'</b></div><div class="symptom-bar"><i style="width:'+(v/4*100)+'%"></i></div><strong>'+v+'/4</strong>';dom.symptoms.append(row);});
    dom.rx.replaceChildren();
    const items=[['douban',pres.portions.douban,'Craving'],['garlic',pres.portions.garlic,'Irritability'],['pepper',pres.portions.pepper,'Anxiety'],['scallion',pres.portions.scallion,'Concentration'],['chili',pres.portions.chili,'Restlessness']];
    items.forEach(([id,v,target])=>{const c=document.createElement('div');c.className='rx-chip';c.innerHTML='<img src="'+food[id].prep+'" alt="'+food[id].name+'"><div><small>'+target+'</small><strong>'+food[id].name+' '+portionText(v)+'</strong></div>';dom.rx.append(c);});
    const rice=document.createElement('div');rice.className='rx-chip';rice.innerHTML='<img src="'+(pres.rice==='半碗飯'?'assets/service/rice-half.webp':'assets/service/rice-full.webp')+'" alt="'+pres.rice+'"><div><small>Appetite</small><strong>'+pres.rice+'</strong></div>';dom.rx.append(rice);
    const soup=document.createElement('div');soup.className='rx-chip';soup.innerHTML='<img src="'+(pres.miso?'assets/service/miso_yes.webp':'assets/service/miso_no.webp')+'" alt="味噌湯"><div><small>Sleep</small><strong>'+(pres.miso?'味噌湯 YES':'味噌湯 NO')+'</strong></div>';dom.rx.append(soup);
  }

  async function moveTo(stage,opts={}){
    state.traveling=true;renderStage();await world.goTo(stage,opts);state.traveling=false;state.stage=stage;renderStage();
  }

  function renderConsult(){
    const p=patient(),pres=rx(),n=shell('01 CONSULT · 問診',ticketText()+' 號 '+p.name,'先看主訴與左側處方，再讓醫師跑到備料檯。');
    const layout=document.createElement('div');layout.className='consult-layout';
    const complaint=document.createElement('article');complaint.className='consult-box';complaint.innerHTML='<small>PATIENT SAYS</small><blockquote>'+p.complaint+'</blockquote>';
    const target=document.createElement('article');target.className='consult-box consult-target';target.innerHTML='<small>本號配餐</small><strong>'+pres.rice+' · '+(pres.miso?'要味噌湯':'不要味噌湯')+'</strong><p>豆腐、絞肉固定 1 份；豆瓣、蒜、青蔥、辣椒、花椒依左側 Clinical Prescription。</p>';
    layout.append(complaint,target);n.append(layout);
    const b=makeButton('consultConfirmBtn',state.traveling?'醫師前往備料檯…':'確認處方 → 前往備料檯','primary-action',state.traveling);
    b.addEventListener('click',()=>{resetPortions();state.activeFood='tofu';state.fireOn=false;state.stirs=0;state.simmering=false;state.simmerReady=false;state.rice=null;state.miso=null;moveTo('prep',{messageText:'Q版醫師跑向備料檯'});});
    n.append(actionRow(b));return n;
  }

  function ingredientCard(id){
    const pres=rx(),fixed=id==='tofu'||id==='pork',m=food[id],card=document.createElement('article');
    card.className='ingredient-card'+(state.activeFood===id?' is-active':'');card.dataset.food=id;
    card.innerHTML='<img src="'+m.prep+'" alt="'+m.name+'"><div class="ingredient-copy"><strong>'+m.name+'</strong><small>'+m.target+(fixed?' · 固定 1':' · 處方 '+portionText(pres.portions[id]))+'</small></div>';
    card.addEventListener('click',e=>{if(e.target.closest('button'))return;state.activeFood=id;renderStage();});
    const row=document.createElement('div');row.className='portion-row';
    if(fixed){const s=document.createElement('span');s.className='fixed-pill';s.textContent='固定 1 份';row.append(s);}
    else [0,.5,1].forEach(v=>{const b=makeButton('',v===.5?'半份':v+'份','portion-btn');b.dataset.food=id;b.dataset.portion=String(v);b.setAttribute('aria-pressed',String(state.portions[id]===v));b.addEventListener('click',e=>{e.stopPropagation();state.portions[id]=v;state.activeFood=id;renderStage();});row.append(b);});
    card.append(row);return card;
  }

  function renderPrep(){
    const n=shell('02 PREP · 備料','廚房配料','點食材、調份量；右側砧板會跟著變動。完成後醫師跑到炒鍋。');
    const layout=document.createElement('div');layout.className='prep-layout';
    const pantry=document.createElement('div');pantry.className='pantry';foodOrder.forEach(id=>pantry.append(ingredientCard(id)));
    const station=document.createElement('div');station.className='prep-station';
    const active=food[state.activeFood];station.innerHTML='<img class="board-img" src="assets/cooking/board_empty.png" alt="砧板"><img id="boardFoodPreview" class="board-food-preview" src="'+active.prep+'" alt="'+active.name+'"><img class="knife-img" src="assets/cooking/chef_knife.png" alt="菜刀"><div class="prep-station-copy"><strong>現在處理：'+active.name+'</strong><span>目前份量：'+portionText(state.portions[state.activeFood])+' 份</span><div id="prepTray" class="prep-tray"></div></div>';
    const tray=station.querySelector('#prepTray');foodOrder.filter(id=>Number(state.portions[id])>0).forEach(id=>{const s=document.createElement('span');s.innerHTML='<img src="'+food[id].prep+'" alt="">'+food[id].name+' '+portionText(state.portions[id]);tray.append(s);});
    layout.append(pantry,station);n.append(layout);
    const b=makeButton('prepDoneBtn',state.traveling?'醫師前往炒鍋…':'備料完成 → 食材端去炒鍋','primary-action',state.traveling);
    b.addEventListener('click',()=>moveTo('wok',{messageText:'端著備料跑向炒鍋'}));n.append(actionRow(b));return n;
  }

  function startSimmer(){
    clearTimers();state.simmering=true;state.simmerReady=false;renderStage();
    state.simmerTimer=setTimeout(()=>{state.simmerTimer=null;if(state.stage==='wok'){state.simmering=false;state.simmerReady=true;renderStage();}},1600);
  }

  function renderWok(){
    const n=shell('03 WOK · 翻炒','開火、翻炒、收汁','食材已全部進鍋。先開火，再用鍋鏟翻炒 3 次；第三次後自動收汁。');
    const layout=document.createElement('div');layout.className='wok-layout';
    const visual=document.createElement('div');visual.className='wok-visual'+(state.stirPulse?' is-stirring':'')+(state.simmering?' is-simmering':'')+(state.simmerReady?' is-ready':'');
    visual.innerHTML='<img class="wok-stove" src="assets/chibi/stove.webp" alt="爐台"><div class="flame-r10'+(state.fireOn?' is-on':'')+'"><i></i><i></i><i></i></div><img class="wok-pan" src="assets/cooking/wok_empty.png" alt="炒鍋"><div id="wokFoodLayer" class="wok-food-layer"></div><img class="simmer-overlay" src="assets/cooking/wok_simmering.png" alt=""><span class="steam"></span><span class="steam s2"></span><img class="spatula-img" src="assets/cooking/metal_spatula.png" alt="鍋鏟">';
    const layer=visual.querySelector('#wokFoodLayer');foodOrder.forEach(id=>{if(Number(state.portions[id])<=0)return;const img=document.createElement('img');img.className='wok-food';img.dataset.food=id;img.src=id==='pork'&&state.stirs>0?food[id].browned:food[id].wok;img.alt=food[id].name;layer.append(img);});
    const controls=document.createElement('div');controls.className='wok-controls';
    const fireCard=document.createElement('div');fireCard.className='control-card';fireCard.innerHTML='<strong>1. 爐火</strong><span>'+(state.fireOn?'爐火已開，可以翻炒':'先開火熱鍋')+'</span>';
    const fireBtn=makeButton('fireBtn',state.fireOn?'🔥 爐火已開':'🔥 開火','wok-btn secondary',state.fireOn||state.simmerReady);fireBtn.addEventListener('click',()=>{state.fireOn=true;renderStage();});
    const stirCard=document.createElement('div');stirCard.className='control-card';const dots=[0,1,2].map(i=>'<i class="'+(i<state.stirs?'is-done':'')+'"></i>').join('');stirCard.innerHTML='<strong>2. 翻炒 3 次</strong><span>鍋鏟把豆腐與配料推勻</span><div class="progress-dots">'+dots+'</div>';
    const stirBtn=makeButton('stirBtn',state.stirs>=3?'翻炒完成':'翻炒 '+state.stirs+'/3','wok-btn',!state.fireOn||state.stirs>=3||state.simmering||state.simmerReady);
    stirBtn.addEventListener('click',()=>{if(stirBtn.disabled)return;state.stirs++;state.stirPulse=true;renderStage();setTimeout(()=>{state.stirPulse=false;if(state.stage==='wok')renderStage();},360);if(state.stirs===3)startSimmer();});
    const simmer=document.createElement('div');simmer.className='control-card';simmer.innerHTML='<strong>3. 收汁</strong><span>'+(state.simmerReady?'紅油收汁完成，可以起鍋':state.simmering?'鍋中咕嘟收汁中…':'翻炒 3 次後開始')+'</span>';
    const done=makeButton('wokDoneBtn',state.traveling?'醫師前往配餐檯…':'關火起鍋 → 前往配餐','wok-btn',!state.simmerReady||state.traveling);
    done.addEventListener('click',()=>{state.fireOn=false;moveTo('serve',{messageText:'端著麻婆豆腐跑向配餐檯'});});
    controls.append(fireCard,fireBtn,stirCard,stirBtn,simmer,done);
    layout.append(visual,controls);n.append(layout);return n;
  }
  function simimerAlias(x){return x}
  function simimmerFix(x){return x}

  function serveChoice(id,label,src,active,handler){
    const b=makeButton(id,'','serve-choice');b.setAttribute('aria-pressed',String(active));b.innerHTML='<img src="'+src+'" alt=""><span>'+label+'</span>';b.addEventListener('click',handler);return b;
  }
  function renderServe(){
    const pres=rx(),n=shell('04 SERVE · 配餐','白飯與味噌湯','飯量與湯品都會直接反映在左側餐盤預覽。');
    const goal=document.createElement('div');goal.className='serve-goal';goal.innerHTML='<strong>本號目標</strong><span>'+pres.rice+'</span><span>'+(pres.miso?'要味噌湯':'不要味噌湯')+'</span>';n.append(goal);
    const layout=document.createElement('div');layout.className='serve-layout';
    const tray=document.createElement('div');tray.className='tray-stage';tray.innerHTML='<div class="tray-board"></div><img class="tray-dish" src="assets/cooking/dish_plated.png" alt="麻婆豆腐"><div id="riceSlot"></div><div id="soupSlot"></div><div id="trayCaption" class="tray-caption"></div>';
    const riceSlot=tray.querySelector('#riceSlot');if(state.rice){const img=document.createElement('img');img.id='trayRice';img.className='tray-rice';img.src=state.rice==='半碗飯'?'assets/service/rice-half.webp':'assets/service/rice-full.webp';img.alt=state.rice;riceSlot.append(img);}
    const soupSlot=tray.querySelector('#soupSlot');if(state.miso===true){const img=document.createElement('img');img.id='traySoup';img.className='tray-soup';img.src='assets/service/miso_yes.webp';img.alt='味噌湯';soupSlot.append(img);}else if(state.miso===false){const empty=document.createElement('div');empty.id='trayNoSoup';empty.className='tray-empty';empty.textContent='不附湯';soupSlot.append(empty);}
    tray.querySelector('#trayCaption').textContent=(state.rice||'尚未選飯')+' · '+(state.miso===null?'尚未選湯':state.miso?'味噌湯 YES':'味噌湯 NO');
    const choices=document.createElement('div');choices.className='serve-choices';
    const riceGroup=document.createElement('section');riceGroup.className='serve-group';riceGroup.innerHTML='<h3>白飯份量</h3>';const rr=document.createElement('div');rr.className='choice-row';rr.append(serveChoice('riceHalfBtn','半碗飯','assets/service/rice-half.webp',state.rice==='半碗飯',()=>{state.rice='半碗飯';renderStage();}),serveChoice('riceFullBtn','一碗飯','assets/service/rice-full.webp',state.rice==='正常飯',()=>{state.rice='正常飯';renderStage();}));riceGroup.append(rr);
    const soupGroup=document.createElement('section');soupGroup.className='serve-group';soupGroup.innerHTML='<h3>味噌湯</h3>';const sr=document.createElement('div');sr.className='choice-row';sr.append(serveChoice('misoNoBtn','不要','assets/service/miso_no.webp',state.miso===false,()=>{state.miso=false;renderStage();}),serveChoice('misoYesBtn','要','assets/service/miso_yes.webp',state.miso===true,()=>{state.miso=true;renderStage();}));soupGroup.append(sr);choices.append(riceGroup,soupGroup);
    layout.append(tray,choices);n.append(layout);
    const ready=state.rice!==null&&state.miso!==null,b=makeButton('serveDoneBtn',state.traveling?'送餐中…':ready?'完成配餐 → 端回診間':'先選飯量與湯品','primary-action',!ready||state.traveling);
    b.addEventListener('click',deliver);n.append(actionRow(b));return n;
  }

  async function deliver(){
    if(state.rice===null||state.miso===null||state.traveling)return;
    state.traveling=true;state.stage='delivery';world.setCarry(true);renderStage();
    await world.goTo('consult',{carry:true,messageText:'Q版醫師端餐跑回診間'});
    world.setCarry(false);state.traveling=false;finishOrder();state.stage='result';renderStage();
  }

  function finishOrder(){
    const p=patient(),pres=rx(),order={spicy:p.spicy,scallion:p.scallion,rice:pres.rice,miso:pres.miso};
    const dish={contents:{...state.portions},stirs:3,eqSimmerTime:4,highHeatSeconds:4,lowHeatSeconds:0,isSimmered:true,isBurnt:false,rice:state.rice,miso:state.miso};
    state.result=rules.evaluateR8(order,dish,p);
    state.clinical=rules.calculateClinicalMetrics(p.clinicalStatus,state.result.quality,state.result.checks,order,dish);
    state.won=!state.result.hardFail&&state.clinical.success;
    state.review=rules.generatePatientReview(p,state.result.quality,state.result.checks,dish,state.won);
  }

  function renderDelivery(){
    const n=shell('DELIVERY · 送餐','端餐回診間','Q版醫師正在把完成的麻婆豆腐送回病人面前。');
    const box=document.createElement('div');box.className='consult-box consult-target';box.innerHTML='<small>AUTO DELIVERY</small><strong>餐點已裝盤</strong><p>請看上方跑圖；抵達診間後會自動進入結算。</p>';n.append(box);return n;
  }

  function renderResult(){
    const n=shell('RESULT · 結算',state.won?'病人滿意':'處方不符','同一套 R8 Prescription Fidelity / Gate B 規則進行結算。');
    const layout=document.createElement('div');layout.className='result-layout';
    const hero=document.createElement('div');hero.className='result-hero'+(state.won?'':' is-fail');hero.innerHTML='<img src="'+(state.won?'assets/finale/success_clinic_meal.webp':'assets/finale/failure_table_flip.webp')+'" alt="結算"><div class="result-summary"><span class="gate-pill '+(state.result.gateB_pass?'pass':'fail')+'">Gate B '+(state.result.gateB_pass?'PASS':'FAIL')+'</span><strong id="resultQuality">'+state.result.quality+'%</strong><small>Prescription fidelity <b id="resultFidelity">'+state.result.prescriptionFidelity+'%</b></small><blockquote>'+state.review.quote+'</blockquote></div>';
    const table=document.createElement('div');table.className='result-table';table.innerHTML='<table><thead><tr><th>項目</th><th>目標</th><th>實際</th><th>結果</th></tr></thead><tbody></tbody></table>';const body=table.querySelector('tbody');
    state.result.checks.forEach(c=>{const tr=document.createElement('tr');if(!c.ok)tr.className='is-miss';tr.innerHTML='<td>'+c.label+'</td><td>'+c.expected+'</td><td>'+c.actual+'</td><td>'+(c.ok?'✓':'−'+c.penalty)+'</td>';body.append(tr);});
    layout.append(hero,table);n.append(layout);
    const b=makeButton('nextPatientBtn','叫下一號','primary-action');b.addEventListener('click',nextPatient);n.append(actionRow(b));return n;
  }

  function renderStage(){
    dom.stage.replaceChildren();
    let node;if(state.stage==='consult')node=renderConsult();else if(state.stage==='prep')node=renderPrep();else if(state.stage==='wok')node=renderWok();else if(state.stage==='serve')node=renderServe();else if(state.stage==='delivery')node=renderDelivery();else node=renderResult();
    dom.stage.append(node);
    dom.status.textContent=ticketText()+' 號 · '+state.stage.toUpperCase()+' · '+(state.traveling?'醫師移動中':'依畫面完成目前工作站');
  }

  function nextPatient(){
    clearTimers();state.ticket++;state.patientIndex=(state.patientIndex+1)%rules.patients.length;state.stage='consult';state.traveling=false;state.activeFood='tofu';resetPortions();state.fireOn=false;state.stirs=0;state.stirPulse=false;state.simmering=false;state.simmerReady=false;state.rice=null;state.miso=null;state.result=null;state.clinical=null;state.review=null;state.won=null;world.reset();renderRail();renderStage();
  }
  function snapshot(){return {version:'R10_KITCHEN_REBUILD',ticket:state.ticket,patient:{id:patient().id,name:patient().name},stage:state.stage,traveling:state.traveling,prescription:JSON.parse(JSON.stringify(rx())),portions:{...state.portions},activeFood:state.activeFood,fireOn:state.fireOn,stirs:state.stirs,simmerReady:state.simmerReady,rice:state.rice,miso:state.miso,result:state.result?JSON.parse(JSON.stringify(state.result)):null,won:state.won,world:world.snapshot()};}

  resetPortions();world.whenReady().then(()=>world.reset());renderRail();renderStage();
  window.CKR10={snapshot,render:()=>{renderRail();renderStage();},nextPatient};
})();
