// データの保存と読み書きをまとめた場所です。
// ブラウザの localStorage に丸ごと保存するので、サーバーは要りません。
// 画面側は useStore() を呼ぶだけで、最新データを受け取って自動で再描画されます。

import { useSyncExternalStore } from "react";
import {
  emptyDB,
  type DB,
  type Category,
  type Task,
  type Habit,
  type Step,
  type DoneLog,
  type StockItem,
  type StockList,
} from "./types";

const STORAGE_KEY = "ippo:db:v1";

function load(): DB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(emptyDB);
    const parsed = JSON.parse(raw) as Partial<DB>;
    // 足りないキーがあっても落ちないように、空のDBで埋める
    return { ...structuredClone(emptyDB), ...parsed };
  } catch {
    return structuredClone(emptyDB);
  }
}

let db: DB = load();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** db を書き換えて保存し、画面に変更を知らせる */
function update(mutate: (draft: DB) => void) {
  const next = structuredClone(db);
  mutate(next);
  db = next;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
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

// --- ちょっとした道具 ---

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();

/** "YYYY-MM-DD"（端末のローカル日付） */
export function todayStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const COLORS = ["#7da9c9", "#9ec7a4", "#c9a9c4", "#d6b48a", "#a4b0c9", "#c99a9a"];

// --- カテゴリ ---

export function addCategory(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const newId = id();
  update((d) => {
    const color = COLORS[d.categories.length % COLORS.length];
    const cat: Category = { id: newId, name: trimmed, color };
    d.categories.push(cat);
  });
  return newId;
}

export function deleteCategory(catId: string) {
  update((d) => {
    d.categories = d.categories.filter((c) => c.id !== catId);
    // 紐づいていたタスクは「未分類」に戻す
    for (const t of d.tasks) if (t.categoryId === catId) t.categoryId = null;
  });
}

// --- タスク ---

export function addTask(title: string, categoryId: string | null): string | null {
  const trimmed = title.trim();
  if (!trimmed) return null;
  const newId = id();
  update((d) => {
    const task: Task = {
      id: newId,
      title: trimmed,
      categoryId,
      status: "open",
      createdAt: now(),
    };
    d.tasks.push(task);
  });
  return newId;
}

export function deleteTask(taskId: string) {
  update((d) => {
    d.tasks = d.tasks.filter((t) => t.id !== taskId);
    d.steps = d.steps.filter((s) => !(s.parentType === "task" && s.parentId === taskId));
    d.today = d.today.filter((ti) => !(ti.refType === "task" && ti.refId === taskId));
    // できたことログ（DoneLog）はあえて消さない。見返す記録として残す。
  });
}

/** タスクを「できた」にする。完了をログに残す。 */
export function completeTask(taskId: string) {
  update((d) => {
    const t = d.tasks.find((x) => x.id === taskId);
    if (!t || t.status === "done") return;
    t.status = "done";
    t.doneAt = now();
    d.doneLogs.push({
      id: id(),
      date: todayStr(),
      refType: "task",
      refId: t.id,
      title: t.title,
      doneAt: t.doneAt,
    });
  });
}

/** 「できた」を取り消す（押し間違え用）。対応するログも消す。 */
export function reopenTask(taskId: string) {
  update((d) => {
    const t = d.tasks.find((x) => x.id === taskId);
    if (!t) return;
    t.status = "open";
    delete t.doneAt;
    d.doneLogs = d.doneLogs.filter((l) => !(l.refType === "task" && l.refId === taskId));
  });
}

// --- 今日やること ---

export function addToToday(refId: string, refType: "task" | "habit" = "task") {
  const date = todayStr();
  update((d) => {
    const exists = d.today.some((ti) => ti.date === date && ti.refId === refId);
    if (exists) return;
    const order = d.today.filter((ti) => ti.date === date).length;
    d.today.push({ id: id(), date, refType, refId, order });
  });
}

export function removeFromToday(refId: string) {
  const date = todayStr();
  update((d) => {
    d.today = d.today.filter((ti) => !(ti.date === date && ti.refId === refId));
  });
}

// --- 手順（ステップ） ---

export function addStep(taskId: string, title: string) {
  const trimmed = title.trim();
  if (!trimmed) return;
  update((d) => {
    const siblings = d.steps.filter((s) => s.parentType === "task" && s.parentId === taskId);
    const step: Step = {
      id: id(),
      parentType: "task",
      parentId: taskId,
      title: trimmed,
      order: siblings.length,
      done: false,
      depth: 0,
    };
    d.steps.push(step);
  });
}

export function deleteStep(stepId: string) {
  update((d) => {
    d.steps = d.steps.filter((s) => s.id !== stepId);
    d.doneLogs = d.doneLogs.filter((l) => !(l.refType === "step" && l.refId === stepId));
  });
}

/** 手順のチェックを切り替える。完了したらログに残し、外したらログも消す。 */
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

/** ログにメモを付ける／書き換える */
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

// --- 習慣（毎日など繰り返すもの） ---

export function addHabit(title: string, categoryId: string | null): string | null {
  const trimmed = title.trim();
  if (!trimmed) return null;
  const newId = id();
  update((d) => {
    const habit: Habit = {
      id: newId,
      title: trimmed,
      categoryId,
      frequency: "daily",
      createdAt: now(),
    };
    d.habits.push(habit);
  });
  return newId;
}

export function deleteHabit(habitId: string) {
  update((d) => {
    d.habits = d.habits.filter((h) => h.id !== habitId);
    // 過去の「できたこと」はあえて残す
  });
}

/** その習慣が指定日に完了済みか */
export function isHabitDone(d: DB, habitId: string, date: string = todayStr()): boolean {
  return d.doneLogs.some((l) => l.refType === "habit" && l.refId === habitId && l.date === date);
}

/** 習慣の「今日できた」を切り替える。完了したらログに残し、外したらログも消す。 */
export function toggleHabitToday(habitId: string) {
  const date = todayStr();
  update((d) => {
    const h = d.habits.find((x) => x.id === habitId);
    if (!h) return;
    const already = d.doneLogs.some(
      (l) => l.refType === "habit" && l.refId === habitId && l.date === date
    );
    if (already) {
      d.doneLogs = d.doneLogs.filter(
        (l) => !(l.refType === "habit" && l.refId === habitId && l.date === date)
      );
    } else {
      d.doneLogs.push({
        id: id(),
        date,
        refType: "habit",
        refId: h.id,
        title: h.title,
        doneAt: now(),
      });
    }
  });
}

// --- ストック情報（買い物・視聴・行きたい場所・メモ） ---

export function addStock(list: StockList, title: string): string | null {
  const trimmed = title.trim();
  if (!trimmed) return null;
  const newId = id();
  update((d) => {
    const item: StockItem = {
      id: newId,
      list,
      title: trimmed,
      done: false,
      createdAt: now(),
    };
    d.stock.push(item);
  });
  return newId;
}

export function toggleStock(stockId: string) {
  update((d) => {
    const s = d.stock.find((x) => x.id === stockId);
    if (!s) return;
    s.done = !s.done;
  });
}

export function deleteStock(stockId: string) {
  update((d) => {
    d.stock = d.stock.filter((s) => s.id !== stockId);
  });
}
