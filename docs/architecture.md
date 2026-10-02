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

### Liquid Glass 視覺改版（2026-10-02 起）
全站背景改成疊在 `body { background }` 上的三層大範圍 `radial-gradient`（`--canvas-glow-1/2/3`
變數，色相沿用既有 `--prod-*`/`--accent`），`background-attachment:fixed` 讓色暈固定貼在視窗、
不隨內容捲動。**第一版曾經改用 `position:fixed` + `zIndex:-1` 的三個獨立模糊色塊 div，實測範圍
太小、只能貼在角落，大部分頁面仍然看起來純白，已經整個換掉**——現在的做法直接是 `body` 背景的
一部分，不是獨立元件，不佔用 zIndex 圖層序列，之後也不用再去想它跟其他層的疊放順序。

Global Header、Overview 專案卡片已換成毛玻璃材質（`background:"var(--glass-surface)"` +
`backdropFilter`），zIndex 皆維持原值不變，純粹換材質不動結構。專案卡片另外做了滑鼠追蹤光斑
（`.card-glow` 子元素，`inset:0` + 跟卡片一致的 `borderRadius`，不能只靠父層 `overflow:hidden`
裁切，`filter:blur()` 在部分瀏覽器會讓子層裁切跟父層圓角對不上）跟輕微 3D 傾斜（`perspective`
+ `rotateX/rotateY`，角度要留意卡片實際尺寸——這批卡片比最初的 demo 示範卡片寬得多，同樣的角度
套用在更大的面上位移量會被放大，需要調低角度、拉遠 perspective 距離才會跟 demo 手感一致）。

套用這批材質新增的 CSS 變數（`--glass-surface`、`--glass-surface-hover`、`--canvas-glow-1/2/3`）
都要同時定義在四個主題區塊：`:root`、`@media (prefers-color-scheme: dark)`、
`html[data-theme="light"]`、`html[data-theme="dark"]`——這個站的手動深色/淺色切換是用後兩個
`data-theme` 區塊覆蓋、優先權比 media query 高，「系統」模式才會真的跟 media query 走。漏放其中
一個區塊會導致「手動選淺色、但作業系統本身是深色」這類情境下變數值跑掉（已踩過一次：
`--glass-surface` 最初只放了前兩個區塊，導致淺色模式下 Header 顯示錯誤顏色）。

**全站鋪開進度（分批進行，Jim 每 3 批手動檢查一次）**：
- Batch 1：ProjectDetail 自己的 Header（跟 Global Header 是不同元件，要分開改）。
- Batch 2：共用的 `Card`／`OvCard`／`ProgressCard` 元件、HomePage 的統計卡＋篩選列（原本漏做，
  跟專案卡片一起補上）、Overview 專案卡片的光斑+傾斜互動。
- Batch 3：所有 modal／側邊欄（NotificationPanel、InAppNotifModal、CalendarPage 任務 modal、
  CustomerAccessPanel、SiteChatEbConsolePanel、Jira Epic bootstrap modal、UserSettingsPanel、
  AiPanel）。
- Batch 4：ProjectDetail 的 tab nav bar、「客戶存取」按鈕、Overview 分頁內兩個沒有套用
  `Card`/`OvCard` 元件、徒手寫 `background:C.white` 的區塊（第二批資料、任務紀錄）；JiraTab
  的 issue 卡片、狀態切換浮動選單、「更新 Epic Description」/「同步 Jira」按鈕；TasksTab 的
  任務卡片（這裡原本用了 `<Card>` 但自己又在 `style` prop 覆寫了 `background:C.white`，把
  Card 本身帶的玻璃背景蓋掉，等於有 `backdropFilter` 卻完全看不出模糊——這是為什麼即使用了
  共用元件也要檢查有沒有在呼叫端被覆寫）、篩選/排序/類型切換按鈕。LoginPage 的登入卡片一併補上
  （不在原始批次規劃內，是順手做的一致性修正）。
- Batch 5：CalendarPage 的整月格線外層容器、展開日期的浮動清單、月份事件清單容器、上下月按鈕、
  任務 modal 的取消按鈕跟類型切換按鈕。**個別日期格子本身維持不透明純色**（`isToday`/平日/非本月
  三種底色是功能性狀態標示，不是「卡片」，而且 42 個格子各自套 `backdrop-filter` 在效能跟視覺
  密度上都不合理，比照其他地方「列表內的個別 row 維持純色、只有外層容器玻璃化」的既有判斷）。
- Batch 6（跟 Batch 4/5 合併執行，沒有另外切）：次要/外框按鈕（原本 `background:C.white` 的
  secondary button）全部換成玻璃；**主色/CTA 按鈕（純色 accent 填色，例如「下一步」「確認建立」
  「新增任務」）維持不透明純色，不玻璃化**——Jim 明確決定主色按鈕要保持清晰標示，不納入這次改版。
  同理，各種「選中態＝純色填滿」的切換元件（Chip、篩選/排序/類型切換按鈕的「已選中」那一態、
  checkbox/完成狀態圓點）維持不透明，只有「未選中」的外框態才換成玻璃——這些純色填滿本身是功能
  性的狀態指示，跟主色按鈕是同一類，不是裝飾性的卡片/按鈕底色。
- 另外修了 Jira Epic bootstrap modal 的 overlay 被困在「飯店資訊」`Card` 裡的 bug：`Card` 在
  Batch 2 加上 `backdropFilter` 後，依 CSS 規範會替內部 `position:fixed` 的後代元素建立新的
  containing block，困住原本應該貼齊 viewport 的 modal 遮罩——修法是用 `ReactDOM.createPortal`
  把這個 modal 掛到 `document.body`，不要再巢狀在 `Card` 底下。**之後如果還有 modal 被包在
  帶 `backdropFilter`/`transform`/`filter`/`perspective` 的祖先元素裡、又用 `position:fixed`，
  一律用這個方法處理**，不要只調整 zIndex（zIndex 解不了 containing block 被困住的問題）。
- 刻意不玻璃化的範圍：輸入框（input/textarea，包含 `baseInput`／`NoteArea`／`FInput`）維持
  不透明——玻璃底的面板上如果輸入框也半透明，會讓使用者分不清哪裡能打字，這點 Jim 在 Batch 3
  的 overlay 變灰回饋裡也間接提過（「只有輸入欄和按鈕維持高亮」）；小型色塊徽章/標籤（整合服務
  標籤、Jira issue key 膠囊、狀態 badge）維持原樣，這些是資訊標示不是卡片；modal/卡片內部用來
  跟外層做對比的巢狀小面板（例如 Jira Epic modal 的錯誤訊息框、SheetLink 的連結輸入框底色）
  維持不透明，因為它們本身的功能就是在已經半透明的外層容器裡提供一塊實色的視覺對比。

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
- 總覽頁 checklist 的「前往」按鈕（沒有對應表單分頁的項目，如 FAQ GPT／Showcase／廣告／QR code／GuestWeb 編輯器）
  會讀 `project_progress.sheet_links`（PM 在內部儀表填的外部連結）跟 `projects.kms_link`／`hotel_id` 動態組網址；
  PM 沒填就反灰。邏輯在 `checklistExternalUrl()`（2026-07-21 新增）。
- `sheet_links` 三個欄位在 PM 端（`dbToUi`／`newProject`，2026-07-22 新增）有智慧預設值，用 `??` 只在
  DB 值為 `null`/`undefined` 時套用（存過一次之後就是使用者自己的值，行為同 AVA 表單 `checklistDue` 的 seed 邏輯）：
  `basic` → 該專案自己的 AVA 表單連結（`AVA_FORM_BASE_URL + "?p=" + project.id`）、
  `faq` → 固定 `https://kms.aiello.ai/dashboard`、
  `guestWeb` → 有 GW 產品且已填 `hotel_id` 時才給 `https://spi.aiello.ai/<hotel_id>/guest_web_builder`，否則空字串。
  三者皆可在 UI 手動覆蓋。
- **已知安全缺口（2026-07-21 發現，尚未修）**：上面那 10 張表 + `projects` 的 UPDATE + `project_progress` 的 SELECT，
  anon RLS policy 目前都是 `USING(true)`——`?p=` 連結只是前端過濾，資料庫層沒有真的限制只能讀寫該 project。
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
