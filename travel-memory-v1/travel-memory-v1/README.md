# 旅行記憶王 V2.0 — 教師登入與排行榜版

## 本版新增
- 首頁僅有學生輸入房間代碼及姓名的加入畫面，右上角有不顯眼的「🔒 教師登入」。
- 教師登入須使用伺服器端密碼驗證，密碼不寫入網頁程式碼。
- 教師可即時查看每位學生在線或離線、立即結束遊戲、公布個人與小組前三名，以及再來一局。
- 再來一局保留原學生名單與組別，分數歸零。學生可使用原房間代碼及原分頁繼續。
- 保留 V1 七主題 49 物品、四種模式、即時作答、QR Code 與 CSV 匯出。

## Render 更新步驟
1. 下載此 ZIP，**解壓縮後**打開 `travel-memory-v2` 資料夾。
2. GitHub Repository 裡原本的 `travel-memory-v1/travel-memory-v1` 路徑有 `server.js`、`package.json` 和 `public/index.html`。**請將新版的這三個檔案覆蓋到同一個路徑**，而不是把整個新版資料夾再多上傳一層。
3. Render → 服務 → Environment → Add Environment Variable：
   - KEY：`TEACHER_PASSWORD`
   - VALUE：自訂至少 8 字元的強密碼（例如使用密碼管理器產生，勿將密碼上傳 GitHub）。
   - 儲存環境變數。
4. Render → Settings：
   - Root Directory：`travel-memory-v1/travel-memory-v1`（若原 GitHub 結構未改）
   - Build Command：`npm install`
   - Start Command：`npm start`
5. Render → Manual Deploy → Deploy latest commit。成功後看見 Live。
6. 使用網站首頁右上角「🔒 教師登入」輸入剛才設定的密碼，建立房間。
7. 請學生使用首頁輸入代碼，或掃描教師房間中的 QR Code 加入。

## 注意事項
- `TEACHER_PASSWORD` 必填，少於 8 字元會拒絕啟動，以免教師管理無密碼保護。
- 教師重新整理同一個瀏覽器分頁會嘗試恢復主持身分；請勿清除該分頁的 Session Storage。
- Render 重新啟動或休眠後重新啟動，房間與分數可能消失，因為此版本只使用記憶體儲存。
- 網頁不會顯示密碼；但已登入的教師分頁應避免讓學生使用。
- 「已離線」代表即時連線中斷，不代表學生主動離開；學生重新連線後會更新。
- 此版本尚未完成 30+ 人真實負載測試，上課前請先用 2–3 台裝置測試。
