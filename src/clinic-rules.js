/* R8: Nicotine Dependence–Informed Clinical Gameplay.
   Three-layer model: Baseline dependence (FTND), Acute withdrawal symptoms, Meal prescription + cooking execution. */
(function(root){
  'use strict';
  // R8 patients: FTND baseline card + acute withdrawal symptom profile (0-4 scale)
  const patients = Object.freeze([
    {
      id: 'office',
      name: '上班族',
      wish: '今天想吃正常辣，不要蔥，半碗飯就好，附熱味噌湯。',
      complaint: '工作壓力繁重，戒菸第三天，下午強烈菸癮難耐，胃口差又焦慮坐不住。',
      spicy: '正常',
      scallion: false,
      rice: '半碗飯',
      miso: true,
      ftnd: Object.freeze({ q1: 1, q2: 0, q3: 1, q4: 1, q5: 0, q6: 1, total: 4, severity: '中度依賴' }),
      clinicalStatus: Object.freeze({ craving: 3, irritability: 3, anxiety: 3, concentration: 2, restlessness: 2, appetite: 3, sleep: 2 })
    },
    {
      id: 'student',
      name: '大學生',
      wish: '想吃正常辣、加蔥花，配一整碗飯，要味噌湯。',
      complaint: '準備期末考熬夜念書，戒菸後注意力渙散又煩躁，熬夜後食慾差睡不好，急需安撫。',
      spicy: '正常',
      scallion: true,
      rice: '正常飯',
      miso: true,
      ftnd: Object.freeze({ q1: 2, q2: 1, q3: 1, q4: 1, q5: 0, q6: 1, total: 6, severity: '中度依賴' }),
      clinicalStatus: Object.freeze({ craving: 3, irritability: 2, anxiety: 3, concentration: 4, restlessness: 2, appetite: 2, sleep: 3 })
    },
    {
      id: 'driver',
      name: '司機',
      wish: '給我重辣、蔥花多香一點，飯要正常份量，不要湯。',
      complaint: '整天市區開車精神高度緊繃，戒菸後菸癮衝動特別難耐，情緒暴躁、坐立難安。',
      spicy: '重辣',
      scallion: true,
      rice: '正常飯',
      miso: false,
      ftnd: Object.freeze({ q1: 2, q2: 1, q3: 2, q4: 1, q5: 1, q6: 1, total: 8, severity: '重度依賴' }),
      clinicalStatus: Object.freeze({ craving: 4, irritability: 4, anxiety: 2, concentration: 2, restlessness: 4, appetite: 1, sleep: 2 })
    },
    {
      id: 'auntie',
      name: '阿姨',
      wish: '正常辣、要蔥花，今天飯只要半碗，要一碗味噌湯。',
      complaint: '最近心神不寧、戒菸後焦慮加重，入夜難以入眠，心情鬱悶時總想找熱食舒緩。',
      spicy: '正常',
      scallion: true,
      rice: '半碗飯',
      miso: true,
      ftnd: Object.freeze({ q1: 1, q2: 0, q3: 1, q4: 0, q5: 0, q6: 1, total: 3, severity: '輕度依賴' }),
      clinicalStatus: Object.freeze({ craving: 2, irritability: 2, anxiety: 4, concentration: 2, restlessness: 1, appetite: 2, sleep: 4 })
    },
    {
      id: 'quiet',
      name: '安靜的訪客',
      wish: '我想吃正常辣，不要蔥，飯要一碗，不要味噌湯。',
      complaint: '胸口堵著悶悶的，戒菸後嘴裡空空的，食慾減退又難以集中精神，只想靜靜吃一頓。',
      spicy: '正常',
      scallion: false,
      rice: '正常飯',
      miso: false,
      ftnd: Object.freeze({ q1: 1, q2: 0, q3: 1, q4: 1, q5: 0, q6: 0, total: 3, severity: '輕度依賴' }),
      clinicalStatus: Object.freeze({ craving: 2, irritability: 1, anxiety: 2, concentration: 3, restlessness: 1, appetite: 3, sleep: 2 })
    },
    {
      id: 'repeat',
      name: '熟客',
      wish: '這次試試重辣，不放蔥，再配半碗飯，附熱味噌湯。',
      complaint: '剛換新工作適應不良，戒菸後焦慮暴躁雙重夾擊、衝動難耐，渴望重辣麻婆豆腐壓壓驚。',
      spicy: '重辣',
      scallion: false,
      rice: '半碗飯',
      miso: true,
      ftnd: Object.freeze({ q1: 2, q2: 1, q3: 2, q4: 1, q5: 1, q6: 2, total: 9, severity: '重度依賴' }),
      clinicalStatus: Object.freeze({ craving: 4, irritability: 4, anxiety: 4, concentration: 3, restlessness: 4, appetite: 1, sleep: 3 })
    }
  ]);

  // R6 Consolidated Stations: Consult (X: -10.5), Prep (X: 5.0), Wok (X: 9.0), Serve (X: 11.5)
  const stations = Object.freeze([
    {id:'consult',name:'診間',label:'01 診間問診開單',x:-10.5,z:-1.4,at:[-10.5,-.65],r:1.8},
    {id:'prep',name:'備料檯',label:'02 取材備料',x:5,z:-2.2,at:[5,-1.4],r:1.6},
    {id:'wok',name:'炒鍋爐台',label:'03 炒鍋收汁',x:9,z:-2.2,at:[9,-1.35],r:1.6},
    {id:'serve',name:'配餐檯',label:'04 配飯味噌湯',x:11.5,z:-2.2,at:[11.5,-1.35],r:1.6}
  ]);

  // R8 ingredients: tofu and pork are FIXED at 1 (no portion selection)
  // Adjustable: douban→Craving, garlic→Irritability, chili→Restlessness, pepper→Anxiety, scallion→Concentration
  const INGREDIENTS = Object.freeze({
    tofu:    { id: 'tofu',    name: '豆腐',   key: '1', defaultPortion: 1, fixed: true },
    pork:    { id: 'pork',   name: '絞肉',   key: '2', defaultPortion: 1, fixed: true },
    douban:  { id: 'douban', name: '豆瓣醬', key: '3', defaultPortion: 1, fixed: false, targets: 'craving' },
    garlic:  { id: 'garlic', name: '蒜',     key: '4', defaultPortion: 1, fixed: false, targets: 'irritability' },
    scallion:{ id: 'scallion',name: '青蔥',  key: '5', defaultPortion: 1, fixed: false, targets: 'concentration' },
    chili:   { id: 'chili',  name: '辣椒',   key: '6', defaultPortion: 0, fixed: false, targets: 'restlessness' },
    pepper:  { id: 'pepper', name: '花椒',   key: '7', defaultPortion: 0, fixed: false, targets: 'anxiety' }
  });

  const VALID_PORTIONS = Object.freeze([0, 0.5, 1]);
  function isValidPortion(p) { return VALID_PORTIONS.includes(p); }

  // R8 symptom → expected portion mapping
  // symptom value 0-1 → portion 0; 2 → portion 0.5; 3-4 → portion 1
  function symptomToTargetPortion(symptomValue) {
    const v = Number(symptomValue) || 0;
    if (v <= 1) return 0;
    if (v === 2) return 0.5;
    return 1;
  }

  // Build expected portions for a patient's adjustable ingredients
  function buildExpectedPortions(patient) {
    const s = patient.clinicalStatus;
    return {
      douban:   symptomToTargetPortion(s.craving),
      garlic:   symptomToTargetPortion(s.irritability),
      chili:    symptomToTargetPortion(s.restlessness),
      pepper:   symptomToTargetPortion(s.anxiety),
      scallion: symptomToTargetPortion(s.concentration),
      tofu: 1,
      pork: 1
    };
  }

  function createWok() {
    return {
      hasFood: false,
      contents: { tofu: 0, pork: 0, douban: 0, garlic: 0, scallion: 0, pepper: 0, chili: 0 },
      stirs: 0,
      flame: 'off', // 'off' | 'low' | 'high'
      highHeatSeconds: 0,
      lowHeatSeconds: 0,
      eqSimmerTime: 0,
      isSimmered: false,
      isBurnt: false,
      overheatSeconds: 0
    };
  }

  function addBatchToWok(wok, preparedTray) {
    if (wok.hasFood) {
      throw new Error('Wok already contains food');
    }
    let count = 0;
    for (const [id, portion] of Object.entries(preparedTray)) {
      if (portion > 0) {
        wok.contents[id] = portion;
        count += portion;
      }
    }
    if (count === 0) {
      throw new Error('Cannot add empty tray to wok');
    }
    wok.hasFood = true;
    return wok;
  }

  function equivalentSimmerTime(highSeconds = 0, lowSeconds = 0) {
    return Number((Math.max(0, highSeconds) + 0.5 * Math.max(0, lowSeconds)).toFixed(4));
  }

  function heatPenaltyR6(eqSeconds = 0, isBurnt = false) {
    if (isBurnt) return 20;
    if (eqSeconds <= 4.0) return 0;
    const excess = Math.max(0, eqSeconds - 4.0);
    return Math.min(20, Math.floor(excess + 1e-7));
  }

  // Legacy heat penalty function for backwards compatibility
  function heatPenalty(seconds = 0, burnt = false) {
    return Math.max(burnt ? 20 : 0, Math.min(20, Math.floor(Math.max(0, seconds) + 1e-7)));
  }

  // R8 evaluation function: stricter prescription mapping and Gate B
  function evaluateR8(order, dish, patient) {
    const contents = dish.contents || {};
    const eqSimmer = dish.eqSimmerTime !== undefined ? dish.eqSimmerTime : equivalentSimmerTime(dish.highHeatSeconds || 0, dish.lowHeatSeconds || 0);
    const heatPen = heatPenaltyR6(eqSimmer, dish.isBurnt);
    const stirs = dish.stirs || 0;
    const rice = dish.rice || dish.ricePortion || '未盛飯';
    const miso = dish.miso !== undefined ? dish.miso : false;

    let score = 100;
    const checks = [];

    // R8: tofu and pork are fixed at 1 — penalize if missing or < 1
    const tofuOk = (contents.tofu || 0) >= 1;
    const porkOk = (contents.pork || 0) >= 1;
    if (!tofuOk || !porkOk) {
      const pen = (!tofuOk ? 20 : 0) + (!porkOk ? 20 : 0);
      score -= pen;
      const missing = [!tofuOk && '豆腐', !porkOk && '絞肉'].filter(Boolean).join('、');
      checks.push({ label: '基底食材', expected: '豆腐+絞肉各1份', actual: `缺 ${missing}`, ok: false, penalty: pen });
    } else {
      checks.push({ label: '基底食材', expected: '豆腐+絞肉各1份', actual: '齊備', ok: true, penalty: 0 });
    }

    // R8 prescription fidelity: adjustable ingredients must match symptom→portion mapping
    const expected = patient ? buildExpectedPortions(patient) : { douban: 1, garlic: 1, scallion: 0, chili: 0, pepper: 0 };
    const adjustable = ['douban', 'garlic', 'scallion', 'chili', 'pepper'];
    const labelMap = { douban: '豆瓣醬→Craving', garlic: '蒜→Irritability', scallion: '蔥→Concentration', chili: '辣椒→Restlessness', pepper: '花椒→Anxiety' };
    let totalPrescriptionPenalty = 0;

    for (const ing of adjustable) {
      const actual = contents[ing] || 0;
      const exp = expected[ing];
      const diff = Math.abs(actual - exp);
      let pen = 0;
      if (diff >= 1.0) pen = 25;
      else if (diff >= 0.5) pen = 12;
      if (pen > 0) {
        score -= pen;
        totalPrescriptionPenalty += pen;
        checks.push({ label: labelMap[ing], expected: `${exp === 0 ? '0份' : exp === 0.5 ? '半份' : '1份'}`, actual: `${actual === 0 ? '0份' : actual === 0.5 ? '半份' : '1份'}`, ok: false, penalty: pen });
      } else {
        checks.push({ label: labelMap[ing], expected: `${exp === 0 ? '0份' : exp === 0.5 ? '半份' : '1份'}`, actual: `${actual === 0 ? '0份' : actual === 0.5 ? '半份' : '1份'}`, ok: true, penalty: 0 });
      }
    }

    // Prescription fidelity gate: max possible penalty from 5 ingredients is 125; 
    // fidelity score = (125 - totalPrescriptionPenalty) / 125 * 100
    const prescriptionFidelity = Math.max(0, Math.round((125 - totalPrescriptionPenalty) / 125 * 100));
    const gateB_pass = prescriptionFidelity >= 70;

    // 3. Stirring technique (20 points)
    if (stirs < 3) {
      const pen = (3 - stirs) * 7;
      score -= pen;
      checks.push({ label: '翻炒手法', expected: '推翻勻炒3次', actual: `翻炒 ${stirs} 次`, ok: false, penalty: pen });
    } else {
      checks.push({ label: '翻炒手法', expected: '推翻勻炒3次', actual: `翻炒 ${stirs} 次`, ok: true, penalty: 0 });
    }

    // 4. Flame & Simmering Reduction
    if (eqSimmer < 3.5) {
      const pen = Math.min(20, Math.round((4.0 - eqSimmer) * 5));
      score -= pen;
      checks.push({ label: '收汁火候', expected: '4等效秒濃郁收汁', actual: `收汁不足 (${eqSimmer.toFixed(1)}s)`, ok: false, penalty: pen });
    } else if (heatPen > 0) {
      score -= heatPen;
      checks.push({ label: '收汁火候', expected: '4等效秒收汁後關火', actual: `逾時 ${(eqSimmer - 4).toFixed(1)}s (-${heatPen}%)`, ok: false, penalty: heatPen });
    } else {
      checks.push({ label: '收汁火候', expected: '4等效秒濃郁收汁', actual: '火候極佳', ok: true, penalty: 0 });
    }

    // 5. Rice portion — R8 penalty: 25 for mismatch
    const expectedRice = order.rice || '正常飯';
    if (rice !== expectedRice) {
      score -= 25;
      checks.push({ label: '配飯份量', expected: expectedRice, actual: rice, ok: false, penalty: 25 });
    } else {
      checks.push({ label: '配飯份量', expected: expectedRice, actual: rice, ok: true, penalty: 0 });
    }

    // 6. Miso soup — R8 penalty: 18 for mismatch
    const expectedMiso = !!order.miso;
    if (miso !== expectedMiso) {
      score -= 18;
      checks.push({ label: '味噌湯', expected: expectedMiso ? '要附湯' : '不要湯', actual: miso ? '有湯' : '無湯', ok: false, penalty: 18 });
    } else {
      checks.push({ label: '味噌湯', expected: expectedMiso ? '要附湯' : '不要湯', actual: miso ? '有湯' : '無湯', ok: true, penalty: 0 });
    }

    const finalQuality = Math.max(0, Math.min(100, score));

    // Hard fail conditions: Gate B (prescription fidelity < 70)
    const hardFail = !gateB_pass;
    const hardFailReason = hardFail ? `處方符合度 ${prescriptionFidelity}% < 70%（Gate B 未通過）` : null;

    return { quality: finalQuality, checks, prescriptionFidelity, gateB_pass, hardFail, hardFailReason };
  }

  // R6 evaluator kept for backwards compatibility
  function evaluateR6(order, dish) {
    const contents = dish.contents || {};
    const eqSimmer = dish.eqSimmerTime !== undefined ? dish.eqSimmerTime : equivalentSimmerTime(dish.highHeatSeconds || 0, dish.lowHeatSeconds || 0);
    const heatPen = heatPenaltyR6(eqSimmer, dish.isBurnt);
    const stirs = dish.stirs || 0;
    const rice = dish.rice || dish.ricePortion || '未盛飯';
    const miso = dish.miso !== undefined ? dish.miso : false;

    let score = 100;
    const checks = [];

    const core = ['tofu', 'pork', 'douban', 'garlic'];
    const missingCore = core.filter(id => !contents[id] || contents[id] <= 0);
    if (missingCore.length > 0) {
      const pen = Math.min(40, missingCore.length * 10);
      score -= pen;
      checks.push({ label: '必備食材', expected: '齊全4項', actual: `缺 ${missingCore.length} 項`, ok: false, penalty: pen });
    } else {
      checks.push({ label: '必備食材', expected: '齊全4項', actual: '齊備', ok: true, penalty: 0 });
    }

    const hasScallion = (contents.scallion || 0) > 0;
    const expectedScallion = !!order.scallion;
    if (hasScallion !== expectedScallion) {
      const pen = expectedScallion ? 8 : 10;
      score -= pen;
      checks.push({ label: '蔥花偏好', expected: expectedScallion ? '要蔥' : '不要蔥', actual: hasScallion ? '有蔥' : '無蔥', ok: false, penalty: pen });
    } else {
      checks.push({ label: '蔥花偏好', expected: expectedScallion ? '要蔥' : '不要蔥', actual: hasScallion ? '有蔥' : '無蔥', ok: true, penalty: 0 });
    }

    const hasPepper = (contents.pepper || 0) > 0;
    const expectedHeavy = order.spicy === '重辣';
    if (hasPepper !== expectedHeavy) {
      const pen = 7;
      score -= pen;
      checks.push({ label: '辣度調味', expected: order.spicy, actual: hasPepper ? '重辣' : '正常', ok: false, penalty: pen });
    } else {
      checks.push({ label: '辣度調味', expected: order.spicy, actual: hasPepper ? '重辣' : '正常', ok: true, penalty: 0 });
    }

    if (stirs < 3) {
      const pen = (3 - stirs) * 8;
      score -= pen;
      checks.push({ label: '翻炒手法', expected: '推翻勻炒3次', actual: `翻炒 ${stirs} 次`, ok: false, penalty: pen });
    } else {
      checks.push({ label: '翻炒手法', expected: '推翻勻炒3次', actual: `翻炒 ${stirs} 次`, ok: true, penalty: 0 });
    }

    if (eqSimmer < 3.5) {
      const pen = Math.min(20, Math.round((4.0 - eqSimmer) * 5));
      score -= pen;
      checks.push({ label: '收汁火候', expected: '4等效秒濃郁收汁', actual: `收汁不足 (${eqSimmer.toFixed(1)}s)`, ok: false, penalty: pen });
    } else if (heatPen > 0) {
      score -= heatPen;
      checks.push({ label: '收汁火候', expected: '4等效秒收汁後關火', actual: `逾時 ${(eqSimmer - 4).toFixed(1)}s (-${heatPen}%)`, ok: false, penalty: heatPen });
    } else {
      checks.push({ label: '收汁火候', expected: '4等效秒濃郁收汁', actual: '火候極佳', ok: true, penalty: 0 });
    }

    const expectedRice = order.rice || '正常飯';
    if (rice !== expectedRice) {
      score -= 5;
      checks.push({ label: '配飯份量', expected: expectedRice, actual: rice, ok: false, penalty: 5 });
    } else {
      checks.push({ label: '配飯份量', expected: expectedRice, actual: rice, ok: true, penalty: 0 });
    }

    const expectedMiso = !!order.miso;
    if (miso !== expectedMiso) {
      score -= 5;
      checks.push({ label: '味噌湯', expected: expectedMiso ? '要附湯' : '不要湯', actual: miso ? '有湯' : '無湯', ok: false, penalty: 5 });
    } else {
      checks.push({ label: '味噌湯', expected: expectedMiso ? '要附湯' : '不要湯', actual: miso ? '有湯' : '無湯', ok: true, penalty: 0 });
    }

    const finalQuality = Math.max(0, Math.min(100, score));
    return { quality: finalQuality, checks };
  }

  function calculateMealOutcome({ beforeCraving, afterCraving, metricMode = 'relative' }) {
    if (beforeCraving <= 0) {
      return {
        beforeCraving: 0,
        afterCraving: 0,
        relativeReduction: 0,
        absoluteReduction: 0,
        success: true,
        reason: '已平靜，降幅不適用'
      };
    }
    const rel = (beforeCraving - afterCraving) / beforeCraving;
    const abs = beforeCraving - afterCraving;
    const success = metricMode === 'absolute' ? (abs >= 25) : (rel >= 0.25 - 1e-9);
    return {
      beforeCraving,
      afterCraving,
      relativeReduction: Number(rel.toFixed(6)),
      absoluteReduction: Number(abs.toFixed(2)),
      success,
      reason: success ? '達到舒壓門檻（降幅 ≥25%）' : '未達舒壓門檻（降幅 <25%）'
    };
  }

  // R8 calculateClinicalMetrics: operates on 0-4 withdrawal symptom scale
  // FTND is immutable — never modified here
  function calculateClinicalMetrics(beforeMetrics, quality, checks = [], order = {}, dish = {}) {
    const defaultMetrics = { craving: 3, irritability: 2, anxiety: 2, concentration: 2, restlessness: 2, appetite: 2, sleep: 2 };
    const b = beforeMetrics || defaultMetrics;
    const qRatio = Math.max(0, Math.min(100, Number(quality) || 0)) / 100;

    // Primary: Craving on 0-4 scale; success = 25% relative reduction
    const cBefore = Math.max(0, Number(b.craving) || 0);
    // R8: craving mapped to 0-4; reduction proportional to quality
    const cAfter = Math.max(0, Number((cBefore * (1 - 0.5 * qRatio)).toFixed(2)));
    const cReduction = cBefore > 0 ? (cBefore - cAfter) / cBefore : 0;
    const won = cReduction >= 0.25 - 1e-9;

    // Secondary withdrawal symptoms (0-4 scale, lower is better for most)
    const irritBefore = Math.max(0, Number(b.irritability) || 0);
    const irritDrop = won ? Number((irritBefore * 0.4 * qRatio).toFixed(2)) : Number((irritBefore * 0.1 * qRatio).toFixed(2));
    const irritAfter = Math.max(0, irritBefore - irritDrop);

    const anxBefore = Math.max(0, Number(b.anxiety) || 0);
    const anxDrop = won ? Number((anxBefore * 0.4 * qRatio).toFixed(2)) : Number((anxBefore * 0.1 * qRatio).toFixed(2));
    const anxAfter = Math.max(0, anxBefore - anxDrop);

    const concBefore = Math.max(0, Number(b.concentration) || 0);
    // concentration difficulty = higher is worse; cooking helps reduce it
    const concDrop = won ? Number((concBefore * 0.35 * qRatio).toFixed(2)) : Number((concBefore * 0.08 * qRatio).toFixed(2));
    const concAfter = Math.max(0, concBefore - concDrop);

    const restBefore = Math.max(0, Number(b.restlessness) || 0);
    const restDrop = won ? Number((restBefore * 0.4 * qRatio).toFixed(2)) : Number((restBefore * 0.08 * qRatio).toFixed(2));
    const restAfter = Math.max(0, restBefore - restDrop);

    const appBefore = Math.max(0, Number(b.appetite) || 0);
    // appetite difficulty = higher means lower appetite; good meal improves appetite
    const appDrop = won ? Number((appBefore * 0.35 * qRatio).toFixed(2)) : Number((appBefore * 0.05 * qRatio).toFixed(2));
    const appAfter = Math.max(0, appBefore - appDrop);

    const sleepBefore = Math.max(0, Number(b.sleep) || 0);
    const sleepDrop = won ? Number((sleepBefore * 0.3 * qRatio).toFixed(2)) : Number((sleepBefore * 0.05 * qRatio).toFixed(2));
    const sleepAfter = Math.max(0, sleepBefore - sleepDrop);

    const afterMetrics = {
      craving: Number(cAfter.toFixed(2)),
      irritability: Number(irritAfter.toFixed(2)),
      anxiety: Number(anxAfter.toFixed(2)),
      concentration: Number(concAfter.toFixed(2)),
      restlessness: Number(restAfter.toFixed(2)),
      appetite: Number(appAfter.toFixed(2)),
      sleep: Number(sleepAfter.toFixed(2))
    };

    const deltaMetrics = {
      craving:       Number((afterMetrics.craving - cBefore).toFixed(2)),
      irritability:  Number((afterMetrics.irritability - irritBefore).toFixed(2)),
      anxiety:       Number((afterMetrics.anxiety - anxBefore).toFixed(2)),
      concentration: Number((afterMetrics.concentration - concBefore).toFixed(2)),
      restlessness:  Number((afterMetrics.restlessness - restBefore).toFixed(2)),
      appetite:      Number((afterMetrics.appetite - appBefore).toFixed(2)),
      sleep:         Number((afterMetrics.sleep - sleepBefore).toFixed(2))
    };

    const comfortScore = Math.max(0, Math.min(100, Math.round(
      40 * qRatio +
      15 * (won ? 1 : 0.3) +
      20 * (1 - cAfter / Math.max(1, cBefore)) +
      15 * (1 - irritAfter / Math.max(1, irritBefore)) +
      10 * (1 - anxAfter / Math.max(1, anxBefore))
    )));

    const metrics = {
      craving:       { before: cBefore,      after: afterMetrics.craving,       delta: deltaMetrics.craving },
      irritability:  { before: irritBefore,  after: afterMetrics.irritability,  delta: deltaMetrics.irritability },
      anxiety:       { before: anxBefore,    after: afterMetrics.anxiety,       delta: deltaMetrics.anxiety },
      concentration: { before: concBefore,   after: afterMetrics.concentration, delta: deltaMetrics.concentration },
      restlessness:  { before: restBefore,   after: afterMetrics.restlessness,  delta: deltaMetrics.restlessness },
      appetite:      { before: appBefore,    after: afterMetrics.appetite,      delta: deltaMetrics.appetite },
      sleep:         { before: sleepBefore,  after: afterMetrics.sleep,         delta: deltaMetrics.sleep }
    };

    return {
      before: b,
      after: afterMetrics,
      delta: deltaMetrics,
      metrics,
      cravingBefore: cBefore,
      cravingAfter: afterMetrics.craving,
      relativeReduction: Number(cReduction.toFixed(6)),
      success: won,
      comfortScore
    };
  }

  // R8 patient review: withdrawal-focused language
  function generatePatientReview(patient, quality, checks = [], dish = {}, won = true) {
    const riceOk = checks.some(c => c.label.includes('飯') && c.ok);
    const misoOk = checks.some(c => c.label.includes('味噌') && c.ok);
    const prescOk = checks.filter(c => ['豆瓣醬→Craving','蒜→Irritability','辣椒→Restlessness','花椒→Anxiety','蔥→Concentration'].includes(c.label)).every(c => c.ok);

    const cravingRelief = won
      ? (prescOk ? '吃了這碗飯，嘴裡對菸的渴望平靜下來了。' : '菸癮還在，但吃完肚子有點安慰。')
      : '吃完胸口還是堵著，菸癮根本沒有緩解。';

    const irritabilityRelief = won
      ? '緊繃的情緒舒緩許多，煩躁感明顯減輕了。'
      : '心情更煩躁了，感覺什麼都不對。';

    const comfortText = won
      ? `熱騰騰的麻婆豆腐下肚，${riceOk ? '配著剛好的米飯，' : ''}整個人放鬆了。`
      : '吃完還是坐立難安，完全沒有被舒緩的感覺。';

    const tasteAcceptance = prescOk
      ? '口味調配剛剛好，吃得很順口，剛好符合今天的需求。'
      : '調味有些偏差，和我想要的口感有落差。';

    const quote = won
      ? `「這正是我需要的！${cravingRelief}謝謝你的用心調配！」`
      : `「這根本不對我的症狀！${cravingRelief}下次請按照症狀來調味！」`;

    return {
      numbing: cravingRelief,
      comfort: comfortText,
      satiety: tasteAcceptance,
      mental: irritabilityRelief,
      quote
    };
  }

  // Legacy evaluate function for backwards compatibility with R5 tests
  function evaluate(order, dish) {
    const heat = heatPenalty(dish.overheatSeconds, dish.isBurnt);
    const actual = {
      spicy: dish.hasPepper && dish.hasDouban ? '重辣' : dish.hasDouban ? '正常' : '微辣',
      scallion: !!dish.hasScallion,
      rice: dish.ricePortion
    };
    const checks = [
      { label: '辣度', expected: order.spicy, actual: actual.spicy, ok: actual.spicy === order.spicy, penalty: 10 },
      { label: '蔥花', expected: order.scallion ? '要蔥' : '不要蔥', actual: actual.scallion ? '有蔥' : '無蔥', ok: actual.scallion === order.scallion, penalty: order.scallion ? 10 : 15 },
      { label: '飯量', expected: order.rice, actual: actual.rice, ok: actual.rice === order.rice, penalty: actual.rice === '未盛飯' ? 15 : 5 },
      { label: '火候', expected: '4秒收汁後關火', actual: !dish.isSimmered ? '未收汁' : heat ? `大火逾時 ${(dish.overheatSeconds || 0).toFixed(1)}秒${dish.isBurnt ? '／焦鍋' : ''}` : '收汁完成', ok: dish.isSimmered && heat === 0, penalty: dish.isSimmered ? heat : 15 }
    ];
    return { quality: Math.max(50, 100 - checks.reduce((n, c) => n + (c.ok ? 0 : c.penalty), 0)), checks, actual };
  }

  root.CKClinicRules = {
    patients,
    stations,
    INGREDIENTS,
    VALID_PORTIONS,
    isValidPortion,
    symptomToTargetPortion,
    buildExpectedPortions,
    createWok,
    addBatchToWok,
    equivalentSimmerTime,
    heatPenaltyR6,
    evaluateR6,
    evaluateR8,
    calculateMealOutcome,
    calculateClinicalMetrics,
    generatePatientReview,
    heatPenalty,
    evaluate
  };
  if (typeof module !== 'undefined') module.exports = root.CKClinicRules;
})(typeof window === 'undefined' ? globalThis : window);
