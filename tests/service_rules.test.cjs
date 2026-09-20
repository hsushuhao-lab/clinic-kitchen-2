'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {heatPenalty,evaluate,patients}=require('../src/clinic-rules.js');
const dish={hasDouban:true,hasPepper:false,hasScallion:false,ricePortion:'半碗飯',isSimmered:true,isBurnt:false};
test('high heat allows cooking beyond readiness; each full excess second costs one point',()=>{
 assert.equal(heatPenalty(0),0);assert.equal(heatPenalty(.99),0);assert.equal(heatPenalty(1),1);assert.equal(heatPenalty(4.9),4);assert.equal(heatPenalty(25),20);
});
test('overcooking and severe burn are one heat penalty, never stacked twice',()=>{
 assert.equal(heatPenalty(7,true),20);assert.equal(evaluate(patients[0],{...dish,overheatSeconds:7,isBurnt:true}).quality,80);
});
test('correct taste but excess heat yields explained penalty; precise timing is not required to complete',()=>{
 const r=evaluate(patients[0],{...dish,overheatSeconds:3.2});assert.equal(r.quality,97);assert.equal(r.checks[3].penalty,3);assert.equal(r.checks.filter(c=>!c.ok).length,1);
});
test('missing or extra requested toppings still give the original independent deductions',()=>{
 assert.equal(evaluate(patients[0],{...dish,hasScallion:true,overheatSeconds:2}).quality,83);
 assert.equal(evaluate(patients[0],dish).quality,100);
});
test('every fixed patient can be satisfied using existing ingredients only',()=>{
 for(const p of patients){const r=evaluate(p,{...dish,hasPepper:p.spicy==='重辣',hasScallion:p.scallion,ricePortion:p.rice});assert.equal(r.quality,100,p.id);}
});
