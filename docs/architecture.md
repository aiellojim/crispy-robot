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
| `notifications` | 客戶通知（2026-07-03 掃描發現前端 `fetchCustomerNotifs` 有讀取；舊文件未記錄，欄位未確認） |

Migrations：`supabase/migrations/`（`20260515_auth_schema` / `20260519_full_schema` / `20260520_push_subscriptions_refactor`）。

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

### customer-access-manage（進行中，尚未 commit）
- 2026-07-03 觀察：只存在於 Jim 的主工作目錄（`/Users/jim.chao/hotel-dashboard`）且未進 git——
  **worktree 或 fresh clone 裡沒有這個目錄**，找不到是正常的。
- 前端 `CustomerAccessPanel`（位置見 jsx-map）已在呼叫其 endpoint。規格未確認。
- **勿動**；若任務被迫觸及，先停下來問 Jim。建議 Jim 儘早 commit 該目錄。

## Web Push 現況

已完成：`push_subscriptions` 表、`public/sw.js`、`send-push`、pg_cron、前端通知設定面板、總覽頁訂閱開關。
**三項未解**（詳見 `docs/todo.md`）：
1. Chrome：舊版 FCM endpoint（`fcm.googleapis.com/fcm/send/...`）回 `BadWebPushRequest`，需 Firebase Server Key 或新版 endpoint 格式。
2. Safari：需要 RFC 8291（ECDH+HKDF）payload 加密，尚未實作。
3. `NotificationPanel` 重開頁面後不會從瀏覽器 endpoint 恢復訂閱狀態，需在 `useEffect` 加自動查詢。

## 客戶入口（customer-portal）

- Magic Link 認證（PKCE flow）；`hotel_id` 走 URL 參數 + `sessionStorage`。
- RLS policies 啟用；Edge Functions 用 service_role key；白名單機制：客戶只能改 checklist 相關欄位。
- **注意（2026-07-03 查證）**：舊文件寫的 `customer-portal/Dashboard.jsx` 不存在於本 repo，程式碼實際位置未確認（可能是獨立 repo）。要改客戶入口前先問 Jim 在哪裡。

## 還原點（git tags，2026-07-03 實查）

`before-jira-bootstrap`、`jira-bootstrap-stable`、`before-phase-C-ui-redesign`、
`before-push-subscriptions-refactor`、`before-web-push-encryption`、`before-harness-setup`。
慣例：任何重大改動前先打描述性 tag（`/checkpoint`）。
