-- 習慣の曜日指定とは独立して、日本の祝日を除外できるようにする移行。
-- 従来の「平日」（月〜金）設定は、祝日除外をオンにして挙動を引き継ぐ。
-- Supabase の SQL Editor に貼って実行。何度実行しても安全。

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'ippo'
      and table_name = 'items'
      and column_name = 'exclude_holidays'
  ) then
    alter table ippo.items
      add column exclude_holidays boolean not null default false;

    update ippo.items
    set exclude_holidays = true
    where recurring = true
      and repeat_days = 62;
  end if;
end $$;
