# AGENT 執行指令 — Clinic Kitchen R2

你是遊戲工程师與技術美術。先讀 README、CURRENT_STATUS、DESIGN_SPEC，以及 assets/manifest.json，開 art-review.html 查看七張原稿。不要拿舊版「PASS」文字當成做完的證據。

## 路徑與分支
整合包 root 是獨立專案；預定新 repo 為 hsushuhao-lab/clinic-kitchen-2，僅使用 main。舊 repo hsushuhao-lab/hao_hw/CK 是暫存原型與發布資料來源，不要把整合包根目錄覆蓋到舊 repo 根目錄。新 repo 未授權時停在推送步驟，回報具體錯誤；不得使用舊 repository token 嘗試跨帳號／跨 repository 管理權限。

## 先驗證
安裝 requirements-qa.txt 與 Chromium 後執行：
```sh
python tests/smoke_test.py
python tools/verify_assets.py
python -m http.server 8000 --bind 127.0.0.1
# 第二個 terminal
python tests/browser_qa.py --base-url http://127.0.0.1:8000/
```
看 1440×900、768×1024、390×844 的實機截圖。不能只看語法或 HTTP 200。

## 已知基線
這是一個 CSS／DOM 2D 原型，並沒有 3D 模型。R2 的24項瀏覽器檢查只涵蓋版面、按鍵移動、配方條件、關火、盛盤與重置。assets/candidates 中的 WebP 是候選圖；不能冒充已建模角色。

## 第一個真正製作 Gate
保持上方移動／下方備料煮菜。先對即時引擎與部署途徑提出一個最小方案，再製作可走入的診間—過渡區—後廚。場景必须有真正幾何、碰撞、材質與光線；提交模型來源、實際 runtime 引用、可走通路徑影片／截圖。不准只換頁面標題、不准再堆 CSS 圓角或背景設定圖充當場景。

## 美術交付
每個角色、每個場景、每個食材分開製作。先 DR. SPEED：成人比例、髮型／眼鏡／白袍／內搭固定；正反側與3/4稿；模型、骨架、PBR貼圖；idle/walk/sit/talk/pickup/carry/prep/cook/serve。先通過一位才擴第二位。原稿 UI board 的精緻感是目標，不是可貼在螢幕上冒充互動的素材。

## 任務交付
一位病人問診—處方—後廚取材—備料—麻婆豆腐—搬運—上菜—第一口。上方站點與下方操作必須共享任務狀態；目前它們是獨立的，需要真正接起來。禁止第二道菜與無關功能。

## 測試與發布
每個 bug 先寫可重現測試。保留既有配方、關火、重置、窄螢幕與第二次遊玩回歸測試。新的3D引用不能破檔、缺材質、無動作。SHA-256 對照原稿，完整解碼，不以「超過幾 KB」替代檢查。推送後確認 remote main SHA，再確認同一 SHA 的 CI，最後開實際試玩網址。沒有真的看過的畫面不得宣稱已試玩。

## 隱私
私人照片與舊封包另在 private-history ZIP，不進公開 repo、不進靜態站。需要人物參考時由 PI 提供，模型不得從外觀推論真人姓名。不得公開歷史 ZIP 內未審核素材。來源不明不能自行指定 MIT 等授權。

## 最終回報
分開列出：遊戲實作、視覺進度、素材完整度、CI、實際網站、新 repository 發布。附精確 commit、測試命令和結果、1440／768／390 截圖、原始碼與素材manifest、剩餘限制。只有文件更新不能稱為遊戲完成；只有旧 repo 更新不能稱為新 repo 已建立。
