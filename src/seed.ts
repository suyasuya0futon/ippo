// Any.do から移ってきたデータを、一度だけ IPPO に取り込むための種データ。
// main.tsx から「まだ取り込んでいなければ一回だけ」呼ばれる。
// 取り込んだ後は、アプリ上から自由に編集・削除できる。

import { addCategory, addTask, addToToday, addHabit, addStock } from "./store";

export function importAnydo() {
  // カテゴリ
  const sew = addCategory("裁縫");
  const clean = addCategory("掃除");
  const body = addCategory("からだ");

  // 今日のタスク（Any.do の Today にあったもの）
  const todayTasks: [string, string | null][] = [
    ["ズボン縫う", sew],
    ["サンプル服の下縫う", sew],
    ["PC入れ袋縫う", sew],
    ["GUコート袖縫う", sew],
    ["NIKEバッグの紐短く縫う", sew],
    ["川口プラネタリウム", null],
    ["品川スキン、西新宿皮膚科？", body],
  ];
  for (const [title, cat] of todayTasks) {
    const taskId = addTask(title, cat);
    if (taskId) addToToday(taskId);
  }

  // 習慣（[毎日] のもの）
  const habits: [string, string | null][] = [
    ["みみこ毛繕い", body],
    ["プロテイン飲む", body],
    ["キッチン掃除", clean],
    ["その他の掃除", clean],
    ["みみこ関係掃除", clean],
    ["自部屋掃除", clean],
  ];
  for (const [title, cat] of habits) addHabit(title, cat);

  // Someday のタスク（今日には入れず、管理タブに置いておく）
  const someday: [string, string | null][] = [
    ["郵便局のお金を引き出して新生にうつす？", null],
    ["換気扇フィルターかえる", clean],
    ["服処分", null],
    ["タグ注文", sew],
    ["デザインするアプリ使う", null],
  ];
  for (const [title, cat] of someday) addTask(title, cat);

  // ストック：買い物
  const shopping = [
    "冷蔵庫 H127×W49×D54cm（153L:冷蔵106L…）",
    "ひきわり納豆、豆腐、豆苗、豚バラ、鶏も…",
    "さむらいむすりっぱー",
    "耐熱ガラスマグカップ",
    "ニトリ風呂掃除ブラシ",
  ];
  for (const t of shopping) addStock("shopping", t);

  // ストック：視聴
  addStock("watch", "無職転生");
}
