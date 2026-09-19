'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Rush, tickets, cursorAt, gradeAt } = require('../src/rush-rules.js');
const { Round } = require('../src/shift-rules.js');
test('ready does not advance the bonus clock; modes lock when active', () => {
  const r = new Rush(); r.tick(90); assert.equal(r.elapsed, 0); r.setMode('rush'); r.begin();
  assert.equal(r.setMode('practice'), false); assert.equal(r.ticket.target, 90);
});
test('precision boundaries and visible cursor agree', () => {
  assert.equal(gradeAt(cursorAt(.4)), 'perfect'); assert.equal(gradeAt(0), 'early');
  assert.equal(gradeAt(.25), 'good'); assert.equal(gradeAt(.35), 'good'); assert.equal(gradeAt(.5), 'perfect');
});
test('duplicate actions and click spam cannot farm precision points', () => {
  const r = new Rush(); r.begin(); r.tick(.4); assert.equal(r.judge('cut:tofu:1').grade, 'perfect');
  const points = r.technique; assert.equal(r.judge('cut:tofu:1'), null); assert.equal(r.technique, points);
  assert.equal(r.judge('cut:tofu:2').earned, 0); assert.equal(r.combo, 0);
});
test('legitimate consecutive precision creates a capped multiplier', () => {
  const r = new Rush(); r.begin(); r.tick(.4);
  let result;
  for (let i=0;i<12;i++) { result=r.judge('cut:'+i); r.tick(1.6); }
  assert.equal(result.multiplier, 2); assert.equal(r.perfect, 12); assert.equal(r.bestCombo, 12);
});
test('miss and incorrect preference end combo without losing accrued points', () => {
  const r = new Rush(); r.begin(); r.tick(.4); r.judge('a'); const points = r.technique;
  r.tick(1.6); assert.equal(r.judge('b', false).grade, 'wrong'); assert.equal(r.combo, 0); assert.equal(r.technique, points);
});
test('late delivery loses only speed bonus, not the order', () => {
  const r = new Rush(); r.setMode('rush'); r.begin(); r.tick(100); assert.equal(r.status, 'active');
  assert.equal(r.settle(95).timeBonus, 0); assert.equal(r.status, 'won');
});
test('quality must reach 80 before fast service is rewarded', () => {
  const r = new Rush(); r.setMode('rush'); r.begin(); r.tick(35); assert.equal(r.settle(70).timeBonus, 0);
});
test('one delivery gets one settlement and one session record', () => {
  const r = new Rush(); r.setMode('rush'); r.begin(); r.tick(40);
  assert.equal(r.settle(100).timeBonus, 100); assert.equal(r.settle(100), null);
  assert.equal(r.record(400), true); assert.equal(r.record(400), false); assert.equal(r.sessionPoints, 400);
});
test('three distinct feasible tickets escalate, then start a new session', () => {
  const r = new Rush(); r.setMode('rush');
  for(let i=0;i<3;i++) { assert.equal(r.ticketIndex,i); assert.equal(r.ticket.target,90-i*10); r.begin(); r.tick(40); r.settle(100); r.record(300); if(i<2) r.reset(); }
  assert.equal(r.complete,true); assert.equal(r.sessionPoints,900); assert.equal(r.results.length,3);
  r.reset(); assert.equal(r.complete,false); assert.equal(r.ticketIndex,0); assert.equal(r.sessionPoints,0);
  assert.equal(tickets[1].spicy,'重辣'); assert.equal(tickets[0].scallion,false);
});
test('abandonment or loss resets challenge progress, not just timer', () => {
  const r = new Rush(); r.setMode('rush'); r.begin(); r.settle(100); r.record(300); r.reset(); r.begin(); r.lose(); r.reset();
  assert.equal(r.ticketIndex,0); assert.equal(r.sessionPoints,0); assert.equal(r.technique,0);
});
test('pressure affects craving, never elapsed time; practice and doctor identities preserved', () => {
  const r = new Round(); r.select('strategy'); r.begin(); r.tick(10,1.3);
  assert.equal(r.elapsed,10); assert.ok(Math.abs(r.craving-(40+5*.82*1.3))<1e-8);
  r.paused=true; r.tick(20,1.3); assert.equal(r.elapsed,10);
});
test('bonus is added once, loss cannot cash it out', () => {
  const r = new Round(); r.begin(); r.finish(100,40); assert.equal(r.lastEarned,294);
  assert.equal(r.finish(100,40),false); const lost=new Round();lost.begin();lost.tick(150);assert.equal(lost.finish(100,100),false);
});
