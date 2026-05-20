-- ============================================================
-- push_subscriptions 重構：一人一筆，endpoints 陣列存多瀏覽器
-- 在 Supabase SQL Editor 執行
-- ============================================================

-- 1. 移除舊的 endpoint unique constraint（改由 user_id unique 取代）
alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_endpoint_key;

-- 2. 新增 endpoints JSONB 陣列欄位
alter table public.push_subscriptions
  add column if not exists endpoints jsonb default '[]'::jsonb;

-- 3. 將現有 endpoint/p256dh/auth 搬入 endpoints 陣列
update public.push_subscriptions
set endpoints = jsonb_build_array(
  jsonb_build_object(
    'endpoint', endpoint,
    'p256dh',   p256dh,
    'auth',     auth
  )
)
where endpoint is not null
  and (endpoints = '[]'::jsonb or endpoints is null);

-- 4. 合併同一 user_id 的多筆記錄（保留最新一筆，合併所有 endpoints）
do $$
declare
  uid          uuid;
  keep_id      uuid;
  merged_eps   jsonb;
  latest_projs uuid[];
  latest_days  int;
  latest_pic   text;
begin
  for uid in
    select user_id from public.push_subscriptions
    where user_id is not null
    group by user_id having count(*) > 1
  loop
    -- 合併此 user 所有 endpoints
    select jsonb_agg(ep)
    into   merged_eps
    from   public.push_subscriptions p,
           jsonb_array_elements(p.endpoints) ep
    where  p.user_id = uid;

    -- 取最新一筆的其他欄位
    select id, subscribed_projects, notify_days_before, pic_name
    into   keep_id, latest_projs, latest_days, latest_pic
    from   public.push_subscriptions
    where  user_id = uid
    order by created_at desc
    limit 1;

    -- 更新保留的那筆
    update public.push_subscriptions
    set    endpoints          = coalesce(merged_eps, '[]'::jsonb),
           subscribed_projects = latest_projs,
           notify_days_before  = latest_days,
           pic_name            = latest_pic
    where  id = keep_id;

    -- 刪除多餘的舊記錄
    delete from public.push_subscriptions
    where  user_id = uid and id != keep_id;
  end loop;
end $$;

-- 5. 為 user_id 加 unique constraint（確保一人一筆）
alter table public.push_subscriptions
  add constraint push_subscriptions_user_id_unique unique (user_id);

-- 確認結果
select id, pic_name, user_id,
       jsonb_array_length(endpoints) as endpoint_count,
       endpoints
from public.push_subscriptions
order by created_at desc;
