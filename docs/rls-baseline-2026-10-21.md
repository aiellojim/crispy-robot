# RLS 基準快照（2026-10-21）

> 用途：方案 B（`docs/todo.md` #6）動工前的「現況基準」。內容是 2026-10-21 直接對正式資料庫查出來的結果，
> 不是從文件推斷。動工前請先重新跑一次第 5 節的查詢，確認這份快照沒有過期。
> 還原點 tag：`before-rls-baseline-doc-2026-10-21`（只涵蓋這份文件的 commit，不是資料庫備份）。

## 1. 今天（2026-10-21）已經處理的

| 項目 | 處理 | migration 名稱 |
|---|---|---|
| `dashboard_egg_unlocks` RLS 原本是 disabled | 啟用 RLS；`authenticated` 只能讀／新增自己 email 的列；`anon` 全收回 | 由 Jim 在 SQL Editor 手動執行（`enable_rls_dashboard_egg_unlocks` 內容） |
| `update_check_item`／`update_progress_field` 是 SECURITY DEFINER，anon／authenticated 都可呼叫並繞過 RLS | 改 SECURITY INVOKER（改由 `project_progress` 的 `staff: full access` 把關）；收回 anon／PUBLIC 的 EXECUTE；固定 `search_path` | `harden_progress_rpcs_security_invoker_search_path` |
| `update_updated_at`／`set_updated_at` 的 `search_path` 可變 | 固定為空字串 | 同上 |

**之後新增 RPC 的規則**：預設用 SECURITY INVOKER，不要再新增 anon 可呼叫的 SECURITY DEFINER 函式
（`docs/aiello-forms-spec.md` 建議的 `jsonb_build_object` 合併模式本身沒問題，問題在「DEFINER + anon 可執行」這個組合）。

## 2. 還沒處理：anon 的 `USING(true)` policy（25 張表）

`public` schema 目前 RLS 全部啟用（0 張 disabled），但下列 25 張表有 anon 的永遠為真 policy：
23 張 `ALL`、`projects`（`SELECT` + `UPDATE`）、`project_progress`（`SELECT`）。
`docs/todo.md` #6 先前記的是 20 張，差的 4 張是後來新增的 `aca_*` 表。

| 表 | 列數 | anon policy | 使用的前端（由 `.from('…')` 搜尋得到） | 建議階段 |
|---|---|---|---|---|
| `aca_faq_documents` | 4 | ALL（讀寫改刪） | ACA basic settings | 2 |
| `aca_transfer_departments` | 64 | ALL（讀寫改刪） | ACA basic settings | 2 |
| `aca_transfer_scenarios` | 175 | ALL（讀寫改刪） | ACA basic settings | 2 |
| `aca_welcome_messages` | 5 | ALL（讀寫改刪） | ACA basic settings | 2 |
| `ad_settings` | 9 | ALL（讀寫改刪） | AVA UI settings | 2 |
| `aiello_team_members` | 179 | ALL（讀寫改刪） | AVA basic settings | 1 |
| `floor_wifi_rooms` | 48 | ALL（讀寫改刪） | AVA basic settings | 1 |
| `hotel_form_config` | 12 | ALL（讀寫改刪） | AVA basic settings | 1 |
| `hotel_team_members` | 26 | ALL（讀寫改刪） | AVA basic settings | 1 |
| `pending_confirmation_items` | 16 | ALL（讀寫改刪） | AVA basic settings | 1 |
| `phone_buttons` | 41 | ALL（讀寫改刪） | AVA basic settings | 1 |
| `qr_popups` | 5 | ALL（讀寫改刪） | AVA UI settings | 2 |
| `reference_documents` | 17 | ALL（讀寫改刪） | AVA basic settings | 1 |
| `room_type_images` | 2 | ALL（讀寫改刪） | AVA basic settings | 1 |
| `room_types` | 15 | ALL（讀寫改刪） | AVA basic settings | 1 |
| `showcase_cards` | 24 | ALL（讀寫改刪） | AVA UI settings | 2 |
| `showcase_sections` | 12 | ALL（讀寫改刪） | AVA UI settings | 2 |
| `sitechat_faq_cards` | 26 | ALL（讀寫改刪） | SiteChat settings | 2 |
| `sitechat_settings` | 6 | ALL（讀寫改刪） | SiteChat settings | 2 |
| `tmsp_room_rows` | 244 | ALL（讀寫改刪） | AVA basic settings | 1 |
| `tmsp_space_rows` | 257 | ALL（讀寫改刪） | AVA basic settings | 1 |
| `web_portal_users` | 104 | ALL（讀寫改刪） | AVA basic + ACA basic + SiteChat（3 個表單共用） | 3（三個表單都改完才能動） |
| `welcome_messages` | 8 | ALL（讀寫改刪） | AVA basic settings | 1 |
| `projects` | 44 | SELECT + UPDATE | SELECT：4 個表單全部；UPDATE：只有 AVA basic settings（約第 1104 行 `projects.update`） | SELECT 跟最後一個表單走；UPDATE 跟階段 1 |
| `project_progress` | 44 | SELECT | AVA basic settings（讀 `sheet_links`，另有 Realtime 訂閱） | 1 |

來源與限制：
- 「使用的前端」是在 `hotel-dashboard`、`AVA basic settings`、`AVA UI settings`、`ACA basic settings`、`SiteChat settings`、
  `customer-portal` 六個資料夾搜尋 `.from('表名')` 得到的靜態結果。`diffRepeater()` 這類用變數傳表名的呼叫沒有被字串搜尋
  直接抓到，但每張表在各自表單裡都至少有一次字面的 `select`，所以對應關係應該完整；**動工前仍要在實際表單裡再確認一次**。
- **`projects` 的 anon UPDATE 實際只寫四個欄位**：`AVA basic settings` 的 `syncToSupabase()` 對 `projects` 只更新
  `integration_notes`、`integrations`、`languages`、`music`（飯店勾選的串接功能／語言／音樂設定）；專案名稱、地址、產品線、
  上線日期等欄位表單都不寫。方案 B 的 policy 除了限定「只能改自己那一列」，也可以考慮另外用資料庫端機制限制可寫欄位（額外加固，非必要）。
- **為什麼 anon 需要寫入與刪除**：飯店端免登入填表（見 `docs/aiello-forms-spec.md` 第 1 節），所以表單所有操作在資料庫看來都是 `anon`。
  INSERT＝新增一列（`diffRepeater()` 的 insert）、UPDATE＝改欄位、DELETE＝飯店在畫面上移除一列或刪除房型圖片、SELECT＝載入與 Realtime。
  不是預填資料造成的，所以不能把 anon 寫入單純拿掉，只能換成「只能動自己專案的列」。
- `hotel-dashboard`（內部員工，`authenticated` 角色）與 `customer-portal`（客戶 Magic Link）不使用 anon policy，
  方案 B 不影響它們。`customer-portal` 寫入走 `customer-check` Edge Function（service role）。
- 所有表的 table-level GRANT 對 `anon` 都是預設的 SELECT/INSERT/UPDATE/DELETE，實際能做什麼完全由 RLS policy 決定。
  這是 Supabase 預設行為，不是這次的問題，但代表「RLS 一旦被打開成 true，就沒有第二道防線」。

## 3. 方案 B 的耦合點與建議分階段（推論，供動工前討論）

1. **共用表決定順序**：`web_portal_users` 被 AVA basic、ACA basic、SiteChat 三個表單共用；`projects` 被四個表單讀取。
   共用表的 policy 只有一套，所以三個表單都能簽發／使用 JWT 之後才能收緊。
2. **階段 1（風險最高、範圍最集中）**：只被 `AVA basic settings` 使用的 12 張表，加上 `projects` 的 `UPDATE`
   與 `project_progress` 的 `SELECT`。含 `floor_wifi_rooms`（明碼 WiFi 密碼）、`web_portal_users` 以外的聯絡人資料，
   也跟 todo #6 已決定的「先 AVA basic settings」一致。
3. **階段 2**：各自獨立的三組——`showcase_*`／`ad_settings`／`qr_popups`（AVA UI settings）、`aca_*` 四張（ACA basic）、
   `sitechat_*` 兩張（SiteChat）。
4. **階段 3**：`web_portal_users`，以及 `projects` 的 `SELECT`。

## 4. 零停機的推出順序（建議，降低「飯店正在填表」時出錯的代價）

RLS 的 permissive policy 是「任一條成立就放行」。利用這一點，可以讓新舊並存、最後才拿掉舊的：

1. **新增**依 JWT claim 判斷的新 policy（例如 `(auth.jwt() ->> 'project_id')::uuid = project_id`），**舊的 `USING(true)` 先不動**。此時任何人行為都沒有改變。
2. 部署表單前端與簽發 JWT 的 Edge Function；表單開始帶 JWT。
3. 觀察一段時間：用 `query_logs` 確認請求確實帶著 project_id 的 JWT、沒有 401/403，Realtime 訂閱正常。
4. **最後**才 `drop policy "anon: edit via link"`（舊的）。出事時立刻用第 6 節的 SQL 重建該表的舊 policy 即可還原，不需要改前端。

每次只處理一張表（先挑資料量小、使用頻率低的，例如 `welcome_messages`、`room_type_images`），確認沒問題再擴大。

## 5. 動工前的檢查清單

- [ ] 重新跑下面的盤點查詢，確認這份快照仍然正確（尤其是新表有沒有又加了 `anon: edit via link`）。
- [ ] 找離峰時段：用各表的 `updated_at` 看飯店實際填表時間（`select date_trunc('hour', max(updated_at))` 之類）。
- [ ] 已決定：JWT 的 `role` claim 要用 `anon` 還是 `authenticated`（影響新 policy 要寫 `to anon` 還是 `to authenticated`，也避免誤觸 `staff: full access` 的 email 判斷）。
- [ ] Jim 手動把專案的 JWT Secret 放進 Supabase Secrets（我這邊沒有工具能讀取）。
- [ ] 簽發 JWT 的 Edge Function：驗證 `project_id` 存在才簽發。
- [ ] 續期機制（背景換新或失敗時換新）——「分頁開一整天慢慢填」的使用情境（todo #6 已記）。
- [ ] Realtime：每個表單用 `supabase.realtime.setAuth(jwt)`；先確認哪些表單真的有 `postgres_changes` 訂閱（`AVA basic settings` 確認有，其餘動工前用 `grep postgres_changes` 查）。
- [ ] 如果專案方案支援 Supabase branching，可以先在 branch 上演練（`create_branch` 工具可用；是否可用取決於方案，尚未確認）。
      **注意（2026-10-30 起）**：branch 會重播目前 46 筆 migration，那些 migration 建表時沒寫 `GRANT`（當時由系統自動授權），
      所以 10/30 之後建出來的 branch，所有表對 Data API 都會是 `permission denied`；演練前要先在 branch 上補一份
      全表 GRANT（見第 7 節），否則看到的錯誤不是方案 B 造成的。
- [ ] 準備好回滾 SQL（第 6 節）並先在隔離環境驗證可以執行。

盤點查詢（唯讀）：

```sql
select tablename, policyname, cmd, array_to_string(roles, ',') as roles, qual, with_check
from pg_policies
where schemaname = 'public' and (qual = 'true' or with_check = 'true')
order by tablename, cmd, policyname;
```

## 6. 回滾 SQL：重建目前所有 anon 開放 policy（26 條）

只在某張表的 anon policy 被 drop 之後需要。`staff: full access` 等其他 policy 都不會被方案 B 動到，所以不在這裡。
重建單張表時，只取該表那一行。

```sql
create policy "anon: edit via link" on public.aca_faq_documents as permissive for all to anon using (true) with check (true);
create policy "anon: edit via link" on public.aca_transfer_departments as permissive for all to anon using (true) with check (true);
create policy "anon: edit via link" on public.aca_transfer_scenarios as permissive for all to anon using (true) with check (true);
create policy "anon: edit via link" on public.aca_welcome_messages as permissive for all to anon using (true) with check (true);
create policy "anon: edit via link" on public.ad_settings as permissive for all to anon using (true) with check (true);
create policy "anon: edit via link" on public.aiello_team_members as permissive for all to anon using (true) with check (true);
create policy "anon: edit via link" on public.floor_wifi_rooms as permissive for all to anon using (true) with check (true);
create policy "anon: edit via link" on public.hotel_form_config as permissive for all to anon using (true) with check (true);
create policy "anon: edit via link" on public.hotel_team_members as permissive for all to anon using (true) with check (true);
create policy "anon: edit via link" on public.pending_confirmation_items as permissive for all to anon using (true) with check (true);
create policy "anon: edit via link" on public.phone_buttons as permissive for all to anon using (true) with check (true);
create policy "anon: edit via link" on public.qr_popups as permissive for all to anon using (true) with check (true);
create policy "anon: edit via link" on public.reference_documents as permissive for all to anon using (true) with check (true);
create policy "anon: edit via link" on public.room_type_images as permissive for all to anon using (true) with check (true);
create policy "anon: edit via link" on public.room_types as permissive for all to anon using (true) with check (true);
create policy "anon: edit via link" on public.showcase_cards as permissive for all to anon using (true) with check (true);
create policy "anon: edit via link" on public.showcase_sections as permissive for all to anon using (true) with check (true);
create policy "anon: edit via link" on public.sitechat_faq_cards as permissive for all to anon using (true) with check (true);
create policy "anon: edit via link" on public.sitechat_settings as permissive for all to anon using (true) with check (true);
create policy "anon: edit via link" on public.tmsp_room_rows as permissive for all to anon using (true) with check (true);
create policy "anon: edit via link" on public.tmsp_space_rows as permissive for all to anon using (true) with check (true);
create policy "anon: edit via link" on public.web_portal_users as permissive for all to anon using (true) with check (true);
create policy "anon: edit via link" on public.welcome_messages as permissive for all to anon using (true) with check (true);
create policy "anon: read via link" on public.projects as permissive for select to anon using (true);
create policy "anon: update via link" on public.projects as permissive for update to anon using (true) with check (true);
create policy "anon: read for AVA form" on public.project_progress as permissive for select to anon using (true);
```

## 7. 新增資料表的規則（Supabase 2026-10-30 起不再自動 GRANT）

來源：[Supabase changelog #45329](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)。
**現有表不受影響**（保留現有權限）。10/30 起新建的 `public` 表，必須明確 `GRANT`，Data API（supabase-js／PostgREST）才摸得到；
沒有授權會回 `permission denied`。目前專案的預設權限（`pg_default_acl`）對 `anon`／`authenticated`／`service_role`
的資料表、序列、函式都是自動全開，10/30 之後這個自動授權會停止（公告明確寫到資料表與序列；函式部分公告沒有說明，不確定）。

**每個「建表」migration 都要同時包含：**

1. `GRANT`——**預設不給 `anon`**。依用途選：
   - 內部表（只有 hotel-dashboard 員工用）：`grant select, insert, update, delete on public.<t> to authenticated;`＋`to service_role`；policy 用 `staff: full access`。
   - 飯店端表單用的表：是否給 `anon` 要等方案 B 定案；**不要再沿用 `anon: edit via link USING(true)`**（見 todo #6）。
   - 只被 Edge Function／agent（service role）用的表：只授權 `service_role`。
2. `alter table public.<t> enable row level security;`
3. 對應的 policy（`GRANT` 決定「能不能碰這張表」，RLS 決定「能看／改哪些列」，兩者都要）。
4. 有自己的序列（`serial`／`identity` 以外的 sequence）時，記得一併授權序列的 `usage`。
5. 新增 RPC 預設 `security invoker`，不要新增 anon 可呼叫的 `security definer`（見第 1 節）。

範本（內部表）：

```sql
create table public.example_internal (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  note text not null default '',
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.example_internal to authenticated;
grant select, insert, update, delete on public.example_internal to service_role;

alter table public.example_internal enable row level security;

create policy "staff: full access" on public.example_internal
  as permissive for all to authenticated
  using ((select auth.email()) like '%@aiello.ai')
  with check ((select auth.email()) like '%@aiello.ai');
```

### migration 歷史的現況（影響 branch／`supabase db reset`／重建環境）

- 資料庫目前有 **46 筆** migration，`hotel-dashboard/supabase/migrations/` 只有 5 個檔；其餘是用 Supabase MCP 套用的，
  **repo 裡的檔案不是完整的 schema 來源**。
- 這 46 筆建表時都沒有寫 `GRANT`。10/30 之後用它們重播出來的環境（preview branch、本機 `supabase db reset`）會讓所有表都 `permission denied`。
  要重建環境時，必須在重播之後另外補一份全表 GRANT；補的內容要依「這張表該不該給 anon」逐表決定，不要整批 `grant ... to anon`。
- 2026-10-21 的 `dashboard_egg_unlocks` RLS 是 Jim 在 SQL Editor 手動執行的，**沒有出現在 migration 歷史**；
  用歷史重播出來的環境，這張表會是 RLS 關閉的狀態。需要時可補一筆同內容的 migration 記錄（內容見第 1 節）。

## 8. 數字備註（2026-10-21 查詢）

`public` schema 共 34 張表，RLS 全部啟用；migration 歷史 46 筆。

## 9. 風險紀錄

- 這份快照只涵蓋 `public` schema 的 RLS／policy；Storage bucket policy 與 `auth` schema 沒有檢查。
- Supabase security advisor（2026-10-21）沒有列出任何 `rls_policy_always_true` 類型的項目，儘管這些 policy 確實存在，
  所以不能把「advisor 沒警告」當成「沒問題」。
