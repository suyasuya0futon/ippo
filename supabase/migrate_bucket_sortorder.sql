-- ステップ1（追加のみ）：items に bucket / sort_order 列を追加し、user_settings を作る。
-- ※既存データの変換（scheduledDate→bucket など）はステップ2で行う。ここでは足すだけ。
-- ※このSQLを先に実行してから、bucket/sort_order を読み書きするコードをデプロイすること。
-- Supabase の SQL Editor に貼って実行。何度実行しても安全。

alter table ippo.items add column if not exists bucket text not null default 'someday';
alter table ippo.items add column if not exists sort_order double precision not null default 0;

-- ユーザー設定（フラグ自動繰り上げの判定用。ユーザーごとに1件）
create table if not exists ippo.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  last_promote_date date
);

grant all on ippo.user_settings to anon, authenticated, service_role;

alter table ippo.user_settings enable row level security;
drop policy if exists "own user_settings" on ippo.user_settings;
create policy "own user_settings" on ippo.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

notify pgrst, 'reload schema';
