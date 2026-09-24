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

test('R11: tofu and pork mismatches are actually scored',()=>{
  const patient=rules.patients[0];
  const expected=rules.buildR11ExpectedPortions(patient);
  const r=rules.evaluateR11Portions({...expected,tofu:0,pork:0.5},patient);
  const tofu=r.checks.find(x=>x.id==='tofu'),pork=r.checks.find(x=>x.id==='pork');
  assert.equal(tofu.penalty,15);
  assert.equal(pork.penalty,7);
  assert.equal(r.fidelity,78);
});


test('R11 M4: DR. STRATEGY reduces portion mismatch penalties without changing exact matches',()=>{
  const patient=rules.patients[0];
  const expected=rules.buildR11ExpectedPortions(patient);
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

test('R11 M5: all seven ingredient targets derive from the displayed symptom score',()=>{
  for(const patient of rules.patients){
    const expected=rules.buildR11ExpectedPortions(patient);
    for(const [id,key] of Object.entries(rules.R11_SYMPTOM_TARGETS)){
      const score=rules.symptomSeverity100(patient.clinicalStatus[key]);
      assert.equal(expected[id],rules.severity100ToPortion(score),patient.id+' '+id+' mismatch');
    }
  }
});

test('R11 M5: office patient tofu visibly follows Craving and pork follows Appetite',()=>{
  const patient=rules.patients.find(x=>x.id==='office');
  const expected=rules.buildR11ExpectedPortions(patient);
  assert.equal(rules.symptomSeverity100(patient.clinicalStatus.craving),75);
  assert.equal(expected.tofu,1);
  assert.equal(rules.symptomSeverity100(patient.clinicalStatus.appetite),25);
  assert.equal(expected.pork,0);
});
