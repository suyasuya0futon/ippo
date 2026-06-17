// 新規インストール時の初期データ（seedDB）と、
// 旧バージョン(v1)で保存済みのデータを新モデルへ移し替える処理(migrateV1)。
// どちらも「DB オブジェクトを作って返すだけ」の素直な関数。

import { emptyDB, type DB, type Item, type DoneLog, type Step } from "./types";

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Any.do から移ってきた初期データ（新規インストール用） */
export function seedDB(): DB {
  const db: DB = structuredClone(emptyDB);
  const date = todayStr();

  // [タイトル, タグ配列, 毎日か, 今日に出すか]
  const rows: [string, string[], boolean, boolean][] = [
    // 今日の縫い物
    ["ズボン縫う", ["裁縫"], false, true],
    ["サンプル服の下縫う", ["裁縫"], false, true],
    ["PC入れ袋縫う", ["裁縫"], false, true],
    ["GUコート袖縫う", ["裁縫"], false, true],
    ["NIKEバッグの紐短く縫う", ["裁縫"], false, true],
    ["川口プラネタリウム", ["行きたい場所"], false, true],
    ["品川スキン、西新宿皮膚科？", ["からだ"], false, true],
    // 毎日の習慣
    ["みみこ毛繕い", ["からだ"], true, false],
    ["プロテイン飲む", ["からだ"], true, false],
    ["キッチン掃除", ["掃除"], true, false],
    ["その他の掃除", ["掃除"], true, false],
    ["みみこ関係掃除", ["掃除"], true, false],
    ["自部屋掃除", ["掃除"], true, false],
    // いつかやる
    ["郵便局のお金を引き出して新生にうつす？", [], false, false],
    ["換気扇フィルターかえる", ["掃除"], false, false],
    ["服処分", [], false, false],
    ["タグ注文", ["裁縫"], false, false],
    ["デザインするアプリ使う", [], false, false],
    // 買い物
    ["冷蔵庫 H127×W49×D54cm（153L:冷蔵106L…）", ["買い物"], false, false],
    ["ひきわり納豆、豆腐、豆苗、豚バラ、鶏も…", ["買い物"], false, false],
    ["耐熱ガラスマグカップ", ["買い物"], false, false],
    ["ニトリ風呂掃除ブラシ", ["買い物"], false, false],
    // 見る・読む
    ["無職転生", ["見る・読む"], false, false],
    ["さむらいむすりっぱー", ["見る・読む"], false, false],
  ];

  let order = 0;
  for (const [title, tags, recurring, inToday] of rows) {
    const item: Item = {
      id: id(),
      title,
      tags,
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

// --- 旧データ(v1)の移し替え ---

type V1Category = { id: string; name: string };
type V1Task = { id: string; title: string; categoryId: string | null; status: "open" | "done"; createdAt: string; doneAt?: string };
type V1Habit = { id: string; title: string; categoryId: string | null; createdAt: string };
type V1Step = { id: string; parentId: string; title: string; order: number; done: boolean; doneAt?: string };
type V1Today = { id: string; date: string; refId: string; order: number };
type V1Log = { id: string; date: string; refType: string; refId: string; title: string; doneAt: string; memo?: string };
type V1Stock = { id: string; list: string; title: string; done: boolean; createdAt: string };
type V1DB = {
  categories?: V1Category[];
  tasks?: V1Task[];
  habits?: V1Habit[];
  steps?: V1Step[];
  today?: V1Today[];
  doneLogs?: V1Log[];
  stock?: V1Stock[];
};

const STOCK_LABEL: Record<string, string> = {
  shopping: "買い物",
  watch: "見る・読む",
  places: "行きたい場所",
  memo: "メモ",
};

/** 旧モデルの categoryId をタグ名に変換するための辞書を作る */
function catTag(categories: V1Category[], id: string | null): string[] {
  if (!id) return [];
  const c = categories.find((x) => x.id === id);
  return c ? [c.name] : [];
}

/** ユーザーが直接指定した修正（タイトル一致で一度だけ当てる） */
function applyCorrections(item: Item): Item {
  if (item.title === "川口プラネタリウム") item.tags = ["行きたい場所"];
  if (item.title.includes("すりっぱー")) item.tags = ["見る・読む"];
  return item;
}

export function migrateV1(old: V1DB): DB {
  const db: DB = structuredClone(emptyDB);
  const categories = old.categories ?? [];

  for (const t of old.tasks ?? []) {
    db.items.push(
      applyCorrections({
        id: t.id,
        title: t.title,
        tags: catTag(categories, t.categoryId),
        recurring: false,
        status: t.status,
        createdAt: t.createdAt,
        doneAt: t.doneAt,
      })
    );
  }

  for (const h of old.habits ?? []) {
    db.items.push({
      id: h.id,
      title: h.title,
      tags: catTag(categories, h.categoryId),
      recurring: true,
      status: "open",
      createdAt: h.createdAt,
    });
  }

  for (const s of old.stock ?? []) {
    db.items.push(
      applyCorrections({
        id: s.id,
        title: s.title,
        tags: STOCK_LABEL[s.list] ? [STOCK_LABEL[s.list]] : [],
        recurring: false,
        status: s.done ? "done" : "open",
        createdAt: s.createdAt,
      })
    );
  }

  for (const s of old.steps ?? []) {
    const step: Step = {
      id: s.id,
      itemId: s.parentId,
      title: s.title,
      order: s.order,
      done: s.done,
      doneAt: s.doneAt,
    };
    db.steps.push(step);
  }

  for (const ti of old.today ?? []) {
    db.today.push({ id: ti.id, date: ti.date, itemId: ti.refId, order: ti.order });
  }

  for (const l of old.doneLogs ?? []) {
    const log: DoneLog = {
      id: l.id,
      date: l.date,
      refType: l.refType === "step" ? "step" : "item",
      refId: l.refId,
      title: l.title,
      doneAt: l.doneAt,
      memo: l.memo,
    };
    db.doneLogs.push(log);
  }

  return db;
}
