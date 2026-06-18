// 今日やる / 今後やる の共通ビュー。mode で振る舞いを切り替える。
// 追加は各セクション見出しの ➕ から（押したときだけ入力欄が出る／1件追加で閉じる）。
// 追加する型はセクションで決まるので「毎日くりかえす」チェックは無い。
import { useState, type ReactNode } from "react";
import {
  useStore,
  todayStr,
  addItem,
  addToToday,
  removeFromToday,
  setScheduledDate,
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
import type { DB, Item } from "../types";
import { TagChip } from "../components/TagChip";
import ItemInput from "../components/ItemInput";

type Mode = "today" | "future";

// タグ降順で並べる（タグ無しは末尾）
const byTagDesc = (a: Item, b: Item) => (b.tag ?? "").localeCompare(a.tag ?? "", "ja");

// 見出しの横に出す「3/6達成」。全部できたら 🎉。
function Count({ done, total }: { done: number; total: number }) {
  if (total === 0) return null;
  const complete = done === total;
  return (
    <span
      style={{
        marginLeft: 8,
        fontSize: 13,
        fontWeight: 400,
        color: complete ? "var(--done)" : "var(--text-soft)",
      }}
    >
      {done}/{total}達成{complete ? "🎉" : ""}
    </span>
  );
}

// セクション見出し（タイトル＋達成数 ＋ 右端の絵文字 ➕）
function SectionHead({
  children,
  open,
  onToggle,
}: {
  children: ReactNode;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="section-head">
      <span className="section-head__title">{children}</span>
      <button className="add-btn" aria-label={open ? "閉じる" : "追加"} onClick={onToggle}>
        {open ? "✕" : "➕"}
      </button>
    </div>
  );
}

export default function TaskListView({ mode }: { mode: Mode }) {
  const db = useStore();
  // どのセクションの入力欄が開いているか（"habit" | "task" | "future" | null）
  const [addOpen, setAddOpen] = useState<string | null>(null);

  const date = todayStr();
  const toggle = (key: string) => setAddOpen((cur) => (cur === key ? null : key));

  // ===== 今後やる =====
  if (mode === "future") {
    const futureItems = db.items
      .filter(
        (i) =>
          !i.recurring &&
          i.status === "open" &&
          (i.scheduledDate == null || i.scheduledDate > date)
      )
      .sort((a, b) => {
        if (a.scheduledDate && b.scheduledDate) {
          return a.scheduledDate.localeCompare(b.scheduledDate) || byTagDesc(a, b);
        }
        if (a.scheduledDate && !b.scheduledDate) return -1;
        if (!a.scheduledDate && b.scheduledDate) return 1;
        return byTagDesc(a, b);
      });

    return (
      <div>
        <SectionHead open={addOpen === "future"} onToggle={() => toggle("future")}>
          今後やる
        </SectionHead>
        {addOpen === "future" && (
          <div className="card">
            <ItemInput
              showRecurring={false}
              autoFocus
              placeholder="いつかやること（例：服を処分する #家事）"
              onSubmit={(input) => {
                addItem(input, false, null);
                setAddOpen(null);
              }}
            />
          </div>
        )}
        <div className="card">
          {futureItems.length === 0 ? (
            <div className="empty">
              今後やるタスクはありません。{"\n"}右上の ➕ から書けます。
            </div>
          ) : (
            futureItems.map((item) => <TaskRow key={item.id} item={item} db={db} mode="future" />)
          )}
        </div>
      </div>
    );
  }

  // ===== 今日やる =====
  const habits = db.items.filter((i) => i.recurring).sort(byTagDesc);

  // 今日やる = 予定日が今日以前の未完了 ∪ 今日完了したもの（打ち消し線で残す）
  const todayItems = db.items
    .filter(
      (i) =>
        !i.recurring &&
        ((i.scheduledDate != null && i.scheduledDate <= date && i.status === "open") ||
          isDoneToday(db, i.id))
    )
    .sort(byTagDesc);

  const habitsDone = habits.filter((h) => isDoneToday(db, h.id)).length;
  const taskDone = todayItems.filter((i) => isDoneToday(db, i.id)).length;

  return (
    <div>
      {/* 毎日の習慣 */}
      <SectionHead open={addOpen === "habit"} onToggle={() => toggle("habit")}>
        毎日の習慣
        <Count done={habitsDone} total={habits.length} />
      </SectionHead>
      {addOpen === "habit" && (
        <div className="card">
          <ItemInput
            showRecurring={false}
            autoFocus
            placeholder="毎日やること（例：プロテイン飲む #からだ）"
            onSubmit={(input) => {
              addItem(input, true);
              setAddOpen(null);
            }}
          />
        </div>
      )}
      {habits.length > 0 && (
        <div className="card">
          {habits.map((h) => (
            <TaskRow key={h.id} item={h} db={db} mode="today" habitDone={isDoneToday(db, h.id)} />
          ))}
        </div>
      )}

      {/* 今日のタスク */}
      <SectionHead open={addOpen === "task"} onToggle={() => toggle("task")}>
        今日のタスク
        <Count done={taskDone} total={todayItems.length} />
      </SectionHead>
      {addOpen === "task" && (
        <div className="card">
          <ItemInput
            showRecurring={false}
            autoFocus
            placeholder="今日やること（例：薬を飲む #からだ）"
            onSubmit={(input) => {
              addItem(input, false, date);
              setAddOpen(null);
            }}
          />
        </div>
      )}
      <div className="card">
        {todayItems.length === 0 ? (
          <div className="empty">
            今日やることは、まだありません。{"\n"}
            右上の ➕ で追加できます。ひとつで十分です。
          </div>
        ) : (
          todayItems.map((item) => <TaskRow key={item.id} item={item} db={db} mode="today" />)
        )}
      </div>
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
          {/* 今日やる：完了前のみ「今日から外す」。習慣は外せない（予定日を持たない）。 */}
          {mode === "today" && !isHabit && !isDone && (
            <button
              className="icon-btn icon-btn--active"
              title="今日から外す"
              aria-label="今日から外す"
              onClick={() => removeFromToday(item.id)}
            >
              🌱
            </button>
          )}
          {/* 今後やる：背景なし🌱で「今日やるにする」 */}
          {mode === "future" && (
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

      {/* 今後やる：予定日の指定・変更・なし */}
      {mode === "future" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px 10px 4px" }}>
          <span style={{ fontSize: 12, color: "var(--text-soft)" }}>予定日</span>
          <input
            type="date"
            value={item.scheduledDate ?? ""}
            onChange={(e) => setScheduledDate(item.id, e.target.value || null)}
            style={{ fontSize: 13, padding: "5px 8px", width: "auto" }}
          />
          {item.scheduledDate && (
            <button
              className="btn--ghost btn"
              style={{ fontSize: 12, padding: "2px 6px" }}
              onClick={() => setScheduledDate(item.id, null)}
            >
              日付なし
            </button>
          )}
        </div>
      )}

      {/* ステップ（今日やるのときだけ表示。今後やるでは出さない） */}
      {mode === "today" && steps.length > 0 && (
        <div style={{ paddingLeft: 30 }}>
          {steps.map((s) => (
            <div key={s.id} className="step">
              {/* 今後やるでは完了させない（チェックは出さない。表示・追加・削除のみ） */}
              {mode === "today" && (
                <button
                  className={`step__check ${s.done ? "step__check--done" : ""}`}
                  onClick={() => toggleStep(s.id)}
                  aria-label={s.done ? "完了を取り消す" : "完了にする"}
                >
                  {s.done ? "✓" : ""}
                </button>
              )}
              <span className={`step__label ${mode === "today" && s.done ? "step__label--done" : ""}`}>
                {s.title}
              </span>
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

      {/* 「小さな一歩を追加」は今日やるのときだけ（今後やるでは砕かない／習慣にも出さない） */}
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
