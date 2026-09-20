/* R4 clinic order and route definitions shared by scene, UI and tests. */
(function(root){
  'use strict';
  const patients = Object.freeze([
    {id:'office',name:'上班族',wish:'今天想吃正常辣，不要蔥，半碗飯就好。',spicy:'正常',scallion:false,rice:'半碗飯'},
    {id:'student',name:'大學生',wish:'想吃正常辣、加蔥花，配一整碗飯。',spicy:'正常',scallion:true,rice:'正常飯'},
    {id:'driver',name:'司機',wish:'給我重辣、蔥花多香一點，飯要正常份量。',spicy:'重辣',scallion:true,rice:'正常飯'},
    {id:'auntie',name:'阿姨',wish:'正常辣、要蔥花，今天飯只要半碗。',spicy:'正常',scallion:true,rice:'半碗飯'},
    {id:'quiet',name:'安靜的訪客',wish:'我想吃正常辣，不要蔥，飯要一碗。',spicy:'正常',scallion:false,rice:'正常飯'},
    {id:'repeat',name:'熟客',wish:'這次試試重辣，不放蔥，再配半碗飯。',spicy:'重辣',scallion:false,rice:'半碗飯'}
  ]);
  const stations = Object.freeze([
    {id:'patient',name:'病人椅',label:'01 看診',x:-10.5,z:-1.4,at:[-10.5,-.65],r:1.3},
    {id:'desk',name:'醫師桌',label:'02 電腦',x:-7,z:-1.8,at:[-7,-1],r:1.5},
    {id:'fridge',name:'冰箱',label:'03 取材',x:.2,z:-2.4,at:[.2,-1.4],r:1.6},
    {id:'prep',name:'備料檯',label:'04 備料',x:5,z:-2.2,at:[5,-1.4],r:1.6},
    {id:'wok',name:'炒鍋爐台',label:'05 炒鍋',x:9,z:-2.2,at:[9,-1.35],r:1.6},
    {id:'rice',name:'電子鍋',label:'06 配飯・出餐',x:11.5,z:-2.2,at:[11.5,-1.35],r:1.6}
  ]);
  // Each complete excess second costs 1 point; neither retries nor re-heating erase it.
  function heatPenalty(seconds=0,burnt=false){
    return Math.max(burnt?20:0,Math.min(20,Math.floor(Math.max(0,seconds)+1e-7)));
  }
  function evaluate(order,dish){
    const heat=heatPenalty(dish.overheatSeconds,dish.isBurnt);
    const actual={spicy:dish.hasPepper&&dish.hasDouban?'重辣':dish.hasDouban?'正常':'微辣',scallion:!!dish.hasScallion,rice:dish.ricePortion};
    const checks=[
      {label:'辣度',expected:order.spicy,actual:actual.spicy,ok:actual.spicy===order.spicy,penalty:10},
      {label:'蔥花',expected:order.scallion?'要蔥':'不要蔥',actual:actual.scallion?'有蔥':'無蔥',ok:actual.scallion===order.scallion,penalty:order.scallion?10:15},
      {label:'飯量',expected:order.rice,actual:actual.rice,ok:actual.rice===order.rice,penalty:actual.rice==='未盛飯'?15:5},
      {label:'火候',expected:'4秒收汁後關火',actual:!dish.isSimmered?'未收汁':heat?`大火逾時 ${(dish.overheatSeconds||0).toFixed(1)}秒${dish.isBurnt?'／焦鍋':''}`:'收汁完成',ok:dish.isSimmered&&heat===0,penalty:dish.isSimmered?heat:15}
    ];
    return {quality:Math.max(50,100-checks.reduce((n,c)=>n+(c.ok?0:c.penalty),0)),checks,actual};
  }
  root.CKClinicRules={patients,stations,evaluate,heatPenalty};
  if(typeof module!=='undefined')module.exports=root.CKClinicRules;
})(typeof window==='undefined'?globalThis:window);
