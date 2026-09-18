'use strict';
// Playable 2D prototype. This is not the planned 3D character/environment build.
const $ = id => document.getElementById(id);
const world = $('world'), camera = $('camera'), player = $('player');
const keys = new Set(), visited = new Set();
const props = [...document.querySelectorAll('.prop')];
const foodButtons = [...document.querySelectorAll('[data-food]')];
const foodNames = {tofu:'豆腐', pork:'絞肉', douban:'豆瓣醬', garlic:'蒜', pepper:'花椒', scallion:'青蔥'};
const required = ['tofu', 'pork', 'douban', 'garlic'];
const prepped = new Set(), inWok = new Set();
let x = 250, y = 470, previousTime = 0;
let selectedFood = null, heated = false, stirs = 0, plated = false;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function propRect(prop) {
  return {x:prop.parentElement.offsetLeft + prop.offsetLeft,
    y:prop.parentElement.offsetTop + prop.offsetTop,
    w:prop.offsetWidth, h:prop.offsetHeight};
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
  // Feet collide with furniture; the upper-body drawing can overlap it.
  const feet = {x:nx + 14, y:ny + player.offsetHeight - 18, w:34, h:16};
  return props.every(prop => {
    const r = propRect(prop);
    return feet.x + feet.w <= r.x || feet.x >= r.x + r.w ||
      feet.y + feet.h <= r.y || feet.y >= r.y + r.h;
  });
}
function updateCameraAndPlayer() {
  player.style.left = `${x}px`; player.style.top = `${y}px`;
  const cx = clamp(x + player.offsetWidth / 2 - world.clientWidth / 2, 0, Math.max(0,1800 - world.clientWidth));
  const cy = clamp(y + player.offsetHeight / 2 - world.clientHeight / 2, 0, Math.max(0,760 - world.clientHeight));
  camera.style.transform = `translate(${-cx}px, ${-cy}px)`;
}
function move(now) {
  const dt = previousTime ? Math.min((now - previousTime) / 1000, 0.05) : 0;
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
  const nearby = nearProp();
  $('prompt').textContent = nearby ? `E — ${nearby.textContent.trim()}` : 'WASD 移動｜靠近物件按 E';
  requestAnimationFrame(move);
}
function cookLog(text) {
  const list = $('recipeLog');
  if (list.textContent.includes('等待開始')) list.replaceChildren();
  const line = document.createElement('li'); line.textContent = text; list.append(line);
  list.scrollTop = list.scrollHeight;
}
function updateCooking() {
  const ready = required.every(id => inWok.has(id));
  foodButtons.forEach(button => {
    const id = button.dataset.food;
    button.classList.toggle('is-selected', selectedFood === id);
    button.classList.toggle('is-prepped', prepped.has(id) || inWok.has(id));
    button.disabled = plated || inWok.has(id);
  });
  $('cutBtn').disabled = plated || !selectedFood || prepped.has(selectedFood) || inWok.has(selectedFood);
  $('heatBtn').disabled = plated;
  $('heatBtn').textContent = heated ? '關火' : '開火';
  $('addBtn').disabled = plated || !heated || prepped.size === 0;
  $('stirBtn').disabled = plated || !heated || inWok.size === 0;
  $('plateBtn').disabled = plated || !heated || !ready || stirs < 3;
  $('flame').classList.toggle('is-on', heated);
  document.querySelector('.wok-visual').classList.toggle('is-cooking', heated && inWok.size > 0);
  $('wokContents').textContent = plated ? '麻婆豆腐完成' : inWok.size ? [...inWok].map(id => foodNames[id]).join('＋') : '空鍋';
  $('cookObjective').textContent = plated ? '原型盛盤完成｜R 重新開始；病人上菜尚未實作' :
    !inWok.size ? '備妥豆腐、絞肉、豆瓣醬、蒜，再開火下鍋' :
    !ready ? `尚缺：${required.filter(id => !inWok.has(id)).map(id => foodNames[id]).join('、')}` :
    !heated ? '重新開火才能翻炒' : stirs < 3 ? `翻炒 ${stirs} / 3 次` : '可以盛盤';
}
function resetAll() {
  x = 250; y = 470; previousTime = 0; keys.clear(); visited.clear();
  selectedFood = null; prepped.clear(); inWok.clear(); heated = false; stirs = 0; plated = false;
  $('boardFood').textContent = '砧板空著'; $('recipeLog').innerHTML = '<li>等待開始</li>';
  $('log').textContent = '已重置：探索與料理狀態皆已清空'; updateCooking();
  updateCameraAndPlayer();
}
foodButtons.forEach(button => button.addEventListener('click', () => {
  selectedFood = button.dataset.food;
  $('boardFood').textContent = `${foodNames[selectedFood]} ${prepped.has(selectedFood) ? '已備妥' : '已放上砧板'}`;
  updateCooking();
}));
$('cutBtn').addEventListener('click', () => {
  if ($('cutBtn').disabled) return;
  prepped.add(selectedFood); $('boardFood').textContent = `${foodNames[selectedFood]} 已備妥`;
  cookLog(`備料完成：${foodNames[selectedFood]}`); updateCooking();
});
$('heatBtn').addEventListener('click', () => { heated = !heated; cookLog(heated ? '炒鍋升溫' : '關火'); updateCooking(); });
$('addBtn').addEventListener('click', () => {
  if ($('addBtn').disabled) return;
  cookLog(`下鍋：${[...prepped].map(id => foodNames[id]).join('、')}`);
  prepped.forEach(id => inWok.add(id)); prepped.clear(); selectedFood = null; stirs = 0;
  $('boardFood').textContent = '砧板空著'; updateCooking();
});
$('stirBtn').addEventListener('click', () => {
  if ($('stirBtn').disabled) return;
  stirs++; cookLog(`翻炒 ${stirs} 次`);
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    $('wokContents').animate([{transform:'translateX(-8px)'},{transform:'translateX(8px)'},{transform:'none'}],{duration:250});
  }
  updateCooking();
});
$('plateBtn').addEventListener('click', () => {
  if ($('plateBtn').disabled) return;
  plated = true; heated = false; cookLog('原型完成：麻婆豆腐盛盤'); updateCooking();
});
const movementKeys = new Set(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright','shift']);
addEventListener('keydown', event => {
  if (event.target.matches('input,textarea,select,[contenteditable="true"]')) return;
  const key = event.key.toLowerCase();
  if (movementKeys.has(key)) { event.preventDefault(); keys.add(key); }
  if (event.repeat) return;
  if (key === 'r') resetAll();
  if (key === 'e') {
    const prop = nearProp();
    if (prop) { const name = prop.textContent.trim(); visited.add(name); $('log').textContent = `互動：${name}｜已探索 ${visited.size} 個重點`; }
  }
});
addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
addEventListener('blur', () => { keys.clear(); previousTime = 0; });
world.addEventListener('pointerdown', event => { if (!event.target.closest('details,button,a')) world.focus({preventScroll:true}); });
resetAll(); requestAnimationFrame(move);
