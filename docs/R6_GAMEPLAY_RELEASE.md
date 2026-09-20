# R6 診間合併、份量備料、火候收汁、配餐與雙結局發布文件

基準：R5 `9742719a52ec45ab1739795ef9831e3b47c1e52a`。
正式分支：`main`

---

## 1. 核心流程與新舊對照

| 階段 | R4 / R5 舊流程 | R6 新流程 | 移除的重複互動 / 改進 |
| :--- | :--- | :--- | :--- |
| **問診開單** | 病人椅互動一次 → 電腦桌互動確認第二次 | 診間單一工作區（X: -10.5）一次 E 鍵完成問診並開單 | 移除重複走到電腦桌按 E 的第二道關卡 |
| **取材備料** | 冰箱拿材料 → 走到備料檯切配 | 冰箱與備料檯合併，1–6 選食材、Q 切換份量（0 / 0.5 / 1）、E 切配備妥 | 消除冰箱與備料重複跑動，份量精確記錄進備料盤 |
| **下鍋烹調** | 6 次 E 逐項投料入鍋 | 炒鍋按 E 鍵一次將備料盤全部材料投入熱鍋 | 杜絕重複敲 E 逐項投料，具長按防抖 |
| **火候控制** | 僅單一開關火 | 3 檔循環火候（關火 → 小火 → 大火 → 關火，F 鍵控制） | 建立等效收汁模型 $T_{\text{eq}} = T_{\text{high}} + 0.5 \times T_{\text{low}}$，理想點 4 等效秒 |
| **配餐與附湯** | 僅白飯半碗／正常飯 | 白飯（1: 半碗 / 2: 滿碗）＋ 暖心味噌湯（Q 鍵切換要／不要） | 依病人需求可選熱味噌湯，完整配餐托盤 |
| **盛盤送餐** | 在最右側配餐檯按 E 立即遠程結算 | 盛盤後醫師切換為端托盤（carry）狀態，實體走回最左側診間病人桌（X: -10.5）按 E 交餐 | 恢復「真正端餐走回病人」，配餐檯遠程交餐完全阻斷 |
| **品嚐判定** | 任一失配一律軟槌敲頭 | 依用餐前後 Craving 相對降幅判定：$\ge 25\%$ 成功共餐；$< 25\%$ 翻桌潑灑 | 分離滿意度與勝負，建立真實效果模型 |
| **終局演出** | 單一軟槌敲頭 | 雙結局分支：<br>• 成功：診間溫馨共餐，連勝 +1<br>• 失敗：病患翻桌潑灑紅油熱湯、醫師白袍濺湯頭起腫包揉頭、連勝歸零 | 三位醫師獨立立繪與特徵一致性，支援跳過與 reduced-motion |

---

## 2. 餐點效果與降幅指標規格

### 降幅定義（決策選項 A：用餐前後相對降幅）
- **公式**：
  $$\text{Relative Reduction} = \frac{C_{\text{before}} - C_{\text{after}}}{C_{\text{before}}}$$
- **基準時點**：
  - $C_{\text{before}}$：醫師將餐點端回診間病人桌，按下 E 鍵交付病人品嚐當下的 Craving 值。
  - $C_{\text{after}}$：病人用餐效果結算後的 Craving 值。
- **餐點效果計算純函式**：
  $$C_{\text{after}} = \text{clamp}\left(C_{\text{before}} \times \left(1 - 0.5 \times \frac{\text{mealQuality}}{100}\right), 0, 100\right)$$
- **勝負邊界**：
  - 相對降幅 $\ge 25.0\%$：**成功共餐（FEAST）**，連勝 $+1$，頒發獎金與連勝加成。
  - 相對降幅 $< 25.0\%$：**翻桌失敗（TABLE FLIP）**，連勝歸零，顯示潑灑腫包反思。
  - 當 $C_{\text{before}} = 0$：特殊邊界「已平靜，降幅不適用」，不翻桌、不給降幅賞金。

### 餐點品質配分表（滿分 100 分）
1. **必備食材（15分）**：豆腐（0/0.5/1）、絞肉（0/0.5/1）、豆瓣醬（0/0.5/1）、蒜碎（0/0.5/1）。
2. **份量與客製材料（15分）**：青蔥偏好（要蔥／去蔥）、辣度花椒（正常／重辣）。
3. **翻炒手法（25分）**：推翻勻炒滿 3 次（未滿 3 次每缺一次扣 8 分）。
4. **火候收汁（35分）**：基準 4 等效秒；不足 3.5 秒每差 0.1 秒扣分；超時每滿 1 等效秒扣 1 分（上限 20 分）。
5. **白飯份量（5分）**：半碗飯／正常飯。
6. **味噌湯品（5分）**：要附湯／免附湯。

---

## 3. 美術素材與來源

所有新素材均符合原生 RGBA WebP 規範，嚴禁普通向量覆蓋或低解析拉伸：
- `assets/finale/success_clinic_meal.webp` (576×324 RGBA)：診間溫暖共餐場景。
- `assets/finale/failure_table_flip.webp` (576×324 RGBA)：病人翻桌、紅油熱湯潑灑畫面。
- `assets/finale/doctor_speed_splashed.webp`、`doctor_speed_bump.webp` (320×320 RGBA)：快刀醫師白袍濺湯與頭頂腫包揉頭。
- `assets/finale/doctor_heat_splashed.webp`、`doctor_heat_bump.webp` (320×320 RGBA)：火候醫師白袍濺湯與頭頂腫包揉頭。
- `assets/finale/doctor_strategy_splashed.webp`、`doctor_strategy_bump.webp` (320×320 RGBA)：處方醫師白袍濺湯與頭頂腫包揉頭。
- `assets/service/miso_yes.webp`、`miso_no.webp` (144×120 RGBA)：配餐味噌湯圖示。
- `assets/service/portion_half.webp`、`portion_full.webp` (144×120 RGBA)：配餐飯量與份量圖示。

---

## 4. 驗證與測試報告

- **單元規則測試** (`tests/r6_rules.test.cjs`, `tests/*_rules.test.cjs`)：42/42 通過。
- **靜態完整性** (`tests/smoke_test.py`, `tools/verify_assets.py`, `tools/verify_shift_assets.py`)：通過。
- **打包發布稽核** (`tools/build_web_release.py`)：148 個檔案全數符合白名單。
- **瀏覽器全流程驗收** (`tests/test_r6_flow.py`)：8 大階段全數通過（含 4 種螢幕解析度無溢出）。
- **既有回歸測試** (`tests/test_clinic_flow.py`, `tests/test_service_polish.py`)：100% 通過。
