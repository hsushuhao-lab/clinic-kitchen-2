/* R6 clinic order, consolidated routes, batch cooking, flame equivalence, and craving outcome rules. */
(function(root){
  'use strict';
  const patients = Object.freeze([
    {
      id: 'office',
      name: '上班族',
      wish: '今天想吃正常辣，不要蔥，半碗飯就好，附熱味噌湯。',
      complaint: '工作壓力繁重，下午總渴望重口味刺激與抽菸，胃口差又容易焦慮。',
      spicy: '正常',
      scallion: false,
      rice: '半碗飯',
      miso: true,
      clinicalStatus: { craving: 70, focus: 35, anxiety: 75, impulsivity: 65, language: 50, memory: 45, sleepiness: 60 }
    },
    {
      id: 'student',
      name: '大學生',
      wish: '想吃正常辣、加蔥花，配一整碗飯，要味噌湯。',
      complaint: '準備期末考熬夜念書，注意力渙散又容易衝動分心，想吃熱呼呼的宵夜。',
      spicy: '正常',
      scallion: true,
      rice: '正常飯',
      miso: true,
      clinicalStatus: { craving: 65, focus: 25, anxiety: 70, impulsivity: 75, language: 60, memory: 40, sleepiness: 80 }
    },
    {
      id: 'driver',
      name: '司機',
      wish: '給我重辣、蔥花多香一點，飯要正常份量，不要湯。',
      complaint: '整天在市區開車精神高度緊繃，嗜睡疲累又常有菸癮衝動，需要重辣提神。',
      spicy: '重辣',
      scallion: true,
      rice: '正常飯',
      miso: false,
      clinicalStatus: { craving: 80, focus: 40, anxiety: 60, impulsivity: 70, language: 45, memory: 50, sleepiness: 75 }
    },
    {
      id: 'auntie',
      name: '阿姨',
      wish: '正常辣、要蔥花，今天飯只要半碗，要一碗味噌湯。',
      complaint: '最近心神不寧、健忘丟三落四，心情鬱悶時總想找點熟悉的熱食舒緩安神。',
      spicy: '正常',
      scallion: true,
      rice: '半碗飯',
      miso: true,
      clinicalStatus: { craving: 60, focus: 45, anxiety: 80, impulsivity: 55, language: 70, memory: 35, sleepiness: 50 }
    },
    {
      id: 'quiet',
      name: '安靜的訪客',
      wish: '我想吃正常辣，不要蔥，飯要一碗，不要味噌湯。',
      complaint: '胸口堵著悶悶的，不太想開口說話，只想靜靜吃一頓暖胃舒壓的家常便飯。',
      spicy: '正常',
      scallion: false,
      rice: '正常飯',
      miso: false,
      clinicalStatus: { craving: 55, focus: 50, anxiety: 65, impulsivity: 40, language: 30, memory: 60, sleepiness: 55 }
    },
    {
      id: 'repeat',
      name: '熟客',
      wish: '這次試試重辣，不放蔥，再配半碗飯，附熱味噌湯。',
      complaint: '剛換新工作適應不良，焦慮暴躁、衝動難耐，渴望正宗重辣麻婆豆腐壓壓驚。',
      spicy: '重辣',
      scallion: false,
      rice: '半碗飯',
      miso: true,
      clinicalStatus: { craving: 75, focus: 30, anxiety: 70, impulsivity: 80, language: 55, memory: 50, sleepiness: 65 }
    }
  ]);

  // R6 Consolidated Stations: Consult (X: -10.5), Prep (X: 5.0), Wok (X: 9.0), Serve (X: 11.5)
  const stations = Object.freeze([
    {id:'consult',name:'診間',label:'01 診間問診開單',x:-10.5,z:-1.4,at:[-10.5,-.65],r:1.8},
    {id:'prep',name:'備料檯',label:'02 取材備料',x:5,z:-2.2,at:[5,-1.4],r:1.6},
    {id:'wok',name:'炒鍋爐台',label:'03 炒鍋收汁',x:9,z:-2.2,at:[9,-1.35],r:1.6},
    {id:'serve',name:'配餐檯',label:'04 配飯味噌湯',x:11.5,z:-2.2,at:[11.5,-1.35],r:1.6}
  ]);

  const INGREDIENTS = Object.freeze({
    tofu: { id: 'tofu', name: '豆腐', key: '1', defaultPortion: 1 },
    pork: { id: 'pork', name: '絞肉', key: '2', defaultPortion: 1 },
    douban: { id: 'douban', name: '豆瓣醬', key: '3', defaultPortion: 1 },
    garlic: { id: 'garlic', name: '蒜', key: '4', defaultPortion: 1 },
    scallion: { id: 'scallion', name: '青蔥', key: '5', defaultPortion: 1 },
    chili: { id: 'chili', name: '辣椒', key: '6', defaultPortion: 0 },
    pepper: { id: 'pepper', name: '花椒', key: '7', defaultPortion: 0 }
  });

  const VALID_PORTIONS = Object.freeze([0, 0.5, 1]);
  function isValidPortion(p) { return VALID_PORTIONS.includes(p); }

  function createWok() {
    return {
      hasFood: false,
      contents: { tofu: 0, pork: 0, douban: 0, garlic: 0, scallion: 0, pepper: 0 },
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

  function evaluateR6(order, dish) {
    const contents = dish.contents || {};
    const eqSimmer = dish.eqSimmerTime !== undefined ? dish.eqSimmerTime : equivalentSimmerTime(dish.highHeatSeconds || 0, dish.lowHeatSeconds || 0);
    const heatPen = heatPenaltyR6(eqSimmer, dish.isBurnt);
    const stirs = dish.stirs || 0;
    const rice = dish.rice || dish.ricePortion || '未盛飯';
    const miso = dish.miso !== undefined ? dish.miso : false;

    // Checks & penalties (out of 100)
    let score = 100;
    const checks = [];

    // 1. Core ingredients presence (15 points: tofu, pork, douban, garlic)
    const core = ['tofu', 'pork', 'douban', 'garlic'];
    const missingCore = core.filter(id => !contents[id] || contents[id] <= 0);
    if (missingCore.length > 0) {
      const pen = Math.min(40, missingCore.length * 10);
      score -= pen;
      checks.push({ label: '必備食材', expected: '齊全4項', actual: `缺 ${missingCore.length} 項`, ok: false, penalty: pen });
    } else {
      checks.push({ label: '必備食材', expected: '齊全4項', actual: '齊備', ok: true, penalty: 0 });
    }

    // 2. Scallion & Pepper matching (15 points)
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

    // 3. Stirring technique (25 points)
    if (stirs < 3) {
      const pen = (3 - stirs) * 8;
      score -= pen;
      checks.push({ label: '翻炒手法', expected: '推翻勻炒3次', actual: `翻炒 ${stirs} 次`, ok: false, penalty: pen });
    } else {
      checks.push({ label: '翻炒手法', expected: '推翻勻炒3次', actual: `翻炒 ${stirs} 次`, ok: true, penalty: 0 });
    }

    // 4. Flame & Simmering Reduction (35 points)
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

    // 5. Rice portion (5 points)
    const expectedRice = order.rice || '正常飯';
    if (rice !== expectedRice) {
      score -= 5;
      checks.push({ label: '配飯份量', expected: expectedRice, actual: rice, ok: false, penalty: 5 });
    } else {
      checks.push({ label: '配飯份量', expected: expectedRice, actual: rice, ok: true, penalty: 0 });
    }

    // 6. Miso soup (5 points)
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

  function calculateClinicalMetrics(beforeMetrics, quality, checks = [], order = {}, dish = {}) {
    const b = beforeMetrics || { craving: 70, focus: 35, anxiety: 75, impulsivity: 65, language: 50, memory: 45, sleepiness: 60 };
    const qRatio = Math.max(0, Math.min(100, Number(quality) || 0)) / 100;
    
    // Primary outcome: Craving relative reduction preserved strictly
    const cBefore = Math.max(0, Number(b.craving) || 0);
    const cAfter = Math.max(0, Number((cBefore * (1 - 0.5 * qRatio)).toFixed(1)));
    const cReduction = cBefore > 0 ? (cBefore - cAfter) / cBefore : 0;
    const won = cReduction >= 0.25 - 1e-9;
    
    // Secondary metrics (0 - 100)
    const anxietyDrop = won ? Math.round(35 * qRatio + 5) : Math.round(10 * qRatio);
    const aAfter = Math.max(10, Math.min(100, b.anxiety - anxietyDrop));
    
    const focusGain = won ? Math.round(35 * qRatio + 5) : Math.round(5 * qRatio);
    const fAfter = Math.max(0, Math.min(100, b.focus + focusGain));
    
    const impulsivityDrop = won ? Math.round(30 * qRatio + 5) : Math.round(8 * qRatio);
    const iAfter = Math.max(10, Math.min(100, b.impulsivity - impulsivityDrop));
    
    const languageGain = won ? Math.round(25 * qRatio + 5) : Math.round(5 * qRatio);
    const lAfter = Math.max(0, Math.min(100, b.language + languageGain));
    
    const memoryGain = won ? Math.round(20 * qRatio + 5) : Math.round(4 * qRatio);
    const mAfter = Math.max(0, Math.min(100, b.memory + memoryGain));
    
    const sleepinessDrop = won ? Math.round(25 * qRatio + 5) : Math.round(5 * qRatio);
    const sAfter = Math.max(10, Math.min(100, b.sleepiness - sleepinessDrop));
    
    const afterMetrics = {
      craving: cAfter,
      focus: fAfter,
      anxiety: aAfter,
      impulsivity: iAfter,
      language: lAfter,
      memory: mAfter,
      sleepiness: sAfter
    };

    const deltaMetrics = {
      craving: Number((cAfter - cBefore).toFixed(1)),
      focus: fAfter - b.focus,
      anxiety: aAfter - b.anxiety,
      impulsivity: iAfter - b.impulsivity,
      language: lAfter - b.language,
      memory: mAfter - b.memory,
      sleepiness: sAfter - b.sleepiness
    };

    const comfortScore = Math.max(0, Math.min(100, Math.round(
      0.4 * quality +
      0.2 * (anxietyDrop / 40 * 100) +
      0.15 * (focusGain / 40 * 100) +
      0.15 * (impulsivityDrop / 35 * 100) +
      0.1 * (languageGain / 30 * 100)
    )));

    const metrics = {
      craving: { before: cBefore, after: cAfter, delta: deltaMetrics.craving },
      focus: { before: b.focus, after: fAfter, delta: deltaMetrics.focus },
      anxiety: { before: b.anxiety, after: aAfter, delta: deltaMetrics.anxiety },
      impulsivity: { before: b.impulsivity, after: iAfter, delta: deltaMetrics.impulsivity },
      language: { before: b.language, after: lAfter, delta: deltaMetrics.language },
      memory: { before: b.memory, after: mAfter, delta: deltaMetrics.memory },
      sleepiness: { before: b.sleepiness, after: sAfter, delta: deltaMetrics.sleepiness }
    };

    return {
      before: b,
      after: afterMetrics,
      delta: deltaMetrics,
      metrics,
      cravingBefore: cBefore,
      cravingAfter: cAfter,
      relativeReduction: Number(cReduction.toFixed(6)),
      success: won,
      comfortScore
    };
  }

  function generatePatientReview(patient, quality, checks = [], dish = {}, won = true) {
    const numbingOk = checks.some(c => c.label.includes('辣度') && c.ok);
    const scallionOk = checks.some(c => c.label.includes('蔥') && c.ok);
    const riceOk = checks.some(c => c.label.includes('飯') && c.ok);

    const numbingText = numbingOk ? '花椒麻香酥在舌尖，香氣醇厚又溫暖。' : '調味稍微失衡，麻辣感不如預期合胃口。';
    const comfortText = won ? '溫熱滑嫩的豆腐下肚，緊繃一整天的肩膀和焦慮完全放鬆了。' : '吃完肚子有些燥熱，原本煩悶的情緒沒有得到紓解。';
    const satietyText = riceOk ? `搭配剛好的${dish.rice || dish.ricePortion || '米飯'}，飽足感十分舒服踏實。` : '米飯份量不太習慣，整體飽足感欠缺。';
    const mentalText = won ? '腦袋清爽許多，午後的注意力與精神都重新回來了！' : '心情很糟，吃完還是感覺坐立難安！';

    const quote = won
      ? `「這就是我想吃的麻婆豆腐！${numbingText}${comfortText}吃完整個人平靜踏實，太感謝了！」`
      : `「這完全不是我想吃的口味！${numbingText}本來就心煩，現在更煩躁了！」`;

    return {
      numbing: numbingText,
      comfort: comfortText,
      satiety: satietyText,
      mental: mentalText,
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
    createWok,
    addBatchToWok,
    equivalentSimmerTime,
    heatPenaltyR6,
    evaluateR6,
    calculateMealOutcome,
    calculateClinicalMetrics,
    generatePatientReview,
    heatPenalty,
    evaluate
  };
  if (typeof module !== 'undefined') module.exports = root.CKClinicRules;
})(typeof window === 'undefined' ? globalThis : window);
