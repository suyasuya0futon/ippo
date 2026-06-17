-- できたことログに tag 列を追加し、メモ列(memo)を廃止。
-- メモは「1日1件」の day_notes テーブルへ移行。
-- Supabase の SQL Editor に貼って実行。何度実行しても安全。

-- 1) done_logs に tag 列を追加し、既存ログへ items / steps からタグを埋める
alter table ippo.done_logs add column if not exists tag text;

update ippo.done_logs l
set tag = i.tag
from ippo.items i
where l.ref_id = i.id and l.ref_type = 'item' and l.tag is null;

update ippo.done_logs l
set tag = i.tag
from ippo.steps s
join ippo.items i on i.id = s.item_id
where l.ref_id = s.id and l.ref_type = 'step' and l.tag is null;

-- 2) 旧 memo 列は廃止（タスクごとのメモはやめる）
alter table ippo.done_logs drop column if exists memo;

-- 3) day_notes（1日のメモ）を作成
create table if not exists ippo.day_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  note text not null default '',
  unique (user_id, date)
);

grant all on ippo.day_notes to anon, authenticated, service_role;

alter table ippo.day_notes enable row level security;
drop policy if exists "own day_notes" on ippo.day_notes;
create policy "own day_notes" on ippo.day_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- API（PostgREST）のスキーマキャッシュを更新して、すぐ使えるようにする
notify pgrst, 'reload schema';
