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


test('R11 M4: DR. STRATEGY reduces portion mismatch penalties without changing exact matches',()=>{
  const patient=rules.patients[0];
  const expected=rules.buildExpectedPortions(patient);
  const mismatched={...expected,tofu:0,pork:0.5};
  const normal=rules.evaluateR11Portions(mismatched,patient);
  const strategy=rules.evaluateR11Portions(mismatched,patient,{doctor:'strategy'});
  assert.equal(normal.fidelity,78);
  assert.equal(strategy.fidelity,85);
  assert.equal(strategy.modifier,'strategy');
  assert.equal(rules.evaluateR11Portions(expected,patient,{doctor:'strategy'}).fidelity,100);
});


test('R11 M4: structured patient wishes stay aligned with the clinical prescription contract',()=>{
  for(const patient of rules.patients){
    const pres=rules.buildClinicalPrescription(patient);
    assert.equal(pres.rice,patient.rice,patient.id+' rice narrative drift');
    assert.equal(pres.miso,patient.miso,patient.id+' miso narrative drift');
    assert.equal(pres.portions.scallion,patient.scallion?1:0,patient.id+' scallion narrative drift');
    if(patient.spicy==='重辣'){
      assert.equal(pres.portions.chili,1,patient.id+' heavy-spice chili drift');
      assert.equal(pres.portions.pepper,1,patient.id+' heavy-spice pepper drift');
    }else if(patient.spicy==='正常'){
      assert.equal(pres.portions.chili,0,patient.id+' normal-spice chili drift');
      assert.equal(pres.portions.pepper,0,patient.id+' normal-spice pepper drift');
    }else{
      assert.fail(patient.id+' has unsupported structured spicy narrative: '+patient.spicy);
    }
  }
});
