# Lessons — 判準區 + 踩坑紀錄

> 動 checklist / JSONB / Supabase auth 相關邏輯前，**先讀本檔對應條目**（CLAUDE.md 路由強制）。
> 踩到新坑當場用 `/lesson` 追加，格式見下方「條目格式」。超過 60 條時提示 Jim 開專門 session 合併去重。

## 判準區（做決定時查這裡）

### 1. 何時停止 patch、改重寫或換方法
同一個 bug、同一條修法路徑，**修兩次都不過就停**，帶完整失敗軌跡換方法或升級模型。
- 正例：Web Push 加密多次嘗試失敗 → 停下來換方案，而不是第三次微調。
- 反例：第一次 deploy 失敗就把整個 function 重寫——還沒到兩次門檻，先看錯誤訊息。

### 2. 何時問 Jim、何時自己決定
**要問**：動 production secrets、改資料表 schema、刪除任何資料、UI 視覺品味。
**自己決定**：純程式結構、命名、內部重構。
- 正例：要在 `projects` 表加欄位 → 先問。
- 反例：把重複的三段 fetch 邏輯抽成共用函式還跑去問——這是內部重構，直接做。

### 3. 完成的定義
前端 = `npm run build` 通過 **且** 部署後在實際頁面確認行為；
Edge Function = deploy 成功 **且** 打一次真實請求 **且** log 無 error。
- 正例：改完 jira-proxy → deploy → 用前端實際切一次 Jira 狀態 → 查 log 無誤 → 回報完成。
- 反例：「程式碼看起來對，應該可以」——不算完成，不准這樣回報。

### 4. 方向錯誤的訊號
錯誤訊息與直覺矛盾時，先懷疑**訊息本身**在誤導（見踩坑 #7 esbuild 前例）；
Supabase auth 出現詭異行為，先查本檔 #2–#4 再開始 debug。
- 正例：報「Unterminated regular expression」但根本沒寫 regex → 先檢查附近 JSX 括號配對。
- 反例：照著錯誤訊息字面在檔案裡到處找不存在的 regex。

### 5. 誠實極限
UI 品味與產品決策只能問 Jim；高知識密度題（如 Safari RFC 8291 加密）卡住的正確動作是
**升級模型或明說做不到**，不是無限重試。
- 正例：「RFC 8291 加密我兩次實作都失敗，建議開一個 Opus/Fable session 專門處理」。
- 反例：默默重試第五次，回報「快好了」。

## 條目格式

每條踩坑紀錄固定五欄：`日期｜觸發情境｜規則｜正例｜反例`。日期用絕對日期（YYYY-MM-DD）。

## 踩坑紀錄

### #1 JSONB 整包 upsert 覆蓋並發修改
- 日期：原始日期不詳（2026-07-03 整理自舊 CLAUDE.md）
- 觸發情境：更新 `project_progress` 的 checklist JSONB 欄位
- 規則：一律透過 RPC（`update_check_item`）做**單一 key 的 atomic 更新**，禁止讀出整包再 upsert 回去
- 正例：`sb.rpc('update_check_item', { ...單一 key... })`
- 反例：`upsert({ progress: 整個物件 })`——會把別人剛勾的項目蓋掉

### #2 `maybeSingle()` 多筆結果時出錯
- 日期：原始日期不詳（2026-07-03 整理）
- 觸發情境：Supabase 查詢預期一筆但實際多筆（曾造成登入無限迴圈）
- 規則：不確定唯一性時不要用 `maybeSingle()`；先 `limit(1)` 或處理陣列，並確認資料層有唯一約束
- 正例：`.select().eq(...).limit(1)` 後取 `data[0]`
- 反例：對可能多筆的 `user_profiles` 查詢直接 `.maybeSingle()`

### #3 `admin.generateLink` 忽略自訂 SMTP
- 日期：原始日期不詳（2026-07-03 整理）
- 觸發情境：要寄 Magic Link 登入信
- 規則：用 `signInWithOtp`，不要用 `admin.generateLink`（後者不走自訂 SMTP）
- 正例：`sb.auth.signInWithOtp({ email, options: { emailRedirectTo } })`
- 反例：`admin.generateLink()` 然後奇怪為什麼信是 Supabase 預設寄件者寄的

### #4 Redirect URL 需要 wildcard
- 日期：原始日期不詳（2026-07-03 整理）
- 觸發情境：Supabase Auth redirect 設定
- 規則：Redirect URL allowlist 要用 wildcard pattern（如 `/dashboard*`），精確路徑會擋掉帶參數的 redirect
- 正例：`https://.../dashboard*`
- 反例：`https://.../dashboard`（帶 query string 就 mismatch）

### #5 未驗證的 Edge Function 部署要加 `--no-verify-jwt`
- 日期：原始日期不詳（2026-07-03 整理）
- 觸發情境：部署不需要 JWT 驗證的 Edge Function
- 規則：`supabase functions deploy <name> --no-verify-jwt`，否則匿名呼叫會被 401 擋掉
- 正例：公開 endpoint 部署時帶上該 flag
- 反例：漏掉 flag，然後在前端 debug「為什麼 401」

### #6 不要在 render function 裡定義 component
- 日期：原始日期不詳（2026-07-03 整理）
- 觸發情境：React 內嵌子元件，input 每打一個字就失焦/重置
- 規則：component 定義移到模組頂層；小段 UI 用 inline JSX 變數，不要在 render 內宣告新 component
- 正例：`const row = <div>...</div>` 或頂層 `function CheckRow()`
- 反例：`function Parent() { function Child() {...} return <Child/> }`——每次 render 都是新型別，state 全重置

### #7 esbuild 錯誤訊息不可盡信
- 日期：原始日期不詳（2026-07-03 整理）
- 觸發情境：build 報「Unterminated regular expression」
- 規則：esbuild 對 JSX 語法錯誤（如漏 `}}`）可能誤報成 regex 錯誤；先檢查報錯位置附近的括號配對，不要照字面找 regex
- 正例：從報錯行往回找最近的 JSX 屬性 `{{...}}` 是否漏關
- 反例：全檔搜尋 `/` 找「未終止的 regex」
