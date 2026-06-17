// 新規ユーザーの初回ログイン時に入れるダミー初期データ。
// Supabase 上のデータが空のときだけ store から呼ばれる。

import { emptyDB, type DB, type Item } from "./types";

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function seedDB(): DB {
  const db: DB = structuredClone(emptyDB);
  const date = todayStr();

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
      scheduledDate: inToday ? date : null,
      status: "open",
      createdAt: now(),
    };
    db.items.push(item);
    if (inToday) {
      db.today.push({ id: id(), date, itemId: item.id, order: order++ });
    }
  }

  return db;
}
