-- ============================================================
-- 方向 C：Magic Link 登入 Migration
-- 在 Supabase SQL Editor 執行
-- ============================================================

-- ── 1. user_profiles ─────────────────────────────────────────
create table public.user_profiles (
  id           uuid        primary key references auth.users on delete cascade,
  display_name text        default '',
  jira_email   text        default '',
  jira_token   text        default '',
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create trigger trg_user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

grant select, insert, update
  on public.user_profiles to anon, authenticated, service_role;


-- ── 2. jira_action_log ───────────────────────────────────────
create table public.jira_action_log (
  id           uuid        primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  user_id      uuid        references auth.users,
  display_name text,
  issue_key    text,
  from_status  text,
  to_status    text,
  project_id   uuid        references public.projects on delete set null
);

grant select, insert
  on public.jira_action_log to anon, authenticated, service_role;


-- ── 3. Supabase Auth 設定（需在 Dashboard 手動完成）────────────
-- Auth > URL Configuration > Site URL：
--   https://hotel-dashboard-aiellojims-projects.vercel.app
--
-- Auth > URL Configuration > Redirect URLs（新增）：
--   https://hotel-dashboard-aiellojims-projects.vercel.app
--   http://localhost:5173  （本機開發用）
