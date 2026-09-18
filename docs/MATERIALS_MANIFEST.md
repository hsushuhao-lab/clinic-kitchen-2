# 材料分流

| 類別 | 位置 | 用途／狀態 |
|---|---|---|
| 功能原型 | index.html、styles.css、r2-fixes.css、src/main.js | 2D／CSS；不是3D成品 |
| 七張原圖 | assets/art_direction/approved | 原始PNG，保持完整解析度與位元組 |
| 七張縮圖 | assets/art_direction/web | 1200px以下JPEG，僅閱覽 |
| 六張舊候選图 | assets/candidates | 構圖／裁切候選，不是模型與正式動畫 |
| 美術檢查 | art-review.html、assets/manifest.json | 圖像解碼、尺寸、SHA-256 |
| 驗證 | tests、qa/baseline、qa/current | 靜態檢查／瀏覽器功能測試與前後圖 |
| 任務交班 | docs/AGENT_PROMPT.md、DESIGN_SPEC.md | 最新規劃與明確驗收 |
| 新 repo 推送 | tools/publish_main.py | 使用使用者本機 gh 登入，只 push main |
| 私人與歷史 | 另份 private-history ZIP | 不在 source repo，不發布到公開GitHub |

目前 production 3D models = 0。封包保存了美術，不代表美術已整合成可用的3D遊戲。舊 repository 本輪只接收原型修復與文字交班，完整二進位素材新 repo 推送仍需目的地權限。
