-- IPPO のテーブル定義（Supabase の SQL Editor に貼って実行）
-- 他アプリ(public スキーマ)と衝突しないよう、専用スキーマ "ippo" に作る。
-- 実行後、ダッシュボードで Settings → API → Exposed schemas に "ippo" を追加すること。
-- 何度実行しても安全。

create extension if not exists "pgcrypto";

create schema if not exists ippo;
grant usage on schema ippo to anon, authenticated, service_role;

-- アイテム（やること）
create table if not exists ippo.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  tag text,
  recurring boolean not null default false,
  bucket text not null default 'someday',
  scheduled_date date,
  sort_order double precision not null default 0,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  done_at timestamptz
);

-- 手順
create table if not exists ippo.steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null references ippo.items (id) on delete cascade,
  title text not null,
  sort_order int not null default 0,
  done boolean not null default false,
  done_at timestamptz
);

-- 今日やること
create table if not exists ippo.today_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null references ippo.items (id) on delete cascade,
  date date not null,
  sort_order int not null default 0
);

-- できたことログ（アイテムを消しても残す。item への外部キーは張らない）
create table if not exists ippo.done_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  ref_type text not null,
  ref_id uuid not null,
  title text not null,
  tag text,
  done_at timestamptz not null default now()
);

-- 1日のメモ（ユーザーごとに1日1件）
create table if not exists ippo.day_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  note text not null default '',
  unique (user_id, date)
);

-- ユーザー設定（フラグの自動繰り上げ判定などに使う。ユーザーごとに1件）
create table if not exists ippo.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  last_promote_date date
);

-- OpenAI Realtime の開始セッション記録（上限チェック用）
create table if not exists ippo.ai_realtime_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  model text not null,
  max_seconds integer not null default 180,
  estimated_cost_usd numeric(10, 4) not null default 0.0166
);

create index if not exists idx_items_user on ippo.items (user_id);
create index if not exists idx_steps_item on ippo.steps (item_id);
create index if not exists idx_today_user_date on ippo.today_items (user_id, date);
create index if not exists idx_logs_user_date on ippo.done_logs (user_id, date);
create index if not exists ai_realtime_sessions_started_at_idx
  on ippo.ai_realtime_sessions (started_at);
create index if not exists ai_realtime_sessions_user_started_at_idx
  on ippo.ai_realtime_sessions (user_id, started_at);

-- PostgREST 経由で読み書きできるよう権限を付与（行の制御は RLS が行う）
grant all on all tables in schema ippo to anon, authenticated, service_role;
alter default privileges in schema ippo grant all on tables to anon, authenticated, service_role;

-- 行レベルセキュリティ（RLS）
alter table ippo.items enable row level security;
alter table ippo.steps enable row level security;
alter table ippo.today_items enable row level security;
alter table ippo.done_logs enable row level security;
alter table ippo.day_notes enable row level security;
alter table ippo.user_settings enable row level security;
alter table ippo.ai_realtime_sessions enable row level security;

drop policy if exists "own items" on ippo.items;
create policy "own items" on ippo.items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own steps" on ippo.steps;
create policy "own steps" on ippo.steps
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own today" on ippo.today_items;
create policy "own today" on ippo.today_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own logs" on ippo.done_logs;
create policy "own logs" on ippo.done_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own day_notes" on ippo.day_notes;
create policy "own day_notes" on ippo.day_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own user_settings" on ippo.user_settings;
create policy "own user_settings" on ippo.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own ai realtime sessions" on ippo.ai_realtime_sessions;
create policy "own ai realtime sessions" on ippo.ai_realtime_sessions
  for select using (auth.uid() = user_id);
