// アプリ内のデータの持ち方と操作をまとめた場所。
//
// 仕組み：メモリ上に最新データ(db)を持ち、画面は useStore() でそれを読む。
// 変更があったら、まずメモリを即書き換えて画面を反応させ(楽観更新)、
// 裏で Supabase にも書き込む。読み込みは hydrate() でまとめて取得する。

import { useSyncExternalStore } from "react";
import {
  emptyDB,
  type DB,
  type Item,
  type Step,
  type DoneLog,
  type DayNote,
} from "./types";
import { seedDB } from "./seed";
import * as remote from "./db";

let db: DB = structuredClone(emptyDB);
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** メモリを書き換えて画面に知らせる（保存は各操作が Supabase に対して行う） */
function optimistic(mutate: (draft: DB) => void) {
  const next = structuredClone(db);
  mutate(next);
  db = next;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return db;
}

/** 画面でデータを読むためのフック */
export function useStore(): DB {
  return useSyncExternalStore(subscribe, getSnapshot);
}

// --- 起動・ログイン/ログアウト時 ---

/** Supabase から自分の全データを読み込んでメモリに載せる */
export async function hydrate() {
  db = await remote.fetchAll();
  emit();
}

/** まだ何も無ければ、初期データをアップロードする */
export async function seedIfEmpty() {
  if (db.items.length > 0) return;
  const initial = seedDB();
  await remote.bulkInsert(initial);
  db = initial;
  emit();
}

/** ログアウト時にメモリを空にする */
export function clearStore() {
  db = structuredClone(emptyDB);
  emit();
}

// --- 道具 ---

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

/** "YYYY-MM-DD"（端末のローカル日付） */
export function todayStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 入力文字列から #タグ を取り出し、タイトルとタグ（1個）に分ける。
 * タグは「# または ＃ のあと、次の空白までの文字」。日本語でも安全。
 * 複数書かれていても最初の1個だけを採用する。
 * 例: "GUコート袖縫う #裁縫" → { title: "GUコート袖縫う", tag: "裁縫" }
 */
export function parseTag(input: string): { title: string; tag: string | null } {
  const re = /[#＃]([^\s#＃　]+)/g;
  let tag: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    if (tag === null && m[1]) tag = m[1]; // 最初の1個を採用
  }
  const title = input
    .replace(re, "")
    .replace(/[\s　]+/g, " ")
    .trim();
  return { title, tag };
}

/** アイテムを編集用の入力文字列（タイトル #タグ）に戻す */
export function itemToInput(item: Item): string {
  return item.tag ? `${item.title} #${item.tag}` : item.title;
}

/** 今あるタグの一覧（重複なし）。絞り込みや候補に使う。 */
export function allTags(d: DB): string[] {
  const set = new Set<string>();
  for (const it of d.items) if (it.tag) set.add(it.tag);
  return [...set].sort((a, b) => a.localeCompare(b, "ja"));
}

// --- アイテム ---

export function addItem(
  input: string,
  recurring: boolean,
  scheduledDate: string | null = null
): string | null {
  const { title, tag } = parseTag(input);
  if (!title) return null;
  const item: Item = {
    id: uid(),
    title,
    tag,
    recurring,
    // 毎日タスクは予定日を持たない。それ以外は渡された予定日（今日やる追加なら今日）。
    scheduledDate: recurring ? null : scheduledDate,
    status: "open",
    createdAt: now(),
  };
  optimistic((d) => d.items.push(item));
  void remote.insertItem(item);
  return item.id;
}

export function editItem(itemId: string, input: string, recurring: boolean) {
  const { title, tag } = parseTag(input);
  if (!title) return;
  optimistic((d) => {
    const it = d.items.find((x) => x.id === itemId);
    if (!it) return;
    it.title = title;
    it.tag = tag;
    it.recurring = recurring;
    // 毎日タスクは予定日を持たない（不変条件）
    if (recurring) it.scheduledDate = null;
  });
  const updated = db.items.find((x) => x.id === itemId);
  if (updated) void remote.updateItem(updated);
}

export function deleteItem(itemId: string) {
  optimistic((d) => {
    d.items = d.items.filter((i) => i.id !== itemId);
    d.steps = d.steps.filter((s) => s.itemId !== itemId);
    // できたことログ（DoneLog）はあえて残す。見返す記録として残す。
  });
  void remote.deleteItemRow(itemId);
}

/** 一度きりのアイテムを「できた」にする */
export function completeItem(itemId: string) {
  const current = db.items.find((x) => x.id === itemId);
  if (!current || current.recurring || current.status === "done") return;
  const doneAt = now();
  const log: DoneLog = {
    id: uid(),
    date: todayStr(),
    refType: "item",
    refId: itemId,
    title: current.title,
    tag: current.tag,
    doneAt,
  };
  optimistic((d) => {
    const it = d.items.find((x) => x.id === itemId);
    if (!it) return;
    it.status = "done";
    it.doneAt = doneAt;
    d.doneLogs.push(log);
  });
  const updated = db.items.find((x) => x.id === itemId);
  if (updated) void remote.updateItem(updated);
  void remote.insertLog(log);
}

export function reopenItem(itemId: string) {
  optimistic((d) => {
    const it = d.items.find((x) => x.id === itemId);
    if (!it) return;
    it.status = "open";
    delete it.doneAt;
    d.doneLogs = d.doneLogs.filter((l) => !(l.refType === "item" && l.refId === itemId));
  });
  const updated = db.items.find((x) => x.id === itemId);
  if (updated) void remote.updateItem(updated);
  void remote.deleteLogsByRef("item", itemId);
}

// --- 毎日の習慣（recurring なアイテム） ---

/** そのアイテム（毎日タスク・一度きり問わず）が指定日に完了済みか。完了は doneLog で判定する。 */
export function isDoneToday(d: DB, itemId: string, date: string = todayStr()): boolean {
  return d.doneLogs.some((l) => l.refType === "item" && l.refId === itemId && l.date === date);
}

export function toggleRecurringToday(itemId: string) {
  const date = todayStr();
  const already = db.doneLogs.some(
    (l) => l.refType === "item" && l.refId === itemId && l.date === date
  );
  if (already) {
    optimistic((d) => {
      d.doneLogs = d.doneLogs.filter(
        (l) => !(l.refType === "item" && l.refId === itemId && l.date === date)
      );
    });
    void remote.deleteLogsByRef("item", itemId, date);
  } else {
    const it = db.items.find((x) => x.id === itemId);
    if (!it) return;
    const log: DoneLog = {
      id: uid(),
      date,
      refType: "item",
      refId: itemId,
      title: it.title,
      tag: it.tag,
      doneAt: now(),
    };
    optimistic((d) => d.doneLogs.push(log));
    void remote.insertLog(log);
  }
}

// --- 今日やること（予定日 scheduledDate で管理） ---

/**
 * その一度きりタスクが「今日やる」に出るか。
 * 予定日が今日以前なら出す（過去日の繰り越しも含む）。毎日タスクは対象外。
 */
export function isInToday(item: Item, date: string = todayStr()): boolean {
  return !item.recurring && item.scheduledDate != null && item.scheduledDate <= date;
}

/** 今日やるにする：予定日を今日にする（毎日タスクは予定日を持たない） */
export function addToToday(itemId: string) {
  const date = todayStr();
  optimistic((d) => {
    const it = d.items.find((x) => x.id === itemId);
    if (!it || it.recurring) return;
    it.scheduledDate = date;
  });
  const updated = db.items.find((x) => x.id === itemId);
  if (updated) void remote.updateItem(updated);
}

/** 今日やるから外す：予定日を未定（null）に戻す */
export function removeFromToday(itemId: string) {
  setScheduledDate(itemId, null);
}

/** 予定日を任意の日付に設定（null で未定）。毎日タスクは対象外。 */
export function setScheduledDate(itemId: string, date: string | null) {
  optimistic((d) => {
    const it = d.items.find((x) => x.id === itemId);
    if (!it || it.recurring) return;
    it.scheduledDate = date;
  });
  const updated = db.items.find((x) => x.id === itemId);
  if (updated) void remote.updateItem(updated);
}

// --- 手順（ステップ） ---

export function addStep(itemId: string, title: string) {
  const trimmed = title.trim();
  if (!trimmed) return;
  const order = db.steps.filter((s) => s.itemId === itemId).length;
  const step: Step = { id: uid(), itemId, title: trimmed, order, done: false };
  optimistic((d) => d.steps.push(step));
  void remote.insertStep(step);
}

export function deleteStep(stepId: string) {
  optimistic((d) => {
    d.steps = d.steps.filter((s) => s.id !== stepId);
    d.doneLogs = d.doneLogs.filter((l) => !(l.refType === "step" && l.refId === stepId));
  });
  void remote.deleteStepRow(stepId);
}

export function toggleStep(stepId: string) {
  const s = db.steps.find((x) => x.id === stepId);
  if (!s) return;
  if (s.done) {
    optimistic((d) => {
      const st = d.steps.find((x) => x.id === stepId);
      if (st) {
        st.done = false;
        delete st.doneAt;
      }
      d.doneLogs = d.doneLogs.filter((l) => !(l.refType === "step" && l.refId === stepId));
    });
    const updated = db.steps.find((x) => x.id === stepId);
    if (updated) void remote.updateStep(updated);
    void remote.deleteLogsByRef("step", stepId);
  } else {
    const doneAt = now();
    const parentTag = db.items.find((i) => i.id === s.itemId)?.tag ?? null;
    const log: DoneLog = {
      id: uid(),
      date: todayStr(),
      refType: "step",
      refId: stepId,
      title: s.title,
      tag: parentTag,
      doneAt,
    };
    optimistic((d) => {
      const st = d.steps.find((x) => x.id === stepId);
      if (st) {
        st.done = true;
        st.doneAt = doneAt;
      }
      d.doneLogs.push(log);
    });
    const updated = db.steps.find((x) => x.id === stepId);
    if (updated) void remote.updateStep(updated);
    void remote.insertLog(log);
  }
}

// --- 1日のメモ（日付ごとに1つ） ---

export function getDayNote(d: DB, date: string): string {
  return d.dayNotes.find((n) => n.date === date)?.note ?? "";
}

export function setDayNote(date: string, note: string) {
  const trimmed = note.trim();
  const existing = db.dayNotes.find((n) => n.date === date);
  if (existing) {
    if (trimmed) {
      optimistic((d) => {
        const n = d.dayNotes.find((x) => x.id === existing.id);
        if (n) n.note = trimmed;
      });
      void remote.updateDayNote({ ...existing, note: trimmed });
    } else {
      optimistic((d) => {
        d.dayNotes = d.dayNotes.filter((x) => x.id !== existing.id);
      });
      void remote.deleteDayNote(existing.id);
    }
  } else if (trimmed) {
    const entry: DayNote = { id: uid(), date, note: trimmed };
    optimistic((d) => d.dayNotes.push(entry));
    void remote.insertDayNote(entry);
  }
}

// --- できたことログ ---

/** その日にできたことを取り出す（新しい順） */
export function logsForDate(d: DB, date: string): DoneLog[] {
  return d.doneLogs
    .filter((l) => l.date === date)
    .sort((a, b) => b.doneAt.localeCompare(a.doneAt));
}

/** 日付ごとの「できた数」を {date: 件数} の形で返す（カレンダーの印に使う） */
export function doneCountByDate(d: DB): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const l of d.doneLogs) counts[l.date] = (counts[l.date] ?? 0) + 1;
  return counts;
}
