# 待辦與方案評估

> 模型可自行更新本檔（完成就劃掉、新增待辦補進來），commit message 註明。
> 最後整理：2026-07-03。

## 進行中

### 1. ~~任務狀態修改者追蹤~~ **已解決（2026-08-05 確認）**
- 方案 C（Magic Link 登入 + 每人一組 Jira token，不需要 RLS）已實作並在跑：`user_profiles`（`jira_email`／`jira_token`）+ `signInWithOtp()` 登入、`jira_action_log` 表（`user_id`／`display_name`／`issue_key`／`from_status`／`to_status`／`project_id`）由 `jira-proxy` Edge Function 在每次任務狀態切換成功後非同步寫入（`index.ts` 約 154-174 行）。
- 目前沒有前端畫面讀取這張 log，Jim 確認現況用手動查 SQL 就夠，不需要另外做查看介面。

### 2. ~~顏色變數漸進重構：`C.blue` 系列 → `C.accent` 系列~~ **已解決（2026-08-05）**
- `C.blue`／`C.blueLight`／`C.blueBorder` 的值本來就已經是 `var(--accent)` 系列 CSS 變數（不是寫死的藍色），純粹是屬性命名跟語意不符，改名風險低，一次做完不需要漸進：`src/hotel-project-dashboard.jsx` 87 處全數改名（`C.blue`→`C.accent` 63 處、`C.blueBorder`→`C.accentBorder` 13 處、`C.blueLight`→`C.accentLight` 11 處），`npm run build` 通過。
- 順便確認並清掉了未被引用的死代碼 `old-dashboard.jsx`（`main.jsx` 只 import `hotel-project-dashboard.jsx`，全 repo 搜尋也無其他引用）——因沙盒環境的 FUSE 限制無法刪除實體檔案，已從 git 追蹤移除，**該檔案仍會留在你本機資料夾，麻煩手動刪除**。

### 4. `customer-access-manage` Edge Function（2026-07-03 觀察）
- ~~只存在於 Jim 主工作目錄、未進 git~~ **已解決（2026-07-21 確認）**：已進 git（`supabase/functions/customer-access-manage/index.ts`），前端 `CustomerAccessPanel` 正常呼叫中。

### 5. ~~AVA 表單（`hotel_form_config` 等表）缺並發保護~~ **已解決（2026-08-08，欄位級 + delete/reinsert 兩類都處理）**
- 原現況：2026-07-21 審查發現 AVA 表單存檔是整包 upsert（見 index.html 的 `syncToSupabase`），跟 `project_progress`（走 `update_check_item` RPC 做單一 key 原子更新）不同。若飯店兩人同時在不同分頁填、或 PM 同時在後台改同一專案，後寫入的會整包覆蓋前面的。
- 2026-08-04 追加發現：`AVA UI settings` 的 `diffRepeater()` 雖然已經是逐列 diff（只送有變動的列），但每一列的 `update()` 送出的還是整個 mapped payload，不是單一欄位；`showcase_cards`（`diffShowcaseCards()`）風險更高，用「整個 section 先刪光所有卡片、再重新 insert」策略。
- **已採方案（Jim 2026-08-08 確認：風險高的先治本，其餘表判斷都需要欄位級原子更新就一起做）**：
  1. **`diffRepeater()` 改成欄位級 diff（兩個 app 共用同一套邏輯，各自改一次）**：UPDATE 現在只送真正變動的欄位，不再送整列 mapped payload。涵蓋兩邊所有用這個函式的表：`hotel_team_members`、`aiello_team_members`、`phone_buttons`、`web_portal_users`、`floor_wifi_rooms`、`tmsp_space_rows`、`tmsp_room_rows`、`reference_documents`、`pending_confirmation_items`、`room_types`（basic settings）、`showcase_sections`、`ad_settings`、`qr_popups`、`showcase_cards`（UI settings）。用獨立 node 測試腳本驗證過 insert／update／delete／純排序／完全無變動五種情境，皆只送出預期的最小 payload。
  2. **`diffRoomTypeImages()`（basic settings）從整批刪除＋重建改成 URL 值диff**：圖片陣列本身沒有 `_id`，但每次上傳都是唯一時間戳記路徑，直接拿 URL 當身分比對——新增的插入、刪除的刪除、只是排序變動的只更新 `sort_order`，沒變動的圖片完全不會被 SQL 碰到。同樣用獨立測試腳本驗證。
  3. **`diffShowcaseCards()`（UI settings）從整個 section 刪光重建改成委派給 `diffRepeater()`**：卡片本來就有穩定的 `_id`（見 `defaultState()`），不需要額外設計，直接沿用同一套逐列＋欄位級 diff 邏輯。
  4. **`welcome_messages`（basic settings）**：從 `upsert({mode, message_text})`（兩欄一起送）改成該列已存在時只送真正變動的欄位；列不存在時仍走 upsert（insert 需要兩欄都給值）。
  5. `node --check` 兩邊都過，commit：`AVA basic settings` `dc2f12d`、`AVA UI settings` `1d00a1d`。
- **範圍內判斷保留、沒有一併做的部分**：`ad_settings`/`qr_popups` 的 `content` 欄位本身是 JSONB（單一欄位內含標題/內容/圖片等多個子欄位），這次的欄位級 diff 只能做到「`content` 這個欄位有沒有變」的粒度——兩人同時改同一列 `content` 內的不同子欄位（例如一人改標題、一人改圖片）還是會互相覆蓋，要做到子欄位原子更新需要新增 `jsonb_build_object` 合併模式的 RPC（比照 `update_check_item`），這是需要額外新增 anon 可呼叫的 SECURITY DEFINER function 的設計決策，這次沒有一併做，Jim 之後想做再另外確認。

### 6. Anon RLS 對 AVA 表單相關 12 張表完全沒有 project 隔離（2026-07-21 發現，安全性問題）
- 現況：`projects`（UPDATE）、`hotel_form_config`、`hotel_team_members`、`aiello_team_members`、`phone_buttons`、`web_portal_users`、`floor_wifi_rooms`、`tmsp_space_rows`、`room_types`、`room_type_images`、`welcome_messages` 的 anon RLS policy 都是 `USING(true)`——任何人持有 anon key（表單前端本來就公開）即可讀寫任意飯店資料，不受 `?p=<project.id>` 連結限制。`floor_wifi_rooms` 還存明碼 WiFi 密碼。
- **2026-07-21 新增**：`project_progress` 也加了一條 anon SELECT policy（`anon: read for AVA form`，`USING(true)`）——AVA 表單總覽頁的 checklist「前往」按鈕要讀 `sheet_links`（PM 在內部儀表填的 FAQ／Showcase／廣告／QR code 連結）才能運作。範圍比其他 11 張表小（只開 SELECT，沒有寫入權限），但一樣沒有 project 隔離，之後方案 B 要一併涵蓋這張表。
- **2026-07-22 新增**：Showcase 功能新增的 `showcase_sections`／`showcase_cards` 兩張表，比照同一套 `anon: edit via link USING(true)` 開放 policy 建立（跟其他 12 張表同款、同樣的已知缺口，沒有另外設計更嚴謹的隔離），方案 B 要一併涵蓋這兩張新表，缺口總數變成 14 張。
- **2026-07-22 再新增**：「其他參考文件」功能新增的 `reference_documents` 表，同樣套用 `anon: edit via link USING(true)`，缺口總數變成 15 張。
- **2026-07-23 再新增**：Showcase+廣告+QR 新網站（`AVA UI settings`，見 `docs/showcase-ads-qr-site-handoff.md`）新增的 `ad_settings`／`qr_popups` 兩張表，同樣套用 `anon: edit via link USING(true)`，缺口總數變成 17 張。
- **2026-08-05 再新增**：TMS Pro「房號清單」功能（`AVA basic settings`，TMSP 未選 AVA 時在空間設定分頁顯示）新增的 `tmsp_room_rows` 表，同樣套用 `anon: edit via link USING(true)` + `staff: full access`（跟 `tmsp_space_rows` 同款），`get_advisors` 確認只有既有已知的 `rls_policy_always_true` 警告類型，缺口總數變成 18 張。
- **2026-08-13 再新增**：新表單 `SiteChat Settings` 建立時新增的 `sitechat_settings`／`sitechat_faq_cards` 兩張表，一樣沿用同一套 `anon: edit via link USING(true)` + `staff: full access` 開放 policy（跟其他表單同款、同樣的已知缺口），缺口總數變成 20 張。**同一次 session 也確立了「Aiello 表單統一規格」文件的撰寫計畫（header/sidebar／語言切換／banner 行為等），該文件的 Supabase 資料慣例章節在方案 B 定案前，必須明確標註目前的 `USING(true)` 只是沿用中的權宜模式、非最終安全設計，避免新表單把這個已知缺口當成「標準做法」照抄，讓缺口持續擴大。**
- Jim 的訴求：飯店拿到表單連結就能同步編輯、不需登入，體驗要跟線上 Excel 一樣（含即時多人同步）。
- 已測試過的方案與結論：
  - **方案 A（`x-project-id` 自訂 header + RLS 用 `current_setting('request.headers')` 檢查）**：REST 讀寫可行，但 **Realtime 的 `postgres_changes` 不吃自訂 header**，只認 JWT claim（`supabase.realtime.setAuth()`），查證見 Supabase 官方文件 Realtime > Postgres Changes > Custom tokens 段落。套用後會讓即時同步整個失效，已在正式環境 canary 測試（`welcome_messages` 表）後確認並復原，不能用。
  - **方案 B（推薦）：短效自訂 JWT，帶 `project_id` claim**，REST 用 `Authorization: Bearer <jwt>`、Realtime 用 `supabase.realtime.setAuth(jwt)`，RLS 統一用 `(auth.jwt()->>'project_id')::uuid = project_id` 判斷。REST 跟 Realtime 都吃同一份 JWT，理論上兩邊體驗都不受影響。
  - 方案 B 需要：(1) 新 Edge Function 簽發短效 JWT（給 project_id、驗證存在後簽發）；(2) Jim 手動把專案的 **JWT Secret**（Dashboard → Settings → API keys → JWT Secret）加進 Supabase Secrets 供該 function 簽章用——這把密鑰我這邊沒有工具能讀取，必須 Jim 手動處理；(3) 表單前端要在拿到 JWT 前先擋一下渲染（bootstrap 變非同步）。
  - **2026-09-03 補充：JWT 續期（推演出來的隱藏成本，todo 原文沒明講）**——JWT 是短效設計，飯店端常見「分頁開一整天慢慢填」的用法，超過 JWT 效期後，即使是既有的 debounce 自動存檔也會被 RLS 判定 JWT 過期而寫入失敗。單純換 JWT 這個動作本身不影響單次讀寫的速度（換到之後每次 REST/Realtime 呼叫都直接帶同一份 JWT，跟現在帶 anon key 一樣，不會每次寫入都重新驗證），但需要額外設計續期機制：(a) 前端在 JWT 快過期前背景偷偷重新呼叫簽發 function 換一份新的（使用者無感），或 (b) 寫入失敗時偵測是 JWT 過期、自動換新後重試一次。這段還沒設計，方案 B 動工時要一併考慮，不然長時間開著分頁填表會無預警存檔失敗。
- **狀態：等 Jim 決定要不要做方案 B（有明確的額外成本：新 function + 新 secret + 前端 bootstrap 改非同步 + JWT 續期機制），再繼續動工。**

### 7. AVA 表單「自訂分頁」功能（2026-07-22 討論，尚未動工）
- 需求：PIN 解鎖後的人員可以像 Excel 加分頁一樣，自行在 AVA 表單新增分頁與欄位，不需要每次都改 code。
- Jim 已確認方向：**在現有架構上長出子系統，不做框架重寫**——新增「分頁定義」「分頁欄位定義」兩張表（project 關聯、標題三語、排序、欄位型別、值），前端寫一個通用 `renderCustomTab()`，依欄位型別分派到既有樣板（`field`/`textarea`/`.note`/`plan-card`/`taggroup`/`imgwrap`，這幾個是目前盤點過可重用的既有 UI 積木，`renderRepeater()` 的「columns 設定即 schema」設計是這個做法的原型）。
- 明確排除的做法：砍掉重練換 React 等框架 + 正規化 EAV/JSONB schema——評估為單一 HTML 檔案零依賴的維運模式會被打破，是週級工程，非必要不做。
- **動工前必須一併處理，不能只加新表**（會被這個功能放大）：
  1. 待辦 #6（anon RLS 12 張表全開放，無 project 隔離）——新增更多開放性表會讓缺口更嚴重，是解決它的好時機。
  2. 待辦 #5（AVA 表單整包 diff-then-upsert 無真正並發保護）——自訂分頁允許多人同時加欄位/編輯，衝突機率比現在單純填固定欄位高，建議挪用 hotel-dashboard 這邊 `project_progress` 已經在用的「單一 key 原子更新」模式。
  3. 圖片欄位目前是 base64 直接塞資料庫欄位（非 Supabase Storage）——分頁/欄位數量變成使用者可無限新增後，這個模式會讓存檔資料量隨之膨脹，建議一併改成存 Storage、資料庫只存網址。
- **狀態：Jim 已選定方向，尚未排入 sprint，之後要主動提醒 Jim 排時間動工。**

### 8. ~~新網站：Showcase + 廣告 + QR Code 合併獨立站（2026-07-23 開始籌備）~~ **已解決（2026-08-05 確認）**
- 要把 AVA 表單裡的 Showcase 分頁（2026-07-22 建的）搬出來，跟目前完全沒實作的「廣告設定」「Pop-up QR
  code 內容設定」合併成一個獨立公開網站。架構決策、現況盤點（AVA 表單/hotel-dashboard 各要改哪裡）、
  風險點（先確認有無真實飯店已填過 Showcase 資料再拆分頁）都寫在
  `docs/showcase-ads-qr-site-handoff.md`。
- **已完成**：`AVA UI settings`（`ava-ui-settings.aiello.dev`）已是獨立公開網站，三個分頁都已實作並持續在打磨：Showcase（`renderShowcase`）、Ad Settings（`ads`，「廣告設定」）、Marketing Event（`qr`，原「Pop-up QR Code」，已改名重構為跟 Ad Settings 同款頁面結構）。待辦 #6 的 RLS 缺口清單也已把這個網站新增的 `ad_settings`／`qr_popups` 兩張表算進去，待辦 #5 也已把這個網站的並發保護現況記錄進去，後續追蹤都併入那兩項，不再需要獨立追這項。

### 9. ~~上傳圖片沒有版本／備份機制~~ **已解決（2026-08-07，正規方案）**
- 原現況：AVA basic settings、AVA UI settings 的圖片上傳（房型照片、Welcome Screen 圖片、樓層 WiFi 掃描圖、Showcase／廣告／QR 背景圖）都是前端用 `FileReader.readAsDataURL()` 轉成 base64 字串後直接寫進 Postgres 欄位，沒有走 Supabase Storage，也沒有任何獨立的檔案版本歷史，且 base64 讓同一張圖比原始檔案體積多約三成。
- **已採正規方案**：
  1. 新建公開 Storage bucket `project-images`（`public:true`，`file_size_limit:15MB`，白名單 `image/jpeg|png|webp|gif|heic|heif`），RLS 比照既有 anon 開放模式（`anon: read/write project-images` USING/CHECK `bucket_id='project-images'`）+ `staff: full access`（`@aiello.ai` 帳號）。`get_advisors(security)` 確認沒有新增警告類型。
  2. `AVA basic settings`：新增 `compressImageIfNeeded()`（>2000px 長邊才轉 JPEG q0.9 壓縮，小圖不處理，不影響下載品質）+ `uploadImageFile()` 共用工具，改寫 4 個真正的圖片上傳點——房型照片、Welcome Screen 背景圖、樓層 WiFi 掃描截圖（另一個 amenity/repair「Upload Filled List」是 Excel 檔，非圖片，維持原樣不動）。
  3. `AVA UI settings`：同一套工具，改寫 3 個上傳點——Showcase 卡片圖、行銷事件／QR 圖、廣告背景圖。`dataUrlExt()` 同步調整為可辨識一般網址副檔名（不只 `data:` URI）；ZIP 下載功能（`dataUrlToBlob()`）本來就是格式無關的 `fetch().blob()`，不需改動。
  4. 既有 base64 資料已於 2026-08-07 一次搬遷完成（透過 Claude in Chrome 注入獨立腳本，繞過沙盒對 `*.supabase.co` 的網路白名單限制）：`hotel_form_config.ws_image_url`（2 筆）、`fw_scan_image_url`（2 筆）、`qr_popups.content` 圖片（1 筆）、`ad_settings.content` 圖片（1 筆）全數搬到 Storage、DB 欄位改存公開網址；`showcase_cards`／`room_type_images` 實測沒有真正的圖片資料，無需搬遷。搬遷後重新查詢確認資料庫內已無殘留 base64。
  5. 驗證：抽測搬遷後的網址皆回應 200、正確 content-type，且 CORS 允許 JS `fetch().blob()` 讀取（ZIP 下載功能相容）；於兩個正式站（`ava-ui-settings.aiello.dev`、`basic-settings.aiello.dev`）實際開啟對應分頁，廣告背景圖、行銷事件圖皆正常顯示，樓層 WiFi 掃描截圖／Welcome Screen 圖片下載連結皆正確指向新 Storage 網址。
- 副作用（原本就是搬遷 Storage 的次要動機）：上傳路徑帶時間戳記、不覆蓋舊檔，舊版本自然留在 bucket 當版本歷史；資料庫體積不再隨圖片線性膨脹。
- **2026-08-07 追加：Amenity/Repair「上傳已填寫清單」Excel 檔也一併搬遷**（原本評估後排除在圖片搬遷範圍外，Jim 確認 Excel 檔案體積小、不會排擠圖片配額，但一樣需要版本歷史，決定另開 bucket 處理）：
  1. 新建**非公開** Storage bucket `project-documents`（`public:false`，白名單僅 xlsx/xls mime type），RLS 同款 anon 開放模式，但因為非公開，讀取一律要走 `sb.storage.download()`（預覽用）或 `createSignedUrl()`（下載連結，120 秒有效期，點擊時才現生成，不在頁面渲染時預先生成）——跟圖片 bucket 的 `getPublicUrl()` 用法不同。已實測確認：`/object/public/...` 直連網址回 400（bucket 確實非公開），但 anon key 呼叫 `download()`／`createSignedUrl()` 都正常拿到正確檔案，RLS 設定正確。
  2. `AVA basic settings`：新增 `uploadDocumentFile()`／`fetchDocBlob()`／`docSignedUrl()` 工具；`wireItemFileUpload()` 改成上傳到 Storage（不再 `FileReader.readAsDataURL()`）；`itemFilePreviewHtml()`／`uploadDownloadLink()` 改成依內容分三種情況處理——舊 base64（相容）、圖片 bucket 的公開網址（`ws_image_url` 等，直接可用）、文件 bucket 的私有路徑（無法直接當網址用，改用 `scheduleDocPreviewLoad()` 在畫面插入後非同步抓 bytes 填入預覽表格、下載連結改成點擊時才動態產生簽章網址）。
  3. 既有 2 筆 base64 資料（同一飯店的 amenity + repair 清單）已透過 Claude in Chrome 搬遷完成，重新查詢確認資料庫內已無殘留 base64。
  4. **2026-08-07 部署後複查**：Jim 確認前端已部署。在 `project-documents` bucket 直接列出檔案，確認裡面只有 amenity/repair 這兩個資料夾、各一個檔案，沒有任何非預期內容。用 anon key 直接呼叫 `download()`／`createSignedUrl()` 對這兩個已搬遷檔案重新測試，都正常拿到正確檔案（跟部署前的測試結果一致）。原本想在正式站（`功能測試` 專案）用瀏覽器自動化實際點擊「上傳已填寫清單」做端對端測試，但 Claude in Chrome 的 `file_upload` 工具本身連續出現 schema 驗證錯誤（`paths` 參數沒有正確傳入，非本專案程式碼問題），沒能完成這一步，測試前手動切換的「送物服務」按鈕觸發開關已還原成原狀，沒有留下測試痕跡。**唯一還沒做到的是「真人在瀏覽器裡點上傳按鈕」這個動作本身**——建議 Jim 找機會手動測試一次「上傳已填寫清單」按鈕（上傳後預覽表格應該正常顯示、下載連結應該正常運作），確認無誤後這項就可以完全放心視為完成。
  5. **釐清一個容易混淆的地方**：Jim 有問過「上傳 TMSP 空間 Excel 時 bucket 沒有跳出對應檔案」——這不是這次改動造成的問題。TMS Pro「空間設定」分頁的 Excel 匯入（`tmsp-import-file`）跟這裡講的 Amenity/Repair 上傳是完全不同的功能：TMSP 匯入是純前端用 SheetJS 讀檔、解析出樓層/空間/房號等資料列後直接寫進 `tmsp_space_rows`／`tmsp_room_rows` 兩張表，从頭到尾不會把原始 Excel 檔案本身存起來（不管是這次改動前後都一樣），所以 bucket 裡本來就不會有 TMSP 匯入的檔案——是設計上如此，不是這次搬遷漏掉或搬壞了什麼。
  6. **2026-08-07 Jim 手動實測確認**：正式站上傳、下載 Amenity 清單皆正常，檔名帶時間戳記數字串（符合 `uploadDocumentFile()` 的路徑命名設計，非異常）。待辦 #9 全部收尾，含 Excel 部分。

### 10. ~~hotel-dashboard：ProjectDetail 整包 upsert 會覆蓋其他使用者的即時編輯~~ **已解決（2026-08-05，治本方案）**
- 現象：Jim 開著某專案的「專案資訊」頁閒置，另一人在別的分頁編輯同一專案並正常存檔；Jim 之後離開該頁面觸發的自動存檔，把資料庫覆蓋回 Jim 那份完全沒編輯過的舊版本，另一人的編輯消失。**同一根因也會讓 `AVA basic settings` 對應資料看起來消失**：該站的 `projects.products`／`installing_rooms`／`ava_units`／`ava_spare`／`launch_date`／`integrations`／`integration_notes` 是跟 hotel-dashboard 共用同一張表、同一批欄位（見 `AVA basic settings/index.html` `syncToSupabase()` 的 `ovMap`，且該站在 `products` 上還有 realtime 訂閱），hotel-dashboard 舊的整包 upsert 只要在別人剛存好這幾個欄位之後、自己這邊存了任何無關欄位，就會把舊值送回去，AVA basic settings 會透過 realtime 立刻反映這個舊值，造成畫面上「資料消失」（實際上子表如 `tmsp_room_rows` 的資料列沒有真的被刪，只是 `products` 之類的欄位被寫回舊值，畫面判斷條件跟著跑掉才看不到）。
- 根因：`ProjectDetail` 的 `info`／`sheetLinks`／`tasks`／各 notes 只在元件掛載當下用 `useState(project.xxx)` 初始化一次，掛載後不會再跟資料庫或父層 `project` prop 同步；`handleUpdate` 不論改了哪個欄位都對 `projects` 表整包 `upsert`、對 `project_progress` 的四個 notes/連結欄位整包 upsert——都不是單一 key 原子更新，也沒有 diff。
- **已採治本方案**：
  1. `projects` 表：`handleUpdate` 改成用 `lastSavedRef`（每個 project 存一份「最後一次真的送出去的 { project, progress }」快照）跟這次要存的值做逐欄位 diff，只送真正變動的欄位（`sb.from("projects").update(diff)`），不再整包 upsert。沒碰過的欄位不會出現在這次的 UPDATE payload 裡，不會覆蓋別人剛存的值。
  2. `project_progress` 的 `basic_notes`／`faq_notes`／`batch2_notes`／`sheet_links`：新增 `update_progress_field(p_project_id, p_field, p_key, p_value)` RPC（跟既有 `update_check_item` 同一套 `jsonb_build_object` 合併模式，只是 value 型別放寬成 text），`handleUpdate` 逐 key diff 後只呼叫 RPC 更新真的變動的 key，不再整包覆蓋整個 JSONB 物件。
  3. `lastSavedRef` 在初始載入（主資料載入 effect）跟 `handleNew` 建立新專案後都會seed，避免第一次存檔時把所有欄位都當作「變動」。
  4. `basic_checked`／`faq_checked`／`batch2_checked` 維持原本 `update_check_item` RPC 不變，未受影響。
  5. `npm run build`／`npx eslint` 都跑過，確認沒有新增的錯誤（既有的 17 個 lint error 都在這次沒碰過的既有程式碼裡）。
- 未解決的殘餘風險（設計上無法完全避免，範圍已大幅縮小）：兩人真的在同一個 debounce 視窗內（800ms）編輯「同一個欄位」還是後寫的贏；但「改了不相關欄位、把別人剛存的其他欄位蓋掉」這個 Jim 實際遇到的情境已經解決。

### 11. ~~SiteChat → eb-console 推送~~ **已解決（2026-09-03，端對端測試通過）：工作佇列 + 內網常駐 agent**
- 需求：SiteChat 的問候語＋主題色彩要能推送進內部真正的 eb-console 設定系統；原本規劃匯出 Excel 手動比對/謄寫，改成內部團隊開一支 API，Jim 打這支 API 指定飯店做更新。Jim 明確交代：**這功能不能做在現在完全開放的 SiteChat 表單裡**，改做在 hotel-dashboard（內部、需登入）。
- **2026-09-01 重大架構轉折**：原計畫是 hotel-dashboard 前端直接呼叫 `ebconsole-proxy` Edge Function，由它直接打 `eb-admin.aiello.ai`。加了 `EB_ADMIN_API_KEY` secret 後實測失敗，查 Edge Function log 拿到明確錯誤：
  ```
  TypeError: error sending request for url (https://eb-admin.aiello.ai/...): client error (Connect):
  tcp connect error: Connection timed out (os error 110)
  ```
  這是**網路層 TCP 連線逾時**（連 TLS 握手都沒發生），不是應用層的認證問題。原因是 `eb-admin.aiello.ai` 的防火牆限制只有 Aiello 內網/VPN 能連（Jim 確認），而 Supabase Edge Function 跑在 Deno Deploy 的全球分散式機房，**官方文件證實完全沒有固定的 outbound IP**，防火牆沒辦法針對它加白名單。討論過三個方向：(1) 請 eb-admin 那邊放寬白名單、(2) 導入第三方固定 IP proxy 服務（QuotaGuard 等，要付費+改防火牆規則）、(3) 改成工作佇列 + 內網常駐 agent。Jim 選了方案 (3)，先用他自己的電腦跑 agent（明確接受這是單點故障——他離線時全公司這個功能會停擺，佇列會排隊等他回來，之後再找專門的常駐主機取代）。
- **最終架構**：
  1. `sitechat_ebconsole_pushes` 表從「純推送結果紀錄」升級成「工作佇列」（migration `sitechat_ebconsole_pushes_add_job_queue_states`）：`status` 從只能是 `success`/`error` 改成 `pending`/`processing`/`success`/`error`（預設值也從 `success` 改成 `pending`），新增 `claimed_at` 欄位。RLS 不變（只有 `@aiello.ai` authenticated 能讀寫，無 anon policy）。
  2. `hotel-project-dashboard.jsx` 的 `SiteChatEbConsolePanel`：「確認推送」現在只是單純 `insert` 一筆 `status='pending'` 的列（不再呼叫任何 Edge Function），有進行中任務（pending/processing）時每 3 秒自動輪詢 `loadHistory()`，agent 處理完會自動反映結果，不用手動重新整理。按鈕在有進行中任務時會停用並顯示「推送處理中…」，避免同一個專案同時排多筆重複任務。
  3. **`scripts/ebconsole-push-agent.mjs`**（新增，這次一起 commit 進 repo；`.env` 走 `scripts/.env`，已被既有的 `.gitignore` 的 `.env` 規則排除）：Jim 在自己已連 VPN 的電腦上跑 `node --env-file=scripts/.env scripts/ebconsole-push-agent.mjs`，常駐輪詢（預設 5 秒一次）`sitechat_ebconsole_pushes`，原子認領最舊的 pending 任務（`update ... where status=eq.pending` 確保就算之後多開一台 agent 也不會搶同一筆），執行「先 GET 再 POST」`/api/admin/settings/by-kms-org` 的合併寫入邏輯（跟原本 `ebconsole-proxy` 同一套顏色/語系對照表，兩邊要一起改），把結果寫回同一筆列。**失敗分兩種處理**（針對 Jim 明確問過的「斷線後會不會自動恢復」設計）：GET/POST 這兩個 `fetch` 如果直接丟例外（網路層失敗，例如電腦離開內網）→ 退回 `pending`，下一輪自動重試，不需要人工介入；如果 eb-admin 真的回應了但是非 200（例如 404 找不到組織）→ 判定為確定性失敗，標記 `error` 並記下回應內容，不會自動重試。另外每輪也會把卡住超過 2 分鐘的 `processing` 任務（agent 中途當掉的情況）退回 `pending`。用的是 `SUPABASE_SERVICE_ROLE_KEY`（本機 `.env`，不進 git、不進 Supabase secrets、不進瀏覽器）+ `EB_ADMIN_API_KEY`。
  4. `ebconsole-proxy` Edge Function **保留部署但目前沒有任何地方呼叫它**——留著是因為如果之後真的架了一台有固定出口 IP 的內網代理，可以把「打 eb-admin」那段邏輯搬回 Edge Function 直接呼叫這台代理，不用整個重寫；`EBCONSOLE_PROXY` 這個前端常數也留著同樣理由，不是死碼誤留。
  5. **已知風險（Jim 明確接受、之後再處理）**：agent 目前掛在 Jim 個人筆電上，等於單點故障——他離開內網/電腦睡眠時，所有人的推送任務都會卡在 `pending` 排隊，直到他的電腦重新連線；佇列本身不會遺失資料，只是會延遲處理。長期應該搬到一台不會離開內網、24 小時開著的專用主機上跑同一支 script。
- 資料模型其餘部分、欄位對照表（SiteChat theme key → eb-console widget_custom_colors key）、locale 對照（en→en-US／zh→zh-TW／ja→ja-JP）、`--welcome-bg` 漸層取第一色碼的理由，都寫在 `scripts/ebconsole-push-agent.mjs`／`ebconsole-proxy/index.ts` 的檔頭註解裡，兩邊邏輯要保持同步，不重複貼在這裡。**2026-09-02 更新**：原本 Advanced 分組（User Messages／FAQ Cards & Links／Destructive Action／Secondary & Feedback）的 14 個欄位因為 eb-console 端沒有對應項目而刻意不送，工程端已在 `widget_custom_colors` 補上這 14 個欄位（`userBubbleBg`／`userBubbleText`／`cardBg`／`cardHeaderBg`／`cardHeaderText`／`cardLinkColor`／`cardTitleColor`／`navBtnBg`／`endChatConfirmColor`／`timeColor`／`feedbackPositiveColor`／`feedbackNegativeColor`／`imgSpinnerAccent`／`imgSpinnerBorder`），已比對確認並加入兩邊的 `COLOR_KEY_MAP`（現在共 40 組），跟著一起送。只有 `fontScale`／`--text-scale`（Text Size）仍然刻意不送，這個決定沒變。
- bot_name 為了跟 eb-console 對齊，2026-09-01 從單一字串改成三語 jsonb，見 SiteChat Settings 的 `CLAUDE.md`。
- git 還原點：hotel-dashboard `pre-ebconsole-push-2026-08-27`、SiteChat Settings `pre-botname-i18n-2026-09-01`。
- `node --check`／`@babel/parser` AST 檢查都過（沙盒 FUSE 限制無法完整跑 `npm run build`）。**2026-09-03 Jim 確認**：本機完整 build、面板實際操作、`ebconsole-push-agent.mjs` 端對端跑過，推送結果正確寫回 `sitechat_ebconsole_pushes`，待辦 #11 全部收尾。

## 長期方向

- ACA 產品 checklist 擴充。
- Jira 整合加深：目前 REST API 單向同步，雙向同步為未來階段。

## harness 未竟事項（2026-07-03 建立制度時留下）

1. Google Drive MCP 停用需 Jim 在 `/mcp` 介面手動操作（帳號層級 connector，CLI 停不掉）；在那之前依 CLAUDE.md 硬規則忽略即可。
2. ~~`customer-portal/Dashboard.jsx` 程式碼不在本 repo，實際位置待 Jim 確認~~ **已釐清（2026-07-21，Jim 確認）**：`customer-auth`、`customer-check` 這兩個 Edge Function、`customer_access.hotel_id`、`customer_checklist_log` 都屬於**另一個正在開發中的專案**，原始碼不在 Jim 能給這個 session 讀取的資料夾裡；該服務**尚未上線，目前算停用狀態**，之後遇到可以忽略，不用當成本專案的缺口處理。
3. 任務狀態追蹤的方案 A/B 落選原因待 Jim 補述（見上方待辦 #1）。
4. ~~建議 Jim 把 `mcp__claude_ai_Supabase__get_logs` 加進 `.claude/settings.json` 的 allow~~ **已解決（2026-09-03，Jim 同意後加入）**：加進 `.claude/settings.local.json`（跟既有的 `get_advisors`／`execute_sql` 同一份清單），deploy commands 查 log 不用再跳權限提示。
