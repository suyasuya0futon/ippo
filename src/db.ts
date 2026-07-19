// Supabase との読み書きをまとめた場所。
// TS の型（camelCase）と DB の列（snake_case）の変換もここで吸収する。
// 失敗してもアプリが止まらないよう、書き込みエラーはトーストで知らせるだけにする。

import { supabase } from "./supabase";
import { showToast } from "./toast";
import {
  emptyDB,
  type DB,
  type Item,
  type Bucket,
  type Step,
  type DoneLog,
  type IppoConversationMessage,
} from "./types";
import { ALL_REPEAT_DAYS } from "./recurrence";

// --- 行（DB）→ 型（アプリ）の変換 ---

type ItemRow = {
  id: string;
  title: string;
  tag: string | null;
  recurring: boolean;
  repeat_days?: number | null;
  bucket: Bucket;
  sort_order: number;
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
type IppoConversationMessageRow = {
  id: string;
  item_id: string;
  role: "user" | "assistant";
  text: string;
  created_at: string;
};

const toItem = (r: ItemRow): Item => ({
  id: r.id,
  title: r.title,
  tag: r.tag ?? null,
  recurring: r.recurring,
  repeatDays: r.repeat_days ?? ALL_REPEAT_DAYS,
  bucket: r.bucket ?? "someday",
  sortOrder: r.sort_order ?? 0,
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
const toIppoConversationMessage = (r: IppoConversationMessageRow): IppoConversationMessage => ({
  id: r.id,
  itemId: r.item_id,
  role: r.role,
  text: r.text,
  createdAt: r.created_at,
});

// --- 型（アプリ）→ 行（DB）。user_id は DB 側の既定値 auth.uid() に任せる ---

const itemRow = (i: Item) => ({
  id: i.id,
  title: i.title,
  tag: i.tag ?? null,
  recurring: i.recurring,
  repeat_days: i.repeatDays,
  bucket: i.bucket,
  sort_order: i.sortOrder,
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
const ippoConversationMessageRow = (message: IppoConversationMessage) => ({
  id: message.id,
  item_id: message.itemId,
  role: message.role,
  text: message.text,
  created_at: message.createdAt,
});

// 書き込み失敗：コンソールに出し、画面にもトーストで知らせる。
function warn(where: string, error: unknown) {
  if (!error) return;
  console.error(`Supabase 書き込み失敗 (${where})`, error);
  showToast("保存に失敗しました。通信を確認して、もう一度お試しください");
}

// 読み込み失敗：コンソールのみ（読み込みは次回の再取得で回復しうるため）
function logError(where: string, error: unknown) {
  if (error) console.error(`Supabase 読み込み失敗 (${where})`, error);
}

// --- 読み込み（自分の全データ） ---

export async function fetchAll(): Promise<DB> {
  const db: DB = structuredClone(emptyDB);
  const [items, steps, logs] = await Promise.all([
    supabase.from("items").select("*"),
    supabase.from("steps").select("*"),
    supabase.from("done_logs").select("*"),
  ]);
  if (items.error) logError("fetch items", items.error);
  if (steps.error) logError("fetch steps", steps.error);
  if (logs.error) logError("fetch logs", logs.error);
  db.items = (items.data ?? []).map((r) => toItem(r as ItemRow));
  db.steps = (steps.data ?? []).map((r) => toStep(r as StepRow));
  db.doneLogs = (logs.data ?? []).map((r) => toLog(r as LogRow));
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
}

// --- 書き込み（個別操作）。呼び出し側は待たなくてよい（楽観更新済み） ---

export async function insertItem(i: Item) {
  warn("insertItem", (await supabase.from("items").insert(itemRow(i))).error);
}
export async function updateItem(i: Item): Promise<boolean> {
  const { error } = await supabase.from("items").update(itemRow(i)).eq("id", i.id);
  warn("updateItem", error);
  return !error;
}
export async function deleteItemRow(id: string) {
  // steps は外部キーの cascade で一緒に消える。
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

// --- AI会話ログ ---

export async function fetchIppoConversationMessages(itemId: string): Promise<IppoConversationMessage[]> {
  const { data, error } = await supabase
    .from("ai_conversation_messages")
    .select("*")
    .eq("item_id", itemId)
    .order("created_at", { ascending: true });
  if (error) {
    logError("fetch AI conversation", error);
    return [];
  }
  return (data ?? []).map((row) => toIppoConversationMessage(row as IppoConversationMessageRow));
}

export async function insertIppoConversationMessage(message: IppoConversationMessage): Promise<boolean> {
  const { error } = await supabase.from("ai_conversation_messages").insert(ippoConversationMessageRow(message));
  warn("insert AI conversation", error);
  return !error;
}

export async function deleteIppoConversationMessages(itemId: string): Promise<boolean> {
  const { error } = await supabase.from("ai_conversation_messages").delete().eq("item_id", itemId);
  warn("delete AI conversation", error);
  return !error;
}

// --- ユーザー設定（フラグ自動繰り上げの判定用） ---

export async function getLastPromoteDate(): Promise<string | null> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("last_promote_date")
    .maybeSingle();
  if (error) {
    logError("fetch user_settings", error);
    return null;
  }
  return ((data?.last_promote_date as string | null) ?? null) || null;
}

export async function setLastPromoteDate(date: string) {
  warn(
    "setLastPromoteDate",
    (await supabase.from("user_settings").upsert({ last_promote_date: date }, { onConflict: "user_id" }))
      .error
  );
}
