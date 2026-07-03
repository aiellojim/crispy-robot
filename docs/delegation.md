# Subagent 調度守則

> 兩個自訂 agent：`scanner`（唯讀掃描，haiku）、`verifier`（結案驗證，sonnet），定義在 `.claude/agents/`。
> 派工模板在 `docs/templates/`（`implement.md` / `verify.md`），照填即可。

## 1. 什麼工作派誰

| 情境 | 派 | 理由 |
|---|---|---|
| 大量讀取本機檔案：掃 jsx 巨檔、跨檔搜尋 | `scanner` | 主對話只收結論 + `檔案:行號` 清單，不進大段內容 |
| 查 Supabase log / advisor | 不派，主對話直接用 MCP（`get_logs` / `get_advisors`） | scanner 沒有 MCP 工具做不到；MCP 回傳量不大，不需隔離 |
| 制度檔案修改、跨多檔重構的**結案驗證** | `verifier` | fresh context 不會被「自己剛寫完」的偏見污染 |
| 日常功能修改（單檔或少數檔） | 不派 | 自己改，用 lessons 判準 #3（build + 實測）自驗即可 |

## 2. 派工三件套（每張派工單必含）

1. **目標與動機**：要什麼、為什麼要（讓 subagent 能對模糊處做正確取捨）。
2. **驗收條件**：可檢查的具體判準（「找到 X 的定義位置」而非「了解 X」）。
3. **回報格式**：明確指定（結論 + 位置清單 / 通過不通過 + 證據）。

缺一件就先補齊再派，不要丟一句話讓 subagent 猜。

## 3. 重試上限

同一個 bug、同一條修法路徑，**修兩次不過就停**。停下來後：
- 整理完整失敗軌跡：做了什麼、預期結果、實際結果、錯誤訊息原文。
- 帶著軌跡換一條路徑，或明確建議 Jim 升級模型處理（見 `docs/lessons.md` 判準區 #1、#5）。
- 禁止：不帶新資訊的第三次重試。

## 4. 驗證不自驗

- **制度檔案修改**（CLAUDE.md、docs/、.claude/）與**跨多檔重構**：結束前必派 `verifier` 做 read-back / build 驗證。
  - 例外：CLAUDE.md 維護協議列為「可自行更新」的三檔（lessons / todo / jsx-map）之**日常追加或小幅更新**不需 verifier；
    只有結構性重寫（lessons 合併去重、jsx-map 全檔重掃）才派。
- **日常功能修改**（非制度檔案，單檔或少數檔皆同）：不用 verifier，`npm run build` + 實際頁面/請求測試即可
  （判準見 lessons「完成的定義」#3）。
- **拿不準歸哪類** → 派 `verifier`，寧多驗不漏驗。

## 5. 明文不做（避免未來 session 自行加回）

- ❌ 多答案評審（同一題派多個 agent 再評比）——單人專案成本不划算。
- ❌ 五層升降級矩陣之類的複雜調度規則——只有上面兩個 agent，夠用。
