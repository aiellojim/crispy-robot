# 架構與決策

> 真值來源優先序：程式碼本身 > 本檔 > 舊檔 `docs/archive/CLAUDE-monolith.md`。
> 本檔內容於 2026-07-03 整理（commit `1046d95`），標註「未確認」者表示查證不到、待 Jim 補充。

## 概覽

- 前端：React（Vite）+ 純 inline style，部署 Vercel：`https://hotel-dashboard-aiellojims-projects.vercel.app`
- 後端：Supabase（PostgreSQL + Edge Functions〔Deno〕+ pg_cron），Project Ref：`yqoingcpcryrcpnhkjzu`
- 前端環境變數：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`、`VITE_GEMINI_API_KEY`（AI 面板用）
  ——實際數值只存在 `.env.local` / Vercel 環境變數，不寫進任何 docs。

## 前端結構

- 主程式：`src/hotel-project-dashboard.jsx`（單一巨檔，約 4,000 行；精確行數見 `docs/jsx-map.md` 檔頭）。
  **找功能位置一律先讀 `docs/jsx-map.md`，禁止整檔讀取。**
- `src/App.jsx` 是 Vite 樣板殘留（counter 示範），與本專案無關，勿誤讀（2026-07-03 掃描確認）。
- Service Worker：`public/sw.js`（Web Push 用）。

### 專案頁 Tab 順序
0. 專案資訊 → 1. 第一批資料（基礎設定表 + FAQ + ACA） → 2. 第二批資料（Showcase + 廣告 + QR + GuestWeb）
→ 3. Jira 子任務 → 4. 任務紀錄 → 5. 總覽

### 產品線與串接
- 產品線：`AVA` / `AVT` / `ACA` / `TMSP` / `GW` / `KMS`
- 串接功能：`PBX` / `PMS` / `TMS` / `RCU` / `POS` / `IPTV`

### zIndex 圖層順序
日期格子(1) < Jira 狀態下拉(100) < 行事曆展開卡片(9999) < Global/專案頁 Header(10000)
< 新增/編輯任務彈窗(20000) = 通知設定背板(20000) < 通知設定側邊欄(20001)

## 資料表

| 資料表 | 說明 |
|---|---|
| `projects` | 飯店專案基本資訊 |
| `project_progress` | 各專案 checklist 勾選狀態、備註、資料表連結（JSONB，見硬規則） |
| `tasks` | 任務紀錄（deadline / period 兩種類型） |
| `push_subscriptions` | Web Push 訂閱資料（PIC 名稱、endpoint、訂閱專案、提醒天數） |
| `user_profiles` | Magic Link 登入對應的使用者資料 |
| `jira_action_log` | Jira 操作紀錄 |
| `notifications` | 客戶通知；`type='customer_check'` 由另一專案的 `customer-check` Edge Function 寫入（見下方「AVA 表單」節），`hotel-project-dashboard.jsx` 的 `fetchCustomerNotifs` 讀取顯示 |

Migrations：`supabase/migrations/`（`20260515_auth_schema` / `20260519_full_schema` / `20260520_push_subscriptions_refactor`）。
**注意（2026-07-21）**：這三個 migration 只涵蓋 hotel-dashboard 自己用的表。AVA 表單另外用到的表
（`hotel_form_config`／`hotel_team_members`／`aiello_team_members`／`phone_buttons`／`web_portal_users`／
`floor_wifi_rooms`／`tmsp_space_rows`／`room_types`／`room_type_images`／`welcome_messages`）不在這幾個
migration 檔裡，是透過 Supabase MCP／Dashboard 直接建的，本 repo 沒有對應的 schema 歷史紀錄。

## Edge Functions（`supabase/functions/`）

### jira-proxy
- 用途：Jira Cloud REST API（`aiello-eng.atlassian.net`）中介層，避免前端暴露 API Token。
- Actions：`issues` / `transitions` / `transition` / `updateDescription`。Epic ID 格式：`AHP-xxxx`。
- Secrets（Supabase Secrets）：`JIRA_BASE_URL`、`JIRA_EMAIL`（jim.chao@aiello.ai）、`JIRA_API_TOKEN`。
- 已定案決策（改動前先問 Jim）：
  - JQL 只用 `parent` 查 Epic 子任務；已棄用的 `"Epic Link"` 會觸發 410。
  - 錯誤一律回傳 HTTP 200，錯誤訊息包在 body 裡（前端據此判斷）。
  - 狀態顏色用 `statusCategory` 判斷，不依賴狀態名稱字串：
    `done` → `#b3df72`/`#3b5a00`（綠）；`indeterminate` → `#a1c2f4`/`#0747a6`（藍）；`new` → `#dfe1e6`/`#44546f`（灰）。
  - Epic Description 用 `[[dashboard-info]]` 文字錨點識別儀表板區塊：更新時先截斷錨點後內容再附加新表格。
  - 狀態切換採樂觀更新（先更新 UI，API 失敗再還原）。
- 部署：`/deploy-jira-proxy`。

### send-push
- 用途：每日掃描到期任務並送 Web Push。Secrets：`VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY`、`VAPID_MAILTO`。
- pg_cron：每天 UTC 01:00（台灣 09:00）。部署：`/deploy-send-push`。

### send-email
- Microsoft 365 SMTP：`smtp.office365.com:587`、STARTTLS、`nodemailer`。
- `FROM = "Aiello <service@aiello.ai>"`，認證帳號 `alan.fang@aiello.ai`。
- HTML 版型必須 icon-free（Outlook 相容性要求）。

### customer-access-manage
- **已 commit（2026-07-21 確認）**：`supabase/functions/customer-access-manage/index.ts`。
- 用途：PM 新增／移除 `customer_access` 表裡的客戶 email 白名單（見下方「AVA 表單」節，這是另一個
  獨立客戶系統用的表，不是 AVA 表單本身）。前端 `CustomerAccessPanel`（位置見 jsx-map）呼叫。

## AVA 表單（另一個 repo：`/Users/jim.chao/AVA basic settings`，單檔 `index.html`）

- 部署：Vercel，自訂網域 `https://basic-settings.aiello.dev/`（2026-07-21 換過網域，見下方連結產生規則）。
- 跟 hotel-dashboard **共用同一個 Supabase 專案**（`yqoingcpcryrcpnhkjzu`），但是完全獨立的前端，本 repo 找不到它的原始碼。
- 存取模式：**無登入**，飯店拿到連結 `AVA_FORM_BASE_URL + "?p=" + project.id`（`project.id` 本身就是權杖，
  UI 由 `hotel-project-dashboard.jsx` 的 `ProjectDetail` 產生／複製，`AVA_FORM_BASE_URL` 常數定義在檔案開頭）就能直接編輯，
  體驗要求跟線上 Excel 一樣（含多人即時同步，透過 Realtime `postgres_changes` 訂閱上面那 10 張表）。
- **已知安全缺口（2026-07-21 發現，尚未修）**：上面那 10 張表 + `projects` 的 UPDATE，anon RLS policy
  目前都是 `USING(true)`——`?p=` 連結只是前端過濾，資料庫層沒有真的限制只能讀寫該 project。
  詳細分析、已測試過但不可行的方案（自訂 header）、以及推薦方案（自訂 JWT + `auth.jwt()->>'project_id'`，
  需要 Jim 提供 JWT Secret）都記錄在 `docs/todo.md` 待辦 #6，動工前先讀那邊。
- `form-submit-notify` Edge Function：飯店按「提交／更新」時觸發，寄信通知 `avapjm@aiello.ai`（Aiello 內部相關人員 email 群組，Jim 確認寄一次全員收到，不需要動態抓 PIC）。
  這是刻意設計，PM 儀表板**不會**自動讀取表單填寫/完成狀態（`hotel_form_config` 未被 `hotel-project-dashboard.jsx` 讀取）——
  Jim 不希望飯店端有機會自動寫入內部儀表板的完成狀態，目前靠人工檢查。

## Web Push 現況

已完成：`push_subscriptions` 表、`public/sw.js`、`send-push`、pg_cron、前端通知設定面板、總覽頁訂閱開關。
**三項未解**（詳見 `docs/todo.md`）：
1. Chrome：舊版 FCM endpoint（`fcm.googleapis.com/fcm/send/...`）回 `BadWebPushRequest`，需 Firebase Server Key 或新版 endpoint 格式。
2. Safari：需要 RFC 8291（ECDH+HKDF）payload 加密，尚未實作。
3. `NotificationPanel` 重開頁面後不會從瀏覽器 endpoint 恢復訂閱狀態，需在 `useEffect` 加自動查詢。

## 客戶入口（customer-portal，`customer-auth` / `customer-check`）

- **已釐清（2026-07-21，Jim 確認）**：這是 Magic Link 認證（`customer-auth` 發信）+ `customer-check`
  （白名單驗證 `hotel_id` 歸屬、樂觀鎖、寫 `project_progress` + `customer_checklist_log` + `notifications`）
  組成的另一個獨立在開發中的專案，跟 AVA 表單是兩回事。
- 原始碼**不在本 repo、也不在 AVA 表單那個 repo**——屬於 Jim 另一個工作目錄，這個 session 沒有權限讀取。
- **該服務尚未上線，目前是停用狀態**：遇到 `customer_access.hotel_id`（跟 `customer-access-manage` 用的
  `customer_access` 是同一張表，但那是給另一件事用的白名單）、`customer_checklist_log`、`customer-auth`、
  `customer-check` 這些東西，視為停用中的另一專案殘留，可以忽略，不用當本專案的缺口處理。

## 還原點（git tags，2026-07-03 實查）

`before-jira-bootstrap`、`jira-bootstrap-stable`、`before-phase-C-ui-redesign`、
`before-push-subscriptions-refactor`、`before-web-push-encryption`、`before-harness-setup`。
慣例：任何重大改動前先打描述性 tag（`/checkpoint`）。
