# R4 診間叫號與單一工作區

本輪由 `b8fd5d9` 接續；不改三位 Q 版醫師的角色／走跑圖集、不換畫風、不新增料理。

## 本次實作
- 左側固定本號、病人姓名／肖像、麻婆豆腐需求、Craving/Focus 與下一位候診。手機改成頂端精簡列，避免擠壓移動區。
- 病人 → 電腦 → 冰箱 → 備料 → 炒鍋 → 配飯／出餐，六站依 x 座標由左至右。清除前景床、推車式收納櫃與餐桌的畫面和碰撞；保留牆邊操作站與家具碰撞。
- 六種病人依序叫號；每位都有固定且現有材料可達成的正常辣／重辣、蔥花與飯量需求。玩家不可把病人需求改成容易版本，實際配料仍由玩家選擇。
- 下方一次只顯示備料、炒鍋或配飯出餐之一。到站會切換，也可切頁預覽，但不到站不能操作。
- 精準條桌面 30px、手機 25px；游標來回週期由 1.6s 改為 2.4s（速度減少 33.3%）。命中區及原本不硬卡關／防刷分規則不變。
- 收汁完成後可先關火，向右去配飯。出餐時一次完成計分、關火及停止移動，直接呈現需求／實際內容／差異／得分，不必端餐再走回去。
- 結果是獨立、不可意外 Esc 關閉的原生對話框，不捲動；「叫下一號」一次完成結算離開與新病人叫號。錯誤飯量、蔥花、辣度及過火依原有扣分比例計算，不是固定 100%。
- 三單晚班與原有動態音樂保留。完整三單後再開一班；音樂只有原有一個 AudioContext/scheduler。

## 來源與技術界線
`src/clinic-rules.js` 共用站點與偏好／評分；`src/clinic-flow.js` 使用既有 classic-script 公開函式的整合點（handleInteraction/updateCooking/resetAll/tick），沒有複製整個料理引擎。`src/main.js`、R3 音樂程式與醫師被動能力未修改。

`tools/build_clinic_assets.py` 使用 repo 原有完整核准 `patient_npcs.png` 裁出六張肖像。六種坐姿病人沿用已驗證的四格身體，改用對應頭部；這不是六套全新獨立動畫，也不是新生成高解析模型。完整原稿不覆寫。來源 SHA-256、裁切座標、尺寸與輸出 hash 在建置的 `assets/clinic/manifest.json`；Pages 僅攜帶衍生圖。

## 驗收如何替換舊流程
R2/R3 舊瀏覽器測試要求「玩家可編輯問診偏好／電腦在病人左側／送餐走回病人」，與本次使用者要求相反，保留在 repository 作歷史參考，不再用那些斷言判定 R4 成功。

目前 gate：原有 source/art integrity；原有 shift 與 rush 純規則測試（僅調整 precision 週期相關預期）；新增 clinic 純規則測試；`test_clinic_flow.py` 從實際 keyboard/pointer 走完整普通訂單＋三單晚班，驗證角色、偏好、錯飯扣分、站點限制、單頁、終局凍結、叫下一號、手機操作、聲音及五種視窗尺寸。不用傳送或直接改任務階段代替流程。

`--inline` 是本機離線傳輸，不算 HTTP 或線上驗證。CI 從 web-dist HTTP 執行，通過才部署 Pages；Public game verification 另比對實際公開 source_commit 與每個檔案 hash，再跑同一套互動測試。發布狀態以同一 commit 的 Actions 為準。

```sh
python tools/build_web_release.py
python -m http.server 8000 --bind 127.0.0.1 --directory web-dist
python tests/test_clinic_flow.py --base-url http://127.0.0.1:8000/
```
