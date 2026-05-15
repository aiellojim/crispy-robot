-- ============================================================
-- 飯店專案進度管理儀表板 — Database Schema Migration
-- Supabase Project: yqoingcpcryrcpnhkjzu
-- Generated: 2026-05-15
-- ============================================================
-- 執行方式：Supabase Dashboard → SQL Editor → 貼上並執行
-- 注意：在新環境執行前請確認 anon key 和 URL 已更新至 .env
-- ============================================================


-- ── 1. projects ──────────────────────────────────────────────
create table public.projects (
  id                uuid        primary key default gen_random_uuid(),
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  name              text        not null default '',
  hotel_id          text        default '',
  address           text        default '',
  region            text        default '',
  region_other      text        default '',
  products          text[]      default '{}',
  ava_units         text        default '',
  ava_spare         text        default '',
  integrations      text[]      default '{}',
  integration_notes jsonb       default '{}',
  launch_date       date,
  batch1_deadline   date,
  batch2_deadline   date,
  notes             text        default '',
  pic               text        default '',
  jira_epic         text        default ''
);


-- ── 2. project_progress ──────────────────────────────────────
create table public.project_progress (
  id             uuid        primary key default gen_random_uuid(),
  project_id     uuid        unique references public.projects(id) on delete cascade,
  updated_at     timestamptz default now(),
  basic_checked  jsonb       default '{}',
  basic_notes    jsonb       default '{}',
  faq_checked    jsonb       default '{}',
  faq_notes      jsonb       default '{}',
  batch2_checked jsonb       default '{}',
  batch2_notes   jsonb       default '{}',
  sheet_links    jsonb       default '{}'
);


-- ── 3. tasks ─────────────────────────────────────────────────
create table public.tasks (
  id           uuid        primary key default gen_random_uuid(),
  project_id   uuid        references public.projects(id) on delete cascade,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  name         text        not null default '',
  description  text        default '',
  type         text        not null default 'deadline', -- 'deadline' | 'period'
  deadline     date,
  period_start date,
  period_end   date,
  url          text        default ''
);


-- ── 4. push_subscriptions ────────────────────────────────────
create table public.push_subscriptions (
  id                  uuid    primary key default gen_random_uuid(),
  created_at          timestamptz default now(),
  pic_name            text    not null,
  endpoint            text    not null unique,
  p256dh              text    not null,
  auth                text    not null,
  subscribed_projects uuid[]  default '{}',
  notify_days_before  integer default 0
);


-- ── 5. updated_at 自動更新 trigger ───────────────────────────
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create trigger trg_project_progress_updated_at
  before update on public.project_progress
  for each row execute function public.set_updated_at();

create trigger trg_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();


-- ── 6. anon key 存取權限（目前架構：無 RLS，anon key 全存取）─
-- 若未來啟用 Auth 和 RLS，請移除以下 grant 並改為 policy
grant select, insert, update, delete
  on public.projects, public.project_progress, public.tasks, public.push_subscriptions
  to anon, authenticated, service_role;


-- ── 7. 未來啟用 Auth 時的預備欄位（目前先不執行）─────────────
-- alter table public.projects add column pic_user_id uuid references auth.users;
-- create table public.user_profiles (
--   id           uuid references auth.users primary key,
--   display_name text,
--   jira_email   text,
--   jira_token   text
-- );


-- ============================================================
-- ⚠️  RLS 目前關閉（所有表）
-- 現階段為內部工具使用 anon key，啟用 RLS 前需先建立 policy
-- 否則所有查詢會被阻擋。待導入 Supabase Auth 後再評估開啟。
-- ============================================================
