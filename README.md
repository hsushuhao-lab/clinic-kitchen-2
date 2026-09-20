# Craving Kitchen — R4 診間叫號

**[直接試玩 GitHub Pages](https://hsushuhao-lab.github.io/clinic-kitchen-2/)**

左側看本號病人想吃的麻婆豆腐，操作 Q 版醫師由左到右完成：病人 → 電腦 → 冰箱 → 備料 → 炒鍋 → 配飯／出餐。清除多餘前景障礙，保留走路、跑步、碰撞與手機控制。

下方一次顯示一個工作區；精準條更高，游標週期 2.4 秒。配飯出餐後直接停止角色及計時，呈現不需捲動的需求／成品比較與評價；按「叫下一號」換下一位病人。病人的要求不能由玩家修改，是否加蔥、花椒或哪份飯仍由玩家決定。

WASD／方向鍵移動、Shift 跑步、E 互動；手機可按住方向鍵。Space 做精準操作、M 靜音、P 暫停、R 重來。三單晚班的 90／80／70 秒目標與 96／120／144 BPM 壓力配樂保留。

[本輪改動、測試及素材界線](docs/R4_CLINIC_RELEASE.md) · [完整核准原稿](assets/art_direction/approved/) · [Actions／部署](https://github.com/hsushuhao-lab/clinic-kitchen-2/actions)

## 執行
```sh
python -m pip install -r requirements-qa.txt
python -m playwright install chromium
python tools/build_web_release.py
python -m http.server 8000 --bind 127.0.0.1 --directory web-dist
# 另一终端
python tests/test_clinic_flow.py --base-url http://127.0.0.1:8000/
```

`main` 為開發及發布線。只有 source SHA、HTTP 瀏覽器測試、部署與公開站驗證皆通過才算發布，不以文件或 blob 建立冒充成功。

本版六種病人使用原稿肖像與共用四格坐姿身體，非六套獨立全身動畫；醫師動畫與配樂沿用上一版。2D 美術仍可持續調整。遊戲 Craving 是虛構規則，麻婆豆腐不是戒菸療法。公開 runtime 不含真人私照、完整原稿或歷史 3D 模型。
