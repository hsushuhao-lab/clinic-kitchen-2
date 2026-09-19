/* First-version rules adapted to the existing 3D mission, not a replacement game. */
(function (root) {
  'use strict';
  const doctors = Object.freeze({
    speed: { name: 'DR. SPEED', title: '快刀醫師', prepFocusBonus: 8, heatTolerance: 0, timeSlow: 1,
      ability: '每份正確備料：Focus +8', detail: '其他醫師為 +4；同一份食材不重複加分。' },
    heat: { name: 'DR. HEAT', title: '火候醫師', prepFocusBonus: 4, heatTolerance: 12, timeSlow: 1,
      ability: '過火前容錯時間 +12%', detail: '沿用初版火候專長，改接現有燜煮計時。' },
    strategy: { name: 'DR. STRATEGY', title: '處方醫師', prepFocusBonus: 4, heatTolerance: 4, timeSlow: 0.82,
      ability: 'Craving 上升速度 −18%', detail: '過火前容錯時間 +4%；適合安排工作順序。' }
  });
  // V1: 1.25/s. This 3D edition uses 0.5/s for the longer walking route.
  const rules = Object.freeze({ cravingPerSecond: 0.5, focusLossPerSecond: 0.3,
    initialCraving: 40, initialFocus: 24, burnAfterSeconds: 15 });
  const clamp = n => Math.max(0, Math.min(100, n));

  class Round {
    constructor() {
      this.doctorId = 'speed';
      this.points = 0;
      this.served = 0;
      this.streak = 0;
      this.bestStreak = 0;
      this.reset(false);
    }
    get doctor() { return doctors[this.doctorId]; }
    get burnAfter() { return rules.burnAfterSeconds * (1 + this.doctor.heatTolerance / 100); }
    select(id) {
      if (!doctors[id] || this.status !== 'ready') return false;
      this.doctorId = id;
      return true;
    }
    reset(abandoned = true) {
      if (abandoned && this.status === 'active') this.streak = 0;
      this.status = 'ready';
      this.craving = rules.initialCraving;
      this.focus = rules.initialFocus;
      this.elapsed = 0;
      this.paused = false;
      this.lastEarned = 0;
      this.quality = null;
      this.awards = new Set();
    }
    begin() {
      if (this.status !== 'ready') return false;
      this.status = 'active';
      return true;
    }
    tick(dt) {
      if (this.status !== 'active' || this.paused || !Number.isFinite(dt) || dt <= 0) return;
      this.elapsed += dt;
      this.craving = clamp(this.craving + rules.cravingPerSecond * this.doctor.timeSlow * dt);
      this.focus = clamp(this.focus - rules.focusLossPerSecond * dt);
      if (this.craving >= 100) {
        this.status = 'lost';
        this.streak = 0;
      }
    }
    reward(key, correct = true, cooking = false) {
      if (this.status !== 'active' || this.awards.has(key)) return false;
      this.awards.add(key);
      this.focus = clamp(this.focus + (correct ? (cooking ? 12 : this.doctor.prepFocusBonus) : -6));
      this.craving = clamp(this.craving + (correct ? (cooking ? -4 : -2) : 6));
      if (this.craving >= 100) { this.status = 'lost'; this.streak = 0; }
      return true;
    }
    finish(quality) {
      if (this.status !== 'active') return false;
      this.quality = clamp(quality);
      this.status = 'won';
      this.lastEarned = 80 + Math.round(this.quality) + Math.max(0, 100 - Math.round(this.craving)) + Math.round(this.focus * 0.6);
      this.points += this.lastEarned;
      this.served++;
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      return true;
    }
    snapshot() {
      return { doctorId: this.doctorId, status: this.status, paused: this.paused,
        craving: this.craving, focus: this.focus, elapsed: this.elapsed,
        points: this.points, served: this.served, streak: this.streak, bestStreak: this.bestStreak,
        quality: this.quality, lastEarned: this.lastEarned, burnAfter: this.burnAfter };
    }
  }
  root.CKShiftRules = { doctors, rules, Round };
  if (typeof module !== 'undefined') module.exports = root.CKShiftRules;
})(typeof window === 'undefined' ? globalThis : window);
