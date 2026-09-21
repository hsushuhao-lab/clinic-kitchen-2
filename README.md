# Craving Kitchen — R8 尼古丁依賴臨床診斷、急性戒斷症狀與處方料理評估

**[直接試玩 GitHub Pages](https://hsushuhao-lab.github.io/clinic-kitchen-2/)**

保留 Q 版可動診間、病人依序叫號、左至右動線及四個合併工作區（問診開單、整合備料、炒鍋烹調、出餐配菜）。R8 全面升級為「尼古丁依賴臨床診斷」三層架構：FTND 基線卡、急性戒斷症狀量表、處方料理烹調評估。

## R8 三層臨床診斷架構
1. **基線依賴程度（FTND 6 題評估卡）**：
   - 包含吸菸史、起床首菸時間、禁菸場所忍受等 6 項題目，計算 0–10 分總分與重度判定（輕度／中度／重度）。
   - **凍結不變**：FTND 代表長期依賴基線，餐前餐後永遠保持不變。
2. **急性戒斷症狀剖面（7 大向度 0–4 量表）**：
   - 包含 Craving（渴求感）、Irritability（易怒）、Anxiety（焦慮）、Concentration（注意力渙散）、Restlessness（坐立難安）、Appetite（食慾）、Sleep（睡眠困擾）。
   - 用餐前顯示急性戒斷指數，用餐後依據料理處方與烹飪品質動態改善。
3. **料理處方與烹飪執行（Gate B 處方忠實度）**：
   - **基底食材**：豆腐與絞肉固定各 1 份，不可調整。
   - **症狀對應調味**：
     - 豆瓣醬 $\rightarrow$ Craving
     - 蒜 $\rightarrow$ Irritability
     - 辣椒 $\rightarrow$ Restlessness
     - 花椒 $\rightarrow$ Anxiety
     - 蔥花 $\rightarrow$ Concentration
   - **配餐對應**：
     - 白飯份量（正常／半碗） $\rightarrow$ Appetite
     - 味噌湯（附湯／不要湯） $\rightarrow$ Sleep
   - **嚴格評分與處方門檻（Gate B）**：
     - 調味份量誤差 0.5 份扣 12 分、誤差 1.0 份扣 25 分。
     - 白飯不符扣 25 分、味噌湯不符扣 18 分。
     - **處方忠實度（Prescription Fidelity）必須 $\ge 70\%$**，否則判定為處方失敗（hardFail），直接觸發翻桌結局。

## 四大整合工作區與流程
1. **問診開單（診間 X: -10.5）**：走至看診桌按 E 鍵，檢視病人 FTND 基線與急性戒斷症狀，開立料理處方。
2. **份量備料（備料區 X: -3.5）**：豆腐與絞肉固定備妥，按數字鍵 3–7 選擇調味食材、Q 鍵循環切換份量（0 / 0.5 / 1 份）、E 鍵切配備妥進入備料盤。
3. **整盤下鍋與火候收汁（炒鍋區 X: 3.5）**：
   - 按 E 鍵一次將備料盤所有食材整盤倒入鍋中。
   - 按 F 鍵循環切換三段火力：**關火 → 小火 → 大火 → 關火**。
   - 等效火候收汁模型：$T_{\text{eq}} = T_{\text{high}} + 0.5 \times T_{\text{low}}$，最佳理想收汁時間為 4 等效秒。
   - 超時每滿 1 等效秒扣 1 分品質扣分（最多扣 20 分）。
4. **出餐配菜與端盤送餐（出餐區 X: 10.5）**：
   - 白飯份量：數字鍵 1（半碗）／2（正常）。
   - 暖心味噌湯：按 Q 鍵切換要／不要。
   - 按 E 鍵盛盤出餐，Q 版醫師進入端托盤模式（carrying tray）。
   - **實體送餐**：醫師必須親自端著托盤走回最左側診間看診桌（X: -10.5），按 E 鍵交給原號病人。

## 操作鍵位
- **移動**：WASD／方向鍵移動，Shift 跑步。
- **互動**：E 鍵（問診／切配／整盤下料／盛盤出餐／交餐給病人）。
- **備料**：數字鍵 3–7 選調味食材，Q 鍵切換份量（0 / 0.5 / 1）。
- **火候**：F 鍵循環火力（關火 → 小火 → 大火 → 關火）。
- **配餐**：數字鍵 1 半碗飯、2 正常飯；Q 鍵切換味噌湯（要／不要）。
- **系統**：P 暫停、R 重來、M 靜音。

## 相關文件與驗證
- [R8 完整玩法與數值發布規格](docs/R8_GAMEPLAY_RELEASE.md)
- [R8 需求追蹤矩陣](qa/current/r8/requirements_matrix.md)
- [R7 臨床烹飪重構規格](docs/R7_CLINICAL_COOKING_SPEC.md)
- [R6 完整玩法規格](docs/R6_GAMEPLAY_RELEASE.md)
- [核准原稿素材](assets/art_direction/approved/)
- [GitHub Actions CI / CD](https://github.com/hsushuhao-lab/clinic-kitchen-2/actions)

```sh
# 安裝依賴與瀏覽器
python -m pip install -r requirements-qa.txt
python -m playwright install chromium

# 單元與靜態測試
node --test tests/*.test.cjs
python tests/smoke_test.py
python tools/verify_assets.py
python tools/verify_shift_assets.py

# 本地建置與端到端瀏覽器驗證
python tools/build_web_release.py
python -m http.server 8000 --bind 127.0.0.1 --directory web-dist
# 另一終端：
python tests/test_r6_flow.py --base-url http://127.0.0.1:8000/
python tests/test_clinic_flow.py --base-url http://127.0.0.1:8000/
python tests/test_service_polish.py --base-url http://127.0.0.1:8000/

# 線上環境核驗
python tools/verify_public_build.py
```

發布由 main 的 CI 建置原生 WebP 圖片，嚴格檢驗 R6 全流程、端盤走動送餐與雙結局渲染無溢出後部署。遊戲設定不代表麻婆豆腐具有戒菸療效。
