# CK 重製版最後衝刺清單（可發布版）

## /goal
上方必須是真正可操作的連續診間：三位 Q 版全身醫師可走、可跑、可轉向，移動至病人、醫師桌、冰箱、備料檯、炒鍋與配飯區才能互動；下方保留既有麻婆豆腐料理流程。禁止再次以四張導覽圖、位置圓點或滑動半身立繪替代人物。

## 實作清單
- [x] 連續 2D 診間／備料／廚房空間，家具獨立圖層與腳部深度排序。
- [x] 三位醫師各有完整頭、白袍、雙手、雙腿、鞋子與獨立 atlas。
- [x] 每人四方向：south / west / east / north；背面重新繪製，不貼舊髮絲方塊。
- [x] 每方向 idle 2、walk 6、run 6、carry 6、work 4，共 96 格／人，三人合計 288 格。
- [x] WASD／方向鍵，Shift／跑步鍵，E／互動鍵；手機方向按住走、鬆開停、鏡頭跟隨。
- [x] 家具碰撞、世界邊界、不能隔空備料／烹調；按工作站是走過去，不是傳送。
- [x] 暫停冻结位置與動畫；重來清空路徑、端餐與跑步切換狀態。
- [x] 下方切配／翻炒會觸發上方 work；盛盤後有雙手端餐，回病人旁完成送餐。
- [x] 新版建置包含全部 16 個 chibi 圖檔；保留核准完整原稿，不公開私有參考照片。
- [x] 加入素材完整解碼、透明度、來源 SHA-256、四方向、非重複動作與腿部影格驗證。
- [x] 保留原有料理、角色選擇與工作區回歸測試，新增 16 組 Q 版操作驗收。

## 發布閘門（以同一 commit 的 Actions 結果為憑證）
1. Source / rules / existing art checks 與 build_web_release 成功。
2. runtime-only HTTP 執行 test_flat_clinic、test_character_art、test_workspace_visuals、test_chibi_world，全部成功才 deploy。
3. Pages 部署成功後，Public game verification 比對公開 build-info.json 的 source_commit 與每個 runtime hash，再操作完整料理與 Q 版移動／端餐測試。

本文件記錄已實作的清單，不拿本機離線測試代替 HTTP 或公開網站驗證。最新狀態見 [Actions](https://github.com/hsushuhao-lab/clinic-kitchen-2/actions)。

## 重建／AGENT 接手
```sh
python -m pip install -r requirements-qa.txt
python -m playwright install chromium
python tools/build_web_release.py
python -m http.server 8000 --bind 127.0.0.1 --directory web-dist
# 另一終端：
python tests/test_flat_clinic.py --base-url http://127.0.0.1:8000/
python tests/test_character_art.py --base-url http://127.0.0.1:8000/
python tests/test_workspace_visuals.py --base-url http://127.0.0.1:8000/
python tests/test_chibi_world.py --base-url http://127.0.0.1:8000/
```
先讀本頁，再讀 tools/build_chibi_world.py、src/scene2d.js 與 tests/test_chibi_world.py。不得退回位置導引版，不新增第二道料理，不改配方或分數來讓測試通過。修改後必須比對遠端 main SHA 與 Pages source_commit。

## 美術範圍
Q 版醫師使用核准圖中原有 Q 版頭像，加上此版本繪製的可分節運動身體。場景使用原稿家具裁切與相同色系補繪；它是可玩 2D raster sprite 版本，不是 3D 或逐格手繪動畫大作。選角與對話保留半寫實立繪。病人目前整合一位坐姿角色；尚未擴充六位全動作病人。美術精修仍由使用者驗收，技術測試不代表美術已被核准。
