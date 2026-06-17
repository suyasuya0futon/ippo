// IPPO のデータ型をまとめた場所です。
// 考え方はシンプルに：すべては「アイテム（やること）」ひとつ。
// 毎日くりかえすかどうかはトグル、テーマは任意のタグ（#で書いて付ける）。

export type ID = string;

/** ログに残せる完了の種類 */
export type RefType = "item" | "step";

/**
 * やること。タスクも習慣も買い物も、ぜんぶこれひとつ。
 * - recurring: true なら「毎日くりかえす（習慣）」。今日タブに自動で出る。
 * - tags: 任意・複数。#裁縫 のように書いて付ける。管理画面は持たない。
 */
export interface Item {
  id: ID;
  title: string;
  tags: string[];
  recurring: boolean;
  status: "open" | "done"; // recurring の場合は使わない（日ごとに doneLogs で管理）
  createdAt: string;
  doneAt?: string;
}

/**
 * 小さな手順。itemId で「どのアイテムの手順か」を表す。
 * （将来、手順の再分解をするときは parent を増やせる）
 */
export interface Step {
  id: ID;
  itemId: ID;
  title: string;
  order: number;
  done: boolean;
  doneAt?: string;
}

/** 今日やると選んだアイテム（毎日の習慣は選ばなくても自動で出るので入らない） */
export interface TodayItem {
  id: ID;
  date: string; // "YYYY-MM-DD"
  itemId: ID;
  order: number;
}

/**
 * できたことの記録。
 * title をコピーして持つので、元のアイテムを消してもカレンダーには残り続ける。
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

/** ブラウザに丸ごと保存するデータの全体 */
export interface DB {
  items: Item[];
  steps: Step[];
  today: TodayItem[];
  doneLogs: DoneLog[];
}

export const emptyDB: DB = {
  items: [],
  steps: [],
  today: [],
  doneLogs: [],
};
