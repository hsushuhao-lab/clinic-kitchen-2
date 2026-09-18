'use strict';
/**
 * Clinic Kitchen 2.0 — Main Game Controller & 8-Stage Mission State Machine
 * Real-time 3D Walkable Scene + Culinary Workbench Integration
 *
 * 8-Stage Mission Flow:
 *   1. STAGE_CONSULT (問診) -> Walk to patient chair & press E
 *   2. STAGE_ORDER (開單) -> Walk to doctor desk or order printer & press E
 *   3. STAGE_GATHER (取材) -> Walk to transition fridge & press E
 *   4. STAGE_PREP (備料) -> Walk to prep counter, cut tofu/pork/douban/garlic
 *   5. STAGE_COOK (翻炒) -> Walk to wok station, heat, add, stir 3x
 *   6. STAGE_PLATE (盛盤) -> Turn off flame & plate Mapo Tofu into ceramic bowl
 *   7. STAGE_SERVE (送餐) -> Carry tray with dish back to clinic patient chair
 *   8. STAGE_FIRST_BITE (第一口) -> Patient first bite cutscene & 100% satisfaction score
 *
 * Game context notice: Mapo Tofu is a fictional gaming stress-relief culinary setting.
 * No clinical efficacy or smoking cessation claims.
 */

const $ = id => document.getElementById(id);
const world = $('world'), camera = $('camera'), player = $('player');
const keys = new Set(), visited = new Set();
const props = [...document.querySelectorAll('.prop')];
const foodButtons = [...document.querySelectorAll('[data-food]')];
const foodNames = { tofu: '豆腐', pork: '絞肉', douban: '豆瓣醬', garlic: '蒜', pepper: '花椒', scallion: '青蔥' };
const required = ['tofu', 'pork', 'douban', 'garlic'];
const prepped = new Set(), inWok = new Set();
let x = 250, y = 470, previousTime = 0;
let selectedFood = null, heated = false, stirs = 0, plated = false;

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

// 8-Stage Mission State Machine
const STAGES = {
  CONSULT: 0,
  ORDER: 1,
  GATHER: 2,
  PREP: 3,
  COOK: 4,
  PLATE: 5,
  SERVE: 6,
  FIRST_BITE: 7
};
let currentStage = STAGES.CONSULT;

// Dialog modal elements
const dialogModal = $('dialogModal');
const dialogBadge = $('dialogBadge');
const dialogTitle = $('dialogTitle');
const dialogContent = $('dialogContent');
const dialogScore = $('dialogScore');
const dialogScoreText = $('dialogScoreText');
const dialogActionBtn = $('dialogActionBtn');
const dialogCloseBtn = $('dialogCloseBtn');

let dialogOpen = false;
let dialogCallback = null;

function setStage(stage) {
  currentStage = stage;
  if (window.setMissionStage) window.setMissionStage(stage);
  if (window.setCarryingTray) window.setCarryingTray(stage === STAGES.SERVE);
  if (window.setPatientDishVisible) window.setPatientDishVisible(stage >= STAGES.FIRST_BITE);
  updateMissionUI();
  updateCooking();
}

function updateMissionUI() {
  const stageNames = [
    '1. 診間問診',
    '2. 開立料理單',
    '3. 冰箱取材',
    '4. 備料切配',
    '5. 炒鍋翻炒',
    '6. 盛盤出鍋',
    '7. 送餐回診間',
    '8. 第一口回饋'
  ];
  const objectives = [
    '階段 1/8：前往診間病人椅按 E 進行問診',
    '階段 2/8：前往醫師桌或處方機開立料理單',
    '階段 3/8：前往過渡區冰箱按 E 取出料理食材',
    '階段 4/8：在備料檯切配豆腐、絞肉、豆瓣醬、蒜',
    '階段 5/8：炒鍋開火、下鍋食材並翻炒 3 次',
    '階段 6/8：火候適當，點擊盛盤麻婆豆腐',
    '階段 7/8：端起托盤送回診間病人椅按 E 送餐',
    '階段 8/8：病患品嚐完成｜滿意度 100% 達成！按 R 可重新開始'
  ];

  if ($('missionStage')) {
    $('missionStage').innerHTML = `目前階段：<strong>${stageNames[currentStage]}</strong>`;
  }
  if ($('cookObjective')) {
    $('cookObjective').textContent = objectives[currentStage];
  }

  const steps = document.querySelectorAll('#missionSteps li');
  steps.forEach((li, idx) => {
    li.classList.toggle('is-active', idx === currentStage);
    li.classList.toggle('is-completed', idx < currentStage);
  });
}

function showDialog({ badge, title, content, showScore, scoreText, confirmText, onConfirm }) {
  if (!dialogModal) return;
  dialogBadge.textContent = badge || 'CLINIC EMR';
  dialogTitle.textContent = title || '通知';
  dialogContent.innerHTML = content || '';
  if (showScore) {
    dialogScore.removeAttribute('hidden');
    if (scoreText) dialogScoreText.textContent = scoreText;
  } else {
    dialogScore.setAttribute('hidden', '');
  }
  dialogActionBtn.textContent = confirmText || '確認繼續 (Enter / E)';
  dialogCallback = onConfirm || null;
  dialogModal.removeAttribute('hidden');
  dialogOpen = true;
  dialogActionBtn.focus();
}

function closeDialog() {
  if (!dialogModal) return;
  dialogModal.setAttribute('hidden', '');
  dialogOpen = false;
  if (dialogCallback) {
    const cb = dialogCallback;
    dialogCallback = null;
    cb();
  }
  world.focus({ preventScroll: true });
}

if (dialogActionBtn) dialogActionBtn.addEventListener('click', closeDialog);
if (dialogCloseBtn) dialogCloseBtn.addEventListener('click', closeDialog);

function propRect(prop) {
  return {
    x: prop.parentElement.offsetLeft + prop.offsetLeft,
    y: prop.parentElement.offsetTop + prop.offsetTop,
    w: prop.offsetWidth,
    h: prop.offsetHeight
  };
}

function nearProp() {
  const px = x + player.offsetWidth / 2, py = y + player.offsetHeight - 10;
  let nearest = null, distance = 100;
  for (const prop of props) {
    const r = propRect(prop);
    const d = Math.hypot(px - clamp(px, r.x, r.x + r.w), py - clamp(py, r.y, r.y + r.h));
    if (d < distance) { nearest = prop; distance = d; }
  }
  return nearest;
}

function canStand(nx, ny) {
  const feet = { x: nx + 14, y: ny + player.offsetHeight - 18, w: 34, h: 16 };
  return props.every(prop => {
    const r = propRect(prop);
    return feet.x + feet.w <= r.x || feet.x >= r.x + r.w ||
      feet.y + feet.h <= r.y || feet.y >= r.y + r.h;
  });
}

function updateCameraAndPlayer() {
  player.style.left = `${x}px`;
  player.style.top = `${y}px`;
  const cx = clamp(x + player.offsetWidth / 2 - world.clientWidth / 2, 0, Math.max(0, 1800 - world.clientWidth));
  const cy = clamp(y + player.offsetHeight / 2 - world.clientHeight / 2, 0, Math.max(0, 760 - world.clientHeight));
  camera.style.transform = `translate(${-cx}px, ${-cy}px)`;
}

function move(now) {
  const dt = previousTime ? Math.min((now - previousTime) / 1000, 0.1) : 0;
  previousTime = now;
  let dx = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
  let dy = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
  const length = Math.hypot(dx, dy) || 1;
  const speed = keys.has('shift') ? 312 : 186;
  const nx = clamp(x + dx / length * speed * dt, 40, 1760 - player.offsetWidth);
  const ny = clamp(y + dy / length * speed * dt, 90, 620 - player.offsetHeight);
  if (canStand(nx, y)) x = nx;
  if (canStand(x, ny)) y = ny;
  updateCameraAndPlayer();

  if (window.update3DPlayerMovement && !dialogOpen) {
    window.update3DPlayerMovement(dx, dy, dt, keys.has('shift') ? 1.6 : 1.0);
  }

  updatePrompt();
  updateCooking();
  requestAnimationFrame(move);
}

function updatePrompt() {
  const nearby = nearProp();
  const target3d = (window.scene3DState && window.scene3DState.interactiveTarget) ||
    (window.getNearbyTarget && window.scene3DState && window.getNearbyTarget(window.scene3DState.playerPos.x, window.scene3DState.playerPos.z));
  const targetName = target3d ? target3d.name : (nearby ? nearby.textContent.trim() : null);

  if (targetName) {
    if ((targetName.includes('病人') || targetName.includes('Patient')) && currentStage === STAGES.SERVE) {
      $('prompt').textContent = 'E — 送餐給病患品嚐';
    } else if ((targetName.includes('病人') || targetName.includes('Patient')) && currentStage === STAGES.CONSULT) {
      $('prompt').textContent = 'E — 靠近病人問診';
    } else if ((targetName.includes('醫') || targetName.includes('處方') || targetName.includes('Desk') || targetName.includes('Printer')) && currentStage === STAGES.ORDER) {
      $('prompt').textContent = 'E — 開立料理處方單';
    } else if (targetName.includes('冰箱') && currentStage === STAGES.GATHER) {
      $('prompt').textContent = 'E — 取材冰箱 (取出豆腐、絞肉、醬料)';
    } else if (target3d) {
      $('prompt').textContent = target3d.prompt;
    } else {
      $('prompt').textContent = `E — ${targetName}`;
    }
  } else {
    $('prompt').textContent = 'WASD 移動｜靠近物件按 E';
  }
}

function cookLog(text) {
  const list = $('recipeLog');
  if (list.textContent.includes('等待開始')) list.replaceChildren();
  const line = document.createElement('li');
  line.textContent = text;
  list.append(line);
  list.scrollTop = list.scrollHeight;
}

function isNearPrepStation() {
  if (!window.scene3DState) return false;
  const pos = window.scene3DState.playerPos;
  return (pos.x >= 3.2 && pos.x <= 6.8 && pos.z <= -0.8 && pos.z >= -3.2);
}

function isNearWokStation() {
  if (!window.scene3DState) return false;
  const pos = window.scene3DState.playerPos;
  return (pos.x >= 7.2 && pos.x <= 11.0 && pos.z <= -0.8 && pos.z >= -3.2);
}

const cutStages = { tofu: 0, scallion: 0, garlic: 0, pork: 0, douban: 0, pepper: 0 };

function getBoardFoodImage(food, stage) {
  if (food === 'tofu') {
    if (stage === 0) return 'assets/ingredients/mapo_tofu/tofu.png';
    if (stage === 1) return 'assets/cooking/tofu_halves.png';
    if (stage === 2) return 'assets/cooking/tofu_strips.png';
    return 'assets/cooking/tofu_cubes.png';
  }
  if (food === 'scallion') {
    return stage === 0 ? 'assets/ingredients/mapo_tofu/scallion.png' : 'assets/cooking/scallion_rings.png';
  }
  if (food === 'garlic') {
    return stage === 0 ? 'assets/ingredients/mapo_tofu/garlic.png' : 'assets/cooking/garlic_mince.png';
  }
  if (food === 'pork') {
    return 'assets/ingredients/mapo_tofu/pork.png';
  }
  if (food === 'douban') {
    return 'assets/ingredients/mapo_tofu/douban.png';
  }
  if (food === 'pepper') {
    return 'assets/ingredients/mapo_tofu/pepper.png';
  }
  return '';
}

function updateCooking() {
  const ready = required.every(id => inWok.has(id));
  const atPrep = isNearPrepStation();
  const atWok = isNearWokStation();

  // Station proximity badges
  if ($('prepStationBadge')) {
    $('prepStationBadge').textContent = atPrep ? '已在備料檯 (可切配)' : '未在備料檯 (需靠近)';
    $('prepStationBadge').classList.toggle('is-ready', atPrep);
  }
  if ($('wokStationBadge')) {
    $('wokStationBadge').textContent = atWok ? '已在炒鍋台 (可操作)' : '未在炒鍋台 (需靠近)';
    $('wokStationBadge').classList.toggle('is-ready', atWok);
  }

  // Mission stage prerequisite lock overlay
  if ($('stationLockOverlay')) {
    if (currentStage < STAGES.PREP) {
      $('stationLockOverlay').removeAttribute('hidden');
      if (currentStage === STAGES.CONSULT) {
        $('stationLockMsg').textContent = '【任務尚未開始】請先在上方診間走向病人椅按 E 進行問診！';
      } else if (currentStage === STAGES.ORDER) {
        $('stationLockMsg').textContent = '【處方尚未開立】請先前往醫師桌按 E 開立料理處方單！';
      } else if (currentStage === STAGES.GATHER) {
        $('stationLockMsg').textContent = '【食材尚未取出】請先前往過渡區冰箱按 E 取出新鮮食材！';
      }
    } else {
      $('stationLockOverlay').setAttribute('hidden', '');
    }
  }

  // Ingredient Tray Buttons
  foodButtons.forEach(button => {
    const id = button.dataset.food;
    button.classList.toggle('is-selected', selectedFood === id);
    button.classList.toggle('is-prepped', prepped.has(id) || inWok.has(id));
    button.disabled = (currentStage < STAGES.PREP) || plated || inWok.has(id);
  });

  // Checklist updates
  ['tofu', 'pork', 'douban', 'garlic', 'scallion'].forEach(id => {
    const el = $(`check-${id}`);
    if (el) {
      const isDone = prepped.has(id) || inWok.has(id);
      el.classList.toggle('is-done', isDone);
      el.textContent = (isDone ? '✓ ' : '○ ') + el.textContent.slice(2);
    }
  });

  // Cutting Board Controls & Visuals
  const canCutFood = selectedFood && !prepped.has(selectedFood) && !inWok.has(selectedFood);
  $('cutBtn').disabled = (currentStage < STAGES.PREP) || plated || !canCutFood;

  if (selectedFood) {
    const isDouban = selectedFood === 'douban';
    if ($('boardSpoon') && $('boardKnife')) {
      if (isDouban) {
        $('boardSpoon').removeAttribute('hidden');
        $('boardKnife').setAttribute('hidden', '');
        $('cutBtn').textContent = prepped.has('douban') ? '豆瓣已舀取' : '舀取一匙';
      } else {
        $('boardKnife').removeAttribute('hidden');
        $('boardSpoon').setAttribute('hidden', '');
        if (selectedFood === 'tofu') {
          const tNames = ['下刀對半切 (0/3)', '切成條狀 (1/3)', '切骰子丁 (2/3)', '切丁完成'];
          $('cutBtn').textContent = prepped.has('tofu') ? '豆腐切配完成' : tNames[cutStages.tofu] || '下刀切塊';
        } else if (selectedFood === 'scallion') {
          $('cutBtn').textContent = prepped.has('scallion') ? '蔥花已備妥' : '下刀切蔥花';
        } else if (selectedFood === 'garlic') {
          $('cutBtn').textContent = prepped.has('garlic') ? '蒜末已備妥' : '拍碎切蒜末';
        } else if (selectedFood === 'pork') {
          $('cutBtn').textContent = prepped.has('pork') ? '絞肉已分切' : '分切絞碎';
        } else {
          $('cutBtn').textContent = '切配';
        }
      }
    }

    if ($('boardFoodImg')) {
      const imgSrc = getBoardFoodImage(selectedFood, cutStages[selectedFood] || 0);
      if (imgSrc) {
        $('boardFoodImg').src = imgSrc;
        $('boardFoodImg').removeAttribute('hidden');
      }
    }
    $('boardFood').textContent = `${foodNames[selectedFood]} ${prepped.has(selectedFood) ? '已備妥' : '已放上砧板'}`;
    if ($('cutProgressText')) {
      $('cutProgressText').textContent = prepped.has(selectedFood) ? `${foodNames[selectedFood]}備料完成` : `點擊按鈕切配 ${foodNames[selectedFood]}`;
    }
  } else {
    if ($('boardFoodImg')) $('boardFoodImg').setAttribute('hidden', '');
    $('boardFood').textContent = '砧板空著';
    if ($('cutProgressText')) $('cutProgressText').textContent = '點選上方食材放上砧板切配';
    $('cutBtn').textContent = '切配';
  }

  // Wok Controls & Visuals
  $('heatBtn').disabled = (currentStage < STAGES.COOK) || plated;
  $('heatBtn').textContent = heated ? '關火' : '開火';
  $('addBtn').disabled = (currentStage < STAGES.COOK) || plated || !heated || prepped.size === 0;
  $('stirBtn').disabled = (currentStage < STAGES.COOK) || plated || !heated || inWok.size === 0;
  $('plateBtn').disabled = (currentStage < STAGES.COOK) || plated || !heated || !ready || stirs < 3;
  $('flame').classList.toggle('is-on', heated);
  document.querySelector('.wok-visual').classList.toggle('is-cooking', heated && inWok.size > 0);

  if ($('wokStatusText')) {
    if (currentStage < STAGES.COOK) {
      $('wokStatusText').textContent = '尚未進入炒鍋階段';
    } else if (!atWok) {
      $('wokStatusText').textContent = '提示：請先靠近後廚炒鍋台 (X: ~9.0)';
    } else if (!heated) {
      $('wokStatusText').textContent = '點擊「開火」啟動瓦斯爐火加熱黑鐵炒鍋';
    } else if (inWok.size === 0) {
      $('wokStatusText').textContent = '鍋已燒熱，點擊「下鍋」倒入備妥食材';
    } else if (stirs < 3) {
      $('wokStatusText').textContent = `以金屬鍋鏟翻炒推勻 (${stirs} / 3 次)`;
    } else {
      $('wokStatusText').textContent = '麻婆豆腐色澤紅亮、香味撲鼻！點擊「盛盤」';
    }
  }

  if ($('wokSimmerImg')) {
    $('wokSimmerImg').hidden = !(inWok.size >= 4 && stirs >= 3 && !plated);
  }

  if ($('wokFoodLayer')) {
    if (inWok.size === 0 || plated) {
      $('wokFoodLayer').innerHTML = '';
    } else {
      let html = '';
      if (inWok.has('pork')) {
        const porkSrc = stirs >= 1 ? 'assets/cooking/pork_browned.png' : 'assets/ingredients/mapo_tofu/pork.png';
        html += `<img class="wok-food-item wok-food-pork ${stirs >= 1 ? 'is-browned' : ''}" src="${porkSrc}" alt="絞肉"/>`;
      }
      if (inWok.has('garlic')) {
        html += `<img class="wok-food-item wok-food-garlic" src="assets/cooking/garlic_mince.png" alt="蒜末"/>`;
      }
      if (inWok.has('douban')) {
        html += `<img class="wok-food-item wok-food-douban ${stirs >= 2 ? 'is-red-oil' : ''}" src="assets/ingredients/mapo_tofu/douban.png" alt="豆瓣醬"/>`;
      }
      if (inWok.has('tofu')) {
        html += `<img class="wok-food-item wok-food-tofu" src="assets/cooking/tofu_cubes.png" alt="豆腐丁"/>`;
      }
      if (inWok.has('scallion')) {
        html += `<img class="wok-food-item wok-food-scallion" src="assets/cooking/scallion_rings.png" alt="蔥花"/>`;
      }
      $('wokFoodLayer').innerHTML = html;
    }
  }

  if ($('platedDishPreview')) {
    if (plated) {
      $('platedDishPreview').removeAttribute('hidden');
    } else {
      $('platedDishPreview').setAttribute('hidden', '');
    }
  }

  $('wokContents').textContent = plated ? '麻婆豆腐完成' : inWok.size ? [...inWok].map(id => foodNames[id]).join('＋') : '空鍋';

  if (currentStage >= STAGES.COOK && !plated) {
    $('cookObjective').textContent = !inWok.size ? '備妥豆腐、絞肉、豆瓣醬、蒜，再開火下鍋' :
      !ready ? `尚缺：${required.filter(id => !inWok.has(id)).map(id => foodNames[id]).join('、')}` :
      !heated ? '重新開火才能翻炒' : stirs < 3 ? `翻炒 ${stirs} / 3 次` : '可以盛盤';
  } else if (plated && currentStage === STAGES.SERVE) {
    $('cookObjective').textContent = '階段 7/8：麻婆豆腐盛盤完成！端起托盤送回診間給病人';
  } else if (currentStage === STAGES.FIRST_BITE) {
    $('cookObjective').textContent = '階段 8/8：病患品嚐完成｜滿意度 100% 達成！按 R 可重新開始';
  } else {
    updateMissionUI();
  }
}

function resetAll() {
  x = 250; y = 470; previousTime = 0; keys.clear(); visited.clear();
  selectedFood = null; prepped.clear(); inWok.clear(); heated = false; stirs = 0; plated = false;
  for (const k in cutStages) cutStages[k] = 0;
  $('boardFood').textContent = '砧板空著';
  if ($('boardFoodImg')) $('boardFoodImg').setAttribute('hidden', '');
  if ($('wokSimmerImg')) $('wokSimmerImg').setAttribute('hidden', '');
  if ($('platedDishPreview')) $('platedDishPreview').setAttribute('hidden', '');
  $('recipeLog').innerHTML = '<li>等待開始</li>';
  $('log').textContent = '已重置：探索與料理狀態皆已清空';
  if (dialogModal && !dialogModal.hasAttribute('hidden')) dialogModal.setAttribute('hidden', '');
  dialogOpen = false;
  dialogCallback = null;
  setStage(STAGES.CONSULT);
  updateCooking();
  updateCameraAndPlayer();
  if (window.set3DPlayerPosition) window.set3DPlayerPosition(-8.0, -0.2);
  if (window.setCarryingTray) window.setCarryingTray(false);
  if (window.setPatientDishVisible) window.setPatientDishVisible(false);
}

function handleInteraction(name) {
  visited.add(name);
  $('log').textContent = `互動：${name}｜已探索 ${visited.size} 個重點`;
  cookLog(`互動：${name}`);

  // 1. Patient Chair Interaction (Consult & First Bite)
  if (name.includes('病人') || name.includes('Patient')) {
    if (currentStage === STAGES.CONSULT) {
      showDialog({
        badge: 'CLINIC EMR — 初診評估',
        title: '【診間問診】上班族病患主訴',
        content: `
          <p><strong>上班族病患：</strong>「醫師，最近專案截稿連續熬夜，肩頸緊繃、精神焦躁，完全吃不下飯，整個人快被壓力壓垮了……」</p>
          <p><strong>Dr. Speed：</strong>「長期高壓會讓交感神經持續亢奮、消化機能低落。我們今天不開苦藥，而是為你特調一道<strong>家常舒壓料理——麻婆豆腐</strong>。豆腐滑嫩易吞嚥，花椒的芳香微麻與豆瓣醬的醇厚能喚醒食慾，透過熱食的感官療癒撫慰身心。」</p>
          <p><em>問診完成！請前往醫師桌或處方機開立料理處方單。</em></p>
        `,
        confirmText: '開立處方單 (Enter / E)',
        onConfirm: () => {
          setStage(STAGES.ORDER);
          cookLog('問診完成：請前往醫師桌或料理處方機出單');
        }
      });
      return;
    } else if (currentStage === STAGES.SERVE) {
      showDialog({
        badge: 'PATIENT FEEDBACK',
        title: '【第一口品嚐回饋】病患反應與評分',
        content: `
          <p><strong>上班族病患雙手接過熱氣騰騰的青花瓷碗，用湯匙舀起第一口麻婆豆腐送入口中：</strong></p>
          <p>「熱氣瞬間在嘴裡散開！花椒的清香微麻、豆瓣醬的醬香醇厚，加上細緻滑嫩的豆腐，微辣但完全不嗆，整個人從胸口到胃裡都暖了起來……剛才緊繃的肩膀一下子全放鬆了！」</p>
          <p><strong>Dr. Speed：</strong>「熱食入腹、感官得到撫慰，心情自然舒暢。今晚請放下工作，好好享受美味與休息！」</p>
        `,
        showScore: true,
        scoreText: '病患滿意度：100%（極致舒壓、色香味俱全）',
        confirmText: '完成諮詢 (Enter / E)',
        onConfirm: () => {
          setStage(STAGES.FIRST_BITE);
          cookLog('任務完成：病患品嚐第一口麻婆豆腐，滿意度 100%！');
          $('log').textContent = '任務達成：麻婆豆腐第一口回饋 100%！按 R 可重新開始新一輪';
        }
      });
      return;
    }
  }

  // 2. Doctor Desk / Order Printer Interaction (Order Prescription)
  if (name.includes('醫師桌') || name.includes('處方機') || name.includes('印表機') || name.includes('DoctorDesk') || name.includes('Printer')) {
    if (currentStage === STAGES.ORDER) {
      showDialog({
        badge: 'RX PRINTER — 料理處方單',
        title: '【電子病歷系統 / 料理處方單出單】',
        content: `
          <p><strong>處方代碼：</strong>#CK2-MAPO-001</p>
          <p><strong>料理品項：</strong>經典舒壓家常麻婆豆腐 (Fictional Stress-Relief Meal)</p>
          <p><strong>標準食材明細：</strong>嫩豆腐 1 塊、特級豬絞肉 100g、川味豆瓣醬 2 大匙、鮮蒜瓣碎、大紅袍花椒少許、青蔥段。</p>
          <p><strong>料理要點：</strong>先爆香肉碎與蒜瓣豆瓣，下豆腐燴煮入味，起鍋前撒花椒蔥花。</p>
          <p><em>料理處方單已列印！請前往過渡區不鏽鋼冰箱取出冷藏食材。</em></p>
        `,
        confirmText: '前往冰箱取材 (Enter / E)',
        onConfirm: () => {
          setStage(STAGES.GATHER);
          cookLog('處方單開立完成：前往過渡區冰箱取出食材');
        }
      });
      return;
    }
  }

  // 3. Transition Fridge Interaction (Gather Ingredients)
  if (name.includes('冰箱') || name.includes('Fridge')) {
    if (currentStage === STAGES.GATHER) {
      showDialog({
        badge: 'PREP COLD STORAGE',
        title: '【冷藏食材取材完畢】',
        content: `
          <p>打開負 4 度不鏽鋼保鮮冷藏冰箱，取出今日料理新鮮食材：</p>
          <ul>
            <li><strong>嫩豆腐</strong>：潔白柔嫩完整</li>
            <li><strong>上等豬絞肉</strong>：肥瘦黃金比例</li>
            <li><strong>川味豆瓣醬</strong>：醇香發酵紅油辣豆瓣</li>
            <li><strong>鮮大蒜、大紅袍花椒、青蔥</strong>：提鮮辛香料</li>
          </ul>
          <p><em>食材已送抵後廚備料檯！請前往備料檯進行切配。</em></p>
        `,
        confirmText: '前往備料檯切配 (Enter / E)',
        onConfirm: () => {
          setStage(STAGES.PREP);
          cookLog('食材已自冰箱取出：前往後廚備料檯切配');
        }
      });
      return;
    }
  }

  // 4. Prep Counter Interaction
  if (name.includes('備料') || name.includes('Counter')) {
    if (currentStage === STAGES.PREP) {
      cookLog('抵達備料檯：請在下方工作檯點選食材並點擊「切配」');
      $('log').textContent = '抵達備料檯：請切配豆腐、絞肉、豆瓣醬、蒜、蔥';
      return;
    }
  }

  // 5. Wok Station Interaction
  if (name.includes('炒鍋') || name.includes('Wok')) {
    if (currentStage === STAGES.COOK) {
      cookLog('抵達爐台：點擊「開火」、食材「下鍋」並「翻炒」3 次');
      $('log').textContent = '抵達爐台：開火、下鍋並翻炒至少 3 次';
      return;
    }
  }
}

foodButtons.forEach(button => button.addEventListener('click', () => {
  if (currentStage < STAGES.PREP) {
    $('log').textContent = '前置任務未完成：請先完成問診、開單與取材！';
    return;
  }
  selectedFood = button.dataset.food;
  updateCooking();
}));

$('cutBtn').addEventListener('click', () => {
  if ($('cutBtn').disabled) return;
  if (!isNearPrepStation()) {
    $('log').textContent = '未到備料檯：Dr. Speed 必須走近備料檯 (X: ~5.0) 才能切配！';
    cookLog('提示：請先靠近後廚備料檯才能切配');
    return;
  }

  if (selectedFood === 'douban') {
    // Spoon scoop action (舀取)
    if ($('boardSpoon')) {
      $('boardSpoon').classList.add('is-scooping');
      setTimeout(() => $('boardSpoon').classList.remove('is-scooping'), 300);
    }
    cutStages.douban = 1;
    prepped.add('douban');
    cookLog('川味豆瓣醬：用湯匙舀取醇厚紅油豆瓣醬！');
  } else if (selectedFood === 'tofu') {
    // Knife chopping action (下刀切塊)
    if ($('boardKnife')) {
      $('boardKnife').classList.add('is-chopping');
      if ($('chopEffect')) $('chopEffect').classList.add('is-active');
      setTimeout(() => {
        $('boardKnife').classList.remove('is-chopping');
        if ($('chopEffect')) $('chopEffect').classList.remove('is-active');
      }, 200);
    }
    cutStages.tofu = (cutStages.tofu || 0) + 1;
    if (cutStages.tofu >= 3) {
      prepped.add('tofu');
      cookLog('嫩豆腐：對半剖開、切成條狀，再均勻切成骰子塊！');
    } else if (cutStages.tofu === 1) {
      cookLog('嫩豆腐：刀鋒下切，對半剖開');
    } else if (cutStages.tofu === 2) {
      cookLog('嫩豆腐：整齊切成長方條狀');
    }
  } else if (selectedFood === 'scallion') {
    if ($('boardKnife')) {
      $('boardKnife').classList.add('is-chopping');
      if ($('chopEffect')) $('chopEffect').classList.add('is-active');
      setTimeout(() => {
        $('boardKnife').classList.remove('is-chopping');
        if ($('chopEffect')) $('chopEffect').classList.remove('is-active');
      }, 200);
    }
    cutStages.scallion = 1;
    prepped.add('scallion');
    cookLog('鮮青蔥：切除蔥白根部，切成細碎翠綠蔥花！');
  } else if (selectedFood === 'garlic') {
    if ($('boardKnife')) {
      $('boardKnife').classList.add('is-chopping');
      if ($('chopEffect')) $('chopEffect').classList.add('is-active');
      setTimeout(() => {
        $('boardKnife').classList.remove('is-chopping');
        if ($('chopEffect')) $('chopEffect').classList.remove('is-active');
      }, 200);
    }
    cutStages.garlic = 1;
    prepped.add('garlic');
    cookLog('鮮蒜瓣：刀面拍扁破壁，細剁成香濃蒜末！');
  } else if (selectedFood === 'pork') {
    if ($('boardKnife')) {
      $('boardKnife').classList.add('is-chopping');
      if ($('chopEffect')) $('chopEffect').classList.add('is-active');
      setTimeout(() => {
        $('boardKnife').classList.remove('is-chopping');
        if ($('chopEffect')) $('chopEffect').classList.remove('is-active');
      }, 200);
    }
    cutStages.pork = 1;
    prepped.add('pork');
    cookLog('上等豬絞肉：以刀背輕剁鬆散，均勻分切成肉末粒！');
  } else {
    prepped.add(selectedFood);
    cookLog(`備料完成：${foodNames[selectedFood]}`);
  }

  if (required.every(id => prepped.has(id) || inWok.has(id)) && currentStage <= STAGES.PREP) {
    setStage(STAGES.COOK);
    cookLog('麻婆豆腐核心食材全數備妥！請走向炒鍋爐台開火下鍋');
  }
  updateCooking();
});

$('heatBtn').addEventListener('click', () => {
  if (!isNearWokStation()) {
    $('log').textContent = '未到炒鍋爐台：Dr. Speed 必須走近炒鍋爐台 (X: ~9.0) 才能操作！';
    cookLog('提示：請先靠近後廚炒鍋爐台才能開火');
    return;
  }
  heated = !heated;
  cookLog(heated ? '瓦斯爐點火：藍色烈焰環繞鍋底，黑鐵炒鍋迅速升溫！' : '關閉爐火');
  updateCooking();
});

$('addBtn').addEventListener('click', () => {
  if ($('addBtn').disabled) return;
  if (!isNearWokStation()) {
    $('log').textContent = '未到炒鍋爐台：請先走近炒鍋爐台才能下鍋！';
    return;
  }
  cookLog(`食材依序下鍋：${[...prepped].map(id => foodNames[id]).join('、')} 入鍋爆香！`);
  prepped.forEach(id => inWok.add(id));
  prepped.clear();
  selectedFood = null;
  stirs = 0;
  $('boardFood').textContent = '砧板空著';
  if ($('boardFoodImg')) $('boardFoodImg').setAttribute('hidden', '');
  if (currentStage < STAGES.COOK) setStage(STAGES.COOK);
  updateCooking();
});

$('stirBtn').addEventListener('click', () => {
  if ($('stirBtn').disabled) return;
  if (!isNearWokStation()) {
    $('log').textContent = '未到炒鍋爐台：請先走近炒鍋爐台才能翻炒！';
    return;
  }
  stirs++;
  if ($('wokSpatula')) {
    $('wokSpatula').classList.add('is-stirring');
    setTimeout(() => $('wokSpatula') && $('wokSpatula').classList.remove('is-stirring'), 350);
  }
  if ($('wokFoodLayer')) {
    $('wokFoodLayer').classList.add('is-stirred');
    setTimeout(() => $('wokFoodLayer') && $('wokFoodLayer').classList.remove('is-stirred'), 350);
  }
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    $('wokContents').animate([{ transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'none' }], { duration: 250 });
  }

  if (stirs === 1) {
    cookLog('翻炒第 1 次：金屬鍋鏟推動豬絞肉均勻受熱，肉粒變色微焦散發肉香！');
  } else if (stirs === 2) {
    cookLog('翻炒第 2 次：豆瓣醬爆出紅油與熱氣，紅亮油光完整包覆肉末與蒜香！');
  } else if (stirs >= 3) {
    cookLog('翻炒第 3 次：豆腐輕柔推勻吸飽濃汁，鍋氣升騰，麻辣香醇熟成！');
    if (required.every(id => inWok.has(id)) && currentStage <= STAGES.COOK) {
      setStage(STAGES.PLATE);
      cookLog('火候達到極致、醬汁濃郁裹附！已可以盛盤出鍋');
    }
  }
  updateCooking();
});

$('plateBtn').addEventListener('click', () => {
  if ($('plateBtn').disabled) return;
  if (!isNearWokStation()) {
    $('log').textContent = '未到炒鍋爐台：請先走近炒鍋爐台盛盤！';
    return;
  }
  plated = true;
  heated = false;
  setStage(STAGES.SERVE);
  cookLog('以鍋鏟將麻婆豆腐俐落舀入青花瓷碗！托盤放上越光米飯與筷匙，請端回診間');
  updateCooking();
});

const movementKeys = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift']);

addEventListener('keydown', event => {
  if (event.target.matches('input,textarea,select,[contenteditable="true"]')) return;
  const key = event.key.toLowerCase();

  if (dialogOpen) {
    if (key === 'escape' || key === 'enter' || key === ' ' || key === 'e') {
      event.preventDefault();
      closeDialog();
      return;
    }
    return;
  }

  if (movementKeys.has(key)) {
    event.preventDefault();
    keys.add(key);
  }
  if (event.repeat) return;
  if (key === 'r') resetAll();
  if (key === 'e') {
    const prop = nearProp();
    const target3d = window.scene3DState && window.scene3DState.interactiveTarget;
    const name = target3d ? target3d.name : (prop ? prop.textContent.trim() : null);
    if (name) {
      handleInteraction(name);
    }
  }
});

addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
addEventListener('blur', () => { keys.clear(); previousTime = 0; });

world.addEventListener('pointerdown', event => {
  if (!event.target.closest('details,button,a')) world.focus({ preventScroll: true });
});

$('prompt').addEventListener('click', () => {
  const prop = nearProp();
  const target3d = window.scene3DState && window.scene3DState.interactiveTarget;
  const name = target3d ? target3d.name : (prop ? prop.textContent.trim() : null);
  if (name) handleInteraction(name);
});

// Helper for test synchronization
window.teleportAndSync = function (x3d, z3d) {
  if (window.set3DPlayerPosition) window.set3DPlayerPosition(x3d, z3d);
  x = clamp(850 + x3d * 75, 40, 1760 - player.offsetWidth);
  y = clamp(470 + z3d * 70, 90, 620 - player.offsetHeight);
  updateCameraAndPlayer();
  if (window.scene3DState && window.getNearbyTarget) {
    window.scene3DState.interactiveTarget = window.getNearbyTarget(x3d, z3d);
  }
  updatePrompt();
  updateCooking();
};

const origSceneSetMissionStage = window.setMissionStage;
window.setMissionStage = function (stage) {
  currentStage = stage;
  if (origSceneSetMissionStage) origSceneSetMissionStage(stage);
  if (window.setCarryingTray) window.setCarryingTray(stage === STAGES.SERVE);
  if (window.setPatientDishVisible) window.setPatientDishVisible(stage >= STAGES.FIRST_BITE);
  updateMissionUI();
  updateCooking();
};
window.setGameStage = window.setMissionStage;

window.getMissionStage = function () {
  return currentStage;
};

if (window.initScene3D) window.initScene3D(world);
resetAll();
requestAnimationFrame(move);
