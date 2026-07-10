create table if not exists ippo.ai_realtime_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  model text not null,
  max_seconds integer not null default 180,
  estimated_cost_usd numeric(10, 4) not null default 0.0166
);

create index if not exists ai_realtime_sessions_started_at_idx
  on ippo.ai_realtime_sessions (started_at);

create index if not exists ai_realtime_sessions_user_started_at_idx
  on ippo.ai_realtime_sessions (user_id, started_at);

alter table ippo.ai_realtime_sessions enable row level security;

grant all on ippo.ai_realtime_sessions to anon, authenticated, service_role;

drop policy if exists "own ai realtime sessions" on ippo.ai_realtime_sessions;
create policy "own ai realtime sessions" on ippo.ai_realtime_sessions
  for select using (auth.uid() = user_id);
