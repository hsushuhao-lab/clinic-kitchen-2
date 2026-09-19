# Craving Kitchen — 診間與料理

**[GitHub Pages 最新試玩](https://hsushuhao-lab.github.io/clinic-kitchen-2/)**

## Workspace R1 · 視覺修正版

上方 1/3 診間位置導引，下方 2/3 備料、炒鍋與配飯裝盤。保留三位醫師、Craving/Focus、得分、連勝、WASD/點站點移動、E 互動、P 暫停與 R 重來。

本輪以核准原稿的診間/工作站視角替換格線矩形場景；不再讓裁切半身像滑動。食材去除照片方框與金屬盤，豆腐四個切配狀態、蔥花/蒜末、鍋內食物、爐台與鍋鏟重新對齊。

**這是可玩視覺修正版，不是完成的全身人物動畫或 3D 場景。** 上方為位置導引；實際全身走路、坐姿與手部料理動作仍未製作。完整規則程式沒有重寫，沒有增加第二道菜。

- [本輪修改與限制](docs/WORKSPACE_VISUAL_RELEASE.md)
- [上一輪人物整合](docs/REALISTIC_CHARACTER_RELEASE.md)
- [上/下畫面配置規格](docs/FLAT_CLINIC_RELEASE_20260919.md)
- [核准完整美術原稿](assets/art_direction/approved/)
- [AGENT 交班入口](docs/00_START_HERE.md)

## 素材與驗證

新增 21 個工作區衍生 WebP 由 `tools/build_workspace_art.py` 在建置時產生。原稿不覆寫；来源、遮罩、尺寸与 SHA-256 写入 QA artifact。不是讓使用者再上傳一次原圖，也不是把小縮圖標成 production-final。

```sh
python -m pip install -r requirements-qa.txt
python -m playwright install chromium
python tests/smoke_test.py
python tools/verify_assets.py
python tools/verify_shift_assets.py
node --test tests/shift_rules.test.cjs
python tools/build_web_release.py
python -m http.server 8000 --bind 127.0.0.1 --directory web-dist
# 另一終端：
python tests/test_flat_clinic.py --base-url http://127.0.0.1:8000/
python tests/test_character_art.py --base-url http://127.0.0.1:8000/
python tests/test_workspace_visuals.py --base-url http://127.0.0.1:8000/
```

main 是唯一開發與發布線；舊 AppDeploy 與 hao_hw 不是最新版入口。GitHub Actions 對相同 commit 檢查後才部署 Pages，再驗證公開網站 SHA 與實際操作。測試通過不代表美術已經由使用者核准。

本遊戲為虛構診間料理設定，並不宣稱麻婆豆腐有戒菸療效。公開 runtime 不包含私有真人照片、完整設定海報、測試或歷史模型。
