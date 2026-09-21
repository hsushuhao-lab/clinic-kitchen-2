# Craving Kitchen — R6 診間合併、份量備料、火候收汁、配餐與雙結局

**[直接試玩 GitHub Pages](https://hsushuhao-lab.github.io/clinic-kitchen-2/)**

保留 Q 版可動診間、病人依序叫號、左至右動線及四個合併工作區（問診開單、整合備料、炒鍋烹調、出餐配菜）。病人保留各自服裝的完整半身插畫呈現；辣度／蔥花／飯量／味噌湯為圖像化需求，結算同時比對需求與實際出餐圖示。

## 四大整合工作區與流程
1. **問診開單（診間 X: -10.5）**：走至看診桌按 E 鍵，一次完成問診並開立處方病歷，消除原有多餘電腦桌重複按鍵。
2. **份量備料（備料區 X: -3.5）**：冰箱與備料檯合一，按數字鍵 1–6 選擇食材、Q 鍵循環切換份量（0 / 0.5 / 1 份）、E 鍵切配備妥進入備料盤。
3. **整盤下鍋與火候收汁（炒鍋區 X: 3.5）**：
   - 按 E 鍵一次將備料盤所有食材整盤倒入鍋中（具防連發防抖）。
   - 按 F 鍵循環切換三段火力：**關火 → 小火 → 大火 → 關火**。
   - 等效火候收汁模型：$T_{\text{eq}} = T_{\text{high}} + 0.5 \times T_{\text{low}}$，最佳理想收汁時間為 4 等效秒。
   - 超時每滿 1 等效秒扣 1 分品質扣分（最多扣 20 分）。
4. **出餐配菜與端盤送餐（出餐區 X: 10.5）**：
   - 白飯份量：數字鍵 1（半碗）／2（正常）。
   - 暖心味噌湯：按 Q 鍵切換要／不要。
   - 按 E 鍵盛盤出餐，Q 版醫師進入端托盤模式（carrying tray）。
   - **實體送餐**：醫師必須親自端著托盤走回最左側診間看診桌（X: -10.5），按 E 鍵交給原號病人，配餐檯遠程出餐完全阻斷。

## 渴求量表與雙重結局
- **品嚐判定**：以用餐前後 Craving 相對降幅（$\frac{C_{\text{before}} - C_{\text{after}}}{C_{\text{before}}}$）作為勝負門檻：
  - **成功共餐（$\ge 25\%$）**：觸發診間溫暖同桌共餐慶祝結局，連勝次數 +1，獲得連勝賞金。
  - **翻桌失敗（$< 25\%$）**：觸發病人怒翻桌、紅油熱湯潑灑白袍、醫師腫包揉頭滑稽反思結局，連勝次數重置為 0。
- **無溢出結算介面**：在桌面（1440×900）、平板（768×1024）與手機（390×844、375×667）皆自適應縮放免捲動，點擊「叫下一號」乾淨重置鍋具、火力與湯品。

## 操作鍵位
- **移動**：WASD／方向鍵移動，Shift 跑步。
- **互動**：E 鍵（問診／切配／整盤下料／盛盤出餐／交餐給病人）。
- **備料**：數字鍵 1–6 選食材，Q 鍵切換份量（0 / 0.5 / 1）。
- **火候**：F 鍵循環火力（關火 → 小火 → 大火 → 關火）。
- **配餐**：數字鍵 1 半碗飯、2 正常飯；Q 鍵切換味噌湯（要／不要）。
- **系統**：P 暫停、R 重來、M 靜音。

## 相關文件與驗證
- [R6 完整玩法與數值發布規格](docs/R6_GAMEPLAY_RELEASE.md)
- [R6 需求追蹤矩陣](qa/current/r6/requirements_matrix.md)
- [R5 服務打磨規格](docs/R5_SERVICE_POLISH.md)
- [R4 診間叫號規格](docs/R4_CLINIC_RELEASE.md)
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
