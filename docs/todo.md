# 待辦與方案評估

> 模型可自行更新本檔（完成就劃掉、新增待辦補進來），commit message 註明。
> 最後整理：2026-07-03。

## 進行中

### 1. 任務狀態修改者追蹤
- **建議案（方案 C）**：Magic Link 登入 + 每人一組 Jira token，不需要 RLS。
- 方案 A / B 的內容與落選原因**未在舊文件留存（未確認）**——動工前先請 Jim 口述補齊，寫回本段再實作。

### 2. 顏色變數漸進重構：`C.blue` 系列 → `C.accent` 系列
- 策略：漸進替換，不一次全改。`C` 物件位置見 `docs/jsx-map.md`（約 39–58 行）。

### 3. Web Push 三項未解
1. Chrome：舊版 FCM endpoint（`fcm.googleapis.com/fcm/send/...`）回 `BadWebPushRequest`——需 Firebase Server Key 或改用新版 FCM endpoint 格式。
2. Safari：需 RFC 8291（ECDH+HKDF）payload 加密，尚未實作。**高知識密度題**：卡兩次就停，建議升級模型專門處理（見 lessons 判準區 #5）。
3. `NotificationPanel` 重開頁面後不會從瀏覽器 endpoint 恢復訂閱狀態——需在 `useEffect` 加自動查詢邏輯。

### 4. `customer-access-manage` Edge Function（2026-07-03 觀察）
- ~~只存在於 Jim 主工作目錄、未進 git~~ **已解決（2026-07-21 確認）**：已進 git（`supabase/functions/customer-access-manage/index.ts`），前端 `CustomerAccessPanel` 正常呼叫中。

### 5. AVA 表單（`hotel_form_config` 等表）缺並發保護
- 2026-07-21 審查發現：AVA 表單存檔是整包 upsert（見 index.html 的 `syncToSupabase`），跟 `project_progress`（走 `update_check_item` RPC 做單一 key 原子更新）不同。若飯店兩人同時在不同分頁填、或 PM 同時在後台改同一專案，後寫入的會整包覆蓋前面的。
- Jim 確認**需要處理，但不急**，先記錄。動工前想清楚：哪些欄位真的需要 diff-then-upsert（目前 `syncToSupabase` 已經有 dirty-check，只送有變動的欄位，衝突視窗比全量覆蓋小很多，但同一欄位被兩邊同時改還是會有 last-write-wins 問題）。

### 6. Anon RLS 對 AVA 表單相關 12 張表完全沒有 project 隔離（2026-07-21 發現，安全性問題）
- 現況：`projects`（UPDATE）、`hotel_form_config`、`hotel_team_members`、`aiello_team_members`、`phone_buttons`、`web_portal_users`、`floor_wifi_rooms`、`tmsp_space_rows`、`room_types`、`room_type_images`、`welcome_messages` 的 anon RLS policy 都是 `USING(true)`——任何人持有 anon key（表單前端本來就公開）即可讀寫任意飯店資料，不受 `?p=<project.id>` 連結限制。`floor_wifi_rooms` 還存明碼 WiFi 密碼。
- **2026-07-21 新增**：`project_progress` 也加了一條 anon SELECT policy（`anon: read for AVA form`，`USING(true)`）——AVA 表單總覽頁的 checklist「前往」按鈕要讀 `sheet_links`（PM 在內部儀表填的 FAQ／Showcase／廣告／QR code 連結）才能運作。範圍比其他 11 張表小（只開 SELECT，沒有寫入權限），但一樣沒有 project 隔離，之後方案 B 要一併涵蓋這張表。
- **2026-07-22 新增**：Showcase 功能新增的 `showcase_sections`／`showcase_cards` 兩張表，比照同一套 `anon: edit via link USING(true)` 開放 policy 建立（跟其他 12 張表同款、同樣的已知缺口，沒有另外設計更嚴謹的隔離），方案 B 要一併涵蓋這兩張新表，缺口總數變成 14 張。
- **2026-07-22 再新增**：「其他參考文件」功能新增的 `reference_documents` 表，同樣套用 `anon: edit via link USING(true)`，缺口總數變成 15 張。
- **2026-07-23 再新增**：Showcase+廣告+QR 新網站（`AVA UI settings`，見 `docs/showcase-ads-qr-site-handoff.md`）新增的 `ad_settings`／`qr_popups` 兩張表，同樣套用 `anon: edit via link USING(true)`，缺口總數變成 17 張。
- Jim 的訴求：飯店拿到表單連結就能同步編輯、不需登入，體驗要跟線上 Excel 一樣（含即時多人同步）。
- 已測試過的方案與結論：
  - **方案 A（`x-project-id` 自訂 header + RLS 用 `current_setting('request.headers')` 檢查）**：REST 讀寫可行，但 **Realtime 的 `postgres_changes` 不吃自訂 header**，只認 JWT claim（`supabase.realtime.setAuth()`），查證見 Supabase 官方文件 Realtime > Postgres Changes > Custom tokens 段落。套用後會讓即時同步整個失效，已在正式環境 canary 測試（`welcome_messages` 表）後確認並復原，不能用。
  - **方案 B（推薦）：短效自訂 JWT，帶 `project_id` claim**，REST 用 `Authorization: Bearer <jwt>`、Realtime 用 `supabase.realtime.setAuth(jwt)`，RLS 統一用 `(auth.jwt()->>'project_id')::uuid = project_id` 判斷。REST 跟 Realtime 都吃同一份 JWT，理論上兩邊體驗都不受影響。
  - 方案 B 需要：(1) 新 Edge Function 簽發短效 JWT（給 project_id、驗證存在後簽發）；(2) Jim 手動把專案的 **JWT Secret**（Dashboard → Settings → API keys → JWT Secret）加進 Supabase Secrets 供該 function 簽章用——這把密鑰我這邊沒有工具能讀取，必須 Jim 手動處理；(3) 表單前端要在拿到 JWT 前先擋一下渲染（bootstrap 變非同步）。
- **狀態：等 Jim 決定要不要做方案 B（有明確的額外成本：新 function + 新 secret + 前端 bootstrap 改非同步），再繼續動工。**

### 7. AVA 表單「自訂分頁」功能（2026-07-22 討論，尚未動工）
- 需求：PIN 解鎖後的人員可以像 Excel 加分頁一樣，自行在 AVA 表單新增分頁與欄位，不需要每次都改 code。
- Jim 已確認方向：**在現有架構上長出子系統，不做框架重寫**——新增「分頁定義」「分頁欄位定義」兩張表（project 關聯、標題三語、排序、欄位型別、值），前端寫一個通用 `renderCustomTab()`，依欄位型別分派到既有樣板（`field`/`textarea`/`.note`/`plan-card`/`taggroup`/`imgwrap`，這幾個是目前盤點過可重用的既有 UI 積木，`renderRepeater()` 的「columns 設定即 schema」設計是這個做法的原型）。
- 明確排除的做法：砍掉重練換 React 等框架 + 正規化 EAV/JSONB schema——評估為單一 HTML 檔案零依賴的維運模式會被打破，是週級工程，非必要不做。
- **動工前必須一併處理，不能只加新表**（會被這個功能放大）：
  1. 待辦 #6（anon RLS 12 張表全開放，無 project 隔離）——新增更多開放性表會讓缺口更嚴重，是解決它的好時機。
  2. 待辦 #5（AVA 表單整包 diff-then-upsert 無真正並發保護）——自訂分頁允許多人同時加欄位/編輯，衝突機率比現在單純填固定欄位高，建議挪用 hotel-dashboard 這邊 `project_progress` 已經在用的「單一 key 原子更新」模式。
  3. 圖片欄位目前是 base64 直接塞資料庫欄位（非 Supabase Storage）——分頁/欄位數量變成使用者可無限新增後，這個模式會讓存檔資料量隨之膨脹，建議一併改成存 Storage、資料庫只存網址。
- **狀態：Jim 已選定方向，尚未排入 sprint，之後要主動提醒 Jim 排時間動工。**

### 8. 新網站：Showcase + 廣告 + QR Code 合併獨立站（2026-07-23 開始籌備）
- 要把 AVA 表單裡的 Showcase 分頁（2026-07-22 建的）搬出來，跟目前完全沒實作的「廣告設定」「Pop-up QR
  code 內容設定」合併成一個獨立公開網站。架構決策、現況盤點（AVA 表單/hotel-dashboard 各要改哪裡）、
  風險點（先確認有無真實飯店已填過 Showcase 資料再拆分頁）都寫在
  `docs/showcase-ads-qr-site-handoff.md`，動工前先讀那份文件。
- **狀態：Jim 正在建新資料夾/新 chat 準備動工，尚未開始寫 code。**

### 9. 上傳圖片沒有版本／備份機制（2026-07-28 發現）
- 現況：AVA basic settings、AVA UI settings 的圖片上傳（房型照片、Welcome Screen 圖片、樓層 WiFi 掃描圖、Showcase／廣告／QR 背景圖）都是前端用 `FileReader.readAsDataURL()` 轉成 base64 字串後直接寫進 Postgres 欄位，沒有走 Supabase Storage，也沒有任何獨立的檔案版本歷史。覆蓋等於直接遺失舊版，唯一救得回來的方式是整個資料庫／資料表層級的時間點還原，代價很高（會連帶復原同一時間之後其他所有欄位的異動）。base64 也讓同一張圖比原始檔案體積多約三成，長期會讓資料表越長越肥。
- 建議方案：
  - 輕量：覆蓋前把舊值寫進一張新的歷史記錄表（project_id／欄位名稱／舊值／時間），不動現有 base64-in-DB 架構，但沒解決體積肥大問題，復原也要另外做介面或手動查 SQL。
  - 正規（建議）：改用 Supabase Storage bucket 存實際檔案，資料庫只存 URL（比照 `reference_documents` 存 URL 的模式）；上傳路徑帶時間戳記、不覆蓋舊檔，舊版本自然留在 bucket 裡當版本歷史，之後可定期清理。需要：三個上傳入口改呼叫 Storage API、設定 bucket RLS policy（比照現有 anon 開放模式）、既有 base64 資料一次性搬遷成真正檔案。
- 狀態：Jim 已了解取捨，尚未決定要不要做，先記錄。

### 10. hotel-dashboard：ProjectDetail 整包 upsert 會覆蓋其他使用者的即時編輯（2026-07-28 實際發生）
- 現象：Jim 開著某專案的「專案資訊」頁閒置，另一人在別的分頁編輯同一專案並正常存檔；Jim 之後離開該頁面觸發的自動存檔，把資料庫覆蓋回 Jim 那份完全沒編輯過的舊版本，另一人的編輯消失。
- 根因：`ProjectDetail` 的 `info`／`sheetLinks`／`tasks`／各 notes 只在元件掛載當下用 `useState(project.xxx)` 初始化一次（約 2577-2585 行），掛載後不會再跟資料庫或父層 `project` prop 同步——沒有 realtime 訂閱、沒有輪詢。觸發存檔的 `useEffect`（約 2619-2627 行）依賴陣列只要有任何一個物件參照變動就會呼叫 `onUpdate`，一路送到 `handleUpdate`（約 3841-3862 行）對 `projects` 表做整包 `upsert`——不是單一 key 原子更新，也沒有 diff。只要 Jim 那個分頁在別人編輯之後、還沒重新整理之前觸發任何一次存檔（哪怕只是掛載當下就會觸發一次，或欄位 blur 產生新的物件參照但內容其實沒變），就會把整包舊資料寫回去蓋掉別人剛存的新資料。
- 範圍：`projects` 表整包 upsert（`info` 等）、`project_progress` 的 `basic_notes`／`faq_notes`／`batch2_notes`／`sheet_links` 都有這個風險；`basic_checked`／`faq_checked`／`batch2_checked` 已經是走 `update_check_item` RPC 原子更新，不受影響（跟 CLAUDE.md 硬規則 #1 的設計初衷一致，只是沒有涵蓋到這幾個欄位）。
- 建議方案：
  - 治標：`ProjectDetail` 增加 realtime 訂閱，或至少在重新取得 focus／重新進入頁面時重新拉一次 `projects`／`project_progress` 最新值再繼續編輯，縮小衝突視窗。
  - 治本：把 `info`／`sheetLinks`／`tasks`／notes 也改成跟 checklist 一樣走單一 key 的原子更新（例如擴充 `update_check_item` 或另開一支類似的 RPC），淘汰整包 `upsert(project)` 的寫法。
- 狀態：剛發現，尚未修，先記錄；範圍比待辦 #5（AVA 表單）更需要留意，因為 hotel-dashboard 是內部人員會多人同時開同一專案的工具，觸發條件比飯店端常見。

## 長期方向

- ACA 產品 checklist 擴充。
- Jira 整合加深：目前 REST API 單向同步，雙向同步為未來階段。

## harness 未竟事項（2026-07-03 建立制度時留下）

1. Google Drive MCP 停用需 Jim 在 `/mcp` 介面手動操作（帳號層級 connector，CLI 停不掉）；在那之前依 CLAUDE.md 硬規則忽略即可。
2. ~~`customer-portal/Dashboard.jsx` 程式碼不在本 repo，實際位置待 Jim 確認~~ **已釐清（2026-07-21，Jim 確認）**：`customer-auth`、`customer-check` 這兩個 Edge Function、`customer_access.hotel_id`、`customer_checklist_log` 都屬於**另一個正在開發中的專案**，原始碼不在 Jim 能給這個 session 讀取的資料夾裡；該服務**尚未上線，目前算停用狀態**，之後遇到可以忽略，不用當成本專案的缺口處理。
3. 任務狀態追蹤的方案 A/B 落選原因待 Jim 補述（見上方待辦 #1）。
4. 建議 Jim 把 `mcp__claude_ai_Supabase__get_logs` 加進 `.claude/settings.json` 的 allow——
   deploy commands 每次都要查 log，目前會跳權限提示（權限設定依維護協議須由 Jim 決定，模型不自行修改）。
