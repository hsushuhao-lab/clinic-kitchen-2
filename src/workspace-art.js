/* Rendering only. The existing mission, timers, collisions, portions and score are unchanged.
   Loose food sprites replace photo squares and tray crops; originals stay in Git. */
(function(){
 'use strict';
 const root='assets/workspace/';
 const foodArt=(food,stage)=>{
   const names={tofu:['tofu-whole','tofu-halves','tofu-strips','tofu-diced'],scallion:['scallion-whole','scallion-cut'],garlic:['garlic-whole','garlic-cut'],pork:['pork-raw','pork-cut'],douban:['douban-paste'],pepper:['pepper']};
   const list=names[food];return list?root+list[Math.min(stage,list.length-1)]+'.webp':'';
 };
 // Classic-script renderer functions are an intentional presentation seam.
 // Nothing writes game state, dispatches actions or observes its own mutations.
 window.getBoardFoodImage=(food,stage)=>{
   const board=document.getElementById('boardStage');board.dataset.food=food;board.dataset.cut=String(stage);
   return foodArt(food,stage);
 };
 window.syncWokFoodDOM=()=>{
   document.getElementById('boardSpoon').hidden=selectedFood!=='douban';
   document.getElementById('boardKnife').hidden=selectedFood==='douban';
   const deck=document.getElementById('cookingDeck');
   deck.dataset.rice=cookedDish.ricePortion==='未盛飯'?'empty':'ready';deck.dataset.plated=String(plated);
   const container=document.getElementById('wokFoodLayer');
   if(!container)return;
   if(!inWok.size||plated){container.replaceChildren();return;}
   const items={pork:stirs?'pork-cooked':'pork-raw',garlic:'garlic-cut',douban:'douban-paste',tofu:'tofu-diced',scallion:'scallion-cut',pepper:'pepper'};
   for(const [id,name] of Object.entries(items)){
     let image=container.querySelector(`[data-ingredient="${id}"]`);
     if(!inWok.has(id)){image?.remove();continue;}
     if(!image){image=document.createElement('img');image.dataset.ingredient=id;image.className=`wok-food-item wok-food-${id}`;image.alt=foodNames[id];container.append(image);}
     const src=root+name+'.webp';if(image.getAttribute('src')!==src)image.src=src;
   }
   container.dataset.redOil=String(inWok.has('douban'));
   container.dataset.simmered=String(stirs>=3&&inWok.size>=4);
 };
 window.CKWorkspaceArt={version:'workspace-r1',foodArt};
})();
