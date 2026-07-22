# Harness 制度建立指令（裁剪版）

> 用法：在 `/Users/jim.chao/hotel-dashboard` 內開啟 `claude`，把本檔案全文貼入（或直接說「依照 harness-setup-instructions.md 執行」）。

---

你的任務是為這個 repo 建立可長期沿用的制度與檔案，讓之後每一個 session（可能由較小的模型執行）都因此變強。本 session 只立制度，不執行日常開發任務。

## 作業規則

1. 自主作業。環境能查的自己查（現有 CLAUDE.md、repo 結構、`/model` 可用型號、已連的 MCP、`.claude/` 現有設定）。開場最多問一批問題（五題以內），之後不再停下來等使用者。
2. 價值排序＋隨做隨寫。按下方交付順序執行，每完成一項立刻寫檔落地再做下一項。session 隨時可能中斷，已落檔的就是使用者拿到的全部。
3. 改任何既有檔案前先 `git status` 確認乾淨，開始前打一個 tag：`git tag before-harness-setup`。git 即備份，不需另建副本。
4. 你的讀者是較弱的模型。規則要具體、可執行、有判準與範例；抽象要求（「保持高品質」）等於沒寫。
5. 所有產出不可依賴強模型才有的能力，Sonnet 等級要跑得動。
6. 現有專案知識以 repo 根目錄現在的 `CLAUDE.md` 為準（含資料表、Edge Functions 決策、踩坑紀錄、待辦）。拆解它，不要重新發明內容。

## 已知事實（不要重查，直接引用）

- 單人開發，開發者：Jim。repo：`aiellojim/crispy-robot`，本機 `/Users/jim.chao/hotel-dashboard`
- 主要痛點診斷（已確認，寫進交付 A 時引用）：
  1. `src/hotel-project-dashboard.jsx` 是單一巨型檔案，任何 session 理解功能都要整檔讀 → 最大 token 漏洞
  2. MCP 工具 schema 常駐 context（Google Drive 8 + Supabase 29 + Vercel 24 = 61 個工具），Google Drive 對本 repo 幾乎無用
  3. 文件裡殘留 chat 時代規則（「每次修改前上傳最新 jsx」「確認檔案版本」），Claude Code 直讀本機檔案後已失效，弱模型照做會浪費回合
- 客戶入口 `customer-portal/Dashboard.jsx` 共用同一 Supabase 後端
- 既有 git tags：`before-web-push-encryption`、`before-phase-C-ui-redesign`（不可動）

## 交付清單（按序執行）

### A. 診斷檔 `docs/harness-notes.md`
把上面三個痛點連同修法寫成正式文件，後面所有產出引用它。修法：
1. jsx 巨檔 → 建章節地圖（交付 D），讀取一律派 subagent，主對話只收結論
2. MCP → 記錄「本專案停用 Google Drive」的操作方式（在 `/mcp` 介面停用；若 CLI 無法停用帳號層級 connector，寫明改用忽略策略：規則明訂「本 repo 不使用 Google Drive 工具」）
3. 舊規則 → 於交付 B 刪除，並在本檔列出被刪條目清單

### B. 重寫 CLAUDE.md 為精簡路由（< 80 行）
先 `cp CLAUDE.md docs/archive/CLAUDE-monolith.md` 留檔，再重寫。結構：

```
# 一句話專案描述 + 技術棧一行
# 指令表（deploy jira-proxy / send-push、build、常用 git 流程）
# 路由（觸發條件 → 讀哪個檔）：
- 動任何 checklist / JSONB / Supabase auth 相關邏輯前 → 先讀 docs/lessons.md 對應條目
- 需要找 jsx 內某功能位置 → 先讀 docs/jsx-map.md，用 grep + 區段讀取，禁止整檔讀
- 架構、資料表、Edge Function 決策 → docs/architecture.md
- 目前待辦與方案評估 → docs/todo.md
- 委派 subagent → docs/delegation.md + docs/templates/
# 硬規則（不路由、直接內嵌的少數幾條）：
- JSONB 一律走 update_check_item RPC 單一 key 更新，禁止整包 upsert
- 大改動前先 git tag
- 本 repo 不使用 Google Drive MCP 工具
- 禁止把 secret 寫進任何會 commit 的檔案
# 維護協議（見交付 F，直接內嵌在 CLAUDE.md 尾部）
```

**明確刪除**：「每次修改前上傳最新 jsx」等所有 chat 時代規則。
**Anon Key / VAPID Public Key 的實際數值不寫進任何 docs**，一律以環境變數名稱引用（`.env.local` / Vercel / Supabase Secrets 為真值來源）。

### C. 內容拆檔
從舊 CLAUDE.md 拆出：
- `docs/architecture.md`：資料表、Edge Functions（jira-proxy 四個 action、`[[dashboard-info]]` 錨點、statusCategory 顏色、`parent` JQL）、zIndex 表、產品線、Email SMTP 慣例、customer-portal 架構、Web Push 現況（含 Chrome BadWebPushRequest / Safari RFC 8291 / NotificationPanel 恢復三項未解）
- `docs/lessons.md`：踩坑紀錄改寫為統一格式：`日期｜觸發情境｜規則｜正例｜反例`。既有素材：JSONB atomic、maybeSingle 多筆炸裂、generateLink 忽略 SMTP、redirect wildcard、--no-verify-jwt、render 內定義 component、esbuild 錯誤誤報
- `docs/todo.md`：任務狀態修改者追蹤（方案 C 為建議案，附 A/B 落選原因）、C.blue→C.accent 漸進重構、Web Push 三缺、ACA checklist 擴充、Jira 雙向同步

### D. `docs/jsx-map.md` 章節地圖
派一個 subagent 實際掃 `src/hotel-project-dashboard.jsx`（與 `customer-portal/Dashboard.jsx`），產出：每個主要 component / 常數區塊 / 功能區的名稱 + 大約行號區間 + 一句話說明。檔頭註明產出當日的 git commit hash，並寫明：「行號會漂移，以名稱 grep 為準，行號僅供定位量級」。

### E. Subagent 與調度制度
1. 先跑 `/model` 或查環境，確認實際可用的模型型號字串，**用查到的實名寫進以下檔案，不要憑印象填**。
2. `.claude/agents/scanner.md`：唯讀掃描用，指定最便宜可用模型；工具限制為唯讀（Read/Grep/Glob）；回報格式固定為「結論 + 檔案:行號清單」，禁止貼大段程式碼回主對話。
3. `.claude/agents/verifier.md`：fresh-context 驗證用；職責：read-back 檢查檔案確實落地與內容完整、前端改動要求 build 通過、Edge Function 改動要求 deploy 後打一次真實請求並查 log；回報「通過/不通過 + 具體證據」。
4. `docs/delegation.md` 調度守則，只含：
   - 大量讀取（掃 jsx、讀 log、查 advisor）一律派 scanner，主對話只進結論
   - 派工三件套：目標與動機、驗收條件、回報格式
   - 重試上限：同一 bug 同一路徑修兩次不過 → 停止，帶完整失敗軌跡（做了什麼、預期、實際、錯誤訊息）換方法或升級模型
   - 驗證不自驗：制度檔案修改與跨多檔重構，結束前派 verifier；日常單檔修改用 build + 實測即可
   - 不做：多答案評審、五層升降級矩陣（單人專案成本不划算，明文寫出以免未來模型自行加回）

### F. 判斷力 rubric（併入 `docs/lessons.md` 開頭的「判準區」）
每條附一正例一反例：
1. **何時停止 patch 改重寫**：同路徑兩次失敗即停。正例：Web Push 加密多次嘗試失敗 → 換方案。反例:第一次 deploy 失敗就重寫整個 function。
2. **何時問 Jim**：動 production secrets、改資料表 schema、刪除任何資料、UI 視覺品味 → 問。純程式結構、命名、內部重構 → 自行決定。
3. **完成的定義**：前端 = build 過 + 部署後實頁確認；Edge Function = deploy 後真實請求 + log 無誤。「程式碼看起來對」不算完成。
4. **方向錯誤訊號**：錯誤訊息與直覺矛盾時先懷疑訊息本身（esbuild 前例）；Supabase auth 詭異行為先查 lessons 再 debug。
5. **誠實極限**：UI 品味與產品決策只能問使用者；高知識密度題（如 Safari RFC 8291 加密）卡住的正確動作是升級模型或明說做不到，不是無限重試。

### G. 派工模板 `docs/templates/`
只做兩份，皆為可直接填空的格式：
- `implement.md`：實作委派（背景、目標、限制〔含適用的 lessons 條目編號〕、驗收條件、回報格式）
- `verify.md`：驗證委派（要驗什麼、怎麼驗〔read-back / build / 實跑〕、通過標準、證據格式）

### H. Slash commands
- `.claude/commands/lesson.md`：把使用者描述的新坑以統一格式追加到 `docs/lessons.md`，並回報寫入的條目
- 更新既有 `deploy-jira-proxy.md` / `deploy-send-push.md`：deploy 後必查 log 並回報結果（呼應「完成的定義」）

### I. 維護協議（內嵌 CLAUDE.md 尾部，≤ 15 行）
- 模型可自行更新：`lessons.md`、`todo.md`、`jsx-map.md`
- 動之前必須先問使用者：CLAUDE.md 路由本身、`architecture.md` 架構決策、`.claude/settings.json` 權限
- 每次踩坑 → 用 `/lesson` 當場寫入，格式同上
- `lessons.md` 超過 60 條 → 提示使用者開一次專門 session 合併去重
- 已知退化風險與預防：(1) lessons 變成只寫不讀的垃圾場 → 路由規則強制「動相關邏輯前先讀」；(2) CLAUDE.md 長回 monolith → 任何新增內容一律進 docs/ 子檔，CLAUDE.md 只加一行路由

## 收尾（必做）

1. 派一個 fresh-context subagent 對抗審查全部產出：找規則互相打架、路徑或檔名錯誤、模型型號字串是否為實查值、弱模型會誤讀的模糊語句。修完為止。
2. verifier 做 read-back：每個檔案確實存在、內容完整、CLAUDE.md 路由指向的檔案全部真實存在。
3. `git add` 全部新檔與修改，commit：`chore: establish harness docs and delegation system`。**不要 push**，留給使用者 review 後自行 push。
4. 給使用者一頁總結：建了哪些檔、改了什麼、刪了什麼、明天開始的工作流程長什麼樣。
5. 若 context 快用完：立刻停下產出，先完成收尾 1–3，把未完成項目寫進 `docs/todo.md` 的「harness 未竟事項」段落交接。

## 誠實條款

不確定的事就查（`/model`、repo 實際結構、MCP 實際狀態），查不到就在檔案裡標註「未確認」，不要編造。模型型號、工具名稱、檔案路徑寫錯一個，弱模型就會整段失效——這三類資訊必須全部經過實查。
