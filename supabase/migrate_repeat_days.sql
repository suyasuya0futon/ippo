-- 習慣に曜日指定を追加する移行。
-- 既存の習慣は default 127（毎日）のまま引き継ぐ。
-- Supabase の SQL Editor に貼って実行。何度実行しても安全。

alter table ippo.items
  add column if not exists repeat_days integer not null default 127;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'ippo.items'::regclass
      and conname = 'items_repeat_days_check'
  ) then
    alter table ippo.items
      add constraint items_repeat_days_check check (repeat_days between 1 and 127);
  end if;
end $$;
