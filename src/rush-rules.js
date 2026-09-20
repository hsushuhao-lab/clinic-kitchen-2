/* R3: bounded precision bonuses and a three-ticket night shift. No DOM/audio dependency. */
(function (root) {
  'use strict';
  const tickets = Object.freeze([
    { name: '第一單・暖身', target: 90, pressure: 1, spicy: '正常', scallion: false, rice: '半碗飯' },
    { name: '第二單・加辣', target: 80, pressure: 1.15, spicy: '重辣', scallion: true, rice: '正常飯' },
    { name: '最後一單・衝刺', target: 70, pressure: 1.3, spicy: '正常', scallion: true, rice: '半碗飯' }
  ]);
  const cursorAt = seconds => (1 - Math.cos(seconds * Math.PI * 2 / 2.4)) / 2;
  const gradeAt = position => Math.abs(position - .5) <= .10 ? 'perfect' : Math.abs(position - .5) <= .25 ? 'good' : 'early';
  class Rush {
    constructor() {
      this.mode = 'practice'; this.ticketIndex = 0; this.sessionPoints = 0; this.results = [];
      this.reset();
    }
    get ticket() { return tickets[this.ticketIndex]; }
    get complete() { return this.mode === 'rush' && this.results.length === 3; }
    get remaining() { return Math.max(0, this.ticket.target - this.elapsed); }
    get pressure() { return this.mode === 'rush' ? this.ticket.pressure : 1; }
    setMode(mode) {
      if (this.status !== 'ready' || !['practice', 'rush'].includes(mode)) return false;
      this.mode = mode; this.ticketIndex = 0; this.sessionPoints = 0; this.results = []; this.reset();
      return true;
    }
    reset() {
      if (this.status === 'won' && this.mode === 'rush' && !this.complete) this.ticketIndex++;
      else if (this.status === 'active' || this.status === 'lost' || this.complete) {
        this.ticketIndex = 0; this.sessionPoints = 0; this.results = [];
      }
      this.status = 'ready'; this.elapsed = 0; this.combo = 0; this.bestCombo = 0;
      this.perfect = 0; this.technique = 0; this.seen = new Set(); this.lastHit = -Infinity;
      this.lastResult = null;
    }
    begin() { if (this.status !== 'ready') return false; this.status = 'active'; return true; }
    tick(dt) { if (this.status === 'active' && Number.isFinite(dt) && dt > 0) this.elapsed += dt; }
    judge(key, correct = true) {
      if (this.status !== 'active' || this.seen.has(key)) return null;
      this.seen.add(key); // A completed action cannot be retried for a better grade.
      const grade = !correct ? 'wrong' : this.elapsed - this.lastHit < .22 ? 'early' : gradeAt(cursorAt(this.elapsed));
      this.lastHit = this.elapsed;
      if (grade === 'perfect' || grade === 'good') {
        this.combo++; this.bestCombo = Math.max(this.bestCombo, this.combo);
        if (grade === 'perfect') this.perfect++;
        const multiplier = this.combo >= 9 ? 2 : this.combo >= 6 ? 1.5 : this.combo >= 3 ? 1.25 : 1;
        const earned = Math.round((grade === 'perfect' ? 10 : 4) * multiplier);
        this.technique += earned;
        return { grade, earned, combo: this.combo, multiplier };
      }
      this.combo = 0;
      return { grade, earned: 0, combo: 0, multiplier: 1 };
    }
    lose() { if (this.status === 'active') { this.status = 'lost'; this.combo = 0; } }
    settle(quality) {
      if (this.status !== 'active') return null;
      this.status = 'won';
      // Late delivery remains playable; only the on-time bonus disappears.
      const timeBonus = this.mode === 'rush' && quality >= 80 ? Math.floor(this.remaining * 2) : 0;
      const cleanBonus = quality === 100 && (this.mode === 'practice' || this.remaining > 0) ? 40 : 0;
      const rank = quality === 100 && this.bestCombo >= 5 && (this.mode === 'practice' || this.remaining > 0) ? 'S' : quality >= 90 ? 'A' : quality >= 75 ? 'B' : 'C';
      this.lastResult = { rank, quality, technique: this.technique, timeBonus, cleanBonus,
        bonus: this.technique + timeBonus + cleanBonus, bestCombo: this.bestCombo, perfect: this.perfect,
        elapsed: this.elapsed, onTime: this.remaining > 0 };
      return this.lastResult;
    }
    record(points) {
      if (!this.lastResult || this.lastResult.recorded) return false;
      this.lastResult.recorded = true; this.lastResult.points = points;
      if (this.mode === 'rush') { this.results.push({ ...this.lastResult }); this.sessionPoints += points; }
      return true;
    }
    snapshot() { return { mode: this.mode, status: this.status, ticketIndex: this.ticketIndex, target: this.ticket.target,
      remaining: this.remaining, elapsed: this.elapsed, pressure: this.pressure, combo: this.combo,
      bestCombo: this.bestCombo, perfect: this.perfect, technique: this.technique,
      cursor: cursorAt(this.elapsed), complete: this.complete, sessionPoints: this.sessionPoints,
      results: this.results.map(x => ({ ...x })), lastResult: this.lastResult && { ...this.lastResult } }; }
  }
  root.CKRushRules = { Rush, tickets, cursorAt, gradeAt };
  if (typeof module !== 'undefined') module.exports = root.CKRushRules;
})(typeof window === 'undefined' ? globalThis : window);
