// 今日やる / 今後やる の共通ビュー。
// 配置は bucket（フラグ）／予定日から導出。並びは手動（sortOrder 昇順）。自動ソートしない。
// 追加は各セクション見出しの ➕ から（押したときだけ入力欄／1件追加で閉じる）。型はセクションで決まる。
import { useState, type ReactNode } from "react";
import {
  useStore,
  todayStr,
  effectiveBucket,
  addItem,
  addToToday,
  moveToFuture,
  addStep,
  toggleStep,
  deleteStep,
  deleteItem,
  editItem,
  itemToInput,
  completeItem,
  reopenItem,
  isDoneToday,
  toggleRecurringToday,
} from "../store";
import type { Bucket, DB, Item } from "../types";
import { TagChip } from "../components/TagChip";
import ItemInput from "../components/ItemInput";

type Mode = "today" | "future";

// 手動の並び（sortOrder 昇順。小さいほど上）
const bySortOrder = (a: Item, b: Item) => a.sortOrder - b.sortOrder;

// 見出しタイトルの後ろに付ける残数ラベル。
// 空セクション（total 0）は何も出さない。残あり＝（N）。
// celebrate=true（今日やる側）で「タスクがあって全部完了」なら 🎉。
function countLabel(remaining: number, total: number, celebrate: boolean): string {
  if (total === 0) return "";
  if (remaining > 0) return `（${remaining}）`;
  return celebrate ? " 🎉" : "";
}

// セクション見出し。左（タイトル）=開閉スイッチ、右＝追加 ➕。
function SectionHead({
  children,
  collapsed,
  onToggleCollapse,
  addOpen,
  onToggleAdd,
}: {
  children: ReactNode;
  collapsed: boolean;
  onToggleCollapse: () => void;
  addOpen: boolean;
  onToggleAdd: () => void;
}) {
  return (
    <div className="section-head">
      <button
        className="section-head__toggle"
        aria-label={collapsed ? "開く" : "閉じる"}
        onClick={onToggleCollapse}
      >
        <span className="section-head__caret">{collapsed ? "▸" : "▾"}</span>
        {children}
      </button>
      <button className="add-btn" aria-label={addOpen ? "閉じる" : "追加"} onClick={onToggleAdd}>
        {addOpen ? "✕" : "➕"}
      </button>
    </div>
  );
}

export default function TaskListView({ mode }: { mode: Mode }) {
  const db = useStore();
  const [addOpen, setAddOpen] = useState<string | null>(null);
  // 畳まれているセクション（既定は全部開く。リロードで戻る＝覚えない）
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const date = todayStr();

  const toggleCollapse = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // ➕ は新規追加だけ。アコーディオン開閉とは無関係（閉じたままでも入力欄を出して追加できる）。
  const toggleAdd = (key: string) => setAddOpen((cur) => (cur === key ? null : key));

  // セクション（見出し＋追加欄＋リスト）を1つ描く
  function section(
    key: Bucket | "habit" | "task",
    title: ReactNode,
    items: Item[],
    placeholder: string,
    onAdd: (input: string) => void,
    emptyText: string,
    habitDoneOf?: (it: Item) => boolean
  ) {
    const isCollapsed = collapsed.has(key);
    return (
      <>
        <SectionHead
          collapsed={isCollapsed}
          onToggleCollapse={() => toggleCollapse(key)}
          addOpen={addOpen === key}
          onToggleAdd={() => toggleAdd(key)}
        >
          {title}
        </SectionHead>
        {/* 追加欄はアコーディオンの開閉とは独立（閉じてても出る） */}
        {addOpen === key && (
          <div className="card">
            <ItemInput
              showRecurring={false}
              autoFocus
              placeholder={placeholder}
              onSubmit={(input) => {
                onAdd(input);
                setAddOpen(null);
              }}
            />
          </div>
        )}
        {/* リストは畳める */}
        {!isCollapsed && (
          <div className="card">
            {items.length === 0 ? (
              <div className="empty" style={{ padding: "12px 8px" }}>
                {emptyText}
              </div>
            ) : (
              items.map((it) => (
                <TaskRow
                  key={it.id}
                  item={it}
                  db={db}
                  mode={mode}
                  habitDone={habitDoneOf ? habitDoneOf(it) : undefined}
                />
              ))
            )}
          </div>
        )}
      </>
    );
  }

  // ===== 今後やる =====
  if (mode === "future") {
    const inBucket = (b: Bucket) =>
      db.items
        .filter((i) => !i.recurring && i.status === "open" && effectiveBucket(i, date) === b)
        .sort(bySortOrder);
    const tomorrow = inBucket("tomorrow");
    const soon = inBucket("soon");
    const someday = inBucket("someday");

    return (
      <div>
        {section(
          "tomorrow",
          `明日${countLabel(tomorrow.length, tomorrow.length, false)}`,
          tomorrow,
          "明日やること（例：銀行に行く）",
          (input) => addItem(input, false, { bucket: "tomorrow" }),
          "明日のタスクはありません。"
        )}
        {section(
          "soon",
          `近日中${countLabel(soon.length, soon.length, false)}`,
          soon,
          "近日中にやること（例：本を返す）",
          (input) => addItem(input, false, { bucket: "soon" }),
          "近日中のタスクはありません。"
        )}
        {section(
          "someday",
          `いつか${countLabel(someday.length, someday.length, false)}`,
          someday,
          "いつかやること（例：服を処分する #家事）",
          (input) => addItem(input, false, { bucket: "someday" }),
          "いつかのタスクはありません。"
        )}
      </div>
    );
  }

  // ===== 今日やる =====
  // その日の完了時刻（毎日タスク用。doneLog から）
  const habitDoneAt = (id: string) =>
    db.doneLogs.find((l) => l.refType === "item" && l.refId === id && l.date === date)?.doneAt ??
    "";

  // 習慣：未完了が上（手動順）→ 完了は下（新しい完了ほど上、早い完了ほど下）
  const habits = db.items
    .filter((i) => i.recurring)
    .sort((a, b) => {
      const ad = isDoneToday(db, a.id);
      const bd = isDoneToday(db, b.id);
      if (ad !== bd) return ad ? 1 : -1;
      if (!ad) return a.sortOrder - b.sortOrder;
      return habitDoneAt(b.id).localeCompare(habitDoneAt(a.id));
    });

  // 今日のタスク：未完了が上（手動順）→ 完了は下（新しい完了ほど上、早い完了ほど下）
  const todayItems = db.items
    .filter(
      (i) =>
        !i.recurring &&
        effectiveBucket(i, date) === "today" &&
        (i.status === "open" || isDoneToday(db, i.id))
    )
    .sort((a, b) => {
      const ao = a.status === "open";
      const bo = b.status === "open";
      if (ao !== bo) return ao ? -1 : 1;
      if (ao) return a.sortOrder - b.sortOrder;
      return (b.doneAt ?? "").localeCompare(a.doneAt ?? "");
    });

  const habitsRemaining = habits.filter((h) => !isDoneToday(db, h.id)).length;
  const todayRemaining = todayItems.filter((i) => i.status === "open").length;

  return (
    <div>
      {section(
        "habit",
        `毎日の習慣${countLabel(habitsRemaining, habits.length, true)}`,
        habits,
        "毎日やること（例：プロテイン飲む #からだ）",
        (input) => addItem(input, true),
        "習慣はありません。",
        (it) => isDoneToday(db, it.id)
      )}
      {section(
        "task",
        `今日のタスク${countLabel(todayRemaining, todayItems.length, true)}`,
        todayItems,
        "今日やること（例：薬を飲む #からだ）",
        (input) => addItem(input, false, { bucket: "today" }),
        "今日やることは、まだありません。右上の ➕ で追加できます。"
      )}
    </div>
  );
}

// habitDone は毎日の習慣行のときだけ渡す（その日の完了状態）
function TaskRow({
  item,
  db,
  mode,
  habitDone,
}: {
  item: Item;
  db: DB;
  mode: Mode;
  habitDone?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [stepText, setStepText] = useState("");

  const isHabit = item.recurring;
  const isFlag = !isHabit && item.scheduledDate == null; // 🌱はフラグタスクのみ
  const steps = db.steps.filter((s) => s.itemId === item.id).sort((a, b) => a.order - b.order);
  const isDone = isHabit ? Boolean(habitDone) : item.status === "done";

  function submitStep() {
    addStep(item.id, stepText);
    setStepText("");
  }

  // 編集モード：行全体を入力欄に（種類は変えない＝recurring は保持）
  if (editing) {
    return (
      <div className="trow" style={{ padding: "8px 4px" }}>
        <ItemInput
          initialText={itemToInput(item)}
          showRecurring={false}
          submitLabel="保存"
          autoFocus
          onSubmit={(input) => {
            editItem(item.id, input, item.recurring);
            setEditing(false);
          }}
        />
        <button className="btn--ghost btn" style={{ marginTop: 6 }} onClick={() => setEditing(false)}>
          キャンセル
        </button>
      </div>
    );
  }

  return (
    <div className="trow">
      {/* 本体の行 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 4px" }}>
        {/* 今日やる（習慣含む）はチェックで完了。今後やるは完了させない。 */}
        {mode === "today" && (
          <button
            className={`step__check ${isDone ? "step__check--done" : ""}`}
            onClick={() =>
              isHabit
                ? toggleRecurringToday(item.id)
                : isDone
                  ? reopenItem(item.id)
                  : completeItem(item.id)
            }
            aria-label={isDone ? "完了を取り消す" : "完了にする"}
          >
            {isDone ? "✓" : ""}
          </button>
        )}
        <span className={`step__label ${isDone ? "step__label--done" : ""}`} style={{ flex: 1 }}>
          <TagChip tag={item.tag} />
          {item.title}
        </span>
        <span className="icon-actions">
          {/* フラグタスクのみ。今日やる＝⏳今後やるへ（近日中）／今後やる＝🌱今日やるに */}
          {mode === "today" && isFlag && !isDone && (
            <button
              className="icon-btn"
              title="今後やるに移動"
              aria-label="今後やるに移動"
              onClick={() => moveToFuture(item.id)}
            >
              ⏳
            </button>
          )}
          {mode === "future" && isFlag && (
            <button
              className="icon-btn"
              title="今日やるにする"
              aria-label="今日やるにする"
              onClick={() => addToToday(item.id)}
            >
              🌱
            </button>
          )}
          <button
            className="icon-btn icon-btn--ghost"
            title="編集"
            aria-label="編集"
            onClick={() => setEditing(true)}
          >
            ✏️
          </button>
          <button
            className="icon-btn icon-btn--ghost"
            style={{ fontSize: 20 }}
            title="削除"
            aria-label="削除"
            onClick={() => deleteItem(item.id)}
          >
            ×
          </button>
        </span>
      </div>

      {/* ステップ（今日やるのときだけ。今後やるでは砕かない） */}
      {mode === "today" && steps.length > 0 && (
        <div style={{ paddingLeft: 30 }}>
          {steps.map((s) => (
            <div key={s.id} className="step">
              <button
                className={`step__check ${s.done ? "step__check--done" : ""}`}
                onClick={() => toggleStep(s.id)}
                aria-label={s.done ? "完了を取り消す" : "完了にする"}
              >
                {s.done ? "✓" : ""}
              </button>
              <span className={`step__label ${s.done ? "step__label--done" : ""}`}>{s.title}</span>
              <button
                className="btn--ghost btn"
                onClick={() => deleteStep(s.id)}
                style={{ padding: "2px 6px" }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 「小さな一歩を追加」は今日やるのときだけ（習慣にも出さない） */}
      {mode === "today" &&
        !isHabit &&
        (adding ? (
          <div className="row" style={{ paddingLeft: 30, marginBottom: 10 }}>
            <input
              type="text"
              placeholder="例：まずは布団から出る"
              value={stepText}
              autoFocus
              onChange={(e) => setStepText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitStep()}
            />
            <button className="btn btn--small" style={{ flexShrink: 0 }} onClick={submitStep}>
              ＋
            </button>
          </div>
        ) : (
          <button
            className="btn--ghost btn"
            style={{ padding: "0 0 10px 30px", fontSize: 13 }}
            onClick={() => setAdding(true)}
          >
            ＋ 小さな一歩を追加する
          </button>
        ))}
    </div>
  );
}
