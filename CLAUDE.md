# 飯店專案進度管理儀表板

React（Vite）+ 純 inline style 前端（Vercel）＋ Supabase 後端（PostgreSQL + Edge Functions + pg_cron）。
單人開發：Jim。GitHub：`aiellojim/crispy-robot`。本機：`/Users/jim.chao/hotel-dashboard`。

## 常用指令

| 情境 | 指令 |
|---|---|
| 前端 build | `npm run build` |
| 本機開發 | `npm run dev` |
| 部署 jira-proxy | `/deploy-jira-proxy`（deploy 後必查 log，見該 command） |
| 部署 send-push | `/deploy-send-push`（同上） |
| 前端改動收尾 | `git add . && git commit -m "..." && git push` |
| 大改動前打還原點 | `/checkpoint`（`git tag <描述性名稱>`） |
| 踩到新坑 | `/lesson`（寫進 docs/lessons.md） |

## 路由：動手前先讀對的檔

| 觸發條件 | 先讀 |
|---|---|
| 動 checklist / JSONB / Supabase auth 相關邏輯 | `docs/lessons.md` 對應條目 |
| 要找 `src/hotel-project-dashboard.jsx` 內某功能的位置 | `docs/jsx-map.md`，然後用 grep + 區段讀取；**禁止整檔讀取** |
| 架構、資料表、Edge Function 決策、zIndex、產品線 | `docs/architecture.md` |
| 目前待辦與方案評估 | `docs/todo.md` |
| 要派 subagent（大量掃描、結案驗證） | `docs/delegation.md` + `docs/templates/` |
| 想知道這套制度的由來 | `docs/harness-notes.md` |

## 硬規則（不路由，一律直接遵守）

1. JSONB 更新一律透過 `update_check_item` RPC 做**單一 key 的 atomic 更新**，禁止整包 upsert（會覆蓋並發修改）。
2. 大改動前先 `git tag` 打還原點。大改動判準（任一成立即算）：預期改 ≥3 個檔案、動資料表 schema、
   動 Edge Function 介面（action/參數）、或 Jim 明說是大改動。
3. 本 repo 不使用 Google Drive MCP 工具。
4. 禁止把 secret（`JIRA_API_TOKEN`、`VAPID_PRIVATE_KEY`、service_role key 等）寫進任何會 commit 的檔案；
   連線資訊一律以環境變數名稱引用（`.env.local` / Vercel / Supabase Secrets 為真值來源）。
5. 完成的定義一律以 `docs/lessons.md` 判準區 #3 為準：前端 = build 通過 **且** 實際頁面確認；
   Edge Function = deploy 成功 **且** 真實請求 **且** log 無 error。「程式碼看起來對」不算完成。

## 維護協議

- 模型**可自行更新**：`docs/lessons.md`、`docs/todo.md`、`docs/jsx-map.md`（commit message 註明更新了什麼）。
- **動之前必須先問 Jim**：本檔（CLAUDE.md）的路由與硬規則、`docs/architecture.md` 的架構決策、
  `.claude/settings.json` 的權限設定。
- 每次踩坑 → 當場用 `/lesson` 寫入，不要等 session 結束。
- `docs/lessons.md` 超過 60 條 → 提示 Jim 開一次專門 session 合併去重。
- 退化預防：
  1. lessons 變成只寫不讀的垃圾場 → 上方路由表強制「動相關邏輯前先讀」。
  2. 本檔長回 monolith → 任何新增專案知識一律寫進 `docs/` 子檔，本檔只加一行路由，禁止直接新增內容段落。
