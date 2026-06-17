// IPPO のデータ型をまとめた場所です。
// アプリ全体がここで定義した「形」のデータをやり取りします。

export type ID = string;

/** ログに残せる完了の種類 */
export type RefType = "task" | "habit" | "step";

/** タスクやストック情報を分類するもの */
export interface Category {
  id: ID;
  name: string;
  color: string;
}

/** 一度きりのやること */
export interface Task {
  id: ID;
  title: string;
  categoryId: ID | null;
  status: "open" | "done";
  createdAt: string; // ISO 文字列
  doneAt?: string;
}

/** 毎日など繰り返すもの（今回は frequency は "daily" のみ。中身は次回作ります） */
export interface Habit {
  id: ID;
  title: string;
  categoryId: ID | null;
  frequency: "daily";
  createdAt: string;
}

/**
 * 小さな手順。
 * parentId で「どのタスクの手順か」を表す。
 * parentType を "step" にすれば手順の手順（再分解）も表現できる。
 */
export interface Step {
  id: ID;
  parentType: "task" | "habit" | "step";
  parentId: ID;
  title: string;
  order: number;
  done: boolean;
  doneAt?: string;
  depth: number;
}

/** 今日やることに選んだ項目 */
export interface TodayItem {
  id: ID;
  date: string; // "YYYY-MM-DD"
  refType: "task" | "habit";
  refId: ID;
  order: number;
}

/**
 * できたことの記録。
 * title をコピーして持つので、元のタスクを消してもカレンダーには残り続ける。
 */
export interface DoneLog {
  id: ID;
  date: string; // "YYYY-MM-DD"
  refType: RefType;
  refId: ID;
  title: string;
  doneAt: string; // ISO 文字列
  memo?: string;
}

/** ストック情報のリスト種類 */
export type StockList = "shopping" | "watch" | "places" | "memo";

/**
 * ストック情報。
 * メモ・買い物リスト・視聴リスト・行きたい場所など、「やること」ではなく
 * ためておく・見返す情報。done は「買った／見た／行った」のチェック。
 */
export interface StockItem {
  id: ID;
  list: StockList;
  title: string;
  done: boolean;
  memo?: string;
  createdAt: string;
}

/** ブラウザに丸ごと保存するデータの全体 */
export interface DB {
  categories: Category[];
  tasks: Task[];
  habits: Habit[];
  steps: Step[];
  today: TodayItem[];
  doneLogs: DoneLog[];
  stock: StockItem[];
}

export const emptyDB: DB = {
  categories: [],
  tasks: [],
  habits: [],
  steps: [],
  today: [],
  doneLogs: [],
  stock: [],
};
