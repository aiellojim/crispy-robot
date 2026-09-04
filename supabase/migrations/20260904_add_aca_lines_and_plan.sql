-- ACA 分級（2026-09-04）：換方案要重新簽約，同一飯店不會同時持有兩種 ACA 方案，所以刻意不比照
-- PRODUCTS 陣列另開 "ACA Pro" 這種標籤，而是在 projects 表加兩個「已選 ACA 之後才追問的細節欄位」，
-- 邏輯上比照既有的 tmsp_max_spaces / installing_rooms（同樣是文字型別，跟前端 FInput 的
-- value=""/type="number" 慣例一致，不用另外處理空字串 vs null）。
-- 已於 2026-09-04 透過 Supabase MCP apply_migration 套用到專案 yqoingcpcryrcpnhkjzu，此檔僅作為
-- 本機 repo 的紀錄留存。
alter table public.projects
  add column if not exists aca_lines text default ''::text,
  add column if not exists aca_plan text default ''::text;
