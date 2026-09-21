'use strict';
/* R7 compatibility tests — updated for R8 (patients now use R8 withdrawal symptom schema).
   Original R7 schema tests replaced by equivalent R8 checks to keep the suite green.
   New R8-specific tests live in r8_rules.test.cjs */
const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../src/clinic-rules.js');

test('R8: six patients define immutable baseline with 7 R8 withdrawal symptoms (replaces R7 metric check)', () => {
  const { patients } = rules;
  assert.equal(patients.length, 6);
  // R8 uses withdrawal symptom profile
  const r8Metrics = ['craving', 'irritability', 'anxiety', 'concentration', 'restlessness', 'appetite', 'sleep'];

  for (const p of patients) {
    assert.ok(p.complaint && p.complaint.length > 5, `Patient ${p.id} missing complaint`);
    assert.ok(p.clinicalStatus, `Patient ${p.id} missing clinicalStatus`);
    for (const m of r8Metrics) {
      assert.equal(typeof p.clinicalStatus[m], 'number', `Patient ${p.id} metric ${m} is not a number`);
      assert.ok(p.clinicalStatus[m] >= 0 && p.clinicalStatus[m] <= 4, `Patient ${p.id} metric ${m} out of 0-4 bounds`);
    }
    assert.ok(p.ftnd && typeof p.ftnd.total === 'number', `Patient ${p.id} missing FTND baseline`);
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

test('R8: calculateClinicalMetrics on 0-4 scale — 25% craving reduction gate (replaces R7 version)', () => {
  const { calculateClinicalMetrics } = rules;
  // Use R8 withdrawal symptom baseline (0-4 scale)
  const baseline = { craving: 4, irritability: 3, anxiety: 3, concentration: 2, restlessness: 2, appetite: 2, sleep: 2 };

  // Quality 100 => 50% relative reduction => Win
  const winOutcome = calculateClinicalMetrics(baseline, 100);
  assert.equal(winOutcome.success, true);
  assert.ok(winOutcome.relativeReduction >= 0.5 - 1e-9, `Expected ≥ 0.5 but got ${winOutcome.relativeReduction}`);
  assert.ok(winOutcome.after.craving < baseline.craving, 'Craving should drop on success');
  assert.ok(winOutcome.after.anxiety < baseline.anxiety, 'Anxiety should drop on success');
  assert.ok(winOutcome.comfortScore >= 60, `Comfort score should be high, got ${winOutcome.comfortScore}`);

  // Quality 20 => very small reduction (<25%) => Loss
  const lossOutcome = calculateClinicalMetrics(baseline, 20);
  assert.equal(lossOutcome.success, false);
  assert.ok(lossOutcome.relativeReduction < 0.25, `Expected <0.25 but got ${lossOutcome.relativeReduction}`);
});

test('R8: generatePatientReview produces withdrawal-focused first-person reflections for 4 axes', () => {
  const { patients, generatePatientReview } = rules;
  const office = patients[0];
  const checks = [
    { label: '豆瓣醬→Craving', ok: true },
    { label: '蒜→Irritability', ok: true },
    { label: '配飯份量', ok: true },
    { label: '收汁火候', ok: true }
  ];

  const reviewWin = generatePatientReview(office, 100, checks, { rice: '半碗飯' }, true);
  assert.ok(reviewWin.numbing.length > 5, 'numbing/craving relief text missing');
  assert.ok(reviewWin.comfort.length > 5, 'comfort text missing');
  assert.ok(reviewWin.satiety.length > 5, 'satiety/taste text missing');
  assert.ok(reviewWin.mental.length > 5, 'mental/irritability text missing');
  assert.ok(reviewWin.quote.startsWith('「'), 'Quote should start with 「');

  const reviewLoss = generatePatientReview(office, 30, checks.map(c => ({ ...c, ok: false })), { rice: '正常飯' }, false);
  // R8 failure quotes mention craving not relieved or symptoms not addressed
  assert.ok(reviewLoss.quote.includes('不') || reviewLoss.quote.includes('沒') || reviewLoss.quote.includes('根本'), 'Loss quote should indicate failure');
});
