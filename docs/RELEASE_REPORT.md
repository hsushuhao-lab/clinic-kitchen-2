# R2 發布與驗證報告 — 2026-09-18

## 已成功推送的遠端
現有 repository：`hsushuhao-lab/hao_hw`，分支 `main`。
Commit：`d92fc0ee13a36a1ed48d53d27d66eb03bb471123`。

本次使用一般非強制 ref 更新，沒有新增／刪除分支，沒有修改其他 repository。

- Commit：https://github.com/hsushuhao-lab/hao_hw/commit/d92fc0ee13a36a1ed48d53d27d66eb03bb471123
- CI：https://github.com/hsushuhao-lab/hao_hw/actions/runs/35352486731
- CI evidence：https://github.com/hsushuhao-lab/hao_hw/actions/runs/35352486731/artifacts/10550740832

## 已執行的驗證
本機靜態檢查：17 個唯一 DOM IDs、3 個本地 script/style 檔案存在、Node 語法檢查通過。
本機圖片檢查：20 張完整解碼、SHA-256、bytes、尺寸全部符合 manifest；其中 7 張原始 PNG 為 1448×1086 或 1536×1024。
本機 Chromium 行為測試：24/24 通過。此環境 localhost HTTP 受政策限制，所以本機使用真實 source inline 渲染；未把此結果稱為 HTTP 驗證。

GitHub Actions 同一 commit：**SUCCESS**。實際啟動 Python HTTP server，使用 Chromium 143.0.7499.4 + Playwright 1.57.0，執行 24 項瀏覽器檢查並保存四張截圖及 JSON。
CI 回傳文字：`Browser QA PASS: 24 checks; transport=http://127.0.0.1:8000/`。

已取回 CI artifact 並驗證其 SHA-256：
`4e7a5bed54eb2b7c63ff57baa4f7949bd298649e2b7c6d1151ea559fdcfb1e3d`。
其中 index.html、styles.css、r2-fixes.css、src/main.js 的 SHA-256 與本 source 包逐一相符。
證據在 `qa/github-ci/`；本機 inline 證據在 `qa/release-local/`；舊版缺陷在 `qa/baseline/`。

沒有執行公開 raw.githack CDN 的端對端瀏覽器測試；不能把 CI 的本機 HTTP 結果宣稱為 CDN 已驗證。

## 新 repository 與素材發布的邊界
預定新 repo：`hsushuhao-lab/clinic-kitchen-2`。本輪 connector get_repo 回傳404，也未列於可存取清單；可能尚未建立或尚未授權，不能斷言不存在。本輪沒有成功建立新 repository，也沒有把完整原圖二進位素材上傳至新的目的地。

現有公開 `hao_hw/main` 只接收原型程式、測試、CI與文字交班。完整20張素材在獨立 source ZIP／main bundle；私人真人照片、舊版本ZIP與歷史QA另外隔離在private-history ZIP。

獨立 source 包的根目錄 CI `.github/workflows/qa.yml` 尚未在新 repo 執行；本輪通過的是舊 repo `.github/workflows/ck2-main-qa.yml`。兩者不可混稱。

`tools/publish_main.py` 為本機授權 GitHub CLI 使用者準備；此處只做Python語法檢查，沒有以它成功建立／推送新 repo。腳本不force push、不替換錯誤origin、不刪其他分支、不修改既有repo可見性。使用 `--create` 時才嘗試建立私人repo。

## 遊戲完成度
本次為2D原型缺陷修復，不是3D重製成品。3D模型數量：0。
前診間／中過渡／後廚、上方移動／下方料理的最終規格保留；寫實角色骨架、3D場景、病人問診、處方、上方與下方任務耦合、托盤與第一口動畫，均未完成。

技術測試PASS不能替代寫實美術或玩法驗收。
