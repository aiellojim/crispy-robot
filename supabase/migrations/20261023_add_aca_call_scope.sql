-- ACA「處理通話」範圍（2026-10-23）：內線 / 外線 / 內外線都接聽。
-- 跟 aca_lines / aca_plan 一樣是「已選 ACA 之後才追問的細節欄位」，文字型別、預設空字串（未設定）。
-- 已於 2026-10-23 透過 Supabase MCP apply_migration 套用到專案 yqoingcpcryrcpnhkjzu，此檔僅作為
-- 本機 repo 的紀錄留存。前端上線前必須先有這個欄位，否則 projectToRow 帶 aca_call_scope 會讓專案儲存失敗。
alter table public.projects
  add column if not exists aca_call_scope text default ''::text;
