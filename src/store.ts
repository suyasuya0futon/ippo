// データの保存と読み書きをまとめた場所です。
// ブラウザの localStorage に丸ごと保存するので、サーバーは要りません。
// 画面側は useStore() を呼ぶだけで、最新データを受け取って自動で再描画されます。

import { useSyncExternalStore } from "react";
import { emptyDB, type DB, type Item, type DoneLog } from "./types";
import { seedDB, migrateV1 } from "./seed";

const KEY = "ippo:db:v2";
const OLD_KEY = "ippo:db:v1"; // 旧モデル。あれば一度だけ移し替える。

function load(): DB {
  try {
    const cur = localStorage.getItem(KEY);
    if (cur) return { ...structuredClone(emptyDB), ...(JSON.parse(cur) as Partial<DB>) };

    // 旧データがあれば新モデルへ移し替え
    const old = localStorage.getItem(OLD_KEY);
    if (old) {
      const migrated = migrateV1(JSON.parse(old));
      localStorage.setItem(KEY, JSON.stringify(migrated));
      return migrated;
    }

    // まっさらなら初期データを入れる
    const seeded = seedDB();
    localStorage.setItem(KEY, JSON.stringify(seeded));
    return seeded;
  } catch {
    return structuredClone(emptyDB);
  }
}

let db: DB = load();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function update(mutate: (draft: DB) => void) {
  const next = structuredClone(db);
  mutate(next);
  db = next;
  localStorage.setItem(KEY, JSON.stringify(db));
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

// --- 道具 ---

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();

/** "YYYY-MM-DD"（端末のローカル日付） */
export function todayStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 入力文字列から #タグ を取り出し、タイトルとタグに分ける。
 * タグは「# または ＃ のあと、次の空白までの文字」。日本語でも安全。
 * 例: "GUコート袖縫う #裁縫" → { title: "GUコート袖縫う", tags: ["裁縫"] }
 */
export function parseTags(input: string): { title: string; tags: string[] } {
  const re = /[#＃]([^\s#＃　]+)/g;
  const tags: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    if (m[1] && !tags.includes(m[1])) tags.push(m[1]);
  }
  const title = input
    .replace(re, "")
    .replace(/[\s　]+/g, " ")
    .trim();
  return { title, tags };
}

/** アイテムを編集用の入力文字列（タイトル #タグ…）に戻す */
export function itemToInput(item: Item): string {
  const tagStr = item.tags.map((t) => `#${t}`).join(" ");
  return tagStr ? `${item.title} ${tagStr}` : item.title;
}

/** 今あるタグの一覧（重複なし・五十音/コード順）。絞り込みや候補に使う。 */
export function allTags(d: DB): string[] {
  const set = new Set<string>();
  for (const it of d.items) for (const t of it.tags) set.add(t);
  return [...set].sort((a, b) => a.localeCompare(b, "ja"));
}

// --- アイテム ---

export function addItem(input: string, recurring: boolean): string | null {
  const { title, tags } = parseTags(input);
  if (!title) return null;
  const newId = id();
  update((d) => {
    const item: Item = {
      id: newId,
      title,
      tags,
      recurring,
      status: "open",
      createdAt: now(),
    };
    d.items.push(item);
  });
  return newId;
}

export function editItem(itemId: string, input: string, recurring: boolean) {
  const { title, tags } = parseTags(input);
  if (!title) return;
  update((d) => {
    const it = d.items.find((x) => x.id === itemId);
    if (!it) return;
    it.title = title;
    it.tags = tags;
    it.recurring = recurring;
  });
}

export function deleteItem(itemId: string) {
  update((d) => {
    d.items = d.items.filter((i) => i.id !== itemId);
    d.steps = d.steps.filter((s) => s.itemId !== itemId);
    d.today = d.today.filter((t) => t.itemId !== itemId);
    // できたことログ（DoneLog）はあえて消さない。見返す記録として残す。
  });
}

/** 一度きりのアイテムを「できた」にする。完了をログに残す。 */
export function completeItem(itemId: string) {
  update((d) => {
    const it = d.items.find((x) => x.id === itemId);
    if (!it || it.status === "done") return;
    it.status = "done";
    it.doneAt = now();
    d.doneLogs.push({
      id: id(),
      date: todayStr(),
      refType: "item",
      refId: it.id,
      title: it.title,
      doneAt: it.doneAt,
    });
  });
}

export function reopenItem(itemId: string) {
  update((d) => {
    const it = d.items.find((x) => x.id === itemId);
    if (!it) return;
    it.status = "open";
    delete it.doneAt;
    d.doneLogs = d.doneLogs.filter((l) => !(l.refType === "item" && l.refId === itemId));
  });
}

// --- 毎日の習慣（recurring なアイテム） ---

/** その習慣が指定日に完了済みか */
export function isRecurringDoneToday(d: DB, itemId: string, date: string = todayStr()): boolean {
  return d.doneLogs.some((l) => l.refType === "item" && l.refId === itemId && l.date === date);
}

/** 習慣の「今日できた」を切り替える。完了したらログに残し、外したらログも消す。 */
export function toggleRecurringToday(itemId: string) {
  const date = todayStr();
  update((d) => {
    const it = d.items.find((x) => x.id === itemId);
    if (!it) return;
    const already = d.doneLogs.some(
      (l) => l.refType === "item" && l.refId === itemId && l.date === date
    );
    if (already) {
      d.doneLogs = d.doneLogs.filter(
        (l) => !(l.refType === "item" && l.refId === itemId && l.date === date)
      );
    } else {
      d.doneLogs.push({
        id: id(),
        date,
        refType: "item",
        refId: it.id,
        title: it.title,
        doneAt: now(),
      });
    }
  });
}

// --- 今日やること ---

export function addToToday(itemId: string) {
  const date = todayStr();
  update((d) => {
    if (d.today.some((t) => t.date === date && t.itemId === itemId)) return;
    const order = d.today.filter((t) => t.date === date).length;
    d.today.push({ id: id(), date, itemId, order });
  });
}

export function removeFromToday(itemId: string) {
  const date = todayStr();
  update((d) => {
    d.today = d.today.filter((t) => !(t.date === date && t.itemId === itemId));
  });
}

// --- 手順（ステップ） ---

export function addStep(itemId: string, title: string) {
  const trimmed = title.trim();
  if (!trimmed) return;
  update((d) => {
    const siblings = d.steps.filter((s) => s.itemId === itemId);
    d.steps.push({
      id: id(),
      itemId,
      title: trimmed,
      order: siblings.length,
      done: false,
    });
  });
}

export function deleteStep(stepId: string) {
  update((d) => {
    d.steps = d.steps.filter((s) => s.id !== stepId);
    d.doneLogs = d.doneLogs.filter((l) => !(l.refType === "step" && l.refId === stepId));
  });
}

export function toggleStep(stepId: string) {
  update((d) => {
    const s = d.steps.find((x) => x.id === stepId);
    if (!s) return;
    if (s.done) {
      s.done = false;
      delete s.doneAt;
      d.doneLogs = d.doneLogs.filter((l) => !(l.refType === "step" && l.refId === stepId));
    } else {
      s.done = true;
      s.doneAt = now();
      d.doneLogs.push({
        id: id(),
        date: todayStr(),
        refType: "step",
        refId: s.id,
        title: s.title,
        doneAt: s.doneAt,
      });
    }
  });
}

// --- できたことログ ---

export function setLogMemo(logId: string, memo: string) {
  update((d) => {
    const l = d.doneLogs.find((x) => x.id === logId);
    if (!l) return;
    const trimmed = memo.trim();
    if (trimmed) l.memo = trimmed;
    else delete l.memo;
  });
}

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
