// Supabase との読み書きをまとめた場所。
// TS の型（camelCase）と DB の列（snake_case）の変換もここで吸収する。
// 失敗してもアプリが止まらないよう、書き込みエラーはコンソールに出すだけにする。

import { supabase } from "./supabase";
import { emptyDB, type DB, type Item, type Step, type TodayItem, type DoneLog } from "./types";

// --- 行（DB）→ 型（アプリ）の変換 ---

type ItemRow = {
  id: string;
  title: string;
  tags: string[];
  recurring: boolean;
  status: "open" | "done";
  created_at: string;
  done_at: string | null;
};
type StepRow = {
  id: string;
  item_id: string;
  title: string;
  sort_order: number;
  done: boolean;
  done_at: string | null;
};
type TodayRow = { id: string; item_id: string; date: string; sort_order: number };
type LogRow = {
  id: string;
  date: string;
  ref_type: "item" | "step";
  ref_id: string;
  title: string;
  done_at: string;
  memo: string | null;
};

const toItem = (r: ItemRow): Item => ({
  id: r.id,
  title: r.title,
  tags: r.tags ?? [],
  recurring: r.recurring,
  status: r.status,
  createdAt: r.created_at,
  doneAt: r.done_at ?? undefined,
});
const toStep = (r: StepRow): Step => ({
  id: r.id,
  itemId: r.item_id,
  title: r.title,
  order: r.sort_order,
  done: r.done,
  doneAt: r.done_at ?? undefined,
});
const toToday = (r: TodayRow): TodayItem => ({
  id: r.id,
  itemId: r.item_id,
  date: r.date,
  order: r.sort_order,
});
const toLog = (r: LogRow): DoneLog => ({
  id: r.id,
  date: r.date,
  refType: r.ref_type,
  refId: r.ref_id,
  title: r.title,
  doneAt: r.done_at,
  memo: r.memo ?? undefined,
});

// --- 型（アプリ）→ 行（DB）。user_id は DB 側の既定値 auth.uid() に任せる ---

const itemRow = (i: Item) => ({
  id: i.id,
  title: i.title,
  tags: i.tags,
  recurring: i.recurring,
  status: i.status,
  created_at: i.createdAt,
  done_at: i.doneAt ?? null,
});
const stepRow = (s: Step) => ({
  id: s.id,
  item_id: s.itemId,
  title: s.title,
  sort_order: s.order,
  done: s.done,
  done_at: s.doneAt ?? null,
});
const todayRow = (t: TodayItem) => ({
  id: t.id,
  item_id: t.itemId,
  date: t.date,
  sort_order: t.order,
});
const logRow = (l: DoneLog) => ({
  id: l.id,
  date: l.date,
  ref_type: l.refType,
  ref_id: l.refId,
  title: l.title,
  done_at: l.doneAt,
  memo: l.memo ?? null,
});

function warn(where: string, error: unknown) {
  if (error) console.error(`Supabase 書き込み失敗 (${where})`, error);
}

// --- 読み込み（自分の全データ） ---

export async function fetchAll(): Promise<DB> {
  const db: DB = structuredClone(emptyDB);
  const [items, steps, today, logs] = await Promise.all([
    supabase.from("items").select("*"),
    supabase.from("steps").select("*"),
    supabase.from("today_items").select("*"),
    supabase.from("done_logs").select("*"),
  ]);
  if (items.error) warn("fetch items", items.error);
  if (steps.error) warn("fetch steps", steps.error);
  if (today.error) warn("fetch today", today.error);
  if (logs.error) warn("fetch logs", logs.error);
  db.items = (items.data ?? []).map((r) => toItem(r as ItemRow));
  db.steps = (steps.data ?? []).map((r) => toStep(r as StepRow));
  db.today = (today.data ?? []).map((r) => toToday(r as TodayRow));
  db.doneLogs = (logs.data ?? []).map((r) => toLog(r as LogRow));
  return db;
}

/** 初回ログイン時、ローカルにあった or 初期データを丸ごとアップロードする */
export async function bulkInsert(db: DB) {
  if (db.items.length) {
    warn("seed items", (await supabase.from("items").insert(db.items.map(itemRow))).error);
  }
  if (db.steps.length) {
    warn("seed steps", (await supabase.from("steps").insert(db.steps.map(stepRow))).error);
  }
  if (db.today.length) {
    warn("seed today", (await supabase.from("today_items").insert(db.today.map(todayRow))).error);
  }
  if (db.doneLogs.length) {
    warn("seed logs", (await supabase.from("done_logs").insert(db.doneLogs.map(logRow))).error);
  }
}

// --- 書き込み（個別操作）。呼び出し側は待たなくてよい（楽観更新済み） ---

export async function insertItem(i: Item) {
  warn("insertItem", (await supabase.from("items").insert(itemRow(i))).error);
}
export async function updateItem(i: Item) {
  warn(
    "updateItem",
    (await supabase.from("items").update(itemRow(i)).eq("id", i.id)).error
  );
}
export async function deleteItemRow(id: string) {
  // steps / today_items は外部キーの cascade で一緒に消える。
  // できたことログ（done_logs）は履歴として残すので消さない。
  warn("deleteItem", (await supabase.from("items").delete().eq("id", id)).error);
}

export async function insertStep(s: Step) {
  warn("insertStep", (await supabase.from("steps").insert(stepRow(s))).error);
}
export async function updateStep(s: Step) {
  warn("updateStep", (await supabase.from("steps").update(stepRow(s)).eq("id", s.id)).error);
}
export async function deleteStepRow(id: string) {
  warn("deleteStep", (await supabase.from("steps").delete().eq("id", id)).error);
  warn(
    "deleteStep logs",
    (await supabase.from("done_logs").delete().eq("ref_id", id).eq("ref_type", "step")).error
  );
}

export async function insertToday(t: TodayItem) {
  warn("insertToday", (await supabase.from("today_items").insert(todayRow(t))).error);
}
export async function deleteTodayByItem(itemId: string, date: string) {
  warn(
    "deleteToday",
    (await supabase.from("today_items").delete().eq("item_id", itemId).eq("date", date)).error
  );
}

export async function insertLog(l: DoneLog) {
  warn("insertLog", (await supabase.from("done_logs").insert(logRow(l))).error);
}
export async function deleteLog(id: string) {
  warn("deleteLog", (await supabase.from("done_logs").delete().eq("id", id)).error);
}
export async function deleteLogsByRef(refType: "item" | "step", refId: string, date?: string) {
  let q = supabase.from("done_logs").delete().eq("ref_type", refType).eq("ref_id", refId);
  if (date) q = q.eq("date", date);
  warn("deleteLogsByRef", (await q).error);
}
export async function updateLogMemo(id: string, memo: string | null) {
  warn("updateLogMemo", (await supabase.from("done_logs").update({ memo }).eq("id", id)).error);
}
