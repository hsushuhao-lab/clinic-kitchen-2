'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../src/clinic-rules.js');

// ===== FTND Immutability =====

test('R8: all 6 patients have FTND baseline card with total in 0-10 range', () => {
  const { patients } = rules;
  assert.equal(patients.length, 6);
  for (const p of patients) {
    assert.ok(p.ftnd, `Patient ${p.id} missing ftnd`);
    assert.equal(typeof p.ftnd.total, 'number', `Patient ${p.id} ftnd.total not a number`);
    assert.ok(p.ftnd.total >= 0 && p.ftnd.total <= 10, `Patient ${p.id} ftnd.total out of range: ${p.ftnd.total}`);
    assert.ok(p.ftnd.severity && p.ftnd.severity.length > 2, `Patient ${p.id} missing ftnd.severity`);
    for (let i = 1; i <= 6; i++) {
      assert.equal(typeof p.ftnd[`q${i}`], 'number', `Patient ${p.id} missing ftnd.q${i}`);
    }
    // FTND must be frozen — mutations should not persist
    const origTotal = p.ftnd.total;
    try { p.ftnd.total = 99; } catch(e) { /* expected: strict mode throws on frozen */ }
    assert.equal(p.ftnd.total, origTotal, `Patient ${p.id} ftnd.total was mutated!`);
  }
});

test('R8: patients have R8 withdrawal symptom profile (0-4 scale, 7 metrics)', () => {
  const { patients } = rules;
  const r8Metrics = ['craving', 'irritability', 'anxiety', 'concentration', 'restlessness', 'appetite', 'sleep'];
  for (const p of patients) {
    assert.ok(p.clinicalStatus, `Patient ${p.id} missing clinicalStatus`);
    for (const m of r8Metrics) {
      const val = p.clinicalStatus[m];
      assert.equal(typeof val, 'number', `Patient ${p.id} symptom ${m} is not a number`);
      assert.ok(val >= 0 && val <= 4, `Patient ${p.id} symptom ${m} out of 0-4 range: ${val}`);
    }
    // R7 metrics should be gone
    assert.equal(p.clinicalStatus.focus, undefined, `Patient ${p.id} still has R7 focus metric`);
    assert.equal(p.clinicalStatus.impulsivity, undefined, `Patient ${p.id} still has R7 impulsivity metric`);
  }
});

// ===== symptomToTargetPortion mapping =====

test('R8: symptomToTargetPortion maps 0→0, 1 or 2→0.5, 3-4→1', () => {
  const { symptomToTargetPortion } = rules;
  assert.equal(symptomToTargetPortion(0), 0);
  assert.equal(symptomToTargetPortion(1), 0.5);
  assert.equal(symptomToTargetPortion(2), 0.5);
  assert.equal(symptomToTargetPortion(3), 1);
  assert.equal(symptomToTargetPortion(4), 1);
});

test('R8: buildExpectedPortions generates correct portions from patient clinicalStatus', () => {
  const { patients, buildExpectedPortions } = rules;
  // driver: craving=4, irritability=4, anxiety=4, concentration=3, restlessness=4
  const driver = patients.find(p => p.id === 'driver');
  const exp = buildExpectedPortions(driver);
  assert.equal(exp.tofu, 1, 'tofu always 1');
  assert.equal(exp.pork, 1, 'pork always 1');
  assert.equal(exp.douban, 1, 'douban for craving=4 should be 1');
  assert.equal(exp.garlic, 1, 'garlic for irritability=4 should be 1');
  assert.equal(exp.pepper, 1, 'pepper for anxiety=4 should be 1');
  assert.equal(exp.scallion, 1, 'scallion for concentration=3 should be 1');
  assert.equal(exp.chili, 1, 'chili for restlessness=4 should be 1');
});

// ===== Portion penalty logic (R8) =====

test('R8: evaluateR8 penalty: diff=0.5 → -12pts, diff=1.0 → -25pts per ingredient', () => {
  const { patients, evaluateR8 } = rules;
  const office = patients[0]; // craving:3→douban:1, irrit:3→garlic:1, anx:3→pepper:1, conc:2→scallion:0.5, rest:2→chili:0.5

  // Perfect prescription match — no prescription penalty
  const perfectOrder = { spicy: office.spicy, scallion: !!office.scallion, rice: office.rice, miso: office.miso };
  const perfectExpected = require('../src/clinic-rules.js').buildExpectedPortions(office);
  const perfectDish = {
    contents: { ...perfectExpected },
    stirs: 3,
    eqSimmerTime: 4.0,
    isBurnt: false,
    rice: office.rice,
    miso: office.miso
  };
  const perfectResult = evaluateR8(perfectOrder, perfectDish, office);
  assert.equal(perfectResult.prescriptionFidelity, 100, 'Perfect match should have 100% fidelity');
  assert.equal(perfectResult.gateB_pass, true, 'Perfect match should pass Gate B');

  // Diff 0.5 on one ingredient (douban: expected 1, give 0.5) → penalty 12
  const halfDiff = {
    contents: { ...perfectExpected, douban: 0.5 },
    stirs: 3, eqSimmerTime: 4.0, isBurnt: false, rice: office.rice, miso: office.miso
  };
  const halfResult = evaluateR8(perfectOrder, halfDiff, office);
  const doubanCheck = halfResult.checks.find(c => c.label === '豆瓣醬→Craving');
  assert.equal(doubanCheck.penalty, 12, 'diff=0.5 should incur 12pt penalty');

  // Diff 1.0 on one ingredient (douban: expected 1, give 0) → penalty 25
  const fullDiff = {
    contents: { ...perfectExpected, douban: 0 },
    stirs: 3, eqSimmerTime: 4.0, isBurnt: false, rice: office.rice, miso: office.miso
  };
  const fullResult = evaluateR8(perfectOrder, fullDiff, office);
  const doubanFull = fullResult.checks.find(c => c.label === '豆瓣醬→Craving');
  assert.equal(doubanFull.penalty, 25, 'diff=1.0 should incur 25pt penalty');
});

test('R8: rice mismatch incurs 25pt penalty', () => {
  const { patients, evaluateR8, buildExpectedPortions } = rules;
  const office = patients[0];
  const order = { spicy: office.spicy, scallion: !!office.scallion, rice: office.rice, miso: office.miso };
  const expected = buildExpectedPortions(office);
  const dish = {
    contents: { ...expected },
    stirs: 3, eqSimmerTime: 4.0, isBurnt: false,
    rice: '正常飯', // office wants 半碗飯
    miso: office.miso
  };
  const r = evaluateR8(order, dish, office);
  const riceCheck = r.checks.find(c => c.label === '配飯份量');
  assert.equal(riceCheck.penalty, 25, 'Rice mismatch should incur 25pt penalty');
  assert.equal(riceCheck.ok, false);
});

test('R8: miso mismatch incurs 18pt penalty', () => {
  const { patients, evaluateR8, buildExpectedPortions } = rules;
  const auntie = patients[3]; // miso: true
  const order = { spicy: auntie.spicy, scallion: !!auntie.scallion, rice: auntie.rice, miso: auntie.miso };
  const expected = buildExpectedPortions(auntie);
  const dish = {
    contents: { ...expected },
    stirs: 3, eqSimmerTime: 4.0, isBurnt: false,
    rice: auntie.rice,
    miso: false // auntie wants miso
  };
  const r = evaluateR8(order, dish, auntie);
  const misoCheck = r.checks.find(c => c.label === '味噌湯');
  assert.equal(misoCheck.penalty, 18, 'Miso mismatch should incur 18pt penalty');
  assert.equal(misoCheck.ok, false);
});

test('R8: Gate B — hardFail when prescription fidelity < 70%', () => {
  const { patients, evaluateR8 } = rules;
  const driver = patients[2]; // heavy dependence, many high symptom scores
  const order = { spicy: driver.spicy, scallion: !!driver.scallion, rice: driver.rice, miso: driver.miso };
  // Completely wrong prescription (all zeros for adjustable)
  const dish = {
    contents: { tofu: 1, pork: 1, douban: 0, garlic: 0, scallion: 0, chili: 0, pepper: 0 },
    stirs: 3, eqSimmerTime: 4.0, isBurnt: false, rice: driver.rice, miso: driver.miso
  };
  const r = evaluateR8(order, dish, driver);
  assert.equal(r.gateB_pass, false, 'Fully wrong prescription should fail Gate B');
  assert.equal(r.hardFail, true, 'hardFail should be true when Gate B fails');
  assert.ok(r.prescriptionFidelity < 70, `Prescription fidelity should be < 70, got ${r.prescriptionFidelity}`);
});

test('R8: FTND immutability — calculateClinicalMetrics does not modify patient FTND', () => {
  const { patients, calculateClinicalMetrics } = rules;
  for (const p of patients) {
    const origFtnd = { ...p.ftnd };
    // Call calculateClinicalMetrics
    calculateClinicalMetrics(p.clinicalStatus, 100, [], {}, {});
    // FTND must be unchanged
    assert.equal(p.ftnd.total, origFtnd.total, `Patient ${p.id} ftnd.total changed after calculateClinicalMetrics!`);
    for (let i = 1; i <= 6; i++) {
      assert.equal(p.ftnd[`q${i}`], origFtnd[`q${i}`], `Patient ${p.id} ftnd.q${i} changed!`);
    }
  }
});

test('R8: calculateClinicalMetrics on 0-4 scale — success requires 25% craving reduction', () => {
  const { calculateClinicalMetrics } = rules;
  const baseline = { craving: 4, irritability: 3, anxiety: 3, concentration: 2, restlessness: 2, appetite: 2, sleep: 2 };

  // quality 100 → 50% craving reduction → success
  const win = calculateClinicalMetrics(baseline, 100);
  assert.equal(win.success, true, 'Quality 100 should succeed');
  assert.ok(win.relativeReduction >= 0.25, `Expected ≥25% reduction, got ${win.relativeReduction}`);
  assert.ok(win.after.craving < baseline.craving, 'Craving should decrease on success');

  // quality 20 → small reduction → fail
  const loss = calculateClinicalMetrics(baseline, 20);
  assert.equal(loss.success, false, 'Quality 20 should fail (insufficient craving reduction)');
  assert.ok(loss.relativeReduction < 0.25, `Expected <25% reduction, got ${loss.relativeReduction}`);
});

test('R8: generatePatientReview produces withdrawal-focused text', () => {
  const { patients, generatePatientReview } = rules;
  const driver = patients[2];
  const checks = [
    { label: '豆瓣醬→Craving', ok: true },
    { label: '蒜→Irritability', ok: true },
    { label: '辣椒→Restlessness', ok: true },
    { label: '花椒→Anxiety', ok: false },
    { label: '蔥→Concentration', ok: true },
    { label: '配飯份量', ok: true },
    { label: '味噌湯', ok: true }
  ];
  const reviewWin = generatePatientReview(driver, 90, checks, { rice: '正常飯' }, true);
  assert.ok(reviewWin.quote.length > 10, 'Quote should not be empty');
  assert.ok(reviewWin.numbing.length > 5, 'numbing/craving relief text should exist');
  assert.ok(reviewWin.comfort.length > 5, 'comfort text should exist');

  const reviewLoss = generatePatientReview(driver, 30, checks.map(c => ({ ...c, ok: false })), {}, false);
  assert.ok(reviewLoss.quote.includes('症狀') || reviewLoss.quote.includes('癮') || reviewLoss.quote.includes('不對'), 'Failure quote should reference symptoms');
});

test('R8: tofu and pork are marked as fixed in INGREDIENTS', () => {
  const { INGREDIENTS } = rules;
  assert.equal(INGREDIENTS.tofu.fixed, true, 'tofu should be fixed=true');
  assert.equal(INGREDIENTS.pork.fixed, true, 'pork should be fixed=true');
  assert.equal(INGREDIENTS.douban.fixed, false, 'douban should be adjustable');
  assert.equal(INGREDIENTS.garlic.fixed, false, 'garlic should be adjustable');
  assert.equal(INGREDIENTS.chili.fixed, false, 'chili should be adjustable');
  assert.equal(INGREDIENTS.pepper.fixed, false, 'pepper should be adjustable');
  assert.equal(INGREDIENTS.scallion.fixed, false, 'scallion should be adjustable');
});
