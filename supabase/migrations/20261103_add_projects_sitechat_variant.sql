-- SiteChat 規格變體（2026-11-03）：集團專屬規格（例如天成集團 cosmos 的頭像尺寸）。
-- 文字型別、預設空字串 = 標準規格；資料庫存代碼（cosmos），顯示名稱在前端 SITECHAT_VARIANTS。
-- 已於 2026-11-03 透過 Supabase MCP apply_migration 套用到專案 yqoingcpcryrcpnhkjzu，此檔僅作為紀錄留存。
-- 前端上線前必須先有這個欄位，否則 projectToRow 帶 sitechat_variant 會讓專案儲存失敗。
alter table public.projects
  add column if not exists sitechat_variant text default ''::text;
