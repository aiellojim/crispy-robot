-- 2026-09-04 追加：Jim 確認舊專案的 ACA 本質上都是 Original 方案（換方案要重新簽約，不會有
-- 「原本沒方案」這種狀態），所以與其讓「未選方案」跟「選 Original」在 ACA basic settings 之後的
-- 分頁邏輯裡長期並存成兩種容易混淆的狀態，直接把既有專案的 aca_plan 回填成 'Original'，並把欄位
-- default 也改成 'Original'（純防呆，hotel-dashboard 實際存檔一律明確帶值，不會真的吃到這個
-- default）。往後在 hotel-dashboard 選上 ACA 的當下，前端也會直接預設帶入 Original
-- （見 hotel-project-dashboard.jsx 的 toggleProduct()），所以「未設定方案」這個狀態往後也不會
--再自然出現。
-- 已於 2026-09-04 透過 Supabase MCP apply_migration 套用到專案 yqoingcpcryrcpnhkjzu，此檔僅作為
-- 本機 repo 的紀錄留存。
update public.projects
  set aca_plan = 'Original'
  where products @> array['ACA'::text] and (aca_plan is null or aca_plan = '');

alter table public.projects
  alter column aca_plan set default 'Original'::text;
