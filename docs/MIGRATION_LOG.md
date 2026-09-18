# R2 整合與發布記錄

來源：前一輪 clinic-kitchen-2-integrated.zip；其 SHA-256 为 e42dcd35757bc580090f167837c570e821ec2b2810c35bb2ce4c6f8e92328f4f。

本輪以 GitHub hsushuhao-lab/hao_hw/main 的 b59dc7d60a97da77adbabc8c90105aad409f53f0 為遠端核對點；其 index.html、styles.css、src/main.js、smoke_test.py 與原整合包的 Git blob SHA 完全一致，並非任意重建出的未知版本。

已重整：上／下同屏版面；鏡頭、配方與重置bug；七张精確原始PNG；候選圖重新分類；私人照片與歷史ZIP分離；完整解碼與雜湊檢查；真實瀏覽器行為測試；main-only推送腳本。

目的地 hsushuhao-lab/clinic-kitchen-2：本輪 get_repo 回傳404，授權清單無此 repo。不能區分未建立或未授權，故不宣稱存在亦不宣稱成功發布。先前建立流程已因403失敗；本輪沒有再觸發跨repository建立流程，也未讀取任何token。

本機容器不提供直接GitHub網路傳輸；GitHub原型修復與交班文件經正式connector寫入現有hao_hw/main。完整原圖與私人附件不經手工貼base64，不降低解析度來規避傳輸問題。

本機 Chromium 對 localhost HTTP 導航有環境政策限制，因此本機24項行為測試使用原始HTML/CSS/JS直接載入瀏覽器（inline）。GitHub CI的HTTP測試是另外的門檻；兩者不可混稱。
