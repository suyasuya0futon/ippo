-- ステップ2a：既存データを「フラグ(bucket)」へ変換する。
-- 既存の scheduled_date は today_items 由来で本物の約束ではないので、全部フラグに移して予定日はクリア。
-- 本物の約束（予定日）は後から付け直す。
-- ※このSQLは不可逆（予定日をクリアする）。実行前に内容を確認すること。
-- Supabase の SQL Editor に貼って実行。何度実行しても安全。

-- 1) scheduled_date からフラグへ（一度きりタスクのみ。毎日タスクは someday のままでよい）
update ippo.items set bucket = case
  when scheduled_date is null then 'someday'
  when scheduled_date <= current_date then 'today'
  when scheduled_date = current_date + 1 then 'tomorrow'
  else 'soon'
end
where recurring = false;

-- 2) 予定日をクリア（本物の約束は後で付け直す）
update ippo.items set scheduled_date = null where recurring = false;

-- 3) sort_order を「新しいものほど上（小さい値）」で連番付与
with ranked as (
  select id, row_number() over (order by created_at desc) as rn
  from ippo.items
)
update ippo.items i
set sort_order = ranked.rn
from ranked
where i.id = ranked.id;

-- 4) bucket に CHECK 制約（許可する値だけ）
alter table ippo.items drop constraint if exists items_bucket_check;
alter table ippo.items
  add constraint items_bucket_check check (bucket in ('today', 'tomorrow', 'soon', 'someday'));

notify pgrst, 'reload schema';
