-- タスクごとのAI会話ログ。音声データは保存せずテキストだけを残す。
create table if not exists ippo.ai_conversation_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id uuid not null references ippo.items (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  text text not null check (char_length(text) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists ai_conversation_messages_item_created_at_idx
  on ippo.ai_conversation_messages (item_id, created_at);

grant all on ippo.ai_conversation_messages to anon, authenticated, service_role;
alter table ippo.ai_conversation_messages enable row level security;

drop policy if exists "own ai conversation messages" on ippo.ai_conversation_messages;
create policy "own ai conversation messages" on ippo.ai_conversation_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
