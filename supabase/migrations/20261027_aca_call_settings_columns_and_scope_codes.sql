-- 2026-10-27：已透過 Supabase MCP apply_migration 套用到專案 yqoingcpcryrcpnhkjzu，此檔僅作紀錄留存。
-- 1) ACA basic settings 新增欄位放進既有 singleton 表 aca_welcome_messages（不新增資料表，
--    避免擴大 anon USING(true) policy 的表數量）。
alter table public.aca_welcome_messages
  add column if not exists internal_speakerphone text not null default '',
  add column if not exists internal_speakerphone_note text not null default '',
  add column if not exists transfer_busy_handling text not null default '',
  add column if not exists transfer_busy_pbx_confirmed boolean not null default false;

-- 2) projects.aca_call_scope 由中文顯示文字改存代碼：internal / external / both
update public.projects
set aca_call_scope = case aca_call_scope
  when '內線' then 'internal'
  when '外線' then 'external'
  when '內外線都接聽' then 'both'
  else aca_call_scope end
where aca_call_scope in ('內線', '外線', '內外線都接聽');
