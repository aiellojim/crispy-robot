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

## 2026-07-23 進度更新

- **風險點已排除**：COZZI Blu 桃園館、台北洲際酒店的 `showcase_sections`/`showcase_cards` 資料經 Jim 確認是他自己填的測試資料，不是真實飯店資料，可忽略/可清掉。**不需要過渡期機制**，直接照原計畫拆 AVA 表單的 Showcase 分頁即可（見上方「AVA 表單要拆除的部分」）。
- **分頁路由已定案**：單頁 + hash 區分，`?p=<project.id>#showcase` / `#ads` / `#qr`。
- **新網站已建好第一版**：`/Users/jim.chao/AVA UI settings/index.html`（單檔 vanilla JS/HTML，風格照抄 AVA 表單的 CSS 變數/header/sidebar，`?p=` 無登入模式，沿用同一顆 supabase-js client + anon publishable key）。
  - Showcase：`renderShowcase`/`renderShowcaseEditorHtml`/`renderShowcaseCardBox`/`wireShowcaseEditor` 從 AVA 表單原樣搬過來（拿掉了 AVA 表單專屬的「小美犀畫面即時預覽」兩層 mock，因為那是給飯店端看小美犀螢幕長怎樣用的，新網站是純編輯器，之後如果 Jim 想要預覽可以再加回來）。
  - 廣告設定／Pop-up QR：目前完全沒實作過，這次**新設計**成跟 showcase card 一樣的結構（共用圖片＋per-language 的 title/text/url），多加一個 `active` 開關可以暫時關閉不刪除。UI 是共用的 `renderFlatCardList()` 函式，兩邊各自傳文案參數。
  - 新表：`ad_settings`、`qr_popups`（欄位仿 `showcase_cards`：`id`/`project_id`/`image_url`/`content jsonb`/`sort_order`/`updated_at`/`created_at`，多一個 `active boolean`），RLS 兩條 anon-via-link + staff-full-access，`project_id` 有 FK ON DELETE CASCADE 到 `projects.id`（比照 `showcase_sections`）。`docs/todo.md` 待辦 #6 的缺口總數已更新成 17 張。
- **驗證方式**：這個沙盒環境的出站網路只allowlist 特定網域，直接用 anon key 從 Node/curl 打 `*.supabase.co` 會被 proxy 擋掉（403 blocked-by-allowlist），沒辦法在瀏覽器外對 `index.html` 實際發請求做端對端測試。改用 Supabase MCP 的 `execute_sql`／`apply_migration`／`get_advisors` 做等效驗證：
  1. 建了一個 `TEST — showcase-ads-qr smoke test` 的假 project row，手動跑跟 `fetchProjectState`/`diffRepeater`/`syncToSupabase` 邏輯對應的 SQL（insert/update/select join/delete），確認資料形狀、join、cascade 都正確。
  2. `get_advisors(security)` 確認 `ad_settings`/`qr_popups` 的 RLS policy 跟 `showcase_cards` 完全同款（已知的、可接受的缺口，不是新問題）。
  3. 測試完把假 project 刪掉，cascade 確認 `showcase_sections`/`ad_settings`/`qr_popups` 都清空。
  4. **還沒做**：真的在瀏覽器打開 `index.html?p=<真實或測試 project id>` 用眼睛看渲染、實際點擊編輯存檔——這步驟這個 session 做不到（沒有可用的瀏覽器/GUI 存取），**下一個 session 或 Jim 自己要做這一步**，才算符合 CLAUDE.md 判準區 #3「前端 = build 通過 **且** 實際頁面確認」的完成定義。目前只能算「資料層驗證過，UI 還沒肉眼確認」。

## 2026-07-23 第二次更新：AVA 表單 Showcase 分頁已拆除

Jim 確認 AVA 表單目前只有他自己在操作、還沒對外開放，沒有風險，且本來就要分流開發，所以不用等新網站肉眼驗證過再拆——已直接動手拆除。

- **AVA 表單（`/Users/jim.chao/AVA basic settings/index.html`）已完成的拆除**：
  - `SECTIONS`/`AVA_ONLY_SECTIONS`/`SECTION_RENDERERS` 移除 `showcase` 條目。
  - 整組 `renderShowcase`/`renderShowcaseCardBox`/`renderShowcaseEditorHtml`/`wireShowcaseEditor`/`renderShowcasePreviewHtml`/`renderShowcaseCardModal`/`wireShowcasePreviewInner`/`refreshShowcasePreview`、`showcaseEditLang`/`showcasePreviewScreen`/`showcasePreviewActiveSi`/`showcasePreviewExpandedCi`/`SC_INPUT_STYLE`/`showcaseLangOptions()`、以及 `IMG_SHOWCASE_HOME_SAMPLE`（2.7MB 的 base64 佔位圖常數）都移除了。
  - `defaultState()`/`withFriendlyDefaults()`/`rowsToState()`/`fetchProjectState()`/`syncToSupabase()`/`diffShowcaseCards()`/realtime 訂閱裡對 `showcase_sections`/`showcase_cards` 的讀寫與訂閱全部移除。
  - 不再使用的 `qrcodejs` CDN script 也拿掉了（只有 Showcase 即時預覽的卡片詳情會用到 QRCode，新網站自己有一份獨立的）。
  - `OVERVIEW_CHECKLIST` 的 `ui_custom` 這條改回 `goto:null`；`checklistExternalUrl()` 新增 `case "ui_custom": return o.sheetLinks.showcase || "";`——**跟 Jim 這次的指示一致：「前往」按鈕網址改帶 hotel-dashboard 裡 PM 填的 `sheet_links.showcase`**（新網站連結），不是自動產生的連結。
  - 已用 `node --check` 驗證整個 module script 語法正確、大括號配對正確；已跑 `grep` 確認沒有殘留的 `state.showcase`/`showcaseEditLang`/`SC_INPUT_STYLE`/`IMG_SHOWCASE_HOME_SAMPLE` 等死碼。
  - 已 commit（用 handoff 文件裡提到的 rsync-scratch workaround 繞過這個沙盒的 `.git/index.lock` 怪癖），還原點 tag `pre-showcase-removal-2026-07-23`。**但這個沙盒環境沒有設定 GitHub 認證，`git push` 失敗（"could not read Username for 'https://github.com'"）——commit 還留在本機，要 Jim 自己在有權限的環境跑 `git push`，或提供認證。**
  - **還沒做**：實際在瀏覽器打開 AVA 表單，肉眼確認總覽頁 checklist 的 UI Customization 那一列「前往」按鈕正確顯示/正確帶到 `sheet_links.showcase`、其餘分頁沒有因為這次刪除而壞掉。這個沙盒沒有瀏覽器可測，需要 Jim 或下一個 session 補做，才符合 CLAUDE.md 判準區 #3 的完成定義。
- **hotel-dashboard 的 `sheetLinks.showcase`/`ad`/`popupQR` 自動預設值維持不變**（Jim 這次明確說先不用動，PM 端維持手動貼新網站連結）——這不是「還沒決定」，是**這次刻意排除的範圍**，除非 Jim 之後主動要求，否則不用主動再提。

## 2026-07-24 第三次更新：Showcase 編輯改成 modal（一次填完所有語言）

Jim 回報：實際後台設定 Showcase 內容時是每張卡片一次設定所有語言，但表單分開切換語言填很不順手。給了內部工具截圖當參考（上方語言 tab、下方區塊橫向 tab bar＋新增/⋮編輯、卡片表格列表）。用 visualize 工具畫了方案 A（modal 編輯，比照內部工具）跟方案 B（同頁全語言堆疊）比較卡片給 Jim 選，Jim 選方案 A。

已實作（`AVA UI settings/index.html`）：
- 新增/編輯區塊、新增/編輯卡片都改成 modal（`scModal` state + `renderScModalHtml`/`wireScModal`），modal 裡把所有支援語言的欄位一次列出，不用切換 tab；Cancel 直接丟棄草稿（`scModal.draft`），只有按 Save 才寫回 `state.showcase`。
- 原本的「編輯語言」右側 tab 移到頁面上方橫排，語意變成「瀏覽語言」——只決定區塊 tab 名稱／卡片表格／即時預覽目前顯示哪個語言，不再限制編輯範圍。
- 區塊改成橫向 tab bar：`renderScSectionBarHtml`/`wireScSectionBar`，"+" 新增、每個 tab 旁「⋮」重新叫出編輯 modal。
- 卡片改成表格（`renderScCardTableHtml`/`wireScCardTable`/`refreshScCardTable`）：名稱/照片/QR Code/介紹欄位（QR Code 欄直接渲染縮圖，不是內部工具截圖裡的「點擊」按鈕——效果一樣但少一次點擊，之後 Jim 覺得不好用可以再改回按鈕+彈窗），上方有快速搜尋（依標題篩選）。
- 資料庫結構完全沒變（`showcase_sections.names`／`showcase_cards.content` 本來就是 `{語言:內容}` 物件），純前端改動，不影響先前驗證過的 CRUD/RLS 結論。
- 順手補上一個先前遺漏：`.modal-overlay`/`.modal-box` 的 CSS 一直沒定義（即時預覽卡片詳情彈窗用到但樣式表沒有），這次一併補上。
- 已用 node 靜態驗證：`node --check` 全檔語法通過、大括號/括號配對正確、逐一核對所有 `getElementById`/`querySelectorAll` 用到的 id/class/data 屬性都有對應的 HTML 輸出（沒有打錯字的死連結）。**沒有瀏覽器可以肉眼跑過整個新增/編輯/刪除流程**，這步驟一樣要 Jim 或下一個 session 補做。
- 已 commit（fbd9ee2），一樣需要 Jim 自己 `git push`。

## 2026-07-24 第四次更新：7 項細節修正

Jim 截圖回報用起來的問題，逐一修掉（commit 9ba7a09）：
1. 語言列（`.sc-lang-strip`）跟區塊 tab（`.sc-section-tab-row`）樣式明確做出差異，不再都用 `.cmdtab`。
2. 區塊 tab 改成底線樣式（有選取=粗體+底線，未選=灰字），名稱和「⋮」編輯鈕合併成一顆（無邊界），⋮ 有自己的圓形 hover/click 高亮（`.sc-section-dots`）。
3. 新增區塊/新增卡片按鈕改用 SVG 加號圖示（新增 `ICON_PLUS` 常數，仿 AVA 表單 `ICON_DOWNLOAD` 的寫法：`.btn-icon` + inline svg），不再是純文字「+」；順手把 Ads/QR 共用的新增按鈕也一併改掉，維持風格一致。
4. **修掉一個實質 bug**：modal 開啟時會先「卡在灰框裡再跳到畫面最上方」——原因是 modal 之前渲染在 `.panel` 內，而 `.panel` 有 150ms 的 fade-in 動畫（`transform:translateY(...)`），動畫進行中的 `transform` 會讓該元素變成它內部 `position:fixed` 子孫的 containing block，導致 modal 在動畫這 150ms 內被限制在 panel 的框框裡、動畫結束後才「跳」到正確的全螢幕置中位置。修法：新增一個跟 `.panel` 平行、不受動畫影響的 `#modal-root`（`.layout` 的 sibling），modal 一律渲染到那裡；`renderActivePanel()` 也補上離開 Showcase 分頁時清掉殘留 modal 的保護。
5. 編輯卡片的鉛筆圖示改成簡單 SVG（`ICON_EDIT`），跟刪除鍵共用 `.sc-row-actions` flex 容器，確保上下邊界對齊。
6. 表格裡的 QR Code 縮圖從 64x64 縮到 52x52，跟圖片縮圖同尺寸（新增 `.qr-holder-sm`）。
7. 編輯卡片 modal：圖片上傳後，圖片預覽下方新增一行提示文字＋下載按鈕（仿 AVA 表單 `ICON_DOWNLOAD` 的 `<a download>` 寫法），方便需要時把目前存的圖片（base64）備份下載。
- 一樣做了 node 靜態驗證（語法、大括號/括號配對、所有 id/class/data 屬性的 JS 查找都對應得到 HTML 輸出），**沒有瀏覽器可以肉眼跑過**，麻煩 Jim push 後實際點過一輪確認，尤其是第 4 點的 modal 跳動有沒有真的修好。
- **Vercel 部署已確認可用**：Jim 把 `aiellojim/AVA-UI-settings` repo 連上 Vercel project `ava-ui-settings` 後，第一次 push 沒有立即觸發部署（懷疑是連接建立前的舊 push，webhook 當時還不存在），補一次新 commit push 後有正常觸發，只是那次 build 排隊比平常慢，非問題。之後如果部署明顯變慢，先看 Vercel 專案的 Deployments 分頁狀態（Building/Queued）判斷是不是真的卡住。

## 2026-07-24：新網站接上 Jim 自己的 GitHub repo + Showcase 即時預覽補回來

- Jim 在 GitHub 建了新 repo，本機 `git init` + `git remote add origin` + push 連上了（這步是 Jim 自己在他自己的終端機做的，不是這個沙盒）。
- 補回 Showcase 的「AVA 裝置畫面即時預覽」（screen 1 首頁熱區、screen 2 側邊欄+卡片輪播+點卡片展開 QR code 詳情）——這是上次搬移時刻意省略的部分（純編輯器優先）。做法：從 AVA 表單 `pre-showcase-removal-2026-07-23` 這個 git tag 撈回原始程式碼（`renderShowcasePreviewHtml`/`renderShowcaseCardModal`/`wireShowcasePreviewInner`/`refreshShowcasePreview` 四個函式 + `IMG_SHOWCASE_HOME_SAMPLE` 2.7MB base64 佔位圖常數），改名避免跟新網站共用的 `editLang` 撞名（`showcasePreviewScreen/ActiveSi/ExpandedCi` → `scPreviewScreen/ActiveSi/ExpandedCi`），接回 `renderShowcase()`。base64 圖片是用 bash/python 直接在檔案間搬移，never 讀進對話 context，避免踩到 lessons 提過的「base64 單行超長觸發 token 上限」的坑。
- 已用 `node --check` 驗證語法、確認大括號/括號配對、確認沒有殘留的舊變數名。純前端渲染改動，沒有動到 Supabase 資料層，不影響上次驗證過的 CRUD/RLS 結論。
- 已 commit（同樣的 rsync-scratch workaround；這次額外踩到一個新坑：scratch 目錄裡 `git commit` 會報 `Author identity unknown`，即使 `git config --global user.name/user.email` 在別的地方看起來已經設好——猜測跟這個沙盒每次 bash 呼叫都是全新環境、只有磁碟狀態會留下但某些 git 的全域設定解析在 scratch 目錄下失效有關。工作繞法：在 scratch repo 內額外跑一次 repo-local 的 `git config user.name`/`user.email` 再 commit）。**一樣沒有 GitHub 認證，`git push` 需要 Jim 自己做。**

## 2026-07-24 第五次更新：版面 3 項調整 + 搜尋欄中文輸入／預覽換行 2 個 bug

- 版面 3 項調整（commit d672884）：Showcase 分頁副標文字改成三語同步的簡化版本；語言切換改回平均分配的 pill badge，新增區塊按鈕固定在區塊列右側（可左右滑動、跟新增卡片按鈕對齊）；卡片清單表格欄寬改成固定比例（圖片/QR 窄、名稱/介紹寬，操作鈕固定釘在最右）。
- Jim 回報 2 個 bug（commit 3e58d8f）：
  1. **卡片名稱搜尋欄打不了中文**：根因是舊版 `refreshScCardTable()` 每次打字都整個重建 `#sc-table-root`（含 `#sc-search-input` 本身），輸入框 DOM 節點被銷毀重建會打斷瀏覽器的 IME 組字狀態。修法：把搜尋列（含 input、新增卡片鈕）跟卡片清單/表格拆開，前者維持穩定不重建，新增 `#sc-card-list-root` 只重建清單/表格部分；`#sc-search-input` 額外加上 `compositionstart`/`compositionend` 事件，組字中不觸發重新渲染，組字結束才套用篩選。
  2. **即時預覽的卡片文字沒吃 Enter 換行**：`renderShowcasePreviewHtml()` screen 2 卡片簡述 `<div>` 少了 `white-space:pre-line`（展開後的卡片詳情 modal 原本就有），補上即可。
- 一樣做了 node 靜態驗證（語法檢查、id/class 對應檢查），**沒有瀏覽器可以肉眼跑過**，麻煩 Jim push 後實際測試中文輸入法搜尋、以及多行文字在預覽卡片上的換行顯示。

## 2026-07-24 第六次更新：新網站加上「提交 / 更新」按鈕 + form-submit-notify 改支援多來源

- Jim 要求 AVA UI settings 加一顆跟 AVA 基本設定表單一樣的「提交 / 更新」按鈕：樣式沿用既有 `.btn.primary`、三語 i18n、點擊後二次確認（confirm 文案原封不動比照 AVA 基本設定表單），確認後 email 通知 `avapjm@aiello.ai`。
- **共用 `form-submit-notify` Edge Function**，而不是另開一支：發現這支 function 完全沒有被任何 repo 追蹤（純部署在 Supabase，找不到原始碼檔案）——已補進 `hotel-dashboard/supabase/functions/form-submit-notify/index.ts`，比照 `send-push`/`send-email`/`jira-proxy`/`customer-access-manage` 這幾支既有函式的版控慣例。
- Function 介面變更（新增可選 `source` 參數）前，先在三個相關 repo（`AVA UI settings`／`AVA basic settings`／`hotel-dashboard`）都打了 `pre-submit-button-2026-07-24` git tag 還原點。
- 改動內容：
  1. `form-submit-notify`：新增 `SOURCE_LABELS` 對照表（`basic_settings` → 「基礎設定表單」、`ui_settings` → 「Showcase／廣告／QR Code 設定表單」），信件標題與內文的來源字樣改吃這個對照表；同時把原本寫死的「AVA 基本設定表單」字樣改成「基礎設定表單」（Jim 指出：現在基本設定表已經不只涵蓋 AVA 這個產品線）。缺省 `source` 一律 fallback 到 `basic_settings`，向下相容不帶這個欄位的舊呼叫。已透過 Supabase MCP `deploy_edge_function` 部署（version 3）。
  2. `AVA basic settings/index.html` 的 `notifySubmit()`：明確加上 `source:"basic_settings"`（原本就是預設值，明確帶出來避免未來預設值調整時被誤傷）。
  3. `AVA UI settings/index.html`：header 新增 `submitBtn`，新增對應的 `notifySubmit()`（帶 `source:"ui_settings"`），沒有另外持久化「已提交」時間戳——AVA 基本設定表單的 `submittedAt`/`form_submitted_at` 目前也只是存著、沒有任何畫面真的顯示它，所以這次先不新增對應欄位/schema，純粹是點擊→二次確認→寄信的流程。如果之後要在畫面上顯示「已提交」狀態，需要另外討論要不要幫 `projects` 或新表加欄位。
- 已用 `node --check` 驗證兩個網站的語法、id/class 對應；**沒有瀏覽器可以肉眼跑過、也沒有實際觸發過信件**（Supabase Edge Function 需要真實 HTTP 呼叫，這個沙盒的 outbound network 被 allowlist 擋掉，連 `*.supabase.co` 都連不到），麻煩 Jim push 後實際點一次「提交 / 更新」，確認：(a) 兩語言按鈕文案／confirm 對話框正常，(b) `avapjm@aiello.ai` 真的有收到信、且標題正確顯示「Showcase／廣告／QR Code 設定表單」而不是「基礎設定表單」。

## 下一個 session 開場建議

新 session 連結資料夾：這份 handoff 提到的三個地方都要連結——本 repo（`hotel-dashboard`，看這份文件、
`docs/todo.md`、`docs/architecture.md`）、`AVA basic settings`（照上面清單移除 Showcase 分頁）、
以及 Jim 新建的第三個資料夾（新網站的 repo）。開場請 Claude 先讀本檔 + `docs/architecture.md` 的
「AVA 表單」節，再開始動工。
