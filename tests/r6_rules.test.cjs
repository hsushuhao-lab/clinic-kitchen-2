const test = require('node:test');
const assert = require('node:assert/strict');

// Will load from clinic-rules and shift-rules
const rules = require('../src/clinic-rules.js');
const shift = require('../src/shift-rules.js');

test('R6: 4 consolidated stations run left to right without duplicate desk/fridge barriers', () => {
  assert.ok(rules.stations, 'stations should exist');
  assert.equal(rules.stations.length, 4, 'should have exactly 4 main functional stations');
  const ids = rules.stations.map(s => s.id);
  assert.deepEqual(ids, ['consult', 'prep', 'wok', 'serve']);
  for (let i = 1; i < rules.stations.length; i++) {
    assert.ok(rules.stations[i].x > rules.stations[i - 1].x, 'stations must progress from left to right');
  }
});

test('R6: 6 ingredients support 0, 0.5, 1 portions accurately', () => {
  const ingredients = ['tofu', 'pork', 'douban', 'garlic', 'scallion', 'pepper'];
  assert.ok(rules.INGREDIENTS, 'INGREDIENTS definition must exist');
  for (const item of ingredients) {
    assert.ok(rules.INGREDIENTS[item], `Ingredient ${item} must be defined`);
  }
  const validPortions = [0, 0.5, 1];
  for (const p of validPortions) {
    assert.ok(rules.isValidPortion(p), `Portion ${p} must be valid`);
  }
  assert.equal(rules.isValidPortion(0.3), false, 'Arbitrary portion 0.3 should be invalid');
});

test('R6: batch wok addition takes all prepared items at once and prevents duplicate submissions', () => {
  const prepared = {
    tofu: 1,
    pork: 1,
    douban: 1,
    garlic: 1,
    scallion: 0.5,
    pepper: 0
  };
  const wok = rules.createWok();
  assert.equal(wok.hasFood, false);
  rules.addBatchToWok(wok, prepared);
  assert.equal(wok.hasFood, true);
  assert.equal(wok.contents.tofu, 1);
  assert.equal(wok.contents.scallion, 0.5);
  assert.equal(wok.contents.pepper, 0);

  // Attempting duplicate addition should be blocked
  assert.throws(() => {
    rules.addBatchToWok(wok, prepared);
  }, /Wok already contains food/);
});

test('R6: flame equivalence model (High 4s == Low 8s == High 2s + Low 4s)', () => {
  assert.equal(rules.equivalentSimmerTime(4, 0), 4.0, 'High 4s should equal 4.0 eq seconds');
  assert.equal(rules.equivalentSimmerTime(0, 8), 4.0, 'Low 8s should equal 4.0 eq seconds');
  assert.equal(rules.equivalentSimmerTime(2, 4), 4.0, 'High 2s + Low 4s should equal 4.0 eq seconds');
});

test('R6: overheat penalty starts after 4.0 eq seconds and caps at 20', () => {
  assert.equal(rules.heatPenaltyR6(3.9), 0, 'Under 4.0s has 0 penalty');
  assert.equal(rules.heatPenaltyR6(4.0), 0, 'Exact 4.0s has 0 penalty');
  assert.equal(rules.heatPenaltyR6(4.99), 0, 'Less than 1 full excess second has 0 penalty');
  assert.equal(rules.heatPenaltyR6(5.0), 1, '1 full excess second costs 1 point');
  assert.equal(rules.heatPenaltyR6(6.2), 2, '2 full excess seconds cost 2 points');
  assert.equal(rules.heatPenaltyR6(30.0), 20, 'Penalty caps at 20 points');
});

test('R6: rice and miso sides affect dish evaluation truthfully', () => {
  const order = {
    spicy: '正常',
    scallion: true,
    rice: '正常飯',
    miso: true,
    portions: { tofu: 1, pork: 1, douban: 1, garlic: 1, scallion: 1, pepper: 0 }
  };

  const perfectDish = {
    contents: { tofu: 1, pork: 1, douban: 1, garlic: 1, scallion: 1, pepper: 0 },
    stirs: 3,
    eqSimmerTime: 4.0,
    rice: '正常飯',
    miso: true
  };

  const evalPerfect = rules.evaluateR6(order, perfectDish);
  assert.equal(evalPerfect.quality, 100, 'Perfect dish should have 100 quality');

  // Wrong miso (ordered true, gave false)
  const wrongMisoDish = { ...perfectDish, miso: false };
  const evalMiso = rules.evaluateR6(order, wrongMisoDish);
  assert.ok(evalMiso.quality < 100, 'Wrong miso soup should reduce quality');
  assert.equal(evalMiso.quality, 95, 'Missing miso soup should deduct 5 points');

  // Wrong rice (ordered 正常飯, gave 半碗飯)
  const wrongRiceDish = { ...perfectDish, rice: '半碗飯' };
  const evalRice = rules.evaluateR6(order, wrongRiceDish);
  assert.equal(evalRice.quality, 95, 'Wrong rice portion should deduct 5 points');
});

test('R6: craving reduction calculation and boundary thresholds (24.99%, 25%, 25.01%)', () => {
  const beforeCraving = 80;
  // Case 1: Quality yields exactly 25.0% relative reduction (after = 60)
  const res25 = rules.calculateMealOutcome({ beforeCraving, afterCraving: 60 });
  assert.equal(res25.relativeReduction, 0.25);
  assert.equal(res25.success, true, '25% reduction should succeed');

  // Case 2: 24.99% relative reduction (after = 60.008)
  const res2499 = rules.calculateMealOutcome({ beforeCraving, afterCraving: 60.008 });
  assert.ok(res2499.relativeReduction < 0.25, 'Reduction is strictly below 25%');
  assert.equal(res2499.success, false, '24.99% reduction should fail (table flip)');

  // Case 3: 25.01% relative reduction (after = 59.992)
  const res2501 = rules.calculateMealOutcome({ beforeCraving, afterCraving: 59.992 });
  assert.ok(res2501.relativeReduction > 0.25, 'Reduction is strictly above 25%');
  assert.equal(res2501.success, true, '25.01% reduction should succeed');

  // Case 4: beforeCraving = 0 edge case
  const resZero = rules.calculateMealOutcome({ beforeCraving: 0, afterCraving: 0 });
  assert.equal(resZero.success, true, 'Zero craving before meal is peaceful, no table flip');
});

test('R6: failure does not increase streak or pay won bonus, streak resets to 0', () => {
  const round = new shift.Round();
  round.begin();
  round.streak = 3;
  const initialPoints = round.points;

  // Finish with failure (won = false)
  round.finishR6({ won: false, quality: 30, cravingBefore: 80, cravingAfter: 75 });
  assert.equal(round.status, 'lost');
  assert.equal(round.streak, 0, 'Streak must reset to 0 on failure');
  assert.equal(round.points, initialPoints, 'Points must not increase on failure');
});
