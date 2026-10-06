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
- **2026-10-02 補：`--text-subtle` 對比度修正**。Jim 回報玻璃化之後淺灰文字跟 icon 在淺色/深色
  模式都變得不清楚——實際算過對比度：這個變數改玻璃前是對著不透明的 `--surface` 算對比，光線/
  深色模式都還過得去（淺色模式 #A3A3A3 對白底約 2.48:1、深色模式 #6B6B6B 對 #21212B 約 3.0:1，
  本來就偏低，只是不透明底色夠「乾淨」還能辨識），改玻璃之後底色變成半透明 + 模糊 + `saturate`
  疊加畫布色暈，有效對比度更不穩定、肉眼明顯變模糊。`--text`／`--text-mid` 本身對比度本來就夠
  （淺色 ~5.7:1、深色 ~6.4:1），問題只在 `--text-subtle` 這個最淺的層級（`C.textLight` 是同一個
  變數，所以文字跟大部分用這個變數上色的 icon 會一起變清楚）。修法：淺色模式 `#A3A3A3`→`#767676`
  （對白底約 4.55:1，WCAG AA 一般文字門檻）、深色模式 `#6B6B6B`→`#8C8C8C`（對 `#21212B` 約
  4.75:1，留一點餘裕給玻璃模糊造成的不確定性）。只動了一般淺/深色模式四個區塊，彩蛋用的駭客綠
  主題（`--text-subtle:#009926`）沒有改動。`--text-mid` 暫時沒動，對比度本來就夠，如果之後 Jim
  還是覺得不夠清楚再一起調。
- 刻意不玻璃化的範圍：輸入框（input/textarea，包含 `baseInput`／`NoteArea`／`FInput`）維持
  不透明——玻璃底的面板上如果輸入框也半透明，會讓使用者分不清哪裡能打字，這點 Jim 在 Batch 3
  的 overlay 變灰回饋裡也間接提過（「只有輸入欄和按鈕維持高亮」）；小型色塊徽章/標籤（整合服務
  標籤、Jira issue key 膠囊、狀態 badge）維持原樣，這些是資訊標示不是卡片；modal/卡片內部用來
  跟外層做對比的巢狀小面板（例如 Jira Epic modal 的錯誤訊息框、SheetLink 的連結輸入框底色）
  維持不透明，因為它們本身的功能就是在已經半透明的外層容器裡提供一塊實色的視覺對比。

**2026-10-02 補：jim mode 彩蛋沒跟著玻璃化更新的 bug**。Jim 問「彩蛋的視覺效果都沒受影響嗎」，
實際查過一輪：`shake`/`flip table`/`confetti`/`matrix rain`/`glitch`/`barrel roll`/`trip mode`
這些都是純 CSS keyframe 動畫（套在 `<body>`/`<html>` 上）或獨立建立、直接掛在 `document.body`
下的 canvas/div（`triggerConfetti()`/`triggerMatrixRain()`，z-index 99998，不是 React 元件樹
的一部分），完全不經過任何套了 `backdropFilter` 的 Card/Panel，所以不受這次改版影響。**只有
`jim mode`（`html.jim-mode-effect`）這個會真的換掉整套 CSS 變數的「主題型」彩蛋受影響**：
它定義了自己的 `--bg`/`--surface`/`--text`/`--border` 等（全黑底、駭客綠字），但套用 Liquid
Glass 玻璃材質時新增的 `--glass-surface`／`--glass-surface-hover`／`--canvas-glow-1/2/3` 三組
變數是後來才加的，當時沒有同步補進這個區塊——所以 Card/OvCard 等全部改用 `var(--glass-surface)`
之後，jim mode 開啟時這些卡片會顯示一般淺色或深色主題的玻璃色調（偏白或偏灰藍），跟黑底綠字的
駭客風格對不上，是這次改版確實造成的一個小 bug（已修正）：補上這三組變數，`--glass-surface`／
`--glass-surface-hover` 比照其他主題「顏色＝對應的 `--surface`/`--surface-raised` 色值、
alpha 分別是 0.55／0.72」的既有規律推算；`--canvas-glow-1/2/3` 沒有照抄其他主題的藍/橙/綠
三色組合，改成同一個駭客綠在三種不同濃淡，跟這個彩蛋「單一強調色」的美術方向一致，也避免跟
代碼雨/掃描線效果搶視覺。這是目前唯一一個因為「新增 CSS 變數時只想到標準的四個主題區塊、漏了
這個額外疊加的第五個彩蛋區塊」而產生的實際視覺 bug，往後如果再新增需要四區塊同步的變數，
記得這個區塊也要一起檢查。

#### 改版收尾評估（2026-10-02，Jim 要求記錄）

**效能影響**：全檔 `backdropFilter` 共 37 處（`WebkitBackdropFilter` 36 處，兩者本來就該幾乎
一一對應，少的 1 處是切換態用 `"none"` 不重複寫前綴也沒差），其中 30 處是最常見的
`background:"var(--glass-surface)"` 組合。這些都是 inline style、不是另外的 CSS 規則檔案，
對 bundle 體積幾乎沒有影響（這次整個分批改版下來，build 產出從 632.71 kB 長到 635.92 kB，
gzip 後只多了約 0.15 kB，可以忽略）。真正的成本是瀏覽器端的 GPU 合成層：`backdrop-filter`
在目前主流瀏覽器都有硬體加速，但每一個套用的元素都會讓瀏覽器多開一層合成運算，元素數量一多、
尤其是同時大量出現在可捲動清單裡時，低階裝置上可能感覺到捲動不夠滑順。目前全站只有一個地方
是「清單裡每一筆都玻璃化」而不是「只有外層容器玻璃化」——JiraTab 的 issue 卡片列表（因為它們
視覺上讀起來比較像獨立卡片而不是表格列，所以刻意跟著卡片規則做）。如果某間飯店的 Jira Epic
底下子任務筆數很多（例如 50+），這是目前**唯一**可能在捲動時感覺到效能差異的地方；CalendarPage
的 42 個日期格子則是刻意反過來處理、維持不透明純色不套 `backdrop-filter`，就是因為量大+密集
格線套毛玻璃這個成本/視覺效益換算不划算。如果日後真的有人反映 Jira 子任務頁捲動卡頓，直接把
issue 卡片的 `backdropFilter` 拿掉、只留外層清單容器玻璃化即可，不用改結構。

**維護穩定度影響**：這次改動全部是 style 層級的疊加，沒有動到任何資料流、Supabase 呼叫或商業
邏輯，唯一的結構性改動是 Jira Epic modal 改用 `ReactDOM.createPortal`（新增 `import { createPortal }
from "react-dom"`，`react-dom` 本來就是既有相依套件，沒有新增套件）。真正要留意的維護風險有兩個：

1. **四個主題區塊重複**（`:root` / dark media query / `data-theme="light"` / `data-theme="dark"`）
   這個既有規則，這次改版又多了 5 個新變數要照規則複製四份（`--glass-surface`、
   `--glass-surface-hover`、`--canvas-glow-1/2/3`），等於又放大了一點這類「漏改其中一塊」的
   踩坑面——這次改版過程中就至少踩過兩次（`--glass-surface` 一開始漏了手動覆蓋區塊、後來修對比度
   時也要記得四處一起改）。這是既有的結構限制，不是這次改版造成的，但這次確實讓需要「四份同步」
   的變數數量變多了。
2. **`<Card style={{...}}>` 覆寫陷阱**：`Card` 元件是 `{ background:"var(--glass-surface)",
   backdropFilter:..., ...style }`，呼叫端傳進去的 `style` prop 會整個蓋在最後，所以如果呼叫端
   自己在 `style` 裡又寫一次 `background`，會不聲不響蓋掉玻璃效果，也不會有任何錯誤或警告——
   這次實際抓到一個真實案例：TasksTab 的任務卡片用了 `<Card style={{..., background:C.white}}>`，
   玻璃效果因此完全沒生效（有 `backdropFilter` 卻被不透明背景蓋住，等於白做工），已經修掉。
   檢查過其他所有 `<Card>` 呼叫點（9 處），只有這一處有這個問題，其餘都是 `<Card>` 空 props，
   暫時不是系統性問題，但沒有任何機制防止未來新寫的程式碼重蹈覆轍。已經在 `Card` 元件定義旁邊
   加上程式碼註解提醒，但這只是最低限度的防呆，不是結構性修正（見下方「簡化建議」）。

**簡化整理（2026-10-02 已執行，Jim 要求一併完成）**——以下三項原本只是記錄的機會，Jim 確認後
當場做掉了，純粹是程式碼整理，沒有改變任何畫面輸出：
- 重複 30 次的 `{ background:"var(--glass-surface)", backdropFilter:"blur(20px) saturate(160%)",
  WebkitBackdropFilter:"blur(20px) saturate(160%)" }` 已抽成共用常數 `const GLASS = {...}`
  （跟 `baseInput` 同一區，檔案前段），所有呼叫端改成 `{...GLASS, ...其他 style}`。以後如果要
  整站統一調整模糊強度或飽和度，改這一個地方就好；「這個元素是不是玻璃」在程式碼上看
  `...GLASS` 一眼就能辨識。
- 「選中態＝純色、未選中態＝玻璃」這個切換按鈕樣式（CalendarPage／TasksTab／JiraTab，6 處）
  已抽成 helper function `glassToggle(active, activeBg)`（定義在 `GLASS` 常數旁），回傳對應的
  `background`/`backdropFilter`/`WebkitBackdropFilter` 物件，呼叫端改成 `...glassToggle(條件,
  選中色)`。
- 7 個關閉（✕）按鈕已收斂成共用元件 `CloseButton`（定義在「Shared UI components」區段最前面，
  `background:C.white` 那批改掉之前就有的 7 處重複，不是這次新造成的）。原本 7 處在字級／圓角／
  padding／文字顏色上有些微差異（不同時期各自手刻造成的，不是刻意設計），`CloseButton` 用
  `size`/`radius`/`padding`/`color`/`lineHeight` 幾個 props 把這些差異值傳進去，每個呼叫端
  視覺跟改版前逐像素一致，沒有趁機「順便統一外觀」。
整個檔案 `node --check` 不適用（這是 Vite/JSX 專案，不是單檔 HTML 表單），驗收方式是
`npx vite build` 通過——三項整理做完後 build 產出從 635.92 kB 降到 628.83 kB（少了被消除的
重複字面值），確認 build 乾淨過。

**這次過程中發現的結構/視覺問題**：
- 上面提到的 `<Card style={{background:...}}>` 覆寫陷阱是本輪實際抓到、也修掉的一個真案例，
  已經在 `Card` 定義旁加註解提醒；但這只防得了「有讀註解的人」，沒有程式層面的保護（例如 dev
  模式下偵測到 `style.background` 就 console.warn），如果要更徹底，需要另外討論是否值得加這層
  防呆，目前先不動。
- 視覺上有一個沒有動、但值得記錄的取捨：這次為了修文字對比度，淺色模式的 `--text-subtle` 從
  `#A3A3A3` 改到 `#767676`，跟 `--text-mid`（`#6B6B6B`）只差 11（十六進位），兩層灰階的視覺
  區隔比改版前更小了——換句話說，拉高「最淺那層文字」的清晰度，一定程度上犧牲了「中層文字」
  跟「最淺層文字」原本該有的層次感。這是優先選擇可讀性換來的結果，不是沒注意到，但如果 Jim
  實際看過覺得兩層分不太出來，下一步可以考慮把 `--text-mid` 也一起往深（淺色模式）/往淺
  （深色模式）調一點，重新拉開兩層間距，而不是只動 `--text-subtle`。
- JiraTab 的 issue 卡片玻璃化之後，卡片本身的邊框/底色對比變得比原本的「純白+實邊框」更柔和，
  逾期（overdue）狀態目前只靠卡片內那個小小的狀態下拉選單變色提示，沒有在卡片層級做任何強調——
  這在改版前後邏輯上沒有變（本來就只靠下拉選單變色），但因為外層卡片整體的視覺「安靜」程度提高
  了，逾期項目在玻璃化之後有沒有「不夠搶眼」，建議 Jim 實際瀏覽一個有逾期子任務的專案確認一下，
  如果覺得不夠醒目，可以考慮幫逾期卡片加一圈淡紅色邊框或左側色條，跟 TasksTab 卡片已經有的
  「選取態＝實色強調」邏輯呼應。

#### 2026-10-02 追修：Header 內兩個面板「特別透明」+ 月曆切換按鈕

Jim 回報「個人設定」側邊欄跟右上角鈴鐺的「通知」下拉，玻璃效果比 AI 助理／通知設定（Email 提醒）
明顯更透明、看不清楚。查證後發現根因跟當初 Jira Epic bootstrap modal 的 bug 是同一類：
`UserSettingsPanel`／`InAppNotifModal` 這兩個是全站**唯一**被巢狀渲染在 App 全域 Header 內部的
`position:fixed` 面板（Header 自己有 `...GLASS`，也就是有 `backdropFilter`）。CSS 規範裡
`backdrop-filter` 不是 `none` 的元素，會幫底下的 `position:fixed` 子孫元素建立新的 containing
block／stacking context，子孫自己的 `backdropFilter` 這時採樣不到真正的頁面背景，疊加合成後
視覺上就「糊成一片、特別透明」。AI 助理（`AiPanel`）、通知設定（`NotificationPanel`，Email 提醒
訂閱）都是渲染在 `HomePage`／App 根層級，不在任何有 `backdropFilter` 的祖先元素底下，所以才會
「看起來清楚」——不是這兩個面板的程式碼寫得不一樣（`...GLASS` 完全相同），純粹是巢狀位置的問題。
修法比照 Jira Epic modal：兩個元件自己的 `return` 改成 `createPortal(..., document.body)`，
直接把這兩個面板掛到 `document.body`，脫離 Header 的 stacking context。

**2026-10-02 補充修正（同一天稍晚發現）**：`InAppNotifModal` portal 完之後，Jim 回報整個下拉選單
被壓到 Header 的分頁切換列底下。原因：portal 之前，`InAppNotifModal` 巢狀在 Header 裡面，
`zIndex:9997/9998` 只要比 Header 內其他兄弟元素高就夠用，不需要跟 Header 自己的 `zIndex:10000`
比較；但 portal 到 `document.body` 之後，它變成要直接跟 Header 的 `zIndex:10000` 在同一層比較大小，
而 9997/9998 < 10000，整個面板因此沉到 Header 底下。`UserSettingsPanel` 沒有這個問題，因為它原本
用的 `zIndex:20000/20001` 剛好已經比 10000 高，portal 前後都安全。修法：把 `InAppNotifModal` 的
`zIndex` 一併調整成跟其他側邊面板同一階層的 `20000/20001`。**這是這類「把元素 portal 出某個容器」
修法共通要注意的地方：z-index 的比較基準會從「容器內的局部順序」變成「跟容器本身、以及其他所有
portal 到同一個掛載點的元素互相比較」，portal 前原本夠用的 z-index 數字，portal 後不一定還夠用，
每次用 createPortal 都要重新檢查數字夠不夠大。**另外也發現
`InAppNotifModal` 的背景遮罩 `<div onClick={onClose}>` 原本完全沒設 `background`（其餘面板都是
`rgba(0,0,0,0.08)`），一併補上以跟其他面板一致。已確認 `CustomerAccessPanel`／
`SiteChatEbConsolePanel`（渲染在 `ProjectDetail` 裡）跟 ProjectDetail 自己的本地 sticky header
（它也有 `...GLASS`）沒有巢狀關係，是平行的 sibling，不受影響，不需要跟著改。

同一輪也修了 CalendarPage 月份切換的 `‹`/`›` 按鈕——這兩個是全站唯一還在用純文字 glyph、沒有
`onMouseEnter`/`onMouseLeave`、也沒設 `color`（inherit 預設黑色，深色模式玻璃底下幾乎看不到）的
按鈕，推測是玻璃化那幾批巡檢時被漏掉。已改成固定 32×32、`display:flex` 置中、套用 `chevronR`
圖示（左邊用 `transform:rotate(180deg)`）、`color:"var(--text-subtle)"` + hover 時變
`var(--accent)`，跟 Header 鈴鐺按鈕同一套 hover 慣例。

#### 2026-10-02 追修：Overview 卡片光暈在深色模式露出直角（兩次嘗試）

Jim 回報 Overview 專案卡片的滑鼠跟隨光暈（`.card-glow`），在深色模式下四角還是看得出直角，沒有
跟卡片本身的圓角外框切齊。

**第一次嘗試（錯的，記錄下來避免以後重蹈覆轍）**：在 `.card-glow` 自己的 inline style 上同時補
`overflow:"hidden"` 跟既有的 `borderRadius:12`，想法是「裁切跟濾鏡同一個元素上總該有效」。Jim
實測後回報深色模式下四角依然存在，證明這個假設是錯的：`overflow:hidden` 只會裁掉「這個元素自己
的子孫內容」溢出的部分，**不會**回頭裁掉這個元素自己的 `filter:blur()` 往外暈開的範圍——兩者套在
同一個元素上，裁切對濾鏡完全不生效。這是 CSS filter 效果本身的既有限制，不是瀏覽器差異或合成層
bug（這點上一版的猜測方向是錯的）。

**第二次嘗試（改成裁切/濾鏡分離成兩層）**：標準且可靠的做法是把「裁切」跟「套濾鏡」拆成兩個不同
元素——外層只負責 `overflow:hidden` + `borderRadius:12` 把形狀裁成圓角、本身完全不帶任何
`filter`；真正套 `filter:blur(22px)` 的 `.card-glow` 當內層子元素，它暈出去的範圍會被外層的裁切
邊界擋下來，而不是靠自己擋自己。`querySelector(".card-glow")` 抓的 class name 不變，三個滑鼠事件
handler 不用跟著改。

**誠實說明**：這兩次修正都只透過 `npx vite build` 驗證語法跟 bundle 正常，**沒有實際在瀏覽器裡
看過效果**——這個 sandbox 裡的瀏覽器工具連不到 Jim 本機的開發伺服器或部署後的正式網址，所以
每次修改都只能依賴程式碼層面的推理，無法像本來驗收流程要求的「實際頁面確認」那樣自己先肉眼
過一次。這次的二層分離結構是業界常見、原理上更可靠的標準做法，但因為第一次的猜測已經證明不可靠，
不敢保證這次一定根除——如果 Jim 實測後還是看得到直角，麻煩截圖或告知瀏覽器/作業系統，會需要更多
線索才能繼續排查（例如是否跟 Safari 對 `backdrop-filter`+`border-radius` 組合的既有渲染限制有關，
這類限制目前沒有已知能 100% 跨瀏覽器解決的純 CSS 寫法）。

**第三次嘗試（2026-10-02 同一天，Jim 回報第二次修正後四角依然存在）**：重新檢討後懷疑前兩次都
修錯層了——真正的直角來源可能從頭到尾都不是 `.card-glow`，而是**卡片本身**：外層卡片這個元素
同時有 `overflow:"hidden"`、`borderRadius:12`、跟 `...GLASS`（`backdropFilter`）三者疊在同一個
元素上，這正好是全網最常被回報的 `backdrop-filter` 已知限制——`backdrop-filter` 取樣/合成的範圍
在部分瀏覽器（尤其 Safari／WebKit）不會正確被同一元素的 `overflow:hidden` + `border-radius`
裁成圓角，跟我們這兩次在 `.card-glow` 身上重演的「裁切對自己的視覺效果不生效」是同一個病根的
不同症狀，差別只在於這次是整張卡片的 `backdrop-filter`，不是內層光斑的 `filter:blur()`。

這次換一個不同機制的修法：在卡片外層額外加上 `clipPath:"inset(0px round 12px)"`。`clip-path`
不是透過 `overflow` 的 box model 裁切，而是直接在最終合成輸出上做裁切，業界公認是處理
「`backdrop-filter` 忽略 `border-radius`」這個經典問題時，比 `overflow:hidden` 更可靠的手段
（`overflow:hidden` 繼續保留，`clip-path` 是疊加上去，不是取代）。沒有更動任何 DOM 結構或疊放
順序，是風險最低的加法修正。

**再次誠實說明**：連續三次修正都只能用 `npx vite build` 驗證語法，無法實際看到畫面——如果這次
`clip-path` 還是沒有解決，接下來能排查的方向已經不多：(1) 可能要麻煩 Jim 直接說是哪個瀏覽器/
版本看到這個狀況，Safari 對這個組合的支援度明顯比 Chrome/Edge 差，如果是 Safari，目前沒有已知
100% 可靠的純 CSS 解法，退路通常是放棄在同一層同時用 `backdrop-filter`+圓角，改用遮罩圖片
（`mask-image`）或乾脆把這張卡片的圓角做小一點讓肉眼比較不明顯；(2) 也可能请 Jim 提供一張截圖，
用視覺比對縮小範圍（直角出現在整張卡片外框，還是只在滑鼠懸停光暈那一圈）。

`clip-path` 這次確認有效（Jim 2026-10-02 實測回報）。

#### 2026-10-02 追加：淺色模式光暈改用品牌 accent 色

Jim 回報淺色模式下卡片底色本來就接近白色，光暈原本的白色（`rgba(255,255,255,...)`）疊上去對比
不夠，幾乎看不出效果；深色模式的白色光暈沒有這個問題（卡片底色深，白光對比夠），維持不動。新增
一個小 helper `isDarkTheme()`（定義在「Helpers」區段，`daysUntil`/`fmtDate` 旁邊）：判斷順序完全
對應 CSS 的套用順序——`html[data-theme]` 有明確值（使用者在 ThemeToggle 選了 light/dark）時以它
為準，沒有值（使用者選「跟隨系統」，App 的 `useEffect` 會 `removeAttribute`）才退回
`prefers-color-scheme` media query。`onMouseMove` 的光暈顏色改成：深色模式維持白色
`255,255,255`；淺色模式改用 `--accent` 淺色模式色號 `#E8621A` 換算的 `232,98,26`（全站 CTA／
連結已經在用的同一個橘色，不是另外挑的新顏色），透明度從白色版本的 `0.55/0.22` 略降到
`0.4/0.16`（同樣透明度下，有色光視覺上比白光更搶眼，要往下調才不會太像一塊橘漬糊在卡片上）。
這組數值是起始推薦值，不是精算出來的定論——沒辦法在這個環境肉眼確認實際濃淡，Jim 看過實際效果
覺得太濃/太淡，直接調 `onMouseMove` 裡那兩個 0.4/0.16 數字即可，不用動其他邏輯。

### Glass v2 質感加成（2026-10-06 起，`src/glassFx.js`）
在上面那套玻璃（`--glass-surface` 透明度、`blur(20px) saturate(160%)`、canvas 色暈）**之上**疊四樣東西，
玻璃本身的參數完全沒動（Jim 比對預覽後決定保留原本的透明度；顆粒、硬邊形狀、elevation 重分級都不做）：
1. 斜向光：`GLASS.background` ＝ `GLASS_BG`（左上 135° 柔光疊在 `--glass-surface` 上）。`style.background=`
   是 shorthand，hover/leave handler 一律用 `GLASS_BG_HOVER`／`GLASS_BG`，不能再寫 `var(--glass-surface…)`。
2. 游標邊緣光：加 `className="lg-live"`（目前：專案卡片、統計卡、Jira issue 卡）；1px 邊框跟著游標亮一段，
   全站一個 delegated、rAF 節流的 `pointermove` listener，觸控裝置停用。
3. 色調陰影：大陰影用 `tint(a)`（`color-mix` 帶主題色，強度＝原本 rgba(0,0,0,a) 的 a）；邊緣高光用 `RIM`／`RIM_HOVER`。
4. 文字：`tabular-nums`、`h1–h3 text-wrap:balance`（字重維持原本的 300，Jim 決定不動）。
   深色的 `--text-mid`／`--text-subtle` 也在同一天調亮（#B8B8C2／#A4A4B0）——斜向光會把卡片左上角底色提亮，
   原值在最壞情況（藍色暈 + 光）對比掉到約 3.4:1。
新增 `--lg-*` token 要在 `glassFx.js` 的五個區塊都定義：`:root`、dark media、`html[data-theme=light]`、
`html[data-theme=dark]`、`html.jim-mode-effect`（jim 放最後，同 specificity 靠順序）。
5. 主色 CTA：`CTA_CLASS`（`.lg-cta`）——維持原本的實色平面（accent 底、白字），只加半透明白邊框與游標邊緣光；
   不做高光／陰影／上浮（試過，Jim 覺得立體感突兀）。已套用在主頁「+ 新增專案」與 9 顆一般尺寸主色按鈕（清單在 `todo.md`）。
還原：tag `before-glass-v2-2026-10-06`，或把 `GLASS.background` 改回 `"var(--glass-surface)"` 並拿掉 import。
`color-mix()` 需 Chrome 111／Safari 16.2／Firefox 113 以上，更舊的瀏覽器只會失去大陰影。

### Loading 動畫（2026-10-06 起）

全站 loading 動畫統一由 `src/OrganicLoader.jsx` 提供，jsx 內只用 `<OrganicLoader size={…} />`，
**不得再在呼叫端手寫 `animation:"spin …"` 或自帶 keyframes**。目前共 11 處呼叫
（`grep -n "<OrganicLoader" src/hotel-project-dashboard.jsx`）。

- 款式：`orbit`（Gooey Orbit，預設）、`ripple`、`cradle`（牛頓擺，目前只用在 AI 打字泡泡，`size={20}`）；換款式改該檔 `DEFAULT_VARIANT`，或呼叫端傳 `variant`。
- 外觀參數（速度 `SPEED`、橢圓尺寸、軌道、黏連度）全在該檔上方的 `ORBIT` / `RIPPLE` 設定物件。
- keyframes 在 `LOADER_CSS`，模組載入時以固定 id `organic-loader-css` 注入 `<head>`：
  不放進 `GLOBAL_CSS`、不新增 CSS 變數，所以不需同步主題區塊與 jim mode 區塊。
- 上色用 `currentColor`，預設 `var(--accent)`，隨主題自動變色；按鈕內有底色時傳 `color="#fff"` 之類。
- 尺寸慣例：`size` 一律代表**高度**，寬度由款式的 `aspect` 決定（orbit / ripple 為正方形，cradle 約 3.7 倍寬）。按鈕內 13、區塊 24~28、全頁 56、AI 打字泡泡 20（cradle）。
- `prefers-reduced-motion`：所有會動的元素帶 `data-ol`，統一改為透明度呼吸。
- 每個實例用 `useId` 產生獨立的 SVG filter id，多個 loader 同時存在不會互相干擾。
- 舊的 `@keyframes spin`（`GLOBAL_CSS`）已無使用者，暫留未刪。
- 預覽頁：`dev/loader-preview.html`（`npm run dev` 後開 `/dev/loader-preview.html`），把各款式、各尺寸、AI 泡泡與按鈕情境常駐顯示，可放大、切深淺色。
  只有根目錄 `index.html` 是 vite build 入口，所以 `dev/` 不會被打包上線。

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
`before-push-subscriptions-refactor`、`before-web-push-encryption`、`before-harness-setup`、`before-organic-loader-2026-10-06`、`before-glass-v2-2026-10-06`、`before-cta-tabicons-2026-10-06`。
慣例：任何重大改動前先打描述性 tag（`/checkpoint`）。
