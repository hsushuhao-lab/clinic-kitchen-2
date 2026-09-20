# Craving Kitchen — R5 圖像點餐與 E 鍵料理

**[直接試玩 GitHub Pages](https://hsushuhao-lab.github.io/clinic-kitchen-2/)**

保留 Q 版可動診間、病人依序叫號、左至右動線及單一料理工作區。六位病人現在以保留各自服裝的完整半身插畫呈現；辣度／蔥花／飯量改成圖像需求，結算同時比較圖示與實際出餐。

## 操作
WASD／方向鍵移動、Shift 跑步、E 互動。備料按 1–6 選材料、E 切配；炒鍋 F 開關火、E 下料／翻炒；配飯 1 半碗、2 正常、E 出餐。P 暫停、R 重來、M 靜音，Space 精準操作保留。手機方向鍵與 E 按鈕仍可用。

4 秒收汁完成後仍能繼續大火，超時每滿 1 秒扣 1 個滿意度百分點、最多 20。F 關火停止累積，已累積的扣分不會因再加材料消失。餐點不符合需求，醫師會有一次無血腥的卡通敲頭／揉頭反應；結果不需移動或捲動，直接「叫下一號」。完全正確餐點不播放敲頭。

三單晚班、96／120／144 BPM 原有壓力配樂與三位醫師能力保留。這仍是 2D 衍生美術遊戲；不把自動測試通過等同美術獲准。

[本版改動、精確規則及素材界線](docs/R5_SERVICE_POLISH.md) · [R4 叫號流程](docs/R4_CLINIC_RELEASE.md) · [核准原稿](assets/art_direction/approved/) · [Actions／部署](https://github.com/hsushuhao-lab/clinic-kitchen-2/actions)

```sh
python -m pip install -r requirements-qa.txt
python -m playwright install chromium
python tools/build_web_release.py
python -m http.server 8000 --bind 127.0.0.1 --directory web-dist
# 另一終端：
python tests/test_clinic_flow.py --base-url http://127.0.0.1:8000/
python tests/test_service_polish.py --base-url http://127.0.0.1:8000/
```

發布由 main 的 CI 建置實際圖片，驗證 R4 與 R5 完整操作後部署，再核對公開網站 source SHA。公開 runtime 排除原稿大海報、真人私照、歷史 3D 模型與測試。遊戲設定不代表麻婆豆腐具有戒菸療效。
