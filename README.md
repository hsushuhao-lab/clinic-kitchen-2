# Craving Kitchen — Q 版可動診間 R2

**[直接試玩 GitHub Pages](https://hsushuhao-lab.github.io/clinic-kitchen-2/)**

上方是可走、可跑的連續診間，下方是麻婆豆腐料理工作區。三位 Q 版全身醫師可切換；不再使用靜態位置導引或滑動半身像。

鍵盤：WASD／方向鍵移動，Shift 跑步，E 互動，P 暫停，R 重來。手機：按住方向鍵、跑步切換與 E 按鈕；工作站快捷鍵會讓角色實際走过去。選角／對話保留核准半寫實立繪。

[最後衝刺清單、驗收與 AGENT 接手](docs/R2_RELEASE_SPRINT.md) · [核准原稿](assets/art_direction/approved/) · [建置／部署紀錄](https://github.com/hsushuhao-lab/clinic-kitchen-2/actions)

## 此版本內容
三位醫師各 96 格：四方向，每方向 idle 2、walk 6、run 6、carry 6、work 4。腿和手臂影格會改變，不是只平移圖片。家具碰撞、腳部深度排序、手機鏡頭、坐姿病人、雙手端餐、配料到送餐流程均與遊戲狀態連動。

原有 `src/main.js`、`src/shift-rules.js`、下方料理邏輯保持不變；沒有新增第二道菜。使用的是 2D raster atlas，不是 3D 模型。部分家具為核准裁切，部分為配色補繪；美術品質仍等待使用者驗收。

## 執行
```sh
python -m pip install -r requirements-qa.txt
python -m playwright install chromium
python tools/build_web_release.py
python -m http.server 8000 --bind 127.0.0.1 --directory web-dist
```

建置會從完整原稿與程式化身體生成 16 個 `assets/chibi/*.webp`，輸出有尺寸、完整 SHA-256 與來源 manifest，Pages 使用真實 raster 檔，不依赖對話附件。完整原稿不覆寫。

## 驗收
原有 21 項流程、10 項人物 UI、5 項工作區檢查，加上 16 組 Q 版控制／動畫／完整端餐驗收。CI 以 HTTP 執行，通過才部署 Pages，之後比對公開 source_commit、檔案 hash 並再實測。只建立 blob 不算發布；成功證據以相同 commit 的 Actions 為準。

遊戲的 Craving 與麻婆豆腐效果均是虛構規則，不代表醫療療效。公開 runtime 排除私有真人照片、完整原稿海報、歷史 3D 檔與測試。
