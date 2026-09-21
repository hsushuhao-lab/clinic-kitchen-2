'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../src/clinic-rules.js');

test('R7: six patients define immutable baseline clinicalStatus with all 7 metrics', () => {
  const { patients } = rules;
  assert.equal(patients.length, 6);
  const requiredMetrics = ['craving', 'focus', 'anxiety', 'impulsivity', 'language', 'memory', 'sleepiness'];
  
  for (const p of patients) {
    assert.ok(p.complaint && p.complaint.length > 5, `Patient ${p.id} missing complaint`);
    assert.ok(p.clinicalStatus, `Patient ${p.id} missing clinicalStatus`);
    for (const m of requiredMetrics) {
      assert.equal(typeof p.clinicalStatus[m], 'number', `Patient ${p.id} metric ${m} is not a number`);
      assert.ok(p.clinicalStatus[m] >= 0 && p.clinicalStatus[m] <= 100, `Patient ${p.id} metric ${m} out of bounds`);
    }
  }
});

test('R7: 7 ingredients defined with 0, 0.5, 1 portion validation', () => {
  const { INGREDIENTS, VALID_PORTIONS, isValidPortion } = rules;
  assert.equal(Object.keys(INGREDIENTS).length, 7);
  assert.ok(INGREDIENTS.chili, 'Missing chili ingredient');
  assert.deepEqual([...VALID_PORTIONS], [0, 0.5, 1]);
  assert.equal(isValidPortion(0), true);
  assert.equal(isValidPortion(0.5), true);
  assert.equal(isValidPortion(1), true);
  assert.equal(isValidPortion(2), false);
});

test('R7: calculateClinicalMetrics preserves primary Craving relative reduction (25% boundary)', () => {
  const { calculateClinicalMetrics } = rules;
  const baseline = { craving: 80, focus: 30, anxiety: 70, impulsivity: 65, language: 50, memory: 40, sleepiness: 60 };

  // Quality 100 => 50% relative reduction => Win
  const winOutcome = calculateClinicalMetrics(baseline, 100);
  assert.equal(winOutcome.success, true);
  assert.equal(winOutcome.after.craving, 40);
  assert.equal(winOutcome.relativeReduction, 0.5);
  assert.ok(winOutcome.after.anxiety < baseline.anxiety, 'Anxiety should drop on success');
  assert.ok(winOutcome.after.focus > baseline.focus, 'Focus should increase on success');
  assert.ok(winOutcome.comfortScore >= 80, 'Comfort score should be high for quality 100');

  // Quality 40 => 20% relative reduction (< 25%) => Loss
  const lossOutcome = calculateClinicalMetrics(baseline, 40);
  assert.equal(lossOutcome.success, false);
  assert.equal(lossOutcome.after.craving, 64);
  assert.equal(lossOutcome.relativeReduction, 0.2);
  assert.ok(lossOutcome.comfortScore < 60, 'Comfort score should reflect poor meal quality');
});

test('R7: generatePatientReview produces first-person reflections for 4 subjective axes', () => {
  const { patients, generatePatientReview } = rules;
  const office = patients[0];
  const checks = [
    { label: '辣度調味', ok: true },
    { label: '蔥花偏好', ok: true },
    { label: '配飯份量', ok: true },
    { label: '收汁火候', ok: true }
  ];

  const reviewWin = generatePatientReview(office, 100, checks, { rice: '半碗飯' }, true);
  assert.ok(reviewWin.numbing.length > 5);
  assert.ok(reviewWin.comfort.length > 5);
  assert.ok(reviewWin.satiety.length > 5);
  assert.ok(reviewWin.mental.length > 5);
  assert.ok(reviewWin.quote.startsWith('「'));

  const reviewLoss = generatePatientReview(office, 30, checks.map(c => ({ ...c, ok: false })), { rice: '正常飯' }, false);
  assert.ok(reviewLoss.quote.includes('完全不是'));
});
