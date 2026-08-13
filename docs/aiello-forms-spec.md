# Aiello 表單統一規格

> 適用對象：所有「飯店端免登入填寫」的 Aiello 表單（目前有 AVA basic settings、AVA UI settings、
> SiteChat Settings，未來新表單也照此規格建立）。
> 這是規格文件，不是紀錄文件——只寫「以後應該怎麼做」，不寫某次改動的過程/日期。改動紀錄寫在
> 各自表單自己的 git log / commit message 裡。
> 建立：2026-08-13（Jim + 這次多輪對話確立）。改動前若牽涉硬性數值（CSS px 值、Supabase 專案資訊）
> 或第 6 節的安全性狀態，先跟 Jim 確認再動筆，其餘章節模型可自行補充/修正。

## 0. 這幾個表單是什麼

單頁 `index.html`（無框架、無 build step）+ Tailwind Play CDN + Supabase（同一個專案，見第 6 節）。
每個表單獨立部署在 Vercel，飯店端靠一個帶 `project_id` 的連結（不需登入）就能編輯、即時同步。
內部靠 `hotel-dashboard` 這個 React/Vite 工具管理所有專案、產生/顯示每個表單的連結。

## 1. Shell UI（header + sidebar）

這是「Aiello 表單的統一特徵」，新表單直接複製這段 CSS，不要重新設計數值。

```css
.ava-header{height:64px;background:#fff;border-bottom:1px solid var(--ava-border);display:flex;align-items:center;justify-content:space-between;padding:0 16px;position:sticky;top:0;z-index:50;gap:12px;}
.ava-header .header-left{display:flex;align-items:center;gap:10px;min-width:0;}
.ava-header .brand{display:flex;flex-direction:column;line-height:1.3;min-width:0;}
.ava-header .brand strong{font-size:15px;color:var(--ava-primary-dark);}
.ava-header .brand-sub{font-size:13px;color:var(--ava-text-light);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ava-header .header-right{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;}
.ava-header .btn.primary{background:var(--ava-primary);color:#fff;border:1px solid var(--ava-primary);padding:0 14px;height:38px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;}
.ava-header .save-indicator{font-size:13px;color:var(--ava-accent);white-space:nowrap;}
.ava-header .icon-btn{border:none;background:transparent;font-size:20px;cursor:pointer;padding:4px 8px;color:var(--ava-text);}
.mobile-only{display:none;}
.ava-layout{display:flex;min-height:calc(100vh - 64px);align-items:stretch;}
.ava-sidebar{width:250px;flex-shrink:0;background:var(--ava-sidebar-bg);color:var(--ava-sidebar-text);overflow-y:auto;padding:10px 0;position:sticky;top:64px;height:calc(100vh - 64px);}
.ava-sidebar .nav-group-label{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;padding:14px 18px 6px;}
.ava-sidebar button.nav-item{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:none;border:none;color:var(--ava-sidebar-text);padding:11px 18px;font-size:13px;cursor:pointer;border-left:3px solid transparent;font-family:inherit;line-height:1.5;}
.ava-sidebar button.nav-item .num{width:20px;height:20px;border-radius:50%;background:#1e293b;color:#94a3b8;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.ava-sidebar button.nav-item:hover{background:#1e293b;}
.ava-sidebar button.nav-item.active{background:#132a27;border-left-color:var(--ava-sidebar-active);color:#fff;}
.ava-content{flex:1;min-width:0;padding:26px 30px 80px;}

@media(max-width:860px){
  .mobile-only{display:inline-block;}
  .ava-sidebar{position:fixed;left:-250px;top:64px;height:calc(100vh - 64px);transition:left .2s;z-index:60;box-shadow:2px 0 12px rgba(0,0,0,.2);}
  .ava-sidebar.open{left:0;}
  .ava-content{padding:18px;}
  .ava-header .brand-sub{display:none;}
}
```

Header markup：`<button id="menuToggle" class="icon-btn mobile-only">☰</button>` + brand 區塊在左，
語言切換（第 2 節）+ Submit 按鈕 + save-indicator 在右。手機版點漢堡開關 `.ava-sidebar` 的 `.open`
class；切換分頁時要記得把 `.open` 移除（否則手機版切完分頁側邊欄還開著）。

側邊欄寬度固定 **250px**（不是 270px，這是唯一一次跟舊版 AVA basic settings 對不齊的地方，250px
才是現在的標準值）。

## 2. 語言切換 —— 兩種語言狀態，不要混在一起

**UI 語言**（header 的語言切換器，翻譯表單「自己的」標籤/說明/按鈕文字，不影響飯店填寫的實際內容）
跟 **內容語言**（Greeting/FAQ 等實際填寫內容要分 en/zh/ja 編輯，各語言筆數必須用同一個共享陣列保證
一致，不要分開存三份陣列）是兩個完全獨立的狀態，各自的切換器互不影響，UI 也要分開放（內容語言的
切換器放在對應卡片內，不要放進 header）。

UI 語言切換器統一用原生 `<select>`（不是自製的 pill 按鈕），放在 header 右側、Submit 按鈕左邊：

```html
<select id="uiLangSelect" aria-label="Language">
  <option value="en">🌐 English</option>
  <option value="zh">🌐 中文</option>
  <option value="ja">🌐 日本語</option>
</select>
```

```css
select#uiLangSelect{-webkit-appearance:none;-moz-appearance:none;appearance:none;border:1px solid var(--ava-border);background:#fff url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="%23555" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 7.5l4.5 4.5 4.5-4.5"/></svg>') no-repeat right 10px center/12px;background-color:#fff;color:var(--ava-text);padding:0 26px 0 10px;height:38px;line-height:36px;border-radius:8px;font-size:13px;cursor:pointer;font-family:inherit;box-sizing:border-box;vertical-align:middle;margin:0;}
```

實作方式分兩派，**新表單先判斷有沒有嵌入即時載入語言的第三方元件（例如 Aiello 對話小工具），
用這個決定走哪一派**：

- **有嵌入即時元件（AVA basic settings、AVA UI settings 現在都這樣）**：元件只在頁面解析時讀一次
  語言，中途沒辦法讓它換語言，所以語言切換要做**整頁重新載入**，用 `?lang=en|zh|ja` URL 參數當單一
  真相來源：
  ```js
  document.getElementById("uiLangSelect").onchange = (e)=>{
    const url = new URL(location.href);
    url.searchParams.set("lang", e.target.value);
    location.href = url.toString();
  };
  ```
  文字翻譯用 `pick(o)`（`{en,zh,ja}` 物件依 `state.lang` 挑一個）+ 對於「掛載後不會再重繪、必須自己
  跟著換」的常駐元素用 `T(en,zh,ja)`（回傳三語都塞進 DOM、用 body class 切換顯示哪一個的 span）。

- **沒有嵌入即時元件（SiteChat Settings）**：不需要整頁重載，直接**原地重繪**，體驗更好：
  ```js
  let uiLang = 'en';
  function t(key){ const e = UI_STRINGS[key]; return e ? (e[uiLang] || e.en) : key; }
  function applyUiLanguage(){ /* 逐一更新 textContent/placeholder，重繪動態產生的區塊 */ }
  document.getElementById("uiLangSelect").onchange = (e)=>{ uiLang = e.target.value; applyUiLanguage(); };
  ```

不管走哪一派，**手機預覽/即時預覽畫面本身不需要跟著 UI 語言換**（預覽是給填表人看效果用的，不是
給填表人閱讀的內容），除非該表單本來就沒有「預覽」這種東西。

## 3. 無連結／找不到專案／連線失敗 —— 統一用非阻斷式 banner

三種情境都要處理，**都不能整頁封鎖**，表單一律維持可操作（本機模式，不會同步雲端）：

| 情境 | 觸發條件 | header 存檔指示器文字 |
|---|---|---|
| 無連結 (`no-id`) | URL 沒帶 `project_id` | `Local only (no project link)` |
| 找不到專案 (`not-found`) | 帶了 id，但查無此專案 | `Not linked to a project - not saving` |
| 連線失敗 (`error`) | fetch/DB 查詢丟出錯誤 | `Sync error – retrying` |
| 正常 (`ok`) | 存檔成功 | `Saved HH:MM:SS`（`formatClock24()`，語言中立，不要用 `toLocaleTimeString()`） |

banner 樣式與行為：

```js
function showBanner(text){
  const el = document.getElementById("content"); // 或該表單對應的內容容器 id
  if(!el) return;
  const banner = document.createElement("div");
  banner.style.cssText = "background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;padding:12px 16px;border-radius:8px;margin:0 0 14px;font-size:13px;";
  banner.textContent = text;
  el.prepend(banner);
}
```

banner 文字三語版本（三個表單目前逐字一致，新表單直接照抄，只是換掉「表單」二字對應的產品名稱
如果需要）：

- 無連結：EN `No project link found in this URL - working in local-only mode, nothing will sync to the cloud.` ／ 中 `此網址未帶有效的專案連結，目前僅為本機模式，不會同步至雲端。` ／ 日 `このURLに有効なプロジェクトリンクが見つかりません。現在はローカルモードで動作しており、クラウドには同期されません。`
- 找不到專案：EN `Hotel ID not found for this link - you can still fill out the form, but it will not be saved to the cloud until this is resolved with your Aiello contact.` ／ 中 `找不到此連結對應的飯店專案，仍可繼續填寫，但在確認前不會同步至雲端，請與 Aiello 聯繫確認。` ／ 日 `このリンクに対応するホテルプロジェクトが見つかりません。引き続きフォームにご記入いただけますが、Aielloの担当者に確認いただくまではクラウドに保存されません。`
- 連線失敗：EN `Could not connect to the server - working offline for now, your edits won't sync until the connection is restored.` ／ 中 `無法連線到伺服器，暫時離線作業，連線恢復前的編輯不會同步。` ／ 日 `サーバーに接続できませんでした。現在はオフラインで作業しています。接続が回復するまで編集内容は同期されません。`

**如果表單是單頁應用式路由**（切換分頁會整個重繪內容容器，例如 AVA UI settings 的
`renderActivePanel()`），banner 會被沖掉——用一個模組層級變數記住目前是哪種 banner，在每次重繪
（含路由 `hashchange`）之後補呼叫一次 `showBanner()`，不要假設 banner 只顯示一次就好。

## 4. 自動存檔 + Submit / Update

- **debounce 250ms**，每次欄位編輯都觸發，不要另外做per-panel 的「儲存」按鈕。
- **header 只有一個存檔狀態指示器**（`#headerSaveIndicator` 或 `#saveIndicator`），不要在各卡片內
  重複顯示「已儲存」文字。
- Submit / Update 按鈕文字（跟著 UI 語言切換）：EN `Submit / Update` ／ 中 `提交 / 更新` ／ 日 `送信・更新`。
- 按下後彈出「確認 → 完成」兩步驟 modal（不用瀏覽器原生 `confirm()`/`alert()`），文案：
  - 確認步驟：EN `Please confirm the form is complete.` + `Aiello will be notified by email.`（兩行，
    用 `<br>` 分開，不要讓翻譯後的單一長句自動換行斷在奇怪的地方）／ 中 `請確認表單內容已填寫完成，` +
    `提交後將以 email 通知 Aiello 相關人員。` ／ 日 `フォームの内容をご確認ください。` +
    `送信後、Aielloの担当者にメール通知します。`
  - 按鈕：Cancel/取消/キャンセル、Submit/提交/送信
  - 完成步驟：EN `Submitted. Thank you!` ／ 中 `已提交，感謝您的填寫！`／日 `送信されました。ありがとうございます！`，按鈕 OK/好的/OK
- Submit 動作本身**不是存檔**（存檔已經靠 autosave 處理），是呼叫共用的 `form-submit-notify` Edge
  Function 寄通知信，帶 `source` 標籤區分是哪個表單（見第 6 節表格）。Function 失敗要 fire-and-forget
  （只 log，不擋住/覆蓋剛顯示的存檔狀態）。

## 5. 驗收流程（改完 code 一定要跑）

1. Tag 配對：用 python regex 數 `div`/`svg`/`button`/`span` 等開合標籤數量一致。
2. `<script type="module">` 抽出來存成 `.mjs`，跑 `node --check` 驗證語法（module 語法才吃得下
   `import`）。
3. 交叉比對：inline `on*="fn(...)"` 用到的每個函式名稱都要出現在 `Object.assign(window, {...})`
   曝光清單（`<script type="module">` 會讓 top-level 宣告不進 `window`，inline handler 會全部失效，
   這是踩過的真實坑）；`getElementById('xxx')` 用到的每個 id 都要有對應的 `id="xxx"` 或動態賦值。
4. Git commit 流程：自己先試 `git commit`；卡在 `.git/index.lock`／`.git/HEAD.lock` 就給
   `rm -f .git/index.lock .git/HEAD.lock` 清 lock 指令；本機那邊如果換成
   `.git/refs/heads/main.lock`，額外補這個路徑。**這是沙盒與本機檔案系統橋接的權限問題，不是真的
   git 併發衝突**，不要以為版本庫壞了——先跑 `git diff HEAD --stat` 確認真實差異量，如果暫存區
   （`git diff --cached`）顯示一大包跟預期不符的差異、但 `git diff HEAD` 很小，通常是暫存區殘影，
   `git reset`（只清暫存區，不動工作目錄）就能修好，一樣可能撞到同一個 lock 問題，用同一招清。
   最後一定要附上完整的 `git add -A && git commit -m "..." && git push origin main` 給 Jim 在本機跑。

## 6. Supabase 資料慣例

**同一個 Supabase 專案**（所有表單、hotel-dashboard 共用）：

- Project URL：`https://yqoingcpcryrcpnhkjzu.supabase.co`
- Publishable (anon) key：`sb_publishable_fiGnl8HwstdP81Eqls6JnQ_YWqmns-5`
  （這是公開金鑰，本來就會出現在每個表單的前端原始碼裡，可以直接寫進新表單，不算 secret；
  service_role key／JWT Secret 等才是禁止出現在任何會 commit 的檔案裡的真正 secret）

資料模型：

- 中央 `public.projects` 表（uuid PK）是所有表單的租戶錨點，新表單的每張表都要有 `project_id` 外鍵
  指回 `projects.id`——**這是目前唯一跟 hotel-dashboard 共用的鍵值**，`hotel_id`（人類可讀的飯店代碼）
  只存在 `projects` 表自己身上，其他表單的表不會、也不應該直接參照它。
- 兩種表結構：singleton（PK 就是 `project_id`，例如 `sitechat_settings`）或可重複列表（自己的
  `id` + `project_id` + `sort_order`，例如 `sitechat_faq_cards`）。
- 多語系內容一律存 `jsonb`，形狀固定 `{en, zh, ja}`（例如 `{welcome:{en,zh,ja}, hint:{en,zh,ja}}`），
  不要拆成三個獨立欄位。

各表單目前的 `source` 標籤（`form-submit-notify` Edge Function 用來標示通知信來源）：

| 表單 | `source` 值 | 主要資料表 |
|---|---|---|
| AVA basic settings | `basic_settings` | `hotel_form_config`、`hotel_team_members`、`aiello_team_members`、`phone_buttons`、`web_portal_users`、`floor_wifi_rooms`、`tmsp_space_rows`、`tmsp_room_rows`、`room_types`、`room_type_images`、`welcome_messages`、`reference_documents`、`pending_confirmation_items` |
| AVA UI settings | `ui_settings` | `showcase_sections`、`showcase_cards`、`ad_settings`、`qr_popups` |
| SiteChat Settings | `sitechat_settings` | `sitechat_settings`、`sitechat_faq_cards` |

新表單要加一個新 `source` 值時，去 `form-submit-notify` 的 `SOURCE_LABELS` map 加一行就好（不要複製
整個 function，這是刻意共用的基礎設施）。

RLS 政策目前固定兩條，新表單照抄：

```sql
-- anon: edit via link
create policy "anon: edit via link" on public.<table> for all to anon using (true) with check (true);
-- staff: full access
create policy "staff: full access" on public.<table> for all to authenticated
  using (auth.email() like '%@aiello.ai') with check (auth.email() like '%@aiello.ai');
```

> ⚠️ **這不是最終的安全設計，是延續中的權宜模式。** `anon` policy 的 `USING(true)` 代表任何拿到
> anon key 的人（key 本來就寫在每個表單的公開前端原始碼裡）都能讀寫**任何**飯店的資料，不受
> `project_id` 限制——這是已知、已追蹤的安全缺口，見 `docs/todo.md` 待辦 #6（目前 20 張表都有這個
> 問題，狀態卡在「等 Jim 決定要不要做方案 B：短效自訂 JWT」）。新表單目前**仍然要照抄這個模式**
> 才能維持「拿到連結就能編輯、不需登入」的一致體驗，但這是暫時的，不代表這個模式被認可為安全——
> 待辦 #6 定案並落地後，這份規格的這一節要跟著改，新表單也要一起補做遷移，不要當作可以無限沿用
> 下去的標準。

其他已驗證穩定、可以直接當標準做法的慣例：

- **並發保護**：批次列表存檔一律用欄位級 diff（只送真正變動的欄位/列），不要整包 upsert；singleton
  設定表用 `update_check_item`／`update_progress_field` 這類 `jsonb_build_object` 合併模式的 RPC 做
  單一 key 原子更新，不要整包覆蓋 jsonb 欄位。
- **圖片上傳**：走 Supabase Storage（公開 bucket，白名單圖片 mime type，>2000px 長邊才壓縮），資料庫
  只存網址；不要用 `FileReader.readAsDataURL()` 把 base64 直接塞進資料庫欄位。
- **部署**：Vercel，根目錄要有 `index.html`（不是其他檔名，Vercel 預設只認這個）；如果表單有自己的
  `/form/:id` 路徑慣例，`vercel.json` 加 rewrite：
  ```json
  { "rewrites": [{ "source": "/form/:id", "destination": "/index.html" }],
    "headers": [{ "source": "/(.*)", "headers": [{ "key": "Cache-Control", "value": "no-cache, must-revalidate" }] }] }
  ```
