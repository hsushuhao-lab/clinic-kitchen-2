# Workspace R1 — 診間與料理呈現修正

## 本輪範圍

上一輪使用半身像當移動角色、矩形格線當診間、帶料盤/照片背景的食材。這些問題不能靠修改副檔名或通過 smoke test 解決。

本轮保留上方診間/下方料理的 1:2 畫面與核心規則；改的是呈現：

- 上方使用核准原稿中診間、收納、備料、爐台的四個插畫視角，沒有把整張設定海報當背景。
- 滑動半身像停止顯示，改為明確的「位置導引」。原本 WASD、連續移動、路徑、家具碰撞與到站才能操作的限制維持；位置指示不是全身行走動畫。
- 砧板上使用有透明背景的散放食材。豆腐由同一像素來源分成完整/對半/條狀，最後使用原稿豆腐丁；蔥花與蒜末不再帶著金屬料盤。
- 炒鍋、爐台與鍋鏟改為同一尺度的組合；鍋內食材使用持久 DOM 節點與去背素材。燜煮只替換鍋內食物，不再把另一張完整炒鍋照片蓋在場景上。
- 清除湯匙圖的旁邊器具碎片；選擇豆瓣才顯示湯匙，空砧板不殘留它。
- 工作區改成連續的淺色金屬檯面與較少的邊框；訂單、操作、完成狀態仍可辨識。

## 明確未完成

本版仍是 2D 插畫介面，不是精緻寫实全身角色完成版。沒有新的人體姿勢、手部操刀骨架、走路/坐下/進食動畫；四個環境视角是同一核准美術中的不同裁切，不是新建的連續 3D 場景。原料小圖仍受原始解析度限制，不能宣稱已重製為高解析模型。

角色選擇與對話仍保留前次核准原稿立繪。不新增第二道料理，不修改 Craving、Focus、分數、時間或配方；`src/main.js` 與 `src/shift-rules.js` 原檔未改動。

## 可重建素材

`python tools/build_workspace_art.py` 建立 21 個 WebP 衍生檔。來源是 repo 內完整核准環境/道具 PNG 及既有原料圖；原稿均不覆寫。遮罩使用人工輪廓或 alpha 連通區，不用 RGB 亮度閾值刪除金屬高光。manifest 記錄 source SHA-256、crop/polygon、輸出尺寸/透明度與完整 SHA-256。

`python tools/verify_workspace_art.py` 檢查真實解碼、來源雜湊與 alpha，不降低 KB 門檻來宣告畫質達標。

建置從上述 Git 來源自動產生實際 WebP 並包入 Pages；不必人工傳輸大型 base64。QA artifact 的 `workspace/asset-provenance.json` 是本次建置的來源清單。公開 build-info 列出每個 runtime 檔案的完整 hash。

## 驗證與美術驗收分開

- `tests/test_flat_clinic.py`：原有實際鍵盤/指標完整流程，不以跳關代替。
- `tests/test_character_art.py`：三醫師、四視窗尺寸與對話。
- `tests/test_workspace_visuals.py`：HTTP 圖像/版面 fixtures，刻意設置狀態來拍圖，不把它當作走路流程測試。
- 相同 commit 的 Pages 部署與 Public game verification 通過，才可以說已上線。

自動測試通過不等於使用者已核准美術；本輪狀態是 **VISUAL REVISION / USER ART REVIEW PENDING**。
