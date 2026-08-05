# jsx 章節地圖 — `src/hotel-project-dashboard.jsx`

> 產出基準：commit `1046d95`（2026-07-03，由 scanner subagent 實掃；當日全檔 3,979 行）。
> **行號會隨改動漂移，一律以「名稱」欄的字串 grep 定位，行號僅供判斷位置量級。**
> 用法：查表 → `grep -n "<名稱>" src/hotel-project-dashboard.jsx` → 只讀該區段（Read 加 offset/limit）。**禁止整檔讀取。**
> 本檔可由模型自行更新：大幅改動 jsx 後，重掃並更新對應列與檔頭 commit hash。

## Imports / Export

- Imports：`react`（useState/useMemo/useEffect/useCallback/useRef）、`@supabase/supabase-js`（createClient）。無其他外部套件。
- 環境變數：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`、`VITE_GEMINI_API_KEY`。
- Export：僅 `export default function App`（位於約第 3634 行）。

## 區塊地圖（依檔案內出現順序）

| 名稱（grep 用） | 約略行號 | 說明 |
|---|---|---|
| `const sb = createClient` | 5–8 | Supabase client 單例 |
| `PRODUCTS` / `INTEGRATIONS` / `COUNTRIES` / `PRODUCT_COLORS` | 11–17 | 產品、串接、國家清單與產品顏色 |
| `BASIC_ITEMS` / `FAQ_ITEMS` / `ACA_ITEM` / `BATCH2_ITEMS` / `GW_ITEM` | 19–27 | 各階段 checklist 項目定義與 link key |
| `CAL_COLORS` | 30–37 | 行事曆事件顏色 |
| `const C = {` | 39–58 | 全域顏色 / 樣式 token（2026-08-05 已完成 C.blue→C.accent 改名） |
| `baseInput` | 59–64 | 共用 input 基礎樣式 |
| `const GLOBAL_CSS` | 65–199 | 全域 CSS 字串（含淺/深色主題變數） |
| `daysUntil` `fmtDate` `getFlags` `calcTotal` `calcPct` `newTask` `dbToUi` `uiToDb` `newProject` | 201–297 | 純工具函式群：日期、進度計算、DB↔UI 轉換 |
| `LinearProgress` / `ProgressCard` | 300–326 | 進度條與進度卡片 |
| `Icon` / `ICONS` / `AielloLogo` / `Ico` | 327–380 | SVG icon 元件與 path 定義、Logo |
| `MiniBar` / `Card` / `SectionLabel` / `SectionCount` | 381–411 | 版面小元件 |
| `renderRichText` / `RichText` | 412–457 | 富文字（連結/換行）解析渲染 |
| `FInput` `Chip` `CheckRow` `NoteArea` `SheetLink` `NavRow` | 458–535 | 表單元件群 |
| `OvCheckRow` `OvCard` `OvBatch2Row` | 536–588 | 專案總覽頁唯讀元件 |
| `FilterSelect` / `THEME_OPTIONS` / `ThemeToggle` | 589–633 | 篩選下拉與主題切換 |
| `VAPID_PUBLIC_KEY` `urlBase64ToUint8Array` `subToKeys` `getOrCreateSub` `updateSub` `deleteSub` | 634–673 | **Web Push 區**：訂閱管理（讀寫 `push_subscriptions`） |
| `NOTIFY_OPTIONS` / `NotificationPanel` | 675–853 | 通知設定面板（訂閱專案、提前天數、取消訂閱） |
| `InAppNotifModal` | 854–949 | 站內即時通知彈窗（緊急 / 客戶通知） |
| `CalendarPage` | 950–1311 | 行事曆頁（任務新增/刪除，寫 `tasks` 表） |
| `HomePage` | 1312–1622 | 首頁：專案列表、地區/PIC 篩選、統計 |
| `GEMINI_API_KEY` / `renderMarkdown` / `AiPanel` | 1623–1908 | **Gemini AI 區**：AI 助理面板（fetch Gemini API） |
| `CustomerAccessPanel` | 1909–2072 | 客戶後台帳號管理（呼叫 `customer-access-manage`） |
| `JIRA_PROXY` `CUSTOMER_ACCESS_MANAGE` `JIRA_ANON` `JIRA_STATUSES` `statusStyle` `jiraFetch` `parseEpicId` | 2073–2115 | **Jira 設定/函式區**：endpoint、狀態樣式、共用請求 |
| `JiraTab` | 2116–2329 | Jira 分頁；內含 `fetchIssues`(≈2127)、`handleUpdateDescription`(≈2136)、`openDropdown`(≈2157)、`doTransition`(≈2166) |
| `TasksTab` | 2330–2552 | 任務分頁；CRUD `tasks` 表 |
| `ProjectDetail` | 2553–3461 | **專案詳情主元件（最大）**：各階段表單、寫 `project_progress`、Jira epic 綁定、push 訂閱同步 |
| `LoginPage` | 3462–3539 | 登入頁 |
| `UserSettingsPanel` | 3540–3633 | 使用者設定（upsert `user_profiles`） |
| `export default function App` | 3634–3979 | 根元件，見下 |

## `App` 根元件內部（3634–3979）

| 區塊 | 約略行號 | 說明 |
|---|---|---|
| State 宣告 | 3635–3651 | page/view/projects/allTasks/activeId/theme/session/profile 等 |
| Auth effect + `loadProfile` | 3655–3684 | 監聽 auth session、載入 `user_profiles` |
| 主資料載入 effect | 3686–3709 | 讀 `projects` / `project_progress` / `tasks` 組裝 |
| `handleNew` / `handleUpdate` / `handleDelete` / `handleOpen` | 3710–3756 | 專案 CRUD handlers |
| `urgentNotifs` / `fetchCustomerNotifs` / 輪詢 effect | 3757–3795 | 通知邏輯（讀 `notifications` 表） |
| 渲染分支 | 3796–3979 | authLoading → LoginPage → loading → 主畫面 |

## 其他檔案

- `src/App.jsx`（122 行）：Vite 官方樣板 counter，**與本專案無關**，勿誤讀。
- `src/main.jsx`（8 行）：進入點。
- `customer-portal/Dashboard.jsx`：**不存在於本 repo**（2026-07-03 查證），位置未確認。
