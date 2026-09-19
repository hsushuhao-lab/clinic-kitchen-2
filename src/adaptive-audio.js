/* Original procedural score: D-minor kitchen groove. No downloads, recordings or samples.
   One AudioContext / one scheduler; game state sets orchestration, never loudness spikes. */
(function () {
  'use strict';
  const TEMPOS = [96, 120, 144];
  const midi = n => 440 * 2 ** ((n - 69) / 12);
  function instruments(ctx, output) {
    const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * .25), ctx.sampleRate);
    const data = noise.getChannelData(0); let seed = 79;
    for (let i = 0; i < data.length; i++) { seed = (seed * 16807) % 2147483647; data[i] = (seed / 2147483647 * 2 - 1); }
    let live = 0;
    function tone(note, time, duration, volume = .12, type = 'triangle', endHz = 0) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type;
      o.frequency.setValueAtTime(midi(note), time);
      if (endHz) o.frequency.exponentialRampToValueAtTime(endHz, time + duration);
      g.gain.setValueAtTime(0, time); g.gain.linearRampToValueAtTime(volume, time + .008);
      g.gain.exponentialRampToValueAtTime(.0001, time + duration);
      o.connect(g); g.connect(output); live++;
      o.onended = () => { o.disconnect(); g.disconnect(); live--; };
      o.start(time); o.stop(time + duration + .02);
    }
    function hat(time, duration, volume, frequency) {
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = noise; f.type = 'highpass'; f.frequency.value = frequency;
      g.gain.setValueAtTime(volume, time); g.gain.exponentialRampToValueAtTime(.0001, time + duration);
      s.connect(f); f.connect(g); g.connect(output); live++;
      s.onended = () => { s.disconnect(); f.disconnect(); g.disconnect(); live--; };
      s.start(time); s.stop(time + duration);
    }
    function step(index, time, level, beat) {
      const bar = Math.floor(index / 16) % 4, i = index % 16;
      const base = [50, 46, 53, 48][bar];
      if (i % 4 === 0) tone(base - 12 + (i === 12 ? 7 : 0), time, beat * .75, .16, 'triangle');
      if (i === 0 || i === 8 || (level === 2 && i === 11)) tone(43, time, .16, .27, 'sine', 42);
      if (i === 4 || i === 12) { hat(time, .11, .10, 1200); tone(48, time, .07, .09, 'triangle'); }
      if (i % (level ? 2 : 4) === 0) hat(time, .035, i % 4 === 0 ? .048 : .03, 7200);
      if (i === 0 || i === 8) for (const n of [base + 12, base + (bar < 2 ? 15 : 16), base + 19]) tone(n, time + .01, beat * 1.65, .034, 'sine');
      const melody = [12, 19, 15, 22, 19, 15, 10, 7];
      if (i % 2 === 0) {
        const offset = melody[(i / 2 + bar * 2) % 8];
        tone(base + offset, time, beat * .55, .095, 'triangle');
        tone(base + offset + 12, time, .10, .018, 'sine');
      }
      if (level >= 1 && i % 2 === 1) tone(base + [12, 19, 24, 19][i % 4], time, beat * .22, .035, 'triangle');
      if (level === 2) {
        hat(time, .025, .026, 8300);
        if (i === 3 || i === 7 || i === 14) tone(base, time, beat * .24, .11, 'triangle');
      }
    }
    return { tone, hat, step, get live() { return live; } };
  }
  let ctx, master, music, fx, analyser, band, voices, cues, timer = null;
  let enabled = true, volume = .45, unlocked = false, blocked = false, level = 0, musicOn = true, duck = false;
  let next = 0, index = 0, scheduled = 0, contexts = 0, lastState = '', lastGains = '';
  try { const pref = JSON.parse(localStorage.getItem('ck-audio-v1') || 'null');
    if (pref) { enabled = pref.enabled !== false; volume = Number.isFinite(pref.volume) ? Math.max(0, Math.min(1, pref.volume)) : .45; }
  } catch (_) { /* Private-mode storage may be unavailable; controls still work. */ }
  function save() { try { localStorage.setItem('ck-audio-v1', JSON.stringify({ enabled, volume })); } catch (_) {} }
  function labels() {
    const b = document.getElementById('musicToggle'); if (!b) return;
    b.textContent = !enabled ? '音樂：關' : !unlocked ? '開啟音樂' : '音樂：開';
    b.setAttribute('aria-pressed', String(enabled && unlocked));
    document.getElementById('musicVolume').value = Math.round(volume * 100);
  }
  function schedule() {
    if (!ctx || ctx.state !== 'running' || !enabled || blocked) return;
    if (next < ctx.currentTime) next = ctx.currentTime + .035;
    while (next < ctx.currentTime + .12) {
      const beat = 60 / TEMPOS[level];
      if (musicOn) { voices.step(index, next, level, beat); scheduled++; }
      index++; next += beat / 4;
    }
  }
  function mix() {
    if (!ctx) return;
    const gains = [enabled, volume, musicOn, duck].join('|');
    if (gains !== lastGains) {
      lastGains = gains;
      master.gain.setTargetAtTime(enabled ? volume * .7 : 0, ctx.currentTime, .025);
      music.gain.setTargetAtTime(musicOn ? (duck ? .16 : .55) : 0, ctx.currentTime, .10);
    }
    const key = String(blocked || !enabled);
    if (key !== lastState) {
      lastState = key;
      if (blocked || !enabled) { if (timer !== null) clearInterval(timer); timer = null; void ctx.suspend(); }
      else if (unlocked) void ctx.resume().then(() => {
        if (blocked || !enabled) return;
        next = ctx.currentTime + .04;
        if (timer === null) timer = setInterval(schedule, 25);
        schedule();
      }).catch(() => { unlocked = false; labels(); });
    }
  }
  function unlock() {
    if (!enabled) return;
    if (!ctx) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) { enabled = false; labels(); return; }
      ctx = new Audio(); contexts++;
      master = ctx.createGain(); music = ctx.createGain(); fx = ctx.createGain();
      band = ctx.createDynamicsCompressor(); band.threshold.value = -18; band.ratio.value = 4;
      analyser = ctx.createAnalyser(); analyser.fftSize = 512;
      music.connect(master); fx.connect(master); master.connect(band); band.connect(analyser); analyser.connect(ctx.destination);
      master.gain.value = 0; fx.gain.value = .8;
      voices = instruments(ctx, music); cues = instruments(ctx, fx);
    }
    if (blocked) return;
    unlocked = true; lastState = ''; mix(); labels();
  }
  function cue(name) {
    if (!ctx || !enabled || blocked || ctx.state !== 'running') return;
    const t = ctx.currentTime + .01;
    if (name === 'perfect') [74, 81].forEach((n, i) => cues.tone(n, t + i * .07, .16, .10, 'sine'));
    else if (name === 'good') cues.tone(74, t, .09, .09);
    else if (name === 'chop') { cues.hat(t, .035, .11, 650); cues.tone(46, t, .035, .07); }
    else if (name === 'early') cues.tone(57, t, .06, .045);
    else if (name === 'ticket') [69, 74, 77].forEach((n, i) => cues.tone(n, t + i * .085, .16, .08));
    else if (name === 'ready') [77, 81, 86].forEach((n, i) => cues.tone(n, t + i * .12, .22, .09, 'sine'));
    else if (name === 'win') [62, 65, 69, 74, 77, 81].forEach((n, i) => cues.tone(n, t + i * .11, .55, .12));
    else if (name === 'lose') [62, 60, 57, 50].forEach((n, i) => cues.tone(n, t + i * .14, .40, .08));
    else if (name === 'warning') [74, 74].forEach((n, i) => cues.tone(n, t + i * .16, .12, .07, 'sine'));
    else if (name === 'sizzle') cues.hat(t, .22, .075, 2200);
  }
  window.CKAudio = {
    unlock, cue,
    update(options) { level = options.level; musicOn = options.musicOn; duck = options.duck; blocked = options.blocked; mix(); },
    setEnabled(value) { enabled = !!value; if (enabled) unlock(); mix(); save(); labels(); },
    setVolume(value) { volume = Math.max(0, Math.min(1, value)); mix(); save(); labels(); },
    snapshot() {
      let rms = 0;
      if (analyser && ctx.state === 'running') { const a = new Float32Array(512); analyser.getFloatTimeDomainData(a); rms = Math.sqrt(a.reduce((sum, v) => sum + v*v, 0) / a.length); }
      return { enabled, volume, unlocked, level, bpm: TEMPOS[level], contextState: ctx?.state || 'uncreated',
        contexts, schedulerCount: timer === null ? 0 : 1, scheduled, liveVoices: (voices?.live || 0) + (cues?.live || 0), rms };
    },
    // The exact score can be rendered offline for audio verification without autoplay.
    async preview(seconds = 24) {
      const offline = new OfflineAudioContext(1, 44100 * seconds, 44100);
      const gain = offline.createGain(); gain.gain.value = .32; gain.connect(offline.destination);
      const score = instruments(offline, gain); let t = .05, n = 0;
      while (t < seconds - .7) { const intensity = Math.min(2, Math.floor(t / (seconds / 3))); const beat = 60 / TEMPOS[intensity]; score.step(n++, t, intensity, beat); t += beat / 4; }
      return offline.startRendering();
    }
  };
  for (const type of ['pointerdown', 'keydown']) addEventListener(type, event => {
    if (event.isTrusted && !event.target.closest('#musicToggle') && (!unlocked || ctx?.state === 'suspended') && !blocked) unlock();
  }, { capture: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { blocked = true; mix(); } });
  labels();
})();
