// IPPO のデータ型をまとめた場所です。
// 考え方はシンプルに：すべては「アイテム（やること）」ひとつ。
// くりかえす習慣かどうかと対象曜日、テーマは任意のタグ（#で書いて付ける）。

export type ID = string;

/** ログに残せる完了の種類 */
export type RefType = "item" | "step";

/** ゆるい「いつやるか」フラグ。予定日なしのときの配置に使う。 */
export type Bucket = "today" | "tomorrow" | "soon" | "someday";

/**
 * やること。タスクも習慣も買い物も、ぜんぶこれひとつ。
 * - recurring: true なら習慣。repeatDays に当たる曜日だけ今日タブに出る。
 * - tag: 任意で1個だけ。#裁縫 のように書いて付ける。管理画面は持たない。
 * - bucket: 「いつやるか」のフラグ。
 * - sortOrder: 手動の並び順（バケット内、小さいほど上）。
 */
export interface Item {
  id: ID;
  title: string;
  tag: string | null; // タグは1個だけ。無ければ null。
  recurring: boolean;
  /** 習慣を表示する曜日のビット集合（0=日〜6=土）。通常タスクでは使わない。 */
  repeatDays: number;
  bucket: Bucket;
  sortOrder: number;
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

/**
 * できたことの記録。
 * title と tag をコピーして持つので、元のアイテムを消してもできた帳には残り続ける。
 */
export interface DoneLog {
  id: ID;
  date: string; // "YYYY-MM-DD"
  refType: RefType;
  refId: ID;
  title: string;
  tag: string | null;
  doneAt: string; // ISO 文字列
}

/** タスクごとに残すAI会話の発話。音声ファイルは保存せず文字だけを持つ。 */
export interface IppoConversationMessage {
  id: ID;
  itemId: ID;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
}

/** ブラウザに丸ごと保存するデータの全体 */
export interface DB {
  items: Item[];
  steps: Step[];
  doneLogs: DoneLog[];
}

export const emptyDB: DB = {
  items: [],
  steps: [],
  doneLogs: [],
};
