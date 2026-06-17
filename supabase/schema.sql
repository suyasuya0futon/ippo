-- IPPO のテーブル定義（Supabase の SQL Editor に貼って実行してください）
-- ログインしたユーザー自身のデータだけを読み書きできるよう、RLS で保護します。
-- 何度実行しても安全なように書いてあります。

create extension if not exists "pgcrypto";

-- アイテム（やること）
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  tags text[] not null default '{}',
  recurring boolean not null default false,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  done_at timestamptz
);

-- 手順
create table if not exists public.steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  title text not null,
  sort_order int not null default 0,
  done boolean not null default false,
  done_at timestamptz
);

-- 今日やること
create table if not exists public.today_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  date date not null,
  sort_order int not null default 0
);

-- できたことログ（アイテムを消しても残す。item への外部キーは張らない）
create table if not exists public.done_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  ref_type text not null,
  ref_id uuid not null,
  title text not null,
  done_at timestamptz not null default now(),
  memo text
);

create index if not exists idx_items_user on public.items (user_id);
create index if not exists idx_steps_item on public.steps (item_id);
create index if not exists idx_today_user_date on public.today_items (user_id, date);
create index if not exists idx_logs_user_date on public.done_logs (user_id, date);

-- 行レベルセキュリティ（RLS）を有効化
alter table public.items enable row level security;
alter table public.steps enable row level security;
alter table public.today_items enable row level security;
alter table public.done_logs enable row level security;

-- 「自分の行だけ」読み書きできるルール（再実行できるよう一度消してから作る）
drop policy if exists "own items" on public.items;
create policy "own items" on public.items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own steps" on public.steps;
create policy "own steps" on public.steps
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own today" on public.today_items;
create policy "own today" on public.today_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own logs" on public.done_logs;
create policy "own logs" on public.done_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
