# R8 Gameplay Release Notes — Nicotine Dependence–Informed Clinical Gameplay

> Release: R8 · Commit: 7ccf1f3  
> Date: 2026-09-21  
> Deployed: https://hsushuhao-lab.github.io/clinic-kitchen-2/

---

## Overview

R8 restructures the game from a generic craving model into a three-layer nicotine dependence framework:

| Layer | What it is | Changes in R8 |
|---|---|---|
| **Baseline dependence** | FTND (Fagerström Test for Nicotine Dependence) | NEW: 6-question card, frozen per patient |
| **Acute withdrawal profile** | 7 symptom domains, 0–4 scale | NEW: replaces R7's 7% metrics |
| **Meal prescription + execution** | Ingredient selection + cooking | Updated: symptom→portion mapping, stricter penalties |

---

## FTND Baseline Card

- 6 questions (Q1–Q6) visible in patient HUD at all times
- Total score shown (0–10) with severity label (輕度/中度/重度依賴)
- **FTND never changes after a meal** — this is by design
- Tests: `r8_rules.test.cjs` — FTND immutability asserted

---

## Acute Withdrawal Symptoms (R8)

New 7-symptom set replaces R7 schema:

| Symptom | Ingredient | Target |
|---|---|---|
| Craving 渴求 | 豆瓣醬 | douban |
| Irritability 煩躁 | 蒜瓣 | garlic |
| Anxiety 焦慮 | 花椒 | pepper |
| Concentration 集中困難 | 青蔥 | scallion |
| Restlessness 坐立難安 | 辣椒 | chili |
| Appetite 食慾不振 | 米飯量 | rice (indirect) |
| Sleep 睡眠困擾 | 味噌湯 | miso (indirect) |

Symptom value → Prescription portion:
- 0–1 → 0份 (none)
- 2 → 半份 (half)
- 3–4 → 1份 (full)

---

## Fixed Ingredients

- **豆腐** and **絞肉** are always 1份 — not adjustable
- Displayed with "1份 固定" badge, button disabled

---

## Scoring (R8)

| Check | Penalty |
|---|---|
| Ingredient diff ≥ 0.5 portion | −12 pts |
| Ingredient diff = 1.0 portion | −25 pts |
| Rice mismatch | −25 pts |
| Miso mismatch | −18 pts |
| Stir < 3 | −7×(3-stirs) |
| Simmer insufficient | up to −20 |
| Tofu/pork missing | −20 each |

### Gate B — Prescription Fidelity Gate

- Prescription fidelity = (125 − total_ingredient_penalty) / 125 × 100
- **Fidelity < 70% → hard fail** (even if cooking technique is perfect)
- Result shows: `處方符合度 XX% · Gate B ✓/❌`

---

## Result Panel

- Before → After shown in left HUD for all 7 withdrawal symptoms
- Patient-reported outcomes rewritten to withdrawal-focused language:
  - 菸癮緩解 / 身心舒緩 / 口感接受 / 煩躁緩解
- Gate B failure shows prominent error message

---

## Finale Image Fix

Canvas draw size increased from 160×90 to scale-to-fit (max 320×200, aspect-preserved)

---

## Tests

- `tests/r8_rules.test.cjs` — 12 unit tests (all pass)
- `tests/r7_rules.test.cjs` — 4 tests updated to R8 schema (all pass)
- Total build: 58/58 unit tests pass
- `tests/test_r8_flow.py` — Playwright E2E (FTND, symptoms, tofu/pork, result)

---

## Known Design Decisions

1. FTND 不因吃完一碗麻婆豆腐而改變 — by design; frozen from patient definition
2. R7 metric names (focus, impulsivity, language, memory, sleepiness) are removed from patient data
3. 豆腐/絞肉 disabled buttons retain visual style for clarity
