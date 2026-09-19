# Craving Kitchen — Q 版診間 R3・晚班挑戰

**[直接試玩 GitHub Pages](https://hsushuhao-lab.github.io/clinic-kitchen-2/)**

保留上方可走、可跑、可端餐的三位 Q 版全身醫師與連續診間，下方製作麻婆豆腐。本輪加入三單晚班挑戰、精準連擊、準時賞金，以及隨壓力升高的原創動態配樂；沒有退回導航圖或更換畫風。

## 怎麼玩
先用練習模式熟悉路線；接單前按「晚班挑戰」：90／80／70 秒三種指定口味，連續完成後比較晚班總分與本機最高紀錄。超過準時目標只失去賞金，Craving 達 100% 才失敗。

WASD／方向鍵移動，Shift 跑步，E 互動；手機按住方向鍵與跑步／E 按鈕。料理時白色游標進入中央金色區按 Space 或原操作鈕可得 PERFECT 與 COMBO；未命中不會卡住料理。收汁後可先關火，再去盛飯，仍能回來盛盤。

**M 靜音、P 暫停、R 重來。** 音量可調；配樂在玩家操作後開始，隨輕快／忙碌／衝刺切換 96／120／144 BPM。暫停及背景分頁停止音訊和計時；靜音不影響判定。

[R3 遊玩規則、配樂與驗收](docs/R3_NIGHT_SHIFT.md) · [R2 Q版角色交班](docs/R2_RELEASE_SPRINT.md) · [核准原稿](assets/art_direction/approved/) · [建置／部署紀錄](https://github.com/hsushuhao-lab/clinic-kitchen-2/actions)

## 執行
```sh
python -m pip install -r requirements-qa.txt
python -m playwright install chromium
node --test tests/shift_rules.test.cjs tests/rush_rules.test.cjs
python tools/build_web_release.py
python -m http.server 8000 --bind 127.0.0.1 --directory web-dist
```

建置沿用 R2 的三位醫師圖集與原稿來源核對。音樂由 `src/adaptive-audio.js` 原創合成，無外部音源依賴或錄音。CI 保留原有流程與 Q 版動作驗收，增加三單實際遊玩及音訊能量測試，通過才部署 Pages；發布依相同 commit 的驗證紀錄，不只建立 blob。

目前是 2D Q 版遊戲，角色／家具原稿與可動圖集未在本輪重畫，仍保留美術驗收。公開 runtime 排除真人私照、完整原稿海報與歷史 3D 檔案。Craving 與料理效果是虛構遊戲規則，不代表醫療療效。
