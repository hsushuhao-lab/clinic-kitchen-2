# 建立／推送獨立 repository

本包本地只有 main。不要使用前一版含私人照片的 bundle；改用本輪 source bundle。

目的地：hsushuhao-lab/clinic-kitchen-2，Private。現有 connector 尚不可存取。

在本機授權的 GitHub CLI 登入環境，於 source 包根目錄執行：
```sh
python tools/publish_main.py --create
```
已建立 repository 時不加 `--create`。腳本不會修改原repo、刪分支或force push；若發現公開repo、錯誤origin、分支不是main、非fast-forward、圖片缺漏，都停止並回報。首次commit沿用本機Git姓名與信箱設定，沒有預設他人身份。

發佈完成需回讀 main SHA 與 CI。要讓本對話中的connector能寫入新repo，請在GitHub App授權裡包含它。

官方命令說明：https://cli.github.com/manual/gh_repo_create
