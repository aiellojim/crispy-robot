-- ============================================================
-- 飯店專案交付中心 — 完整 Schema Migration
-- ============================================================

-- ── 1. 資料表：projects ──────────────────────────────────────
create table if not exists projects (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  name            text not null default '',
  hotel_id        text default '',
  address         text default '',
  region          text default '',
  region_other    text default '',
  products        text[]  default '{}',
  ava_units       text default '',
  ava_spare       text default '',
  integrations    text[]  default '{}',
  integration_notes jsonb default '{}',
  launch_date     date,
  batch1_deadline date,
  batch2_deadline date,
  notes           text default '',
  pic             text default '',
  jira_epic       text default '',
  pic_user_id     uuid references auth.users
);

-- ── 2. 資料表：project_progress ──────────────────────────────
create table if not exists project_progress (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references projects(id) on delete cascade unique,
  updated_at  timestamptz default now(),
  basic_checked  jsonb default '{}',
  basic_notes    jsonb default '{}',
  faq_checked    jsonb default '{}',
  faq_notes      jsonb default '{}',
  batch2_checked jsonb default '{}',
  batch2_notes   jsonb default '{}',
  sheet_links    jsonb default '{}'
);

-- ── 3. 資料表：tasks ─────────────────────────────────────────
create table if not exists tasks (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid references projects(id) on delete cascade,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  name         text not null default '',
  description  text default '',
  type         text not null default 'deadline',
  deadline     date,
  period_start date,
  period_end   date,
  url          text default ''
);

-- ── 4. 資料表：push_subscriptions ────────────────────────────
create table if not exists push_subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz default now(),
  pic_name            text not null,
  endpoint            text not null unique,
  p256dh              text not null,
  auth                text not null,
  subscribed_projects uuid[] default '{}',
  notify_days_before  int default 0,
  user_id             uuid references auth.users
);

-- ── 5. 資料表：user_profiles ─────────────────────────────────
create table if not exists user_profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text default '',
  jira_email   text default '',
  jira_token   text default '',
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ── 6. 資料表：jira_action_log ───────────────────────────────
create table if not exists jira_action_log (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  user_id      uuid references auth.users,
  display_name text,
  issue_key    text,
  from_status  text,
  to_status    text,
  project_id   uuid references projects(id) on delete set null
);

-- ── 7. updated_at trigger ────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_projects_updated_at
  before update on projects for each row execute function public.set_updated_at();

create trigger trg_progress_updated_at
  before update on project_progress for each row execute function public.set_updated_at();

create trigger trg_tasks_updated_at
  before update on tasks for each row execute function public.set_updated_at();

create trigger trg_user_profiles_updated_at
  before update on user_profiles for each row execute function public.set_updated_at();

-- ── 8. 權限 ──────────────────────────────────────────────────
grant select, insert, update, delete
  on public.projects, public.project_progress, public.tasks, public.push_subscriptions
  to anon, authenticated, service_role;

grant select, insert, update
  on public.user_profiles to anon, authenticated, service_role;

grant select, insert
  on public.jira_action_log to anon, authenticated, service_role;

-- ── 9. pg_cron 排程（修正版）────────────────────────────────
-- 舊版缺少 Content-Type 和 body，導致 401 錯誤，一併修正

select cron.unschedule('daily-push-notification');
select cron.unschedule('send-email-notifications');

-- 推播通知（UTC 01:00 = 台灣 09:00）
select cron.schedule(
  'daily-push-notification',
  '0 1 * * *',
  $$
  select net.http_post(
    url     := 'https://yqoingcpcryrcpnhkjzu.supabase.co/functions/v1/send-push',
    body    := '{}'::jsonb,
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlxb2luZ2NwY3J5cmNwbmhranp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNTg5NTMsImV4cCI6MjA5MjgzNDk1M30.mDbv7McB9urXXYoqm795dnNj2SHUDal_L0Y1_klFy4Y"}'::jsonb
  )
  $$
);

-- Email 通知（UTC 01:00 = 台灣 09:00）
select cron.schedule(
  'send-email-notifications',
  '0 1 * * *',
  $$
  select net.http_post(
    url     := 'https://yqoingcpcryrcpnhkjzu.supabase.co/functions/v1/send-email',
    body    := '{}'::jsonb,
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlxb2luZ2NwY3J5cmNwbmhranp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNTg5NTMsImV4cCI6MjA5MjgzNDk1M30.mDbv7McB9urXXYoqm795dnNj2SHUDal_L0Y1_klFy4Y"}'::jsonb
  )
  $$
);

-- 確認兩個排程都在
select jobname, schedule, active from cron.job;
