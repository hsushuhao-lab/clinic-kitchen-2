# Clinic Kitchen 2.0 — R2 重製整合包

**本包：可驗證的 2D 功能原型 + 完整美術原稿 + 3D 製作交班，不是完成的 3D 遊戲。**

先讀 [交班入口](docs/00_START_HERE.md)、[AGENT 指令](docs/AGENT_PROMPT.md) 與 [目前狀態](docs/CURRENT_STATUS.md)。

## 本機執行
```sh
python -m http.server 8000 --bind 127.0.0.1
```
開啟 `http://127.0.0.1:8000/index.html`；美術原稿頁為 `art-review.html`。
上方 WASD／方向鍵移動，E 檢視附近物件；下方備料、開火、下鍋、翻炒與盛盤。R 清空整個原型的探索和料理狀態。手機尚未提供觸控移動控制；窄螢幕測試只代表版面可見。

## 本輪修正
- 上方移動與下方料理同時在首屏；下方必要時內部捲動。
- 正確鏡頭邊界；窄螢幕主角不再出現在畫面外。
- 盛盤須含豆腐、絞肉、豆瓣醬、蒜，開火並翻炒三次；新食材下鍋須重新翻炒。
- 關火不可翻炒；完成後不能重複盛盤；R 可開始第二輪。
- 基本腳部家具碰撞、按鍵失焦清除與按時間計算移動。

## 測試
```sh
python -m pip install -r requirements-qa.txt
python -m playwright install chromium
python tests/smoke_test.py
python tools/verify_assets.py
python tests/browser_qa.py --base-url http://127.0.0.1:8000/
```
`--inline` 可離線執行瀏覽器行為測試；此模式不代表 HTTP／CDN 測試。

## 新 repository 發布
目的地預定 `hsushuhao-lab/clinic-kitchen-2`，只推送 main。準備好 Python、Node.js、Git、GitHub CLI，先用自己的帳號執行 `gh auth login`。
```sh
python tools/publish_main.py --create
```
`--create` 明確授權使用本機登入建立 private repo；已建立時省略即可。腳本驗證素材與語法後，只做一般 main push 並比對遠端 SHA。不改公開性、不 force push、不刪除現有 branch、不修改舊 repository。

截至本次核對，新 repo 回傳 404／未列於已授權清單；本包並未宣稱新 repo 已成功建立或完整素材已在線上。

## 美術與隱私
`assets/art_direction/approved/` 保存七張原始 PNG；`web/` 是閱覽縮圖；`assets/candidates/` 是舊候選 raster，不是模型。`assets/manifest.json` 記錄每個檔案的完整雜湊與尺寸。
真人參考照、舊 ZIP 與歷史 QA 另存 private-history 封包，不在本 repo／本包 Git 歷史。沒有賦予來源未知的候選素材開源授權。

## 本輪遠端驗證
原型修復已推送到現有 `hao_hw/main`，commit `d92fc0ee13a36a1ed48d53d27d66eb03bb471123`。同一commit的GitHub CI已從HTTP執行24項Chromium檢查通過，並取回截圖。
完整證據與新repo／二進位上傳邊界見 [RELEASE_REPORT.md](docs/RELEASE_REPORT.md)。
