# Craving Kitchen — 平面診間 × 麻婆豆腐

**[線上遊戲：GitHub Pages](https://hsushuhao-lab.github.io/clinic-kitchen-2/)**

本版依最新確認的設計改成：上方 1/3 固定平面診間、下方 2/3 備料／炒鍋／配飯裝盤。移除重複的料理工作台標題與分頁列，保留三位醫師选择、Craving／Focus、分數、出餐與連勝。

W/S/A/D 上下左右；可點地圖工作站走過去，抵達後 E 互動。P 暫停、R 重來。醫師在接單前選擇；手機按地圖站點行走，抵達後下方呈現對應料理區。

美術使用原本核准設定稿的 UI 立繪及輪廓去背器具；不是新生成的高解析模型。Craving 與料理都是虛構遊戲規則，不是醫療療效。

詳見 [本輪發布範圍](docs/FLAT_CLINIC_RELEASE_20260919.md)。只有 main 作為開發與發布線。舊 AppDeploy 固定版本不作為最新版驗收入口。

## 執行與驗證
```sh
python -m pip install -r requirements-qa.txt
python -m playwright install chromium
python tests/smoke_test.py
python tools/verify_assets.py
python tools/verify_shift_assets.py
node --test tests/shift_rules.test.cjs
python tools/build_web_release.py
python -m http.server 8000 --bind 127.0.0.1 --directory web-dist
# 另一個終端執行：
python tests/test_flat_clinic.py --base-url http://127.0.0.1:8000/
```
原本 3D 程式、模型與測試保留供歷史參考，目前首頁不載入 Three.js 或 GLB。

---
## 歷史說明（以下不代表目前介面）

# Clinic Kitchen 2.0

## 線上試玩（最新發布版本）

- **[GitHub Pages 最新線上遊戲（自動部署最新 main）](https://hsushuhao-lab.github.io/clinic-kitchen-2/)**
- **[AppDeploy 託管版本](https://clinic-kitchen-2-0-rnbvw5.v2.appdeploy.ai/)**

倉庫已由擁有者改為 Public，main 為唯一開發與發布分支。

- **畫面架構**：上方即時 3D 診間／備料過渡區／後廚連續空間，下方寫實砧板切配、炒鍋翻炒與盛盤出鍋。
- **操作控制**：WASD／方向鍵移動（W 向深處、S 朝鏡頭、A 向左、D 向右），Shift 快走，E 互動，R 重置。四肢步行動畫與端托盤平舉姿態已同步。
- **寫實料理**：豆腐 3 步切骰子丁、蔥切蔥花、蒜拍碎切蒜末、絞肉分切，豆瓣醬以湯匙舀取（非刀切）；炒鍋黑鐵材質、瓦斯爐火苗、金屬料理鏟翻炒推進（肉色焦香、紅油裹附、滾沸收汁），盛盤至青花瓷碗並配搭越光米飯托盤。
- **工作站限制**：問診 → 處方單 → 取材 → 備料檯切配 → 炒鍋翻炒 → 盛盤出鍋 → 端餐送回診間 → 第一口品嚐回饋。未達工作站半徑不可隔空操作。
- **安全發布邊界**：僅載入白名單 runtime 檔案與 GLB 模型，不包含私有參考照或歷史資料。


---

## 以下為 R2 整合包的歷史交班紀錄

下方「2D」「repo 未建立」「Private」「舊 hao_hw」等敘述保留原始交班背景，不代表目前倉庫或線上發布狀態；目前狀態以上方發布段落為準。

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
