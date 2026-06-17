-- タグを「配列(text[])」から「1個だけ(text, null可)」に変える移行。
-- Supabase の SQL Editor に貼って実行。何度実行しても安全。

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'ippo' and table_name = 'items' and column_name = 'tags'
  ) then
    alter table ippo.items add column if not exists tag text;
    -- 配列の先頭要素を 1個のタグへ。空なら null。
    update ippo.items set tag = nullif(tags[1], '');
    alter table ippo.items drop column tags;
  end if;
end $$;
