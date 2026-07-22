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

## 長期方向

- ACA 產品 checklist 擴充。
- Jira 整合加深：目前 REST API 單向同步，雙向同步為未來階段。

## harness 未竟事項（2026-07-03 建立制度時留下）

1. Google Drive MCP 停用需 Jim 在 `/mcp` 介面手動操作（帳號層級 connector，CLI 停不掉）；在那之前依 CLAUDE.md 硬規則忽略即可。
2. ~~`customer-portal/Dashboard.jsx` 程式碼不在本 repo，實際位置待 Jim 確認~~ **已釐清（2026-07-21，Jim 確認）**：`customer-auth`、`customer-check` 這兩個 Edge Function、`customer_access.hotel_id`、`customer_checklist_log` 都屬於**另一個正在開發中的專案**，原始碼不在 Jim 能給這個 session 讀取的資料夾裡；該服務**尚未上線，目前算停用狀態**，之後遇到可以忽略，不用當成本專案的缺口處理。
3. 任務狀態追蹤的方案 A/B 落選原因待 Jim 補述（見上方待辦 #1）。
4. 建議 Jim 把 `mcp__claude_ai_Supabase__get_logs` 加進 `.claude/settings.json` 的 allow——
   deploy commands 每次都要查 log，目前會跳權限提示（權限設定依維護協議須由 Jim 決定，模型不自行修改）。
