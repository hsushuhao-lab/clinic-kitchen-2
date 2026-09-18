# 實際狀態：Clinic Kitchen 2.0 (3D Scene & 8-Stage Mission Completed)

## 已有（Gate 1 ~ Gate 3 已完成）
- **即時 3D 引擎與連續場景**：內建 Three.js WebGL 渲染管線 (`src/three.min.js`, `src/scene3d.js`)，診間 (X: -12~-3) → 備料過渡區 (X: -3~+3) → 後廚 (X: +3~+13) 物理連續可探索空間，具備 PBR 材質、冷白／過渡／暖色三段光照、動態炒鍋火光、AABB 家具碰撞體與第三人稱跟隨視角。
- **真實 3D 角色與環境 GLB 模型**：
  1. `assets/models/environment/clinic_kitchen_scene.glb` (196,980 bytes, 雜湊通過)
  2. `assets/models/characters/dr_speed_placeholder.glb` (45,244 bytes, 雜湊通過)
  3. `assets/models/characters/patient_office_placeholder.glb` (15,652 bytes, 雜湊通過)
  - 均納入 `assets/manifest.json` 與 `tools/verify_assets.py` 嚴格校驗。
- **角色規格與 3D Turnaround 多視角圖**：
  - Dr. Speed 成人寫實比例 (1.78m)、短黑髮、黑框眼鏡、醫師白袍、內搭襯衫與胸牌，產出 5 視角展示板及規格 JSON (`assets/characters/dr_speed/dr_speed_turnaround_sheet.png`)。
  - 上班族病患成人寫實比例 (1.72m)、深藍商務西裝、藍領帶、坐姿就診，產出 5 視角展示板及規格 JSON (`assets/characters/patient_office/patient_office_turnaround_sheet.png`)。
- **統一 8 階段任務狀態機**：
  1. `STAGE_CONSULT`：診間病人椅靠近問診對話彈窗
  2. `STAGE_ORDER`：醫師桌／料理處方機開單出單
  3. `STAGE_GATHER`：過渡區低溫冷藏冰箱取出食材
  4. `STAGE_PREP`：備料檯切配豆腐、絞肉、豆瓣醬、蒜
  5. `STAGE_COOK`：炒鍋爐台開火、下鍋並翻炒 3 次
  6. `STAGE_PLATE`：盛盤出鍋裝入青花瓷碗，主角切換托盤端餐姿態
  7. `STAGE_SERVE`：端托盤返回診間病人椅送餐
  8. `STAGE_FIRST_BITE`：病患第一口品嚐回饋、舒壓滿意度 100% 評分、虛構舒壓料理聲明
- **全自動化 QA 測試鏈**：
  - `tests/smoke_test.py` (36 DOM IDs, 語法校驗 PASS)
  - `tools/verify_assets.py` (20 圖檔, 7 原稿, 3 GLB 模型 PASS)
  - `tests/test_initial_viewport.py` (1440, 768, 390 視口 PASS)
  - `tests/browser_qa.py` (24/24 瀏覽器烹飪面板測試 PASS)
  - `tests/test_full_mission_chain.py` (37/37 全流程 8 階段 Playwright 測試 PASS)

## 設定聲明
- 麻婆豆腐為虛構遊戲舒壓料理設定，提供感官撫慰與心理放鬆，非臨床醫療處方，不具戒菸或戒斷醫療療效。

## 後續待推進（Gate 4 擴展）
- 擴增 Dr. Heat、Dr. Strategy 兩位角色獨立模型與切換機制。
- 擴增第二道料理食譜與完整食材物理動態。
- 音效與手機螢幕虛擬搖桿支援。
