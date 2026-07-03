部署 send-push 並驗證（依「完成的定義」，deploy 成功不等於完成）：

1. 執行 `supabase functions deploy send-push`。
2. deploy 失敗 → 回報錯誤訊息原文，停止，不要自行重寫整個 function（見 docs/lessons.md 判準區 #1）。
3. deploy 成功 → 用 Supabase MCP 的 `get_logs` 查該 function 最近 10 筆（deploy 之後產生的）log，確認無 error。
4. 觸發一次真實請求（curl 打 function endpoint；或等下一次 pg_cron 排程後查 log），再查一次 log。
5. 回報結果，格式固定三選一：
   - `✅ deploy 成功 + 真實請求 + log 無 error`（這才算完成），或
   - `⚠️ 已 deploy、log 無 error，但尚未以真實請求驗證——不算完成，待驗證`，或
   - `❌ log 有 error：<錯誤原文>`。
