// 新規ユーザーの初回ログイン時に入れる初期データ（Any.do から移してきた分）。
// データが空のときだけ store から呼ばれる。

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
    // 今日の縫い物
    ["ズボン縫う", "裁縫", false, true],
    ["サンプル服の下縫う", "裁縫", false, true],
    ["PC入れ袋縫う", "裁縫", false, true],
    ["GUコート袖縫う", "裁縫", false, true],
    ["NIKEバッグの紐短く縫う", "裁縫", false, true],
    ["川口プラネタリウム", "行きたい場所", false, true],
    ["品川スキン、西新宿皮膚科？", "からだ", false, true],
    // 毎日の習慣
    ["みみこ毛繕い", "からだ", true, false],
    ["プロテイン飲む", "からだ", true, false],
    ["キッチン掃除", "掃除", true, false],
    ["その他の掃除", "掃除", true, false],
    ["みみこ関係掃除", "掃除", true, false],
    ["自部屋掃除", "掃除", true, false],
    // いつかやる
    ["郵便局のお金を引き出して新生にうつす？", null, false, false],
    ["換気扇フィルターかえる", "掃除", false, false],
    ["服処分", null, false, false],
    ["タグ注文", "裁縫", false, false],
    ["デザインするアプリ使う", null, false, false],
    // 買い物
    ["冷蔵庫 H127×W49×D54cm（153L:冷蔵106L…）", "買い物", false, false],
    ["ひきわり納豆、豆腐、豆苗、豚バラ、鶏も…", "買い物", false, false],
    ["耐熱ガラスマグカップ", "買い物", false, false],
    ["ニトリ風呂掃除ブラシ", "買い物", false, false],
    // 見る・読む
    ["無職転生", "見る・読む", false, false],
    ["さむらいむすりっぱー", "見る・読む", false, false],
  ];

  let order = 0;
  for (const [title, tag, recurring, inToday] of rows) {
    const item: Item = {
      id: id(),
      title,
      tag,
      recurring,
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
