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
  const expected=rules.buildR11ExpectedPortions(patient);
  const r=rules.evaluateR11Portions(expected,patient);
  assert.equal(r.checks.length,7);
  assert.equal(r.fidelity,100);
  assert.equal(r.gateB_pass,true);
});

test('R11 M5 trap: missing tofu or pork hard-fails prescription to zero',()=>{
  const patient=rules.patients[0];
  const expected=rules.buildR11ExpectedPortions(patient);
  const noTofu=rules.evaluateR11Portions({...expected,tofu:0},patient);
  const noPork=rules.evaluateR11Portions({...expected,pork:0},patient);
  assert.equal(noTofu.fidelity,0);
  assert.equal(noTofu.gateB_pass,false);
  assert.equal(noTofu.missingBase,true);
  assert.equal(noPork.fidelity,0);
  assert.equal(noPork.gateB_pass,false);
  assert.equal(noPork.missingBase,true);
});


test('R11 M4: DR. STRATEGY reduces nonzero portion mismatch penalties without bypassing base trap',()=>{
  const patient=rules.patients[0];
  const expected=rules.buildR11ExpectedPortions(patient);
  const mismatched={...expected,tofu:0.5,pork:0.5};
  const normal=rules.evaluateR11Portions(mismatched,patient);
  const strategy=rules.evaluateR11Portions(mismatched,patient,{doctor:'strategy'});
  assert.equal(normal.fidelity,86);
  assert.equal(strategy.fidelity,94);
  assert.equal(normal.missingBase,false);
  assert.equal(strategy.modifier,'strategy');
  assert.equal(rules.evaluateR11Portions(expected,patient,{doctor:'strategy'}).fidelity,100);
  assert.equal(rules.evaluateR11Portions({...expected,tofu:0},patient,{doctor:'strategy'}).fidelity,0);
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


test('R11 M5: visible 0-100 severity thresholds map exactly to 0 / half / full',()=>{
  assert.equal(rules.severity100ToPortion(0),0);
  assert.equal(rules.severity100ToPortion(40),0);
  assert.equal(rules.severity100ToPortion(41),0.5);
  assert.equal(rules.severity100ToPortion(70),0.5);
  assert.equal(rules.severity100ToPortion(71),1);
  assert.equal(rules.severity100ToPortion(100),1);
  assert.equal(rules.symptomSeverity100(0),0);
  assert.equal(rules.symptomSeverity100(1),25);
  assert.equal(rules.symptomSeverity100(2),50);
  assert.equal(rules.symptomSeverity100(3),75);
  assert.equal(rules.symptomSeverity100(4),100);
});

test('R11 M5: each ingredient has one unique symptom clue and five adjustable targets follow score thresholds',()=>{
  const symptomKeys=Object.values(rules.R11_SYMPTOM_TARGETS);
  assert.equal(new Set(symptomKeys).size,7);
  assert.equal(rules.R11_SYMPTOM_TARGETS.tofu,'sleep');
  assert.equal(rules.R11_SYMPTOM_TARGETS.pork,'appetite');
  for(const patient of rules.patients){
    const expected=rules.buildR11ExpectedPortions(patient);
    for(const id of ['douban','garlic','scallion','chili','pepper']){
      const key=rules.R11_SYMPTOM_TARGETS[id];
      const score=rules.symptomSeverity100(patient.clinicalStatus[key]);
      assert.equal(expected[id],rules.severity100ToPortion(score),patient.id+' '+id+' mismatch');
    }
    assert.equal(expected.tofu,1);
    assert.equal(expected.pork,1);
  }
});

test('R11 M5: office patient shows Sleep on tofu and Appetite on pork, but both remain mandatory',()=>{
  const patient=rules.patients.find(x=>x.id==='office');
  const expected=rules.buildR11ExpectedPortions(patient);
  assert.equal(rules.symptomSeverity100(patient.clinicalStatus.sleep),75);
  assert.equal(rules.symptomSeverity100(patient.clinicalStatus.appetite),25);
  assert.equal(expected.tofu,1);
  assert.equal(expected.pork,1);
});
