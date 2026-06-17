// Supabase との読み書きをまとめた場所。
// TS の型（camelCase）と DB の列（snake_case）の変換もここで吸収する。
// 失敗してもアプリが止まらないよう、書き込みエラーはコンソールに出すだけにする。

import { supabase } from "./supabase";
import {
  emptyDB,
  type DB,
  type Item,
  type Step,
  type DoneLog,
  type DayNote,
} from "./types";

// --- 行（DB）→ 型（アプリ）の変換 ---

type ItemRow = {
  id: string;
  title: string;
  tag: string | null;
  recurring: boolean;
  scheduled_date: string | null;
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
type LogRow = {
  id: string;
  date: string;
  ref_type: "item" | "step";
  ref_id: string;
  title: string;
  tag: string | null;
  done_at: string;
};
type DayNoteRow = { id: string; date: string; note: string };

const toItem = (r: ItemRow): Item => ({
  id: r.id,
  title: r.title,
  tag: r.tag ?? null,
  recurring: r.recurring,
  scheduledDate: r.scheduled_date ?? null,
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
const toLog = (r: LogRow): DoneLog => ({
  id: r.id,
  date: r.date,
  refType: r.ref_type,
  refId: r.ref_id,
  title: r.title,
  tag: r.tag ?? null,
  doneAt: r.done_at,
});
const toDayNote = (r: DayNoteRow): DayNote => ({ id: r.id, date: r.date, note: r.note });

// --- 型（アプリ）→ 行（DB）。user_id は DB 側の既定値 auth.uid() に任せる ---

const itemRow = (i: Item) => ({
  id: i.id,
  title: i.title,
  tag: i.tag ?? null,
  recurring: i.recurring,
  scheduled_date: i.scheduledDate ?? null,
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
const logRow = (l: DoneLog) => ({
  id: l.id,
  date: l.date,
  ref_type: l.refType,
  ref_id: l.refId,
  title: l.title,
  tag: l.tag ?? null,
  done_at: l.doneAt,
});
const dayNoteRow = (n: DayNote) => ({ id: n.id, date: n.date, note: n.note });

function warn(where: string, error: unknown) {
  if (error) console.error(`Supabase 書き込み失敗 (${where})`, error);
}

// --- 読み込み（自分の全データ） ---

export async function fetchAll(): Promise<DB> {
  const db: DB = structuredClone(emptyDB);
  const [items, steps, logs, notes] = await Promise.all([
    supabase.from("items").select("*"),
    supabase.from("steps").select("*"),
    supabase.from("done_logs").select("*"),
    supabase.from("day_notes").select("*"),
  ]);
  if (items.error) warn("fetch items", items.error);
  if (steps.error) warn("fetch steps", steps.error);
  if (logs.error) warn("fetch logs", logs.error);
  if (notes.error) warn("fetch day_notes", notes.error);
  db.items = (items.data ?? []).map((r) => toItem(r as ItemRow));
  db.steps = (steps.data ?? []).map((r) => toStep(r as StepRow));
  db.doneLogs = (logs.data ?? []).map((r) => toLog(r as LogRow));
  db.dayNotes = (notes.data ?? []).map((r) => toDayNote(r as DayNoteRow));
  return db;
}

/** 初回ログイン時、初期データを丸ごとアップロードする */
export async function bulkInsert(db: DB) {
  if (db.items.length) {
    warn("seed items", (await supabase.from("items").insert(db.items.map(itemRow))).error);
  }
  if (db.steps.length) {
    warn("seed steps", (await supabase.from("steps").insert(db.steps.map(stepRow))).error);
  }
  if (db.doneLogs.length) {
    warn("seed logs", (await supabase.from("done_logs").insert(db.doneLogs.map(logRow))).error);
  }
  if (db.dayNotes.length) {
    warn("seed day_notes", (await supabase.from("day_notes").insert(db.dayNotes.map(dayNoteRow))).error);
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
export async function insertDayNote(n: DayNote) {
  warn("insertDayNote", (await supabase.from("day_notes").insert(dayNoteRow(n))).error);
}
export async function updateDayNote(n: DayNote) {
  warn("updateDayNote", (await supabase.from("day_notes").update({ note: n.note }).eq("id", n.id)).error);
}
export async function deleteDayNote(id: string) {
  warn("deleteDayNote", (await supabase.from("day_notes").delete().eq("id", id)).error);
}
