# Harness 診斷筆記（本套制度為什麼長這樣）

> 建立日期：2026-07-03（commit 基準：`1046d95`）。
> 本檔記錄三個已確認的痛點與對應修法。所有其他 docs 與 CLAUDE.md 路由皆源自此診斷。

## 痛點 1：`src/hotel-project-dashboard.jsx` 單一巨檔（約 4,000 行，精確行數見 `docs/jsx-map.md` 檔頭）

任何 session 想理解某個功能，都得把整檔讀進 context，是最大的 token 漏洞；
弱模型整檔讀完後常常已無餘裕做正事。

**修法**：
- 建立章節地圖 `docs/jsx-map.md`（component / 常數區 / 功能區 → 行號區間 + 一句話說明）。
- 讀取規則：**先查 jsx-map → 用 grep 定位名稱 → 只讀該區段**；需要大範圍掃描時派 scanner subagent，主對話只收結論。
- 硬性禁令寫進 CLAUDE.md 路由表：禁止整檔讀取此檔。

## 痛點 2：MCP 工具 schema 常駐 context（61 個工具）

2026-07-03 實查 `claude mcp list`：三個 claude.ai 帳號層級 connector 全部連線中——
Supabase（29 工具）、Vercel（24 工具）、Google Drive（8 工具）。
Google Drive 對本 repo 幾乎無用，卻佔用 context。

**修法**：
- 首選：在 `/mcp` 介面把 Google Drive 對本專案停用。
- 若停不掉（帳號層級 connector 無法從 CLI 針對單一專案停用）：改用**忽略策略**——
  CLAUDE.md 硬規則明訂「本 repo 不使用 Google Drive MCP 工具」，任何 session 不得呼叫。
- 註（2026-07-03 觀察）：目前 harness 已把 MCP 工具改為 deferred（schema 需經 ToolSearch 載入才進 context），
  token 壓力已大幅緩解；忽略策略仍保留，避免無意義的工具呼叫。

## 痛點 3：文件殘留 chat 時代規則

舊 CLAUDE.md 混有為「網頁 chat + 手動上傳檔案」時代寫的規則。
Claude Code 直接讀寫本機檔案系統後這些規則已失效，弱模型照做會浪費回合。

**修法**：重寫 CLAUDE.md 時刪除（見交付 B）。**被刪條目清單**：
1. 「每次修改前上傳最新 `.jsx`」（舊檔已自行劃掉，本次正式移除）。
2. 「偏好直接修改檔案 + git push，而非產出程式碼片段」——Claude Code 本來就直接改檔，此句已無意義。
3. 各處「確認檔案版本」類提醒——git 即版本真值，不需再人工比對。

## 產出清單（本次 harness 建立的檔案）

| 檔案 | 用途 |
|---|---|
| `CLAUDE.md`（重寫） | 精簡路由 + 硬規則 + 維護協議 |
| `docs/archive/CLAUDE-monolith.md` | 舊版 CLAUDE.md 完整留檔 |
| `docs/harness-notes.md` | 本檔：診斷與修法 |
| `docs/architecture.md` | 架構、資料表、Edge Function 決策 |
| `docs/lessons.md` | 判準區（rubric）+ 踩坑紀錄 |
| `docs/todo.md` | 待辦與方案評估 |
| `docs/jsx-map.md` | jsx 巨檔章節地圖 |
| `docs/delegation.md` | subagent 調度守則 |
| `docs/templates/implement.md` / `verify.md` | 派工填空模板 |
| `.claude/agents/scanner.md` / `verifier.md` | 唯讀掃描 / fresh-context 驗證 subagent |
| `.claude/commands/lesson.md` | `/lesson`：把新坑寫進 lessons.md |
| `.claude/commands/deploy-*.md`（更新） | deploy 後強制查 log 並回報 |
