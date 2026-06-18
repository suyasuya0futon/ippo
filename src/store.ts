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
  type Bucket,
  type Step,
  type DoneLog,
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

/** その日の週初め（月曜）の "YYYY-MM-DD" */
function mondayOf(dateStr: string): string {
  const [y, m, dd] = dateStr.split("-").map(Number);
  const d = new Date(y, m - 1, dd);
  const dow = d.getDay(); // 0=日..6=土
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return todayStr(d);
}

/** last から today までに「週（月曜）」をまたいだか */
function crossedWeek(last: string, today: string): boolean {
  return mondayOf(today) > mondayOf(last);
}

/**
 * 入力文字列から #タグ を取り出し、タイトルとタグ（1個）に分ける。
 * タグは「# または ＃ のあと、次の空白までの文字」。日本語でも安全。
 * 複数書かれていても最初の1個だけを採用する。
 * 例: "GUコート袖縫う #裁縫" → { title: "GUコート袖縫う", tag: "裁縫" }
 */
export function parseTag(input: string): { title: string; tag: string | null } {
  // # のあと、空白までをタグとして扱う（\s は全角スペース U+3000 も拾う）
  const re = /[#＃]([^\s#＃]+)/g;
  let tag: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    if (tag === null && m[1]) tag = m[1]; // 最初の1個を採用
  }
  const title = input
    .replace(re, "")
    .replace(/\s+/g, " ")
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
  opts: { bucket?: Bucket } = {}
): string | null {
  const { title, tag } = parseTag(input);
  if (!title) return null;
  const item: Item = {
    id: uid(),
    title,
    tag,
    recurring,
    bucket: opts.bucket ?? "someday",
    sortOrder: -Date.now(), // 新しいものほど上（昇順で先頭）
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

// --- いつやるか（フラグ bucket） ---

/** フラグ(bucket)を変更し、移動先の先頭に出す。毎日タスクは対象外。 */
export function setBucket(itemId: string, bucket: Bucket) {
  optimistic((d) => {
    const it = d.items.find((x) => x.id === itemId);
    if (!it || it.recurring) return;
    it.bucket = bucket;
    it.sortOrder = -Date.now(); // 移動先の先頭へ
  });
  const updated = db.items.find((x) => x.id === itemId);
  if (updated) void remote.updateItem(updated);
}

/**
 * 起動時の自動繰り上げ。前回繰り上げ日(last_promote_date)と比較して:
 * - 日が変わった → bucket "tomorrow" → "today"
 * - 週(月曜)をまたいだ → bucket "soon" → "tomorrow"
 * 繰り上げたものは移動先の末尾へ。予定日つき・毎日タスクは対象外。
 * 初回(last=null)は基準日を入れるだけで繰り上げない。
 */
export async function promote() {
  const today = todayStr();
  const last = await remote.getLastPromoteDate();
  if (last === today) return; // 今日はもう繰り上げ済み（端末間の二重も防ぐ）
  if (last == null) {
    await remote.setLastPromoteDate(today); // 初回は基準を作るだけ
    return;
  }

  const weekChanged = crossedWeek(last, today);
  const isFlag = (i: Item) => !i.recurring;
  const tomorrowItems = db.items.filter((i) => isFlag(i) && i.bucket === "tomorrow");
  const soonItems = weekChanged ? db.items.filter((i) => isFlag(i) && i.bucket === "soon") : [];
  const changedIds = new Set([...tomorrowItems, ...soonItems].map((i) => i.id));

  let allOk = true;
  if (changedIds.size > 0) {
    const base = Date.now();
    optimistic((d) => {
      // tomorrow → today（末尾。元の並びは保つ）
      d.items
        .filter((i) => tomorrowItems.some((x) => x.id === i.id))
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .forEach((it, i) => {
          it.bucket = "today";
          it.sortOrder = base + i;
        });
      // soon → tomorrow（末尾）
      d.items
        .filter((i) => soonItems.some((x) => x.id === i.id))
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .forEach((it, i) => {
          it.bucket = "tomorrow";
          it.sortOrder = base + 1_000_000 + i;
        });
    });
    // item 更新が全部成功してから last_promote_date を進める（部分失敗で“繰り上げ済み”にしない）
    const results = await Promise.all(
      [...changedIds].map((id) => {
        const it = db.items.find((x) => x.id === id);
        return it ? remote.updateItem(it) : Promise.resolve(true);
      })
    );
    allOk = results.every(Boolean);
  }

  // 全部成功（または繰り上げ対象なし）のときだけ基準日を進める。失敗したら次回再試行。
  if (allOk) await remote.setLastPromoteDate(today);
}

/** 🌱 今日やるにする */
export function addToToday(itemId: string) {
  setBucket(itemId, "today");
}

/** ⏳ 今後やるに移動（近日中へ。いつか送りで埋もれさせない） */
export function moveToFuture(itemId: string) {
  setBucket(itemId, "soon");
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

// --- できたことログ ---

/** その日にできたことを取り出す（新しい順） */
export function logsForDate(d: DB, date: string): DoneLog[] {
  return d.doneLogs
    .filter((l) => l.date === date)
    .sort((a, b) => b.doneAt.localeCompare(a.doneAt));
}

/** 日付ごとの「できた数」を {date: 件数} の形で返す */
export function doneCountByDate(d: DB): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const l of d.doneLogs) counts[l.date] = (counts[l.date] ?? 0) + 1;
  return counts;
}
