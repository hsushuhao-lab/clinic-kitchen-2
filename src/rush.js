/* R3 controller: precision is an optional reward, never a recipe gate. */
(function () {
  'use strict';
  const rush = new CKRushRules.Rush(), byId = id => document.getElementById(id);
  let lastStatus = 'ready', lastStage = 0, warnedTime = false, warnedBurn = false, lastUI = '';
  let toastUntil = 0, lastFeedback = '', activeClock = 0, best = 0;
  try { best = Number(localStorage.getItem('ck-rush-best-v1')) || 0; } catch (_) {}
  const text = (id, value) => { const el = byId(id); if (el.textContent !== String(value)) el.textContent = value; };
  function feedback(message, grade) {
    lastFeedback = message; toastUntil = activeClock + 1.3;
    text('precisionFeedback', message); byId('precisionFeedback').dataset.grade = grade;
    CKAudio.cue(grade);
  }
  function resultText() {
    const r = rush.lastResult;
    if (!r) return '';
    return `${r.rank} 級｜精準 +${r.technique}・準時 +${r.timeBonus}・完美訂單 +${r.cleanBonus}｜最高 ${r.bestCombo} COMBO`;
  }
  window.CKRush = {
    pressureMultiplier: () => rush.pressure,
    prescribedOrder() {
      if (rush.mode !== 'rush') return null;
      const { spicy, scallion, rice } = rush.ticket;
      return { spicy, scallion, rice };
    },
    lockPreferences(grid) {
      if (rush.mode !== 'rush' || !grid) return;
      grid.querySelectorAll('button').forEach(button => { button.disabled = true; });
      const note = document.createElement('p'); note.className = 'rush-order-note';
      note.textContent = `晚班 ${rush.ticketIndex + 1}/3：病人已指定口味，照單製作。準時目標 ${rush.ticket.target} 秒；讀完並確認處方才開始計時。`;
      grid.before(note);
    },
    begin() { rush.begin(); warnedTime = warnedBurn = false; CKAudio.cue('ticket'); },
    reset() { rush.reset(); warnedTime = warnedBurn = false; lastStatus = 'ready'; lastStage = 0; lastFeedback = ''; toastUntil = 0; },
    action(key, correct = true) {
      const s = CKShift.snapshot(); if (s.status !== 'active' || CKShift.isFrozen()) return;
      const result = rush.judge(key, correct);
      if (!result) return;
      feedback(result.grade === 'perfect' ? `PERFECT +${result.earned} · ${result.combo} COMBO` :
        result.grade === 'good' ? `GOOD +${result.earned} · ${result.combo} COMBO` :
        result.grade === 'wrong' ? '注意訂單偏好・連擊中斷' : '完成・瞄準金色區可加分', result.grade === 'wrong' ? 'early' : result.grade);
    },
    settle(quality) { const r = rush.settle(quality); return r?.bonus || 0; },
    record(points) {
      if (!rush.record(points)) return;
      if (rush.complete && rush.sessionPoints > best) {
        best = rush.sessionPoints;
        try { localStorage.setItem('ck-rush-best-v1', String(best)); } catch (_) {}
      }
      CKAudio.cue('win');
    },
    resultText,
    renderResult(s, modalVisible, shouldBlock) {
      if (s.status !== 'won' || !rush.lastResult) return;
      const line = resultText() + (rush.mode === 'rush' ? `｜晚班累積 ${rush.sessionPoints} 分` : '');
      if (modalVisible && !byId('rushResultLine')) {
        const p = document.createElement('p'); p.id = 'rushResultLine'; p.className = 'rush-result'; p.textContent = line;
        byId('dialogContent').append(p);
      }
      if (shouldBlock) {
        text('sessionTitle', rush.complete ? '三單完成！今晚的廚房由你掌控。' : `${rush.lastResult.rank} 級出餐！`);
        text('sessionMessage', line + (rush.complete ? `｜本機最高 ${best} 分` : ''));
        text('sessionContinueBtn', rush.complete ? '再挑戰一個晚班' : '下一份料理');
      }
    },
    update(dt, snapshot, frozen) {
      const s = snapshot, cooking = window.getCookingStatus();
      if (!frozen) { rush.tick(dt); activeClock += dt; }
      if (s.status === 'lost' && lastStatus !== 'lost') { rush.lose(); CKAudio.cue('lose'); }
      if (cooking.stage === 5 && lastStage !== 5) CKAudio.cue('ready');
      const burnLeft = Math.max(0, s.burnAfter - cooking.simmerTimer);
      if (s.status === 'active' && rush.mode === 'rush' && rush.remaining <= 15 && !warnedTime) {
        warnedTime = true; CKAudio.cue('warning');
      }
      if (cooking.heated && cooking.stage === 5 && burnLeft <= 3 && !warnedBurn) { warnedBurn = true; CKAudio.cue('warning'); }
      let intensity = s.craving >= 80 || (rush.mode === 'rush' && rush.remaining <= 15 && s.status === 'active') ||
        (cooking.stage === 5 && cooking.heated && burnLeft <= 3) ? 2 : s.craving >= 60 || cooking.stage >= 4 ||
        (rush.mode === 'rush' && rush.elapsed >= rush.ticket.target / 2) ? 1 : 0;
      if (s.status !== 'active') intensity = 0;
      CKAudio.update({ level: intensity, musicOn: s.status === 'ready' || s.status === 'active',
        blocked: s.paused || document.hidden || byId('doctorDialog').open, duck: !byId('dialogModal').hidden });
      byId('app').dataset.pressure = ['calm', 'busy', 'urgent'][intensity];
      const available = s.status === 'active' && !frozen && (
        cooking.atPrep && cooking.selectedFood && !cooking.prepped.includes(cooking.selectedFood) && !cooking.inWok.includes(cooking.selectedFood) ||
        cooking.atWok && cooking.heated && cooking.ready && cooking.stirs < 3 && !cooking.plated);
      byId('precisionTrack').dataset.active = String(available);
      byId('precisionCursor').style.left = `${rush.snapshot().cursor * 100}%`;
      const time = rush.mode === 'rush' ? (rush.remaining > 0 ? `${Math.ceil(rush.remaining)}s` : '賞金已逾時') : '自由練習';
      const cue = cooking.stage === 5 ? (cooking.heated ? `收汁完成！${Math.ceil(burnLeft)}s 後過火・可先關火` : '已關火保溫・仍可盛盤') :
        cooking.stage === 6 ? '端餐衝刺！回病人椅 E 送餐' : available ? '金色區按 Space／操作鈕・沒命中仍可完成' :
        s.status === 'ready' ? '接單前可切換晚班挑戰・M 靜音' : '先備料再開火・可趁燜煮盛飯';
      const key = [rush.mode, rush.ticketIndex, time, s.status, s.paused, rush.combo, rush.technique, cue, intensity, cooking.stage, available, activeClock < toastUntil].join('|');
      if (key !== lastUI) {
        lastUI = key;
        text('rushMode', rush.mode === 'rush' ? '晚班挑戰 3 單' : '練習 → 晚班挑戰');
        byId('rushMode').setAttribute('aria-pressed', String(rush.mode === 'rush'));
        byId('rushMode').disabled = s.status !== 'ready' || cooking.stage !== 0;
        text('rushTicket', rush.mode === 'rush' ? `晚班 ${rush.ticketIndex + 1}/3` : '精準加分');
        text('rushClock', time); text('rushCombo', `${rush.combo} COMBO`);
        text('rushHint', s.paused ? '暫停中・倒數與判定停止' : cue);
        if (activeClock >= toastUntil) text('precisionFeedback', `本單技巧 +${rush.technique}`);
        text('musicState', ['輕快 96', '忙碌 120', '衝刺 144'][intensity] + ' BPM');
      }
      lastStatus = s.status; lastStage = cooking.stage;
    },
    snapshot: () => ({ ...rush.snapshot(), best, lastFeedback })
  };
  byId('rushMode').addEventListener('click', () => {
    if (CKShift.snapshot().status !== 'ready' || getMissionStage() !== 0) return;
    rush.setMode(rush.mode === 'rush' ? 'practice' : 'rush'); lastUI = '';
    CKAudio.cue('ticket');
  });
  byId('musicToggle').addEventListener('click', () => {
    const s = CKAudio.snapshot();
    if (s.enabled && !s.unlocked) CKAudio.unlock(); else CKAudio.setEnabled(!s.enabled);
  });
  byId('musicVolume').addEventListener('input', e => CKAudio.setVolume(Number(e.target.value) / 100));
  addEventListener('keydown', e => {
    if (e.repeat || e.target.closest('input,textarea,select,[contenteditable="true"]')) return;
    if (e.key.toLowerCase() === 'm') { e.preventDefault(); byId('musicToggle').click(); return; }
    if (e.code !== 'Space' || e.defaultPrevented || e.target.closest('#rushStrip,dialog,.dialog-modal') || CKShift.isFrozen()) return;
    const c = getCookingStatus();
    const button = c.atPrep ? byId('cutBtn') : c.atWok ? byId('stirBtn') : null;
    if (button && !button.disabled) { e.preventDefault(); button.click(); }
  });
})();
