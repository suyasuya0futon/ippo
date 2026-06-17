-- 【読み取り専用】何も変更しません。
-- さっき public に schema.sql を実行してしまった後の状態を確認するためのクエリ。
-- Supabase の SQL Editor に貼って実行し、結果を Claude に貼ってください。

-- 1) public スキーマにあるテーブル一覧
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

-- 2) IPPO が作ろうとした4つの名前のテーブルの「列」
--    （IPPO製＝user_id/tags/recurring 等が並ぶ。oyasumi-sanpo 製なら別の列になる）
select table_name,
       string_agg(column_name, ', ' order by ordinal_position) as columns
from information_schema.columns
where table_schema = 'public'
  and table_name in ('items', 'steps', 'today_items', 'done_logs')
group by table_name
order by table_name;

-- 3) それらに今ついている RLS ポリシー
select tablename, policyname
from pg_policies
where schemaname = 'public'
  and tablename in ('items', 'steps', 'today_items', 'done_logs')
order by tablename, policyname;
