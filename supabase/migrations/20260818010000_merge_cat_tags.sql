-- 既存の表記揺れを「猫」にまとめる。今後の入力はフロント側でも正規化する。
update ippo.items
set tag = '猫'
where tag = 'ねこ';

update ippo.done_logs
set tag = '猫'
where tag = 'ねこ';
