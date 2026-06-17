-- items に scheduled_date（予定日）を追加し、today_items から移行する。
-- today_items テーブルはまだ落とさない（scheduledDate 運用が安定してから別途）。
-- Supabase の SQL Editor に貼って実行。何度実行しても安全。
-- ※このSQLを先に実行してから、scheduledDate を読み書きするコードをデプロイすること。

alter table ippo.items add column if not exists scheduled_date date;

-- 一度きりタスク：today_items に行があれば、その「最新の日付」を予定日にする
update ippo.items i
set scheduled_date = sub.max_date
from (
  select item_id, max(date) as max_date
  from ippo.today_items
  group by item_id
) sub
where i.id = sub.item_id
  and i.recurring = false
  and i.scheduled_date is null;

-- 毎日タスク、および today_items に行が無いタスクは null のまま（予定日なし）

-- API（PostgREST）のスキーマキャッシュを更新
notify pgrst, 'reload schema';
