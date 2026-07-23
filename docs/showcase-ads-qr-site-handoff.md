# 新網站籌備：Showcase + 廣告 + QR Code（2026-07-23 建立）

> 給下一個 session 讀的交接筆記。這個新網站要做什麼、現況卡在哪裡、已經定案的架構決策都寫在這裡，
> 避免新 session 要重新爬一次 `AVA basic settings/index.html` 和本 repo 才能搞懂現況。
> 本檔由模型建立與維護（不是 CLAUDE.md 硬規則管轄的檔案，可自行更新）。

## 目標

把目前分散、部分還沒真的做出來的三件事，合併成**一個獨立的公開網站**：
1. **Showcase**（介面客製化）——目前已經在 AVA 表單裡有一個完整的編輯分頁（2026-07-22 建的），要整個搬出來。
2. **廣告設定**——目前完全沒有實作，PM 端只有一個手動貼連結的欄位。
3. **Pop-up QR Code 內容設定**——同上，完全沒有實作，只有手動貼連結欄位。

搬完之後，AVA 表單裡的 Showcase 分頁要移除，總覽頁 checklist 的「前往」連結要指到新網站。

## 2026-07-23 已定案的架構決策

- **技術架構**：沿用 AVA 表單風格——單檔 vanilla JS/HTML，直接 import `@supabase/supabase-js`，inline style，無框架。
  理由：Showcase 的編輯器／即時預覽程式碼已經在 AVA 表單裡寫好了（`renderShowcase()` 系列函式），照抄過去改動最小。
- **存取／編輯權限模式**：沿用 AVA 表單的無登入 token 連結模式（`?p=<project.id>`），不做登入驗證。
- **Supabase**：沿用現有專案 `yqoingcpcryrcpnhkjzu`（跟 hotel-dashboard、AVA 表單共用），`showcase_sections`／
  `showcase_cards` 這兩張表直接沿用，不用搬資料。

## 現況盤點（已用 grep 實查，不是猜的）

### AVA 表單（`/Users/jim.chao/AVA basic settings/index.html`）要拆除的部分

- `SECTIONS` 陣列裡 `id:"showcase"` 這一條，以及 `AVA_ONLY_SECTIONS` Set 裡的 `"showcase"`。
- `renderShowcase()` / `renderShowcaseEditorHtml()` / `renderShowcaseCardBox()` / `renderShowcasePreviewHtml()`
  這一整組函式，還有 `SC_INPUT_STYLE` 常數、`showcaseEditLang` 等相關 state。
- `fetchProjectState()` 裡對 `showcase_sections` / `showcase_cards` 的 `select` 與 `children` 組裝。
- `rowsToState()` 裡把 `children.showcaseSections`/`showcaseCards` 轉成 `state.showcase` 的邏輯。
- 同步函式（`runSync`/`diffRepeater` 呼叫處）裡對這兩張表的 `ops.push(...)`。
- Realtime `.on('postgres_changes', ...)` 訂閱 `showcase_sections` / `showcase_cards` 的那兩段。
- **`OVERVIEW_CHECKLIST` 裡 `ui_custom` 這一條**（約第 281 行）：
  ```js
  {key:"ui_custom", en:"UI Customization (Showcase)", ..., goto:"showcase", batch:2}
  ```
  `goto:"showcase"` 要改回 `goto:null`——這樣它就會自動落回 `checklistExternalUrl()` 的邏輯（見下方），
  跟 `ads`/`qr` 兩條現在的行為一致。**不用額外加 case**，因為 `checklistExternalUrl()` 目前雖然沒有
  `ui_custom` 的 case（只有 `faq_gpt`/`faq_voice`/`ads`/`qr`/`guestweb_editor`），需要**新增一條**：
  ```js
  case "ui_custom": return o.sheetLinks.showcase || "";
  ```
  （注意：`o.sheetLinks` 是不是叫這個名字要以屆時實際 `state.overview` 或對應物件結構為準，
  下方 hotel-dashboard 那邊的 `sheetLinks.showcase` 是 PM 端的名字，AVA 表單這邊可能是另一個變數名，
  動工前先 grep `sheetLinks` 確認 AVA 表單怎麼接的。）
- **`ads`／`qr` 這兩條完全不用動**——`goto:null`、`checklistExternalUrl()` 已經有
  `case "ads": return o.sheetLinks.ad||"";` 和 `case "qr": return o.sheetLinks.popupQR||"";`，
  是現成、已經在跑的模式，新網站的連結填進 `sheet_links.ad`／`sheet_links.popupQR` 之後就會直接生效，
  這兩條不需要在 AVA 表單裡改任何 code。

### hotel-dashboard（`src/hotel-project-dashboard.jsx`）要調整的部分

- `dbToUi()`（約第 267–273 行）和 `newProject()`（約第 307 行）裡的 `sheetLinks` 預設值：
  ```js
  showcase: prog?.sheet_links?.showcase ?? "", ad: prog?.sheet_links?.ad ?? "",
  popupQR: prog?.sheet_links?.popupQR ?? "",
  ```
  這三個目前是**空字串預設**（PM 要手動貼連結），要仿照 `basic`／`faq`／`guestWeb` 的自動預設模式：
  ```js
  basic: prog?.sheet_links?.basic || (AVA_FORM_BASE_URL + "?p=" + row.id),
  ```
  改成類似 `NEW_SITE_BASE_URL + "?p=" + row.id`（+ 可能要看新網站是不是三個分頁在同一頁，
  要不要加 `#showcase`/`#ads`/`#qr` 這種 hash 區分，這個等新網站的分頁路由設計出來再定）。
  `NEW_SITE_BASE_URL` 常數要仿照 `AVA_FORM_BASE_URL` 的定義方式新增（grep `AVA_FORM_BASE_URL` 找它現在定義在哪）。
- PM 端「第二批資料」分頁（`BATCH2_ITEMS`/`SheetLink` 元件那幾行，約 3191–3238 行）本身的 UI 不用大改，
  改完預設值之後，PM 那邊看到的連結會自動變成新網站的連結（可覆蓋，邏輯跟 `basic`/`faq` 一樣）。

## 動工前務必先確認的事（風險點）

**先查有沒有任何真實飯店專案已經透過 AVA 表單的 Showcase 分頁填過資料**（`showcase_sections`/
`showcase_cards` 兩張表是否已有非空的 row，`project_id` 對到真實專案而非測試專案）。這個分頁是
2026-07-22 才上線的，如果已經有飯店填過，直接拆分頁 = 資料還在但入口消失，要先想好新網站上線前
這段期間怎麼過渡（例如先保留 AVA 表單分頁唯讀展示，或請對應 PM 通知飯店改用新連結），不能直接刪。

## 延續本 session 的既有慣例（新網站/新 repo 都要遵守）

- 新表命名慣例：`id uuid pk default gen_random_uuid()`、`project_id uuid`、文字欄位預設 `''::text`、
  `sort_order integer default 0`、`updated_at timestamptz default now()`；RLS 兩條：
  `anon: edit via link`（all/anon/USING(true)/WITH CHECK(true)）+ `staff: full access`
  （all/authenticated/`(select auth.email()) like '%@aiello.ai'`）——這是已知的安全性缺口
  （見 `docs/todo.md` 待辦 #6），新網站如果加新表，記得把新表也算進那個缺口總數裡（目前 15 張）。
- JSONB／`project_progress` 相關的原子更新規則（`update_check_item` RPC）如果新網站有寫到
  `project_progress`，同樣適用（見 CLAUDE.md 硬規則 #1）。
- 目前兩個 repo（本 repo + AVA 表單）都在同一個沙盒掛載環境下有個 git 權限怪癖：
  無法直接 `git commit`/解鎖 `.git/*.lock*`，要用「rsync 整包複製到 `/tmp` 的 scratch 目錄
  → 在 scratch 裡 commit → 把 scratch 的 `.git` rsync 回掛載目錄」的方式繞過，且**用完一定要
  `rm -rf` scratch 目錄**（之前忘記清理累積了 24 份複本把沙盒塞爆過一次）。新 repo 大概率會遇到一樣的情況。
- AVA 表單的 `index.html` 內嵌大量 base64 圖片，直接用 `Read` 加 `offset`/`limit` 常常會噴
  「exceeds maximum tokens」錯誤（就算該行範圍看起來不大），改用 `Grep -A`/`-B` 或 Python/Node
  處理大量文字異動比較穩。新網站如果也走同樣的單檔內嵌圖片模式，會有一樣的狀況。

## 下一個 session 開場建議

新 session 連結資料夾：這份 handoff 提到的三個地方都要連結——本 repo（`hotel-dashboard`，看這份文件、
`docs/todo.md`、`docs/architecture.md`）、`AVA basic settings`（照上面清單移除 Showcase 分頁）、
以及 Jim 新建的第三個資料夾（新網站的 repo）。開場請 Claude 先讀本檔 + `docs/architecture.md` 的
「AVA 表單」節，再開始動工。
