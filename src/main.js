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
let isPlating = false;
let platingTimeout = null;
let simmerTimer = 0;
const REQUIRED_SIMMER_TIME = 4.0;
const actionTimers = new Set();
function queueAction(callback, delay) {
  const timer = setTimeout(() => { actionTimers.delete(timer); callback(); }, delay);
  actionTimers.add(timer);
  return timer;
}
function cancelActionTimers() {
  actionTimers.forEach(clearTimeout); actionTimers.clear();
}

let preparedTray = { tofu: 1, pork: 1, douban: 1, garlic: 1, scallion: 0, pepper: 0 };
window.preparedTray = preparedTray;

let wok = window.CKClinicRules?.createWok ? window.CKClinicRules.createWok() : {
  hasFood: false,
  contents: { tofu: 0, pork: 0, douban: 0, garlic: 0, scallion: 0, pepper: 0 },
  stirs: 0,
  flame: 'off',
  highHeatSeconds: 0,
  lowHeatSeconds: 0,
  eqSimmerTime: 0,
  isSimmered: false,
  isBurnt: false,
  overheatSeconds: 0
};
window.wok = wok;

function updatePortionUI() {
  for (const [food, portion] of Object.entries(preparedTray)) {
    const badge = $('portion-badge-' + food);
    if (badge) {
      badge.textContent = portion === 0 ? '0份' : (portion === 0.5 ? '半份' : '1份');
      badge.dataset.zero = String(portion === 0);
    }
  }
  const curFood = selectedFood || 'tofu';
  const curP = preparedTray[curFood] !== undefined ? preparedTray[curFood] : 1;
  if ($('portionCycleBtn')) {
    $('portionCycleBtn').textContent = `份量：${curP === 0 ? '0份' : curP === 0.5 ? '半份' : '1份'} (Q)`;
  }
}
window.updatePortionUI = updatePortionUI;

function cyclePortion(food) {
  const target = food || selectedFood || 'tofu';
  const cur = preparedTray[target] !== undefined ? preparedTray[target] : 0;
  const next = cur === 0 ? 0.5 : (cur === 0.5 ? 1 : 0);
  preparedTray[target] = next;
  updatePortionUI();
  cookLog(`${foodNames[target] || target} 份量切換為：${next === 0 ? '不取 (0份)' : next === 0.5 ? '半份' : '1份'}`);
  return next;
}
window.cyclePortion = cyclePortion;

let cookedDish = {
  hasScallion: false,
  hasPepper: false,
  hasTofu: false,
  hasPork: false,
  hasDouban: false,
  hasGarlic: false,
  spicyLevel: '正常',
  ricePortion: '未盛飯',
  miso: false,
  stirs: 0,
  simmerProgress: 0,
  eqSimmerTime: 0,
  isSimmered: false,
  isBurnt: false,
  overheatSeconds: 0
};
window.cookedDish = cookedDish;

Object.defineProperty(window, 'plated', {
  get: () => plated,
  set: (v) => { plated = v; }
});
Object.defineProperty(window, 'isPlating', {
  get: () => isPlating,
  set: (v) => { isPlating = v; }
});

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

// Patient Dining Order Preferences
let currentOrder = {
  spicy: '正常', // '微辣', '正常', '重辣'
  scallion: true, // true (要青蔥), false (去青蔥)
  rice: '正常飯' // '正常飯', '半碗飯'
};

Object.defineProperty(window, 'currentOrder', {
  get: () => currentOrder,
  set: (v) => { currentOrder = v; }
});

function syncOrderTicketUI() {
  const tSpicy = $('ticketSpicy');
  const tScallion = $('ticketScallion');
  const tRice = $('ticketRice');
  if (tSpicy) tSpicy.textContent = currentOrder.spicy === '正常' ? '正常辣' : currentOrder.spicy;
  if (tScallion) tScallion.textContent = currentOrder.scallion ? '要青蔥' : '去青蔥';
  if (tRice) tRice.textContent = currentOrder.rice;
}

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
  if (stage === STAGES.GATHER || (stage >= STAGES.PREP && window.CKShift?.snapshot().status === 'ready')) window.CKShift?.begin();
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
  dialogContent.innerHTML = (content || '').replaceAll('Dr. Speed', window.CKShift?.doctorName || 'DR. SPEED');
  keys.clear();
  if (window.update3DPlayerMovement) window.update3DPlayerMovement(0, 0, 0, 1);
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

function confirmDialog() {
  if (!dialogModal) return;
  dialogModal.setAttribute('hidden', '');
  dialogOpen = false;
  if (dialogCallback) {
    const cb = dialogCallback;
    dialogCallback = null;
    cb();
  }
  if (world) world.focus({ preventScroll: true });
}

function cancelDialog() {
  if (!dialogModal) return;
  dialogModal.setAttribute('hidden', '');
  dialogOpen = false;
  dialogCallback = null; // Do not execute callback on cancellation
  if (world) world.focus({ preventScroll: true });
}

const closeDialog = confirmDialog;

if (dialogActionBtn) dialogActionBtn.addEventListener('click', confirmDialog);
if (dialogCloseBtn) dialogCloseBtn.addEventListener('click', cancelDialog);

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
  const stopped = dialogOpen || Boolean(window.CKShift?.isFrozen());
  const dt = !stopped && previousTime ? Math.min((now - previousTime) / 1000, 0.1) : 0;
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

  if (stopped && window.update3DPlayerMovement) window.update3DPlayerMovement(0, 0, 0, 1);
  if (window.update3DPlayerMovement && !stopped) {
    window.update3DPlayerMovement(dx, dy, dt, keys.has('shift') ? 1.6 : 1.0);
  }

  window.CKShift?.tick(dt, dialogOpen);

  // R6: equivalent simmer time accumulation (high = 1.0x, low = 0.5x)
  if (wok.hasFood && wok.stirs >= 3 && wok.flame !== 'off' && !plated && !isPlating) {
    const mult = wok.flame === 'high' ? 1.0 : 0.5;
    wok.eqSimmerTime += dt * mult;
    if (wok.flame === 'high') wok.highHeatSeconds += dt;
    else wok.lowHeatSeconds += dt;
    simmerTimer = wok.eqSimmerTime;
    cookedDish.eqSimmerTime = wok.eqSimmerTime;
    cookedDish.simmerProgress = Math.min(100, Math.round((wok.eqSimmerTime / REQUIRED_SIMMER_TIME) * 100));
    if (wok.eqSimmerTime >= REQUIRED_SIMMER_TIME && !wok.isSimmered) {
      wok.isSimmered = true;
      cookedDish.isSimmered = true;
      window.CKShift?.simmer();
      setStage(STAGES.PLATE);
      cookLog('炒鍋：等效4秒燜煮收汁完成！請適時盛盤或按 F 關火（亦可先至配餐檯盛飯）');
    }
    if (wok.eqSimmerTime > REQUIRED_SIMMER_TIME) {
      wok.overheatSeconds = wok.eqSimmerTime - REQUIRED_SIMMER_TIME;
      cookedDish.overheatSeconds = wok.overheatSeconds;
      if (wok.overheatSeconds >= (window.CKShift?.burnAfter ?? 20.0) && !wok.isBurnt) {
        wok.isBurnt = true;
        cookedDish.isBurnt = true;
      }
    }
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

function isNearServeStation() {
  if (!window.scene3DState) return false;
  const pos = window.scene3DState.playerPos;
  return (pos.x >= 10.5 && pos.z <= -0.8 && pos.z >= -3.2);
}

function isNearConsultStation() {
  if (!window.scene3DState) return false;
  const pos = window.scene3DState.playerPos;
  return (pos.x <= -8.0);
}

const cutStages = { tofu: 0, scallion: 0, garlic: 0, pork: 0, douban: 0, pepper: 0 };
let lastRenderedBoardFood = undefined;
let lastRenderedBoardStage = undefined;

function renderBoardFoodPieces(food, stage) {
  const container = $('boardFoodPieces');
  if (!container) return;
  if (food === lastRenderedBoardFood && stage === lastRenderedBoardStage) {
    return;
  }
  lastRenderedBoardFood = food;
  lastRenderedBoardStage = stage;
  if (!food) {
    container.innerHTML = '';
    return;
  }
  if (food === 'tofu') {
    if (stage === 0) {
      container.innerHTML = '<div class="tofu-piece-container"><div class="tofu-whole-block" title="完整嫩豆腐塊"></div></div>';
    } else if (stage === 1) {
      container.innerHTML = '<div class="tofu-piece-container"><div class="tofu-split-halves"><div class="tofu-half-left" title="對半切左塊"></div><div class="tofu-half-right" title="對半切右塊"></div></div></div>';
    } else if (stage === 2) {
      container.innerHTML = '<div class="tofu-piece-container"><div class="tofu-strips-grid"><div class="tofu-strip-item"></div><div class="tofu-strip-item"></div><div class="tofu-strip-item"></div><div class="tofu-strip-item"></div></div></div>';
    } else {
      let cubes = '';
      for (let i = 0; i < 12; i++) cubes += '<div class="tofu-cube-item" title="骰子豆腐丁"></div>';
      container.innerHTML = `<div class="tofu-piece-container"><div class="tofu-cubes-grid">${cubes}</div></div>`;
    }
  } else if (food === 'scallion') {
    if (stage === 0) {
      container.innerHTML = '<div class="scallion-stalk-piece" title="鮮青蔥全株"></div>';
    } else {
      container.innerHTML = '<div class="scallion-rings-cluster" title="翠綠蔥花圈"></div>';
    }
  } else if (food === 'garlic') {
    if (stage === 0) {
      container.innerHTML = '<div class="garlic-cloves-piece" title="整瓣蒜頭"></div>';
    } else {
      container.innerHTML = '<div class="garlic-mince-piece" title="香濃蒜碎末"></div>';
    }
  } else if (food === 'pork') {
    if (stage === 0) {
      container.innerHTML = '<div class="pork-mound-piece" title="生豬絞肉團"></div>';
    } else {
      container.innerHTML = '<div class="pork-crumble-piece" title="均勻分切肉碎"></div>';
    }
  } else if (food === 'douban') {
    container.innerHTML = '<div class="douban-jar-board" title="川味豆瓣醬瓶"></div>';
  } else {
    container.innerHTML = '';
  }
}

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
  const atServe = isNearServeStation();

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

    renderBoardFoodPieces(selectedFood, cutStages[selectedFood] || 0);

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
    renderBoardFoodPieces(null, 0);
    if ($('boardFoodImg')) $('boardFoodImg').setAttribute('hidden', '');
    $('boardFood').textContent = '砧板空著';
    if ($('cutProgressText')) $('cutProgressText').textContent = '點選上方食材放上砧板切配';
    $('cutBtn').textContent = '切配';
  }

  // Wok Controls & Visuals
  $('heatBtn').disabled = (currentStage < STAGES.PREP) || plated;
  $('heatBtn').textContent = wok.flame === 'off' ? '開小火 (F)' : wok.flame === 'low' ? '轉大火 (F)' : '關火 (F)';

  $('addBtn').disabled = (currentStage < STAGES.PREP) || plated || isPlating || wok.hasFood || wok.flame === 'off';
  $('addBtn').textContent = wok.hasFood ? '食材已全下鍋' : '一次全下鍋 (E)';

  $('stirBtn').disabled = (currentStage < STAGES.PREP) || plated || isPlating || !wok.hasFood;
  $('stirBtn').textContent = wok.stirs >= 3 ? `翻炒完成 (${wok.stirs}次)` : `翻炒 (${wok.stirs}/3次)`;

  const canPlate = (wok.hasFood || ready) && (wok.stirs >= 3 || stirs >= 3) && ((currentStage === STAGES.PLATE) || (wok.isSimmered || cookedDish.isSimmered || wok.eqSimmerTime >= REQUIRED_SIMMER_TIME));
  $('plateBtn').disabled = plated || isPlating || !canPlate;
  $('plateBtn').textContent = isPlating ? '盛盤中...' : (plated ? '已盛盤入托盤' : '盛盤裝托盤 (E)');
  $('flame').classList.toggle('is-on', wok.flame !== 'off');
  $('flame').classList.toggle('is-low', wok.flame === 'low');
  $('flame').classList.toggle('is-high', wok.flame === 'high');
  document.querySelector('.wok-visual').classList.toggle('is-cooking', wok.flame !== 'off' && (wok.hasFood || inWok.size > 0));

  // Rice Cooker Widget State
  if ($('riceHalfBtn') && $('riceFullBtn')) {
    const riceDisabled = plated || isPlating;
    $('riceHalfBtn').disabled = riceDisabled;
    $('riceFullBtn').disabled = riceDisabled;
  }
  if ($('riceStatusBadge')) {
    const rPortion = cookedDish.ricePortion;
    $('riceStatusBadge').textContent = rPortion === '未盛飯' ? '未盛飯' : `已盛【${rPortion}】✓`;
    $('riceStatusBadge').classList.toggle('is-ready', rPortion !== '未盛飯');
  }

  // Miso Soup Widget State
  if ($('misoStatusBadge') && $('misoBtnLabel') && $('misoBtnIcon')) {
    const hasM = !!cookedDish.miso;
    $('misoStatusBadge').textContent = hasM ? '已附味噌湯 ✓' : '不要味噌湯';
    $('misoStatusBadge').classList.toggle('is-ready', hasM);
    $('misoBtnIcon').src = hasM ? 'assets/service/miso_yes.webp' : 'assets/service/miso_no.webp';
    $('misoBtnLabel').textContent = hasM ? '要味噌湯 (Q)' : '不要味噌湯 (Q)';
  }

  // Simmer Progress Bar Widget
  if ($('simmerProgressContainer')) {
    const isSimmeringActive = (wok.hasFood || inWok.size >= 4) && (wok.stirs >= 3 || stirs >= 3) && !plated;
    $('simmerProgressContainer').hidden = !isSimmeringActive;
    if (isSimmeringActive) {
      const pct = Math.min(100, Math.round((wok.eqSimmerTime / REQUIRED_SIMMER_TIME) * 100));
      if ($('simmerProgressBarFill')) $('simmerProgressBarFill').style.width = `${pct}%`;
      if ($('simmerProgressText')) {
        const heatMode = wok.flame === 'high' ? '🔥 大火 (1.0x)' : wok.flame === 'low' ? '🔥 小火 (0.5x)' : '爐火已關';
        $('simmerProgressText').textContent = (wok.isSimmered || cookedDish.isSimmered)
          ? `收汁完成 (${wok.eqSimmerTime.toFixed(1)}s / 4.0s) · ${heatMode}`
          : `${wok.eqSimmerTime.toFixed(1)} / 4.0 等效秒 · ${heatMode}`;
      }
    }
  }

  if ($('wokStatusText')) {
    if (!atWok && !atServe) {
      $('wokStatusText').textContent = '提示：請靠近炒鍋爐台 (X: ~9.0) 或配餐檯 (X: ~11.5)';
    } else if (!wok.hasFood) {
      $('wokStatusText').textContent = wok.flame === 'off' ? '爐火已關，請按 F 或點擊「開小火」啟動爐火' : '炒鍋加熱中，點擊「一次全下鍋 (E)」投入食材';
    } else if (wok.stirs < 3) {
      $('wokStatusText').textContent = `以鍋鏟翻炒推勻 (${wok.stirs} / 3 次) · 快捷鍵 Space / E`;
    } else if (!wok.isSimmered) {
      $('wokStatusText').textContent = `火候收汁中：等效 ${wok.eqSimmerTime.toFixed(1)} / 4.0 秒，期間可至右方配飯・選湯！`;
    } else if (wok.eqSimmerTime > 4.0) {
      const pen = CKClinicRules.heatPenaltyR6(wok.eqSimmerTime, wok.isBurnt);
      $('wokStatusText').textContent = `收汁達標！大火累積扣分 −${pen}%，請按 F 關火並盛盤`;
    } else {
      $('wokStatusText').textContent = '麻婆豆腐4等效秒收汁完成！點擊「盛盤裝托盤」';
    }
  }

  if ($('wokSimmerImg')) {
    $('wokSimmerImg').hidden = !(inWok.size >= 4 && stirs >= 3 && !plated);
  }

  syncWokFoodDOM();

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
      !heated ? (cookedDish.isSimmered ? '已安全關火，可直接盛盤' : '重新開火才能翻炒與燜煮') : stirs < 3 ? `翻炒推勻 ${stirs} / 3 次` :
      (!cookedDish.isSimmered && simmerTimer < REQUIRED_SIMMER_TIME) ? `燜煮收汁中 (${simmerTimer.toFixed(1)} / ${REQUIRED_SIMMER_TIME} 秒，可並行至電子鍋盛飯)` : '燜煮完成！可以進行盛盤';
  } else if (plated && currentStage === STAGES.SERVE) {
    $('cookObjective').textContent = '階段 7/8：麻婆豆腐盛盤完成！端起托盤送回診間給病人';
  } else if (currentStage === STAGES.FIRST_BITE) {
    $('cookObjective').textContent = '階段 8/8：病患品嚐完成｜按 R 可重新開始新一輪諮詢';
  } else {
    updateMissionUI();
  }
}

function syncWokFoodDOM() {
  const container = $('wokFoodLayer');
  if (!container) return;
  if (inWok.size === 0 || plated) {
    if (container.hasChildNodes()) container.innerHTML = '';
    return;
  }

  // 1. Red oil glow
  let glowEl = container.querySelector('.wok-red-oil-glow');
  if (inWok.has('douban')) {
    if (!glowEl) {
      glowEl = document.createElement('div');
      glowEl.className = 'wok-red-oil-glow';
      container.appendChild(glowEl);
    }
  } else if (glowEl) {
    glowEl.remove();
  }

  // 2. Pork element - persistent DOM node across stirs
  let porkEl = container.querySelector('.wok-food-pork');
  if (inWok.has('pork')) {
    const porkSrc = stirs >= 1 ? 'assets/cooking/pork_browned.png' : 'assets/ingredients/mapo_tofu/pork.png';
    if (!porkEl) {
      porkEl = document.createElement('img');
      porkEl.className = `wok-food-item wok-food-pork ${stirs >= 1 ? 'is-browned' : ''}`;
      porkEl.src = porkSrc;
      porkEl.alt = '絞肉';
      container.appendChild(porkEl);
    } else {
      if (!porkEl.src.endsWith(porkSrc)) porkEl.src = porkSrc;
      porkEl.classList.toggle('is-browned', stirs >= 1);
    }
  } else if (porkEl) {
    porkEl.remove();
  }

  // 3. Garlic element
  let garlicEl = container.querySelector('.wok-food-garlic');
  if (inWok.has('garlic')) {
    if (!garlicEl) {
      garlicEl = document.createElement('img');
      garlicEl.className = 'wok-food-item wok-food-garlic';
      garlicEl.src = 'assets/cooking/garlic_mince.png';
      garlicEl.alt = '蒜末';
      container.appendChild(garlicEl);
    }
  } else if (garlicEl) {
    garlicEl.remove();
  }

  // 4. Douban paste
  let doubanEl = container.querySelector('.wok-food-douban-paste');
  if (inWok.has('douban')) {
    if (!doubanEl) {
      doubanEl = document.createElement('div');
      doubanEl.className = `wok-food-item wok-food-douban-paste ${stirs >= 2 ? 'is-red-oil' : ''}`;
      doubanEl.title = '發酵紅油豆瓣醬';
      container.appendChild(doubanEl);
    } else {
      doubanEl.classList.toggle('is-red-oil', stirs >= 2);
    }
  } else if (doubanEl) {
    doubanEl.remove();
  }

  // 5. Tofu element
  let tofuEl = container.querySelector('.wok-food-tofu');
  if (inWok.has('tofu')) {
    if (!tofuEl) {
      tofuEl = document.createElement('img');
      tofuEl.className = 'wok-food-item wok-food-tofu';
      tofuEl.src = 'assets/cooking/tofu_cubes.png';
      tofuEl.alt = '豆腐丁';
      container.appendChild(tofuEl);
    }
  } else if (tofuEl) {
    tofuEl.remove();
  }

  // 6. Scallion element
  let scallionEl = container.querySelector('.wok-food-scallion');
  if (inWok.has('scallion')) {
    if (!scallionEl) {
      scallionEl = document.createElement('img');
      scallionEl.className = 'wok-food-item wok-food-scallion';
      scallionEl.src = 'assets/cooking/scallion_rings.png';
      scallionEl.alt = '蔥花';
      container.appendChild(scallionEl);
    }
  } else if (scallionEl) {
    scallionEl.remove();
  }

  // 7. Simmer bubbles
  let bubblesEl = container.querySelector('.simmer-bubbles');
  if (stirs >= 2 && inWok.size >= 4) {
    if (!bubblesEl) {
      bubblesEl = document.createElement('div');
      bubblesEl.className = 'simmer-bubbles';
      bubblesEl.innerHTML = `
        <span class="simmer-bubble" style="left:34%;bottom:26px;animation-delay:0s"></span>
        <span class="simmer-bubble" style="left:52%;bottom:38px;animation-delay:0.35s"></span>
        <span class="simmer-bubble" style="left:42%;bottom:22px;animation-delay:0.7s"></span>
        <span class="simmer-bubble" style="left:60%;bottom:32px;animation-delay:1.05s"></span>
      `;
      container.appendChild(bubblesEl);
    }
  } else if (bubblesEl) {
    bubblesEl.remove();
  }
}

function resetAll() {
  cancelActionTimers();
  if (platingTimeout) {
    clearTimeout(platingTimeout);
    platingTimeout = null;
  }
  isPlating = false;
  window.isPlating = false;
  plated = false;
  window.plated = false;
  simmerTimer = 0;
  lastRenderedBoardFood = undefined;
  lastRenderedBoardStage = undefined;

  cookedDish = {
    hasScallion: false,
    hasPepper: false,
    hasTofu: false,
    hasPork: false,
    hasDouban: false,
    hasGarlic: false,
    spicyLevel: '正常',
    ricePortion: '未盛飯',
    stirs: 0,
    simmerProgress: 0,
    eqSimmerTime: 0,
    miso: false,
    isSimmered: false,
    isBurnt: false,
    overheatSeconds: 0
  };
  window.cookedDish = cookedDish;

  preparedTray = { tofu: 1, pork: 1, douban: 1, garlic: 1, scallion: 0, pepper: 0 };
  window.preparedTray = preparedTray;
  wok = window.CKClinicRules?.createWok ? window.CKClinicRules.createWok() : {
    hasFood: false,
    contents: { tofu: 0, pork: 0, douban: 0, garlic: 0, scallion: 0, pepper: 0 },
    stirs: 0,
    flame: 'off',
    highHeatSeconds: 0,
    lowHeatSeconds: 0,
    eqSimmerTime: 0,
    isSimmered: false,
    isBurnt: false,
    overheatSeconds: 0
  };
  window.wok = wok;

  x = 250; y = 470; previousTime = 0; keys.clear(); visited.clear();
  selectedFood = null; prepped.clear(); inWok.clear(); heated = false; stirs = 0;
  currentOrder = { spicy: '正常', scallion: true, rice: '正常飯', miso: true };
  window.currentOrder = currentOrder;
  syncOrderTicketUI();
  updatePortionUI();
  for (const k in cutStages) cutStages[k] = 0;
  $('boardFood').textContent = '砧板空著';
  if ($('boardFoodImg')) $('boardFoodImg').setAttribute('hidden', '');
  if ($('boardFoodPieces')) $('boardFoodPieces').innerHTML = '';
  if ($('boardKnife')) $('boardKnife').className = 'board-knife-img';
  if ($('boardSpoon')) $('boardSpoon').className = 'board-spoon-img';
  if ($('flame')) $('flame').className = 'flame';
  if ($('addBtn')) { $('addBtn').disabled = false; $('addBtn').textContent = '一次全下鍋 (E)'; }
  if ($('stirBtn')) { $('stirBtn').textContent = '翻炒 (0/3次)'; }
  if ($('heatBtn')) { $('heatBtn').textContent = '開小火 (F)'; }
  if ($('wokSimmerImg')) $('wokSimmerImg').setAttribute('hidden', '');
  if ($('wokFoodLayer')) $('wokFoodLayer').innerHTML = '';
  if ($('platedDishPreview')) $('platedDishPreview').setAttribute('hidden', '');
  if ($('simmerProgressContainer')) $('simmerProgressContainer').hidden = true;
  if ($('riceStatusBadge')) {
    $('riceStatusBadge').textContent = '未盛飯';
    $('riceStatusBadge').classList.remove('is-ready');
  }
  if ($('misoStatusBadge')) {
    $('misoStatusBadge').textContent = '不要味噌湯';
    $('misoStatusBadge').classList.remove('is-ready');
  }
  if ($('misoBtnIcon')) $('misoBtnIcon').src = 'assets/service/miso_no.webp';
  if ($('misoBtnLabel')) $('misoBtnLabel').textContent = '不要味噌湯 (Q)';
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
  window.CKShift?.reset();
}

function handleInteraction(name) {
  if (window.CKShift && !window.CKShift.canInteract()) return;
  visited.add(name);
  $('log').textContent = `互動：${name}｜已探索 ${visited.size} 個重點`;
  cookLog(`互動：${name}`);

  // 1. Patient Chair Interaction (Consult & First Bite)
  if (name.includes('病人') || name.includes('Patient')) {
    if (currentStage === STAGES.CONSULT) {
      const pendingPref = { ...(window.CKRush?.prescribedOrder() || currentOrder) };

      showDialog({
        badge: 'CLINIC EMR — 初診與客製偏好',
        title: '【診間問診】上班族病患主訴與料理客製',
        content: `
          <p><strong>上班族病患：</strong>「醫師，今天煙癮有些強，想找件事轉移注意力，也想吃一份麻婆豆腐。」</p>
          <p><strong>Dr. Speed：</strong>「先確認今天想吃的口味，再安排這份料理。請選擇辣度、青蔥和飯量：」</p>
          <div class="preference-grid" id="prefGrid">
            <div class="pref-row">
              <span class="pref-label">辣度喜好：</span>
              <div class="pref-buttons" data-pref="spicy">
                <button type="button" class="pref-btn ${pendingPref.spicy === '微辣' ? 'is-selected' : ''}" data-val="微辣">微辣 (輕盈微麻)</button>
                <button type="button" class="pref-btn ${pendingPref.spicy === '正常' ? 'is-selected' : ''}" data-val="正常">正常 (正宗川味)</button>
                <button type="button" class="pref-btn ${pendingPref.spicy === '重辣' ? 'is-selected' : ''}" data-val="重辣">重辣 (大汗淋漓)</button>
              </div>
            </div>
            <div class="pref-row">
              <span class="pref-label">青蔥配置：</span>
              <div class="pref-buttons" data-pref="scallion">
                <button type="button" class="pref-btn ${pendingPref.scallion ? 'is-selected' : ''}" data-val="yes">要青蔥 (提鮮爽脆)</button>
                <button type="button" class="pref-btn ${!pendingPref.scallion ? 'is-selected' : ''}" data-val="no">不要蔥 (純粹豆腐)</button>
              </div>
            </div>
            <div class="pref-row">
              <span class="pref-label">越光米飯：</span>
              <div class="pref-buttons" data-pref="rice">
                <button type="button" class="pref-btn ${pendingPref.rice === '正常飯' ? 'is-selected' : ''}" data-val="正常飯">正常 (一滿碗)</button>
                <button type="button" class="pref-btn ${pendingPref.rice === '半碗飯' ? 'is-selected' : ''}" data-val="半碗飯">半碗 (減醣輕量)</button>
              </div>
            </div>
          </div>
          <p><em>確認偏好後，請前往醫師桌或處方機開立料理處方單。</em></p>
        `,
        confirmText: '確認偏好並開立處方 (Enter / E)',
        onConfirm: () => {
          currentOrder = { ...pendingPref };
          syncOrderTicketUI();
          setStage(STAGES.ORDER);
          cookLog(`問診完成：記錄客製偏好【${currentOrder.spicy === '正常' ? '正常辣' : currentOrder.spicy}、${currentOrder.scallion ? '要青蔥' : '去青蔥'}、${currentOrder.rice}】，前往開立處方單`);
        }
      });

      // Bind interactive click handlers to preference buttons
      const grid = $('prefGrid');
      if (grid) {
        window.CKRush?.lockPreferences(grid);
        grid.querySelectorAll('.pref-btn').forEach(btn => {
          btn.addEventListener('click', e => {
            e.stopPropagation();
            const group = btn.closest('.pref-buttons');
            if (!group) return;
            group.querySelectorAll('.pref-btn').forEach(b => b.classList.remove('is-selected'));
            btn.classList.add('is-selected');
            const prefType = group.dataset.pref;
            const val = btn.dataset.val;
            if (prefType === 'spicy') pendingPref.spicy = val;
            if (prefType === 'scallion') pendingPref.scallion = (val === 'yes');
            if (prefType === 'rice') pendingPref.rice = val;
          });
        });
      }
      return;
    } else if (currentStage === STAGES.SERVE) {
      if (window.setCarryingTray) window.setCarryingTray(false);
      if (window.setPatientDishVisible) window.setPatientDishVisible(true);

      const actualDish = window.cookedDish || cookedDish;
      const actualHasScallion = inWok.has('scallion') || !!actualDish.hasScallion;
      const actualHasPepper = inWok.has('pepper') || !!actualDish.hasPepper;
      const actualHasDouban = inWok.has('douban') || !!actualDish.hasDouban;

      let actualSpicy = '微辣';
      if (actualHasPepper && actualHasDouban) actualSpicy = '重辣';
      else if (actualHasDouban) actualSpicy = '正常';

      let score = 100;
      let notes = [];

      // 1. Scallion Evaluation
      let scallionRemark = '';
      if (!currentOrder.scallion && actualHasScallion) {
        scallionRemark = '「哎呀……我明明在問診時說了不要蔥，碗裡還是放了青蔥花！這點跟我的客製處方不符啊……」';
        score -= 15;
        notes.push('青蔥偏好不符 (-15%)');
      } else if (!currentOrder.scallion && !actualHasScallion) {
        scallionRemark = '「太貼心了，完全按照我的要求沒有放蔥花，口感純粹濃郁，細節滿分！」';
      } else if (currentOrder.scallion && actualHasScallion) {
        scallionRemark = '「翠綠青蔥點綴提香，清爽解膩，色香味俱全！」';
      } else {
        scallionRemark = '「處方單上有勾選青蔥，但盤裡似乎少了翠綠蔥花提鮮，稍顯單調。」';
        score -= 10;
        notes.push('缺少青蔥 (-10%)');
      }

      // 2. Spicy Evaluation
      let spicyRemark = '';
      if (actualSpicy === currentOrder.spicy) {
        if (currentOrder.spicy === '微辣') spicyRemark = '微辣溫潤微麻、暖胃而不刺激，正好撫慰了疲憊的腸胃！';
        else if (currentOrder.spicy === '重辣') spicyRemark = '重辣熱辣過癮、發汗舒暢，整個人的壓力和疲憊感全都散開了！';
        else spicyRemark = '正宗川味香氣四溢，麻辣適中、豆腐滑嫩極了！';
      } else {
        spicyRemark = `「辣度【${actualSpicy}】與預期處方【${currentOrder.spicy}】稍有出入，但川香調味依舊下飯！」`;
        score -= 10;
        notes.push('辣度不符 (-10%)');
      }

      // 3. Rice Evaluation
      let riceRemark = '';
      const actualRice = actualDish.ricePortion;
      if (actualRice === currentOrder.rice) {
        riceRemark = currentOrder.rice === '半碗飯' ? '搭配減醣半碗越光米飯，份量恰到好處無負擔！' : '熱騰騰越光米飯吸飽紅油肉汁，極致療癒下飯！';
      } else if (actualRice === '未盛飯') {
        riceRemark = '「托盤上好像忘了裝白飯？麻婆豆腐若是少了越光米飯搭配，就少了一味啊！」';
        score -= 15;
        notes.push('未盛白飯 (-15%)');
      } else {
        riceRemark = `「白飯份量是【${actualRice}】，和當初勾選的【${currentOrder.rice}】不太一樣，不過米粒依舊香Q！」`;
        score -= 5;
        notes.push('白飯份量出入 (-5%)');
      }

      // 4. Simmer & Cook Doneness Evaluation
      let donenessRemark = '';
      if (actualDish.isBurnt) {
        donenessRemark = '「鍋氣稍重了點，底層有一絲微焦苦味，火候若再收斂些就完美了。」';
        score -= 20;
        notes.push('微焦過火 (-20%)');
      } else if (!actualDish.isSimmered && currentStage < STAGES.PLATE) {
        donenessRemark = '「豆腐內部尚未充分入味，燜煮時間若能再長一些會更加入味。」';
        score -= 15;
        notes.push('燜煮不足 (-15%)');
      } else {
        donenessRemark = '「豆腐滑嫩入味、紅油收汁濃稠均勻，火候拿捏得恰到好處！」';
      }

      const finalScore = Math.max(50, Math.min(100, score));
      let scoreDetail = `${finalScore}%（${finalScore === 100 ? '完美客製舒壓神作' : (finalScore >= 80 ? '風味優良、符合主訴' : '完成料理、客製稍有出入')}）`;
      if (notes.length) scoreDetail += ` [${notes.join('、')}]`;
      // Delivery is committed once; dismissing feedback is not another serving action.
      setStage(STAGES.FIRST_BITE);
      window.CKShift?.finish(finalScore);

      showDialog({
        badge: 'PATIENT DINING & FEEDBACK',
        title: '【放餐與第一口品嚐回饋】病患反應與評分',
        content: `
          <div class="patient-eating-card">
            <img src="assets/cooking/tray_served.png" alt="美味托盤" class="patient-eating-portrait"/>
            <div class="patient-eating-text">
              <strong>上班族病患雙手端起托盤，用湯匙舀起第一口熱氣騰騰的麻婆豆腐：</strong>
              <p>「熱氣瞬間在嘴裡散開！${spicyRemark} ${scallionRemark} ${riceRemark}」</p>
              <p>「${donenessRemark} 剛才緊繃僵硬的肩膀一下子全放鬆了，整個人胸腹暖暖的，太療癒了！」</p>
            </div>
          </div>
          <p><strong>Dr. Speed：</strong>「熱食入腹、身心撫慰。今晚請放下工作，好好享受美味與充分休息！」</p>
        `,
        showScore: true,
        scoreText: `病患滿意度：${scoreDetail}`,
        confirmText: '完成諮詢 (Enter / E)',
        onConfirm: () => {
          setStage(STAGES.FIRST_BITE);
          cookLog(`任務完成：病患品嚐第一口麻婆豆腐，滿意度 ${scoreDetail}！`);
          $('log').textContent = `任務達成：麻婆豆腐第一口回饋 ${scoreDetail}！按 R 可重新開始新一輪`;
        }
      });
      return;
    }
  }

  // Rice Cooker Stand Interaction (X = 11.5)
  if (name.includes('電子鍋') || name.includes('RiceCooker') || name.includes('飯鍋')) {
    const currentRice = cookedDish.ricePortion;
    showDialog({
      badge: 'RICE STATION — 越光米飯',
      title: '【電子鍋 / 盛裝越光米飯】',
      content: `
        <p>打開香氣四溢、蒸氣裊裊的高壓電子鍋，裡面是粒粒分明飽滿的越光米飯。</p>
        <p>目前托盤配飯狀態：<strong>【${currentRice}】</strong>（病患問診處方需求：<strong>【${currentOrder.rice}】</strong>）</p>
        <div class="preference-grid">
          <div class="pref-row">
            <span class="pref-label">請選擇盛飯份量：</span>
            <div class="pref-buttons" id="riceDialogButtons">
              <button type="button" class="pref-btn ${currentRice === '半碗飯' ? 'is-selected' : ''}" id="dlgRiceHalf">盛半碗飯 (減醣輕量)</button>
              <button type="button" class="pref-btn ${currentRice === '正常飯' ? 'is-selected' : ''}" id="dlgRiceFull">盛一滿碗 (傳統大份量)</button>
            </div>
          </div>
        </div>
      `,
      confirmText: '完成盛飯並返回 (Enter / E)',
      onConfirm: () => {
        cookLog(`電子鍋：托盤已備妥【${cookedDish.ricePortion}】！`);
        updateCooking();
      }
    });

    const btnHalf = $('dlgRiceHalf');
    const btnFull = $('dlgRiceFull');
    if (btnHalf && btnFull) {
      btnHalf.onclick = () => {
        cookedDish.ricePortion = '半碗飯';
        btnHalf.classList.add('is-selected');
        btnFull.classList.remove('is-selected');
        cookLog('電子鍋：盛入【減醣半碗越光米飯】');
        updateCooking();
      };
      btnFull.onclick = () => {
        cookedDish.ricePortion = '正常飯';
        btnFull.classList.add('is-selected');
        btnHalf.classList.remove('is-selected');
        cookLog('電子鍋：盛入【熱騰騰滿碗越光米飯】');
        updateCooking();
      };
    }
    return;
  }

  // 2. Doctor Desk / Order Printer Interaction (Order Prescription)
  if (name.includes('醫師桌') || name.includes('處方機') || name.includes('印表機') || name.includes('DoctorDesk') || name.includes('Printer')) {
    if (currentStage === STAGES.ORDER) {
      showDialog({
        badge: 'RX PRINTER — 料理處方單',
        title: '【電子病歷系統 / 料理處方單出單】',
        content: `
          <p><strong>處方代碼：</strong>#CK2-MAPO-001</p>
          <p><strong>料理品項：</strong>客製舒壓家常麻婆豆腐 (${currentOrder.spicy === '正常' ? '正宗川味' : currentOrder.spicy}配方)</p>
          <p><strong>客製化規格：</strong>辣度【${currentOrder.spicy === '正常' ? '正常辣' : currentOrder.spicy}】｜青蔥【${currentOrder.scallion ? '要青蔥' : '免放蔥'}】｜附餐【越光米飯 ${currentOrder.rice}】</p>
          <p><strong>標準食材明細：</strong>嫩豆腐 1 塊、特級豬絞肉 100g、川味豆瓣醬 2 大匙、鮮蒜瓣碎、大紅袍花椒少許${currentOrder.scallion ? '、青蔥段' : ''}。</p>
          <p><strong>料理要點：</strong>先爆香肉碎與蒜瓣豆瓣，下豆腐燴煮入味，起鍋前盛盤。</p>
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
      $('boardSpoon').className = 'board-spoon-img is-scooping';
      queueAction(() => $('boardSpoon') && ($('boardSpoon').className = 'board-spoon-img'), 300);
    }
    cutStages.douban = 1;
    prepped.add('douban');
    cookLog('川味豆瓣醬：用湯匙舀取醇厚紅油豆瓣醬！');
  } else if (selectedFood === 'tofu') {
    // Knife chopping action aligned with cut seam
    const curT = cutStages.tofu || 0;
    if ($('boardKnife')) {
      const alignClass = curT === 0 ? 'align-tofu-center' : (curT === 1 ? 'align-tofu-horizontal' : 'align-tofu-dice');
      $('boardKnife').className = `board-knife-img ${alignClass} is-chopping`;
      if ($('chopEffect')) $('chopEffect').classList.add('is-active');
      queueAction(() => {
        if ($('boardKnife')) $('boardKnife').className = `board-knife-img ${alignClass}`;
        if ($('chopEffect')) $('chopEffect').classList.remove('is-active');
      }, 220);
    }
    cutStages.tofu = curT + 1;
    if (cutStages.tofu >= 3) {
      prepped.add('tofu');
      cookLog('嫩豆腐：對半剖開、切成條狀，再均勻切成骰子塊！');
    } else if (cutStages.tofu === 1) {
      cookLog('嫩豆腐：刀鋒垂直下切中線，潔白豆腐對半剖開');
    } else if (cutStages.tofu === 2) {
      cookLog('嫩豆腐：刀身旋轉九十度，橫剖切成長方條狀');
    }
  } else if (selectedFood === 'scallion') {
    if ($('boardKnife')) {
      $('boardKnife').className = 'board-knife-img align-scallion is-chopping';
      if ($('chopEffect')) $('chopEffect').classList.add('is-active');
      queueAction(() => {
        if ($('boardKnife')) $('boardKnife').className = 'board-knife-img align-scallion';
        if ($('chopEffect')) $('chopEffect').classList.remove('is-active');
      }, 220);
    }
    cutStages.scallion = 1;
    prepped.add('scallion');
    cookLog('鮮青蔥：沿蔥白至蔥綠連續下刀分段，切成細碎翠綠蔥花！');
  } else if (selectedFood === 'garlic') {
    if ($('boardKnife')) {
      $('boardKnife').className = 'board-knife-img align-garlic is-chopping';
      if ($('chopEffect')) $('chopEffect').classList.add('is-active');
      queueAction(() => {
        if ($('boardKnife')) $('boardKnife').className = 'board-knife-img align-garlic';
        if ($('chopEffect')) $('chopEffect').classList.remove('is-active');
      }, 220);
    }
    cutStages.garlic = 1;
    prepped.add('garlic');
    cookLog('鮮蒜瓣：刀面平壓拍扁破壁，快速細剁成香濃蒜碎末！');
  } else if (selectedFood === 'pork') {
    if ($('boardKnife')) {
      $('boardKnife').className = 'board-knife-img align-pork is-chopping';
      if ($('chopEffect')) $('chopEffect').classList.add('is-active');
      queueAction(() => {
        if ($('boardKnife')) $('boardKnife').className = 'board-knife-img align-pork';
        if ($('chopEffect')) $('chopEffect').classList.remove('is-active');
      }, 220);
    }
    cutStages.pork = 1;
    prepped.add('pork');
    cookLog('上等豬絞肉：以刀背輕剁鬆散，均勻分切成肉末粒！');
  } else {
    prepped.add(selectedFood);
    cookLog(`備料完成：${foodNames[selectedFood]}`);
  }

  window.CKRush?.action(`cut:${selectedFood}:${cutStages[selectedFood] || 1}`, selectedFood !== 'scallion' || currentOrder.scallion);
  if (selectedFood && prepped.has(selectedFood)) {
    if ((preparedTray[selectedFood] || 0) === 0) {
      preparedTray[selectedFood] = 1;
      updatePortionUI();
    }
    window.CKShift?.prep(selectedFood, selectedFood !== 'scallion' || currentOrder.scallion);
  }
  if (required.every(id => prepped.has(id) || inWok.has(id)) && currentStage <= STAGES.PREP) {
    setStage(STAGES.COOK);
    cookLog('麻婆豆腐核心食材全數備妥！請走向炒鍋爐台開火下鍋');
  }
  updateCooking();
});

if ($('portionCycleBtn')) {
  $('portionCycleBtn').addEventListener('click', () => {
    cyclePortion(selectedFood);
  });
}

$('heatBtn').addEventListener('click', () => {
  if (!isNearWokStation()) {
    $('log').textContent = '未到炒鍋爐台：Dr. Speed 必須走近炒鍋爐台 (X: ~9.0) 才能操作！';
    cookLog('提示：請先靠近後廚炒鍋爐台才能開火');
    return;
  }
  if (wok.flame === 'off') {
    wok.flame = 'low';
    heated = true;
    cookLog('瓦斯爐點火：開啟小火，文火慢煨（0.5x等效收汁）！');
  } else if (wok.flame === 'low') {
    wok.flame = 'high';
    heated = true;
    cookLog('瓦斯爐轉大火：大火猛烈爆炒收汁（1.0x等效收汁）！');
  } else {
    wok.flame = 'off';
    heated = false;
    cookLog('關閉爐火：火候停止累積');
  }
  updateCooking();
});

$('addBtn').addEventListener('click', () => {
  if ($('addBtn').disabled || wok.hasFood) return;
  if (!isNearWokStation()) {
    $('log').textContent = '未到炒鍋爐台：請先走近炒鍋爐台才能下鍋！';
    return;
  }
  if (wok.flame === 'off') {
    $('log').textContent = '炒鍋尚未加熱：請先按 F 或點擊「開小火」！';
    return;
  }

  let addedCount = 0;
  const addedNames = [];
  for (const [id, portion] of Object.entries(preparedTray)) {
    if (portion > 0) {
      wok.contents[id] = portion;
      inWok.add(id);
      addedCount++;
      addedNames.push((foodNames[id] || id) + (portion === 0.5 ? '半份' : '1份'));
      if (id === 'scallion') cookedDish.hasScallion = true;
      if (id === 'tofu') cookedDish.hasTofu = true;
      if (id === 'pork') cookedDish.hasPork = true;
      if (id === 'douban') cookedDish.hasDouban = true;
      if (id === 'garlic') cookedDish.hasGarlic = true;
      if (id === 'pepper') cookedDish.hasPepper = true;
    }
  }
  if (addedCount === 0) {
    $('log').textContent = '備料盤是空的！請先至備料檯設定材料份量。';
    return;
  }

  wok.hasFood = true;
  cookedDish.contents = { ...wok.contents };
  window.CKAudio?.cue('sizzle');
  $('addBtn').disabled = true;
  $('addBtn').textContent = '食材已全下鍋';

  cookLog(`炒鍋：一次全料下鍋！【${addedNames.join('、')}】滑入熱鍋！`);
  $('log').textContent = `全料下鍋：【${addedNames.join('、')}】！請翻炒推勻並控制火候收汁。`;

  wok.stirs = 0;
  stirs = 0;
  simmerTimer = 0;
  wok.eqSimmerTime = 0;
  cookedDish.stirs = 0;
  cookedDish.isSimmered = false;
  if (currentStage >= STAGES.COOK && currentStage < STAGES.SERVE) setStage(STAGES.COOK);
  syncWokFoodDOM();
  updateCooking();
});

$('stirBtn').addEventListener('click', () => {
  if ($('stirBtn').disabled || !wok.hasFood) return;
  if (!isNearWokStation()) {
    $('log').textContent = '未到炒鍋爐台：請先走近炒鍋爐台才能翻炒！';
    return;
  }
  wok.stirs++;
  stirs = wok.stirs;
  cookedDish.stirs = wok.stirs;
  if (wok.stirs <= 3) window.CKRush?.action('stir:' + wok.stirs);

  // Spatula sweeping animation
  if ($('wokSpatula')) {
    $('wokSpatula').classList.remove('is-stirring');
    void $('wokSpatula').offsetWidth;
    $('wokSpatula').classList.add('is-stirring');
    queueAction(() => $('wokSpatula') && $('wokSpatula').classList.remove('is-stirring'), 400);
  }

  // Reactive physical displacement of food items
  const foodLayer = $('wokFoodLayer');
  if (foodLayer) {
    const items = foodLayer.querySelectorAll('.wok-food-item');
    items.forEach(item => item.classList.add('is-pushed'));
    queueAction(() => items.forEach(item => item.classList.remove('is-pushed')), 250);
  }

  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    $('wokContents').animate([{ transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'none' }], { duration: 250 });
  }

  if (wok.stirs === 1) {
    cookLog('翻炒第 1 次：金屬鍋鏟推動食材均勻受熱，肉粒變色微焦散發肉香！');
  } else if (wok.stirs === 2) {
    cookLog('翻炒第 2 次：豆瓣醬爆出紅油與熱氣，紅亮油光完整包覆肉末與蒜香！');
  } else if (wok.stirs >= 3) {
    cookLog('翻炒第 3 次：翻炒推勻！請維持適度火候進入【燜煮收汁】階段（目標 4 等效秒）');
  }
  updateCooking();
});

if ($('misoToggleBtn')) {
  $('misoToggleBtn').addEventListener('click', () => {
    cookedDish.miso = !cookedDish.miso;
    cookLog(cookedDish.miso ? '托盤新增：熱騰騰暖心味噌湯！' : '托盤移除味噌湯');
    $('log').textContent = cookedDish.miso ? '配餐：已選擇附熱味噌湯！' : '配餐：不要味噌湯';
    updateCooking();
  });
}

// Rice Cooker lower workbench buttons
if ($('riceHalfBtn')) {
  $('riceHalfBtn').addEventListener('click', () => {
    cookedDish.ricePortion = '半碗飯';
    cookLog('電子鍋：盛入【減醣半碗越光米飯】至服務托盤！');
    $('log').textContent = '電子鍋：已盛裝半碗越光米飯！';
    updateCooking();
  });
}
if ($('riceFullBtn')) {
  $('riceFullBtn').addEventListener('click', () => {
    cookedDish.ricePortion = '正常飯';
    cookLog('電子鍋：盛入【熱騰騰滿碗越光米飯】至服務托盤！');
    $('log').textContent = '電子鍋：已盛裝一滿碗越光米飯！';
    updateCooking();
  });
}

$('plateBtn').addEventListener('click', () => {
  if ($('plateBtn').disabled || isPlating) return;
  if (!isNearWokStation() && !isNearServeStation()) {
    $('log').textContent = '未到工作檯：請先走近炒鍋爐台或配餐檯盛盤！';
    return;
  }

  isPlating = true;
  window.isPlating = true;
  window.plated = false;
  window.setCarryingTray(false);
  $('plateBtn').disabled = true;

  // Plating transfer animation
  const wok = $('wokStage');
  if (wok) wok.classList.add('wok-plating-active');
  if ($('wokSpatula')) $('wokSpatula').classList.add('is-stirring');
  const preview = $('platedDishPreview');
  if (preview) {
    preview.classList.add('is-transferring');
    preview.removeAttribute('hidden');
  }

  $('wokStatusText').textContent = '盛盤中：熱氣蒸騰，豆腐紅油滑入青花瓷碗裝入托盤...';
  cookLog('盛盤中：熱氣蒸騰，豆腐紅油滑入青花瓷碗...');

  if (platingTimeout) clearTimeout(platingTimeout);
  platingTimeout = setTimeout(() => {
    if (wok) wok.classList.remove('wok-plating-active');
    if ($('wokSpatula')) $('wokSpatula').classList.remove('is-stirring');
    if (preview) preview.classList.remove('is-transferring');
    isPlating = false;
    window.isPlating = false;
    platingTimeout = null;

    plated = true;
    window.plated = true;
    heated = false;
    setStage(STAGES.SERVE);
    if (window.setCarryingTray) window.setCarryingTray(true);
    cookLog('以鍋鏟將麻婆豆腐俐落舀入青花瓷碗！托盤放上越光米飯與筷匙，請端回診間');
    $('log').textContent = '麻婆豆腐已盛盤！請端著托盤走回前診間給病人 (X: ~ -7.3)';
    updateCooking();
  }, 450);
});

const movementKeys = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift']);

addEventListener('keydown', event => {
  if (event.target.matches('input,textarea,select,[contenteditable="true"]')) return;
  const key = event.key.toLowerCase();
  if (event.target.closest('#doctorDialog')) return;
  if (key === 'r' && !event.repeat) { event.preventDefault(); resetAll(); return; }
  if (event.target.closest('[data-worktab],.shift-control')) return;
  if (!dialogOpen && key !== 'r' && window.CKShift?.isFrozen()) {
    if (movementKeys.has(key) || key === 'e') event.preventDefault();
    return;
  }
  if (dialogOpen && event.target.closest('.pref-btn') && (key === 'enter' || key === ' ')) return;

  if (dialogOpen) {
    if (key === 'escape') {
      event.preventDefault();
      cancelDialog();
      return;
    }
    if (key === 'enter' || key === ' ' || key === 'e') {
      event.preventDefault();
      confirmDialog();
      return;
    }
    return;
  }

  if (movementKeys.has(key)) {
    event.preventDefault();
    keys.add(key);
  }
  if (event.repeat) return;
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

window.clearGameKeys = function () {
  keys.clear(); previousTime = 0;
  if (window.update3DPlayerMovement) window.update3DPlayerMovement(0, 0, 0, 1);
};
window.stopShiftCooking = function () {
  cancelActionTimers();
  window.clearGameKeys();
  heated = false;
  if (platingTimeout) clearTimeout(platingTimeout);
  platingTimeout = null; isPlating = false;
  $('wokStage').classList.remove('wok-plating-active');
  $('wokSpatula').classList.remove('is-stirring');
  $('platedDishPreview').classList.remove('is-transferring');
  if (window.setCarryingTray) window.setCarryingTray(false);
  updateCooking();
};

window.getCookingStatus = () => ({
  stage: currentStage, selectedFood, atPrep: isNearPrepStation(), atWok: isNearWokStation(), atServe: isNearServeStation(), atConsult: isNearConsultStation(),
  prepped: [...prepped], inWok: [...inWok], ready: (wok.hasFood || required.every(id => inWok.has(id))),
  heated: wok.flame !== 'off',
  flame: wok.flame,
  stirs: wok.stirs,
  simmerTimer: wok.eqSimmerTime,
  eqSimmerTime: wok.eqSimmerTime,
  plated, isPlating,
  rice: cookedDish.ricePortion,
  miso: !!cookedDish.miso,
  wok, preparedTray
});

if (window.initScene3D) window.initScene3D(world);
resetAll();
requestAnimationFrame(move);
