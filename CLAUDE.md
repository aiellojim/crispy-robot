# 飯店專案進度管理儀表板 — CLAUDE.md

> 本檔案由 Claude Code 在每次 session 開始時自動讀取，作為專案的長期上下文。
> **請勿在此檔案寫入任何 private secret**（JIRA_API_TOKEN、VAPID_PRIVATE_KEY、service_role key 等）。
> 這份檔案會進 git，Anon Key / VAPID Public Key 這類「設計上就是公開、靠 RLS 或簽章保護」的值可以留，
> 但一律以環境變數引用，不直接寫死數值。

## 專案概覽

- **前端**：React（Vite）+ 純 inline style，部署於 Vercel
- **後端**：Supabase（PostgreSQL + Edge Functions, Deno + pg_cron）
- **主要檔案**：
  - 內部儀表板：`src/hotel-project-dashboard.jsx`（Aiello PIC 用，管理飯店部署流程）
  - 客戶入口：`customer-portal/Dashboard.jsx`（飯店客戶查看進度用，共用同一個 Supabase 後端）
- **部署網址**：`https://hotel-dashboard-aiellojims-projects.vercel.app`
- **GitHub Repo**：`aiellojim/crispy-robot`
- **本機路徑**：`/Users/jim.chao/hotel-dashboard`
- **背景**：Aiello（aiello.ai）部署智慧飯店助理軟硬體（AVA、AVT、ACA、TMS Pro、GuestWeb/GW、KMS）。
  Alan Fang 是 Jira 操作備援執行者，Jim Chao 是使用者文件（`使用者說明.md`）上的支援聯絡人。

## Supabase 專案

- Project Ref：`yqoingcpcryrcpnhkjzu`
- 連線資訊一律走環境變數：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`（`.env.local` / Vercel 環境變數）
- Schema migration：`supabase/migrations/20260515_init_schema.sql`
- GRANT 權限已針對 anon / authenticated / service_role 明確設定於四張主要資料表

### 資料表結構

| 資料表 | 說明 |
|---|---|
| `projects` | 飯店專案基本資訊 |
| `project_progress` | 各專案 checklist 勾選狀態、備註、資料表連結 |
| `tasks` | 任務紀錄（`completed boolean default false`，deadline / period 兩種類型） |
| `push_subscriptions` | Web Push 訂閱資料（PIC 名稱、endpoint、訂閱專案、提醒天數） |
| `user_profiles` | 客戶入口 Magic Link 登入對應的使用者資料 |
| `jira_action_log` | Jira 操作紀錄（供任務狀態修改者追蹤方案 A 使用） |

### Checklist 常數

`BASIC_ITEMS`、`FAQ_ITEMS`、`BATCH2_ITEMS`、`ACA_ITEM`、`GW_ITEM`、`FAQ_TV_ITEM`（僅在有選 IPTV 時顯示）

## 前端功能模組

### 專案頁 Tab 順序
0. 專案資訊 → 1. 第一批資料（基礎設定表 + FAQ + ACA） → 2. 第二批資料（Showcase + 廣告 + QR + GuestWeb）
→ 3. Jira 子任務 → 4. 任務紀錄 → 5. 總覽

### 產品線
`AVA` / `AVT` / `ACA` / `TMSP` / `GW` / `KMS`

### 串接功能
`PBX` / `PMS` / `TMS` / `RCU` / `POS` / `IPTV`

### zIndex 圖層順序
日期格子(1) < Jira 狀態下拉(100) < 行事曆展開卡片(9999) < Global/專案頁 Header(10000)
< 新增/編輯任務彈窗(20000) = 通知設定背板(20000) < 通知設定側邊欄(20001)

### 視覺系統
- 字型：Inter + Noto Sans TC（粗細統一 300/400/500）
- 主題色：CSS 變數 `--accent`（橘色系，light `#E8621A` / dark `#F4873D`），支援 dark/light/system 三態
  （internal: `localStorage: 'hotel-dash-theme'`；portal: `'cp-theme'`）
- 圖示：inline SVG `ICONS` 字典 + `Ico` component；Logo 為 `public/aiello-logo.svg`

## Supabase Edge Functions

### `jira-proxy`
- 用途：作為 Jira Cloud REST API（`aiello-eng.atlassian.net`）的中介層，避免前端暴露 API Token
- Actions：`issues`（取得 Epic 子任務）、`transitions`（取得可用狀態）、`transition`（執行狀態切換）、`updateDescription`（更新 Epic Description）
- Secrets（存於 Supabase，不進 repo）：`JIRA_BASE_URL`、`JIRA_EMAIL`（jim.chao@aiello.ai）、`JIRA_API_TOKEN`
- **重要決策**：
  - JQL 只用 `parent` 查詢 Epic 子任務，避免已棄用的 `"Epic Link"` 觸發 410
  - 錯誤一律回傳 HTTP 200，錯誤訊息包在 body 裡
  - 狀態顯示顏色一律用 `statusCategory`（`new`/`indeterminate`/`done`）判斷，不依賴狀態名稱字串（避免語言依賴問題）
    - `done` → `#b3df72` / `#3b5a00`（綠）
    - `indeterminate` → `#a1c2f4` / `#0747a6`（藍）
    - `new` → `#dfe1e6` / `#44546f`（灰）
  - Epic Description 更新用 `[[dashboard-info]]` 文字錨點識別儀表板插入區塊；更新時先截斷錨點後內容再附加新表格
  - 狀態切換採樂觀更新（先更新 UI，API 失敗再還原）
- Epic ID 格式：`AHP-xxxx`
- 修改後部署：`supabase functions deploy jira-proxy`

### `send-push`
- 用途：每日定時掃描到期任務並送出 Web Push 通知
- Secrets：`VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY`、`VAPID_MAILTO`（存於 Supabase Secrets）
- pg_cron 排程：每天 UTC 01:00（台灣時間 09:00）
- Key 格式：JWK
- 修改後部署：`supabase functions deploy send-push`

### Web Push 狀態
**已完成**：`push_subscriptions` 資料表、`public/sw.js` Service Worker、`send-push` Edge Function、pg_cron 排程、
前端通知設定面板（主頁「🔔 通知設定」）、專案總覽頁訂閱開關

**未解決**：
1. Chrome：`sent:1` 但瀏覽器未顯示通知——`sw.js` 註冊或 Chrome 權限問題尚未確診
2. Safari：Apple Push Service 需要 RFC 8291（ECDH+HKDF）payload 加密，尚未實作
3. `NotificationPanel` 重開頁面後不會從瀏覽器 endpoint 恢復訂閱狀態——純前端問題，需在 `useEffect` 加自動查詢邏輯（後端已避免重複 insert）

## Email（Microsoft 365 SMTP）

- `smtp.office365.com:587`，STARTTLS
- `FROM = "Aiello <service@aiello.ai>"`，認證帳號 `alan.fang@aiello.ai`
- 使用 `nodemailer`
- HTML 版型：**不可使用圖示（icon-free）**，Outlook 相容性要求

## 客戶入口（customer-portal）

- Magic Link 認證（PKCE flow）
- `hotel_id` 透過 URL 參數 + `sessionStorage` 傳遞
- RLS policies 啟用，Edge Functions 用 service_role key
- 白名單機制：客戶只能修改 checklist 相關欄位，其餘欄位鎖定

## 還原點（Git Tags）

- `before-web-push-encryption`：Web Push 加密實作前的穩定版本
- `before-phase-C-ui-redesign`：UI 重新設計前
- **慣例**：任何重大改動（架構調整、加密邏輯、大型 UI 重構）前，先打 tag 作為還原點

## 關鍵學習與原則（踩過的坑，勿重踏）

- **JSONB 更新必須是單一 key 的 atomic 操作**——整包 upsert 會覆蓋掉並發中的其他修改。
  一律透過 RPC（如 `update_check_item`）做單一 key 的 JSONB 更新。
- **Jira API**：用 `statusCategory` 判斷顏色，不用狀態名稱字串；只用 `parent` JQL 查 Epic 子任務。
- **Supabase Auth 陷阱**：
  - `maybeSingle()` 在多筆結果時會出錯（曾造成登入無限迴圈）
  - `admin.generateLink` 會忽略自訂 SMTP 設定，需改用 `signInWithOtp`
  - Redirect URL 需要 wildcard pattern（如 `/dashboard*`）才能相容 query param
  - 未驗證的 Edge Function 部署需加 `--no-verify-jwt`
- **React 模式**：絕對不要在 render function 裡定義 component（會導致每次打字都重置 input——`ModalForm` 的教訓），
  改用 inline JSX 變數（如 `ModalContent`）
- **esbuild 錯誤訊息不可盡信**：曾經漏寫 `}}` 的 JSX 語法錯誤被誤報成「Unterminated regular expression」
- **檔案狀態紀律**：修改前務必確認目前操作的是哪個版本的檔案（Claude Code 下這個問題應該自然消失，
  因為永遠讀本機最新檔案，但跨分支 / worktree 工作時仍要留意）

## 開發慣例（Claude Code 版）

- ~~每次修改前上傳最新 `.jsx`~~ → **已不需要**，Claude Code 直接讀本機檔案系統
- 前端修改後：`git add . && git commit -m "..." && git push`
- `jira-proxy` 修改後：`supabase functions deploy jira-proxy`
- `send-push` 修改後：`supabase functions deploy send-push`
- 大改動前：`git tag <描述性名稱>` 作為還原點
- 偏好**漸進式重構**而非一次性大改（例如 `C.blue`/`C.blueLight`/`C.blueBorder` → `C.accent`/`C.accentLight`/`C.accentBorder`
  的顏色變數重新命名，要逐步替換，不要一次性大改）
- 偏好**直接修改檔案 + git push**，而非產出程式碼片段
- 修改架構性決策前（如 single-point vs full-object update、Realtime vs on-mount fetch）先說明原因與取捨
- 當 patch 累積太多次失敗時，改為**完整重寫**而非繼續 patch

## 進行中的待辦（Active Todos）

1. **任務狀態修改者追蹤**——目前建議方案 C：Magic Link 登入 + 每人一組 Jira token，不需要 RLS
   （1.5–2 天，兩端歸屬都準確）。方案 A（localStorage + action log，半天，但 Jira 歸屬不準）與
   方案 B（完整 Supabase Auth + RLS，3–5 天，最準確）已評估但暫緩。
2. **顏色變數重新命名**：`C.blue` 系列 → `C.accent` 系列，漸進式替換
3. **Web Push 三項未解問題**（見上）

## 長期方向

- ACA 產品 checklist 擴充（待 ACA 完整交付流程確認）
- Jira 整合加深：目前為 REST API 單向同步，雙向同步為未來階段
