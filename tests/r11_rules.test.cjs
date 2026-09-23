'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const rules=require('../src/clinic-rules.js');

test('R11: tofu and pork are adjustable without changing legacy R8 metadata',()=>{
  assert.equal(rules.INGREDIENTS.tofu.fixed,true);
  assert.equal(rules.INGREDIENTS.pork.fixed,true);
  assert.equal(rules.R11_INGREDIENTS.tofu.fixed,false);
  assert.equal(rules.R11_INGREDIENTS.pork.fixed,false);
  assert.equal(Object.keys(rules.R11_INGREDIENTS).length,7);
});

test('R11: all seven exact portions score 100 and pass Gate B',()=>{
  const patient=rules.patients[0];
  const expected=rules.buildExpectedPortions(patient);
  const r=rules.evaluateR11Portions(expected,patient);
  assert.equal(r.checks.length,7);
  assert.equal(r.fidelity,100);
  assert.equal(r.gateB_pass,true);
});

test('R11: tofu and pork mismatches are actually scored',()=>{
  const patient=rules.patients[0];
  const expected=rules.buildExpectedPortions(patient);
  const r=rules.evaluateR11Portions({...expected,tofu:0,pork:0.5},patient);
  const tofu=r.checks.find(x=>x.id==='tofu'),pork=r.checks.find(x=>x.id==='pork');
  assert.equal(tofu.penalty,15);
  assert.equal(pork.penalty,7);
  assert.equal(r.fidelity,78);
});
