'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Round } = require('../src/shift-rules.js');

test('unaccepted order does not accumulate craving', () => {
  const r = new Round(); r.tick(40); assert.equal(r.craving, 40); assert.equal(r.status, 'ready');
});
test('all three doctors have functional, distinct bonuses', () => {
  const speed = new Round(); speed.select('speed'); speed.begin(); speed.reward('tofu'); assert.equal(speed.focus, 32);
  const heat = new Round(); heat.select('heat'); heat.begin(); heat.reward('tofu'); assert.equal(heat.focus, 28); assert.equal(heat.burnAfter, 16.8);
  const strategy = new Round(); strategy.select('strategy'); strategy.begin(); strategy.tick(10); assert.equal(strategy.craving, 44.1);
  speed.tick(10); assert.equal(speed.craving, 43);
});
test('doctor cannot be swapped during an accepted order', () => {
  const r = new Round(); r.begin(); assert.equal(r.select('heat'), false); assert.equal(r.doctorId, 'speed');
});
test('one ingredient cannot repeatedly farm focus', () => {
  const r = new Round(); r.begin(); r.reward('tofu'); r.reward('tofu'); assert.equal(r.focus, 32); assert.equal(r.craving, 38);
});
test('incorrect preparation uses the first version penalty', () => {
  const r = new Round(); r.begin(); r.reward('scallion', false); assert.equal(r.focus, 18); assert.equal(r.craving, 46);
});
test('pause freezes focus, craving and elapsed time', () => {
  const r = new Round(); r.begin(); r.paused = true; r.tick(100); assert.equal(r.elapsed, 0); assert.equal(r.craving, 40);
});
test('100% is a terminal loss; score and streak are not awarded', () => {
  const r = new Round(); r.streak = 2; r.begin(); r.tick(120); assert.equal(r.status, 'lost'); assert.equal(r.streak, 0); assert.equal(r.finish(100), false); assert.equal(r.points, 0);
});
test('one delivery scores exactly once and freezes subsequent timer ticks', () => {
  const r = new Round(); r.begin(); r.finish(85); const before = r.snapshot(); r.finish(100); r.tick(100);
  assert.deepEqual(r.snapshot(), before); assert.equal(r.lastEarned, 239); assert.equal(r.served, 1);
});
test('next round resets transient state but retains the selected doctor and totals', () => {
  const r = new Round(); r.select('strategy'); r.begin(); r.finish(95); const points = r.points; r.reset();
  assert.equal(r.doctorId, 'strategy'); assert.equal(r.craving, 40); assert.equal(r.focus, 24); assert.equal(r.points, points); assert.equal(r.streak, 1);
});
test('abandoning an active order clears streak without deleting earned points', () => {
  const r = new Round(); r.begin(); r.finish(90); r.reset(); r.begin(); r.reset(); assert.equal(r.streak, 0); assert.equal(r.served, 1); assert.ok(r.points > 0);
});
test('quality affects earned score instead of always paying for 100%', () => {
  const a = new Round(); const b = new Round(); a.begin(); b.begin(); a.finish(75); b.finish(100); assert.equal(b.points - a.points, 25);
});
test('simmer reward cannot be farmed by removing heat and heating again', () => {
  const r = new Round(); r.begin(); r.reward('simmer', true, true); r.reward('simmer', true, true); assert.equal(r.focus, 36); assert.equal(r.craving, 36);
});
