/* One-screen clinic HUD, doctor choice and craving. The cooking engine stays in main.js. */
(function () {
  'use strict';
  const { Round, doctors, rules } = window.CKShiftRules;
  const round = new Round();
  const el = id => document.getElementById(id);
  const picker = el('doctorDialog');
  let lastKey = '';
  let lastStation = '';
  let lastStatus = 'ready';
  let resultDismissed = false;
  let resumeOnReturn = false;

  function frozen() {
    return round.paused || picker.open || document.hidden || round.status === 'lost' || round.status === 'won';
  }
  function setText(id, text) { if (el(id).textContent !== String(text)) el(id).textContent = text; }
  function selectPanel(panel) {
    el('cookingDeck').dataset.panel = panel;
  }
  function applyDoctor() {
    const doctor = round.doctor;
    setText('selectedDoctorName', doctor.name);
    setText('selectedDoctorTitle', doctor.title);
    setText('doctorAbility', doctor.ability);
    el('doctorPickerBtn').title = doctor.ability + '；接單前可換醫師';
    el('selectedDoctorPortrait').src = `assets/ui/doctor-${round.doctorId}.webp`;
    el('app').dataset.doctor = round.doctorId;
    if (window.setDoctorRole) window.setDoctorRole(round.doctorId, doctor.name);
    document.querySelectorAll('[data-doctor]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.doctor === round.doctorId));
    });
  }
  function render() {
    const value = Math.round(round.craving);
    const focus = Math.round(round.focus);
    const band = value >= 90 ? 'critical' : value >= 70 ? 'high' : value >= 40 ? 'medium' : 'low';
    const labels = { low: '較平穩', medium: '有些坐不住', high: '需要留意', critical: '接近上限' };
    const key = [value, focus, round.status, round.paused, round.points, round.served, round.streak, Math.floor(round.elapsed), round.doctorId, resultDismissed].join('|');
    if (key !== lastKey) {
      lastKey = key;
      el('patientHUD').dataset.cravingBand = band;
      setText('cravingText', value + '%');
      setText('focusText', focus + '%');
      setText('patientMood', labels[band]);
      el('cravingMeter').value = value;
      el('focusMeter').value = focus;
      el('cravingMeter').setAttribute('aria-valuetext', value + '%，' + labels[band]);
      setText('shiftPoints', round.points);
      setText('shiftServed', round.served);
      setText('shiftStreak', round.streak);
      setText('shiftTime', Math.floor(round.elapsed) + ' 秒');
      setText('roundStatus', round.paused ? '已暫停' : ({ ready: '確認料理單後計時', active: '料理進行中', won: '本單完成', lost: '本單未完成' })[round.status]);
      el('doctorPickerBtn').disabled = round.status !== 'ready';
      el('pauseBtn').disabled = round.status === 'lost' || round.status === 'won';
      setText('pauseBtn', round.paused ? '繼續 P' : '暫停 P');
      el('nextOrderBtn').hidden = round.status !== 'won' && round.status !== 'lost';
      setText('nextOrderBtn', round.status === 'won' ? '下一份料理' : '重試本單');
      el('app').dataset.roundStatus = round.status;
      el('app').dataset.paused = String(round.paused);
    }
    const modalVisible = !el('dialogModal').hidden;
    const shouldBlock = round.paused || ((round.status === 'lost' || round.status === 'won') && !modalVisible && !resultDismissed);
    el('sessionOverlay').hidden = !shouldBlock;
    if (shouldBlock) {
      const paused = round.paused;
      setText('sessionTitle', paused ? '門診暫停' : round.status === 'won' ? '這一份，送到了。' : 'Craving 到達上限');
      setText('sessionMessage', paused ? 'Craving 與燜煮計時都已停止。' : round.status === 'won'
        ? `料理品質 ${round.quality}% · +${round.lastEarned} 分 · 連勝 ${round.streak}。完成的是遊戲任務，不是治療效果。`
        : '本次來不及出餐，未取得分數，連勝歸零。重新整理下一份料理。');
      setText('sessionContinueBtn', paused ? '繼續料理' : round.status === 'won' ? '下一份料理' : '重新挑戰');
    }
    if (round.status === 'won' && modalVisible && !el('shiftResultLine')) {
      const line = document.createElement('p');
      line.id = 'shiftResultLine';
      line.textContent = `+${round.lastEarned} 分｜Craving ${value}%｜Focus ${focus}%｜連勝 ${round.streak}`;
      el('dialogContent').append(line);
    }
    if (round.status === 'lost' && lastStatus !== 'lost') {
      if (window.stopShiftCooking) window.stopShiftCooking();
      el('sessionContinueBtn').focus({ preventScroll: true });
    }
    window.CKRush?.renderResult(round.snapshot(), modalVisible, shouldBlock);
    lastStatus = round.status;
    const p = window.scene3DState?.playerPos;
    const station = p && p.x >= 10.8 ? 'serve' : p && p.x >= 7.2 ? 'wok' : p && p.x >= 3.2 ? 'prep' : '';
    if (station && station !== lastStation) selectPanel(station);
    lastStation = station;
  }
  window.CKShift = {
    get craving() { return round.craving; },
    get doctorName() { return round.doctor.name; },
    get burnAfter() { return round.burnAfter; },
    snapshot: () => round.snapshot(),
    isFrozen: frozen,
    canInteract: () => !round.paused && !picker.open && round.status !== 'lost' && round.status !== 'won',
    tick(dt, dialogOpen) {
      const stopped = frozen() || dialogOpen;
      if (!stopped) round.tick(dt, window.CKRush?.pressureMultiplier() || 1);
      window.CKRush?.update(stopped ? 0 : dt, round.snapshot(), stopped);
      render();
    },
    begin() { if (round.begin()) window.CKRush?.begin(); render(); },
    prep(id, correct) { round.reward('prep:' + id, correct); render(); },
    simmer() { round.reward('simmer', true, true); render(); },
    finish(quality) {
      if (round.status !== "active") return;
      round.finish(quality, window.CKRush?.settle(quality) || 0);
      window.CKRush?.record(round.lastEarned); render();
    },
    finishR6(params) {
      if (round.status !== "active") return;
      const bonus = window.CKRush?.settle(params.quality) || 0;
      round.finishR6({ ...params, bonus });
      if (params.won) {
        window.CKRush?.record(round.lastEarned);
      }
      render();
    },
    reset() { window.CKRush?.reset(); round.reset(); resultDismissed = false; resumeOnReturn = false; lastKey = ''; applyDoctor(); selectPanel('prep'); render(); el('world').focus({ preventScroll: true }); },
    render
  };
  document.querySelectorAll('[data-doctor]').forEach(button => button.addEventListener('click', () => {
    if (!round.select(button.dataset.doctor)) return;
    applyDoctor(); picker.close(); el('world').focus({ preventScroll: true }); render();
  }));
  el('doctorPickerBtn').addEventListener('click', () => {
    if (round.status !== 'ready') return;
    picker.showModal();
  });
  el('closeDoctorBtn').addEventListener('click', () => picker.close());
  picker.addEventListener('close', () => el('doctorPickerBtn').focus({ preventScroll: true }));
  function pause() {
    if (round.status === 'won' || round.status === 'lost' || picker.open || !el('dialogModal').hidden) return;
    round.paused = !round.paused;
    if (window.clearGameKeys) window.clearGameKeys();
    render();
    (round.paused ? el('sessionContinueBtn') : el('world')).focus({ preventScroll: true });
  }
  el('pauseBtn').addEventListener('click', pause);
  el('sessionContinueBtn').addEventListener('click', () => round.paused ? pause() : window.resetAll());
  el('nextOrderBtn').addEventListener('click', () => window.resetAll());
  el('restartRoundBtn').addEventListener('click', () => window.resetAll());
  window.addEventListener('keydown', event => {
    if (event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
    if (event.key.toLowerCase() === 'p' && !event.repeat) { event.preventDefault(); pause(); }
  });
  document.addEventListener('visibilitychange', () => {
    if (window.clearGameKeys) window.clearGameKeys();
    if (document.hidden && !round.paused && round.status === 'active') {
      resumeOnReturn = true; round.paused = true;
    } else if (!document.hidden && resumeOnReturn) {
      // Stay paused until explicit resume; never penalize time spent off-page.
      resumeOnReturn = false;
    }
    render();
  });
  // Guard normal UI events while paused/finished without altering recipe eligibility.
  el('cookingDeck').addEventListener('click', event => {
    if (!frozen() || event.target.closest('.shift-control,[data-worktab],#cookLogContainer,#dialogModal,#rushStrip')) return;
    event.preventDefault(); event.stopImmediatePropagation();
  }, true);
  el('cookingDeck').dataset.panel = 'prep';
  applyDoctor(); render();
  el('ruleSummary').textContent = `Craving 達 100% 本單失敗；正確備料降低 2%。本版上升 ${rules.cravingPerSecond}/秒，確認料理單後開始；閱讀對話、暫停及背景分頁不計時。`;
})();
