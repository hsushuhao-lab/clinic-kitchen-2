# 精緻寫實人物插畫整合 — 2026-09-19

## 範圍
本輪沿用最新 `clinic-kitchen-2/main` 的平面診間與料理版面，不恢復舊 hao_hw/ck-game 的儀表板，也不改回 3D。

修正選角視窗缺少 `doctor-dialog`、三個按鈕缺少 `doctor-option` 的真實缺陷；補上原稿半身立繪、合理圖文欄位、手機直列卡片。看診及第一口回饋顯示當前醫師與病人插畫，地圖改用等比例半身立繪標記。原有走路、碰撞、工作站限制、切配、炒鍋、配飯、暫停與評分規則不變；`src/main.js` 與 `src/shift-rules.js` 沒有修改。

## 圖像不是縮圖冒充原稿
原始 `assets/art_direction/approved/doctor_concepts.png`、`patient_npcs.png` 保持完整 1448×1086，不覆寫。擷取只使用大型寫實人物區域，不使用底部 Q 版區。

| 衍生立繪 | 原生裁切尺寸 |
|---|---|
| doctor-speed-bust.webp | 370×361 |
| doctor-heat-bust.webp | 382×426 |
| doctor-strategy-bust.webp | 367×424 |
| patient-office-bust.webp | 319×304 |

它們是抗鋸齒輪廓遮罩的 RGBA、WebP quality 96，沒有重新生成臉、沒有放大原生像素、沒有用亮度閾值刪白袍。它們仍是 **2D 半身插畫**；不是新增 3D 模型、全身行走、獨立表情或進食逐格動畫。

## 建置與線上資產
```sh
python tools/build_character_portraits.py
python tools/verify_character_assets.py
python tools/build_web_release.py
```
建置自動從已在 GitHub 的完整 PNG 產生四個 `assets/ui/*-bust.webp`；GitHub Pages 發布包含這四個真正圖檔，不依賴對話附件、外部圖片 URL 或執行時裁整張海報。

完整圖像追溯資料由建置寫入 `assets/ui/character-manifest.json`，並複製到 QA artifact 的 `characters/asset-provenance.json`：來源 SHA-256、裁切框、輪廓點、輸出尺寸、完整輸出 SHA-256。`build-info.json` 同樣登記所有發布圖像的 bytes/hash。

驗證檢查實際解碼、透明度、原生尺寸、來源雜湊和不透明區域 RGB 像素誤差，不靠任意 KB 門檻判定品質。

## 驗證
本機離線瀏覽器檢查不冒充 HTTP 驗證。CI 從 runtime-only HTTP root 執行既有完整料理流程與新增 `tests/test_character_art.py`，通過才執行 Pages 部署。

新增檢查包含：4 個視窗尺寸的選角不溢出、3 位醫師對話對應正確、未確認偏好取消不改單、手機確認/關閉可達、圖像解碼、對話插畫不重複。舊完整流程測試保留。

部署狀態以相同 commit 的 `Runtime-only web release audit` 與 `Public game verification` 為準，不以文件標題宣稱已上線。

最新試玩：https://hsushuhao-lab.github.io/clinic-kitchen-2/
