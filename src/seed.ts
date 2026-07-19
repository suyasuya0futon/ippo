// 新規ユーザーの初回ログイン時に入れるダミー初期データ。
// Supabase 上のデータが空のときだけ store から呼ばれる。

import { emptyDB, type DB, type Item } from "./types";
import { ALL_REPEAT_DAYS } from "./recurrence";

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();

export function seedDB(): DB {
  const db: DB = structuredClone(emptyDB);

  // [タイトル, タグ(無ければ null), 毎日か, 今日に出すか]
  const rows: [string, string | null, boolean, boolean][] = [
    ["早起きする", "健康", true, false],
    ["腹筋を10回する", "健康", true, false],
    ["豆腐を買う", "買物", false, true],
  ];

  let order = 0;
  for (const [title, tag, recurring, inToday] of rows) {
    const item: Item = {
      id: id(),
      title,
      tag,
      recurring,
      repeatDays: ALL_REPEAT_DAYS,
      bucket: inToday ? "today" : "someday",
      sortOrder: order++,
      status: "open",
      createdAt: now(),
    };
    db.items.push(item);
  }

  return db;
}
