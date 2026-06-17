// 今日やる / 今後やる の共通ビュー。mode で振る舞いを切り替える。
// 追加・編集・削除もここで行う（旧「一覧」タブの機能を引き継いだ）。
import { useEffect, useRef, useState } from "react";
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

export default function TaskListView({ mode }: { mode: Mode }) {
  const db = useStore();
  const [picking, setPicking] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // 「今日やることを選ぶ」を開いたら、その候補リストへスクロール
  useEffect(() => {
    if (picking) pickerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [picking]);

  const date = todayStr();

  // 追加：今日やるでは予定日=今日、今後やるでは未定。毎日チェック時は習慣（予定日なし）。
  // 最初から予定日付きで作る（insert 1回。addToToday の追い書きはしない＝レース回避）。
  function onAdd(input: string, recurring: boolean) {
    addItem(input, recurring, mode === "today" ? date : null);
  }

  const addForm = (
    <>
      <p className="section-title">タスクを追加</p>
      <div className="card">
        <ItemInput onSubmit={onAdd} />
      </div>
    </>
  );

  // ===== 今後やる =====
  if (mode === "future") {
    // 日付未定 or 明日以降の未完了（毎日タスクは出さない）
    const futureItems = db.items
      .filter(
        (i) =>
          !i.recurring &&
          i.status === "open" &&
          (i.scheduledDate == null || i.scheduledDate > date)
      )
      .sort((a, b) => {
        // 日付ありを先（昇順）、日付なしは後ろ。同条件はタグ降順。
        if (a.scheduledDate && b.scheduledDate) {
          return a.scheduledDate.localeCompare(b.scheduledDate) || byTagDesc(a, b);
        }
        if (a.scheduledDate && !b.scheduledDate) return -1;
        if (!a.scheduledDate && b.scheduledDate) return 1;
        return byTagDesc(a, b);
      });

    return (
      <div>
        {addForm}
        <p className="section-title">今後やる</p>
        <div className="card">
          {futureItems.length === 0 ? (
            <div className="empty">
              今後やるタスクはありません。{"\n"}上の「タスクを追加」から書けます。
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

  // 候補 = 今日やるに出ていない未完了の一度きりタスク（予定日が未定 or 未来）
  const candidates = db.items.filter(
    (i) =>
      !i.recurring &&
      i.status === "open" &&
      !(i.scheduledDate != null && i.scheduledDate <= date)
  );

  const habitsDone = habits.filter((h) => isDoneToday(db, h.id)).length;
  const taskDone = todayItems.filter((i) => isDoneToday(db, i.id)).length;

  return (
    <div>
      {addForm}

      {habits.length > 0 && (
        <>
          <p className="section-title">
            毎日の習慣
            <Count done={habitsDone} total={habits.length} />
          </p>
          <div className="card">
            {habits.map((h) => {
              const done = isDoneToday(db, h.id);
              return <TaskRow key={h.id} item={h} db={db} mode="today" habitDone={done} />;
            })}
          </div>
        </>
      )}

      <p className="section-title">
        今日のタスク
        <Count done={taskDone} total={todayItems.length} />
      </p>
      <div className="card">
        {todayItems.length === 0 ? (
          <div className="empty">
            今日やることは、まだありません。{"\n"}
            上で追加するか、下のボタンから選んでみましょう。{"\n"}
            ひとつで十分です。
          </div>
        ) : (
          todayItems.map((item) => <TaskRow key={item.id} item={item} db={db} mode="today" />)
        )}
      </div>

      <button className="btn" style={{ width: "100%" }} onClick={() => setPicking((v) => !v)}>
        {picking ? "閉じる" : "＋ 今日やることを選ぶ"}
      </button>

      {picking && (
        <div className="card" style={{ marginTop: 12, scrollMarginTop: 12 }} ref={pickerRef}>
          {candidates.length === 0 ? (
            <div className="empty" style={{ padding: 12 }}>
              追加できるものがありません。
            </div>
          ) : (
            candidates.map((it) => (
              <div className="taskitem" key={it.id}>
                <span className="taskitem__title">
                  <TagChip tag={it.tag} />
                  {it.title}
                </span>
                <button
                  className="icon-btn"
                  title="今日に追加"
                  aria-label="今日に追加"
                  onClick={() => addToToday(it.id)}
                >
                  🌱
                </button>
              </div>
            ))
          )}
        </div>
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
  const steps = db.steps.filter((s) => s.itemId === item.id).sort((a, b) => a.order - b.order);
  const isDone = isHabit ? Boolean(habitDone) : item.status === "done";

  function submitStep() {
    addStep(item.id, stepText);
    setStepText("");
  }

  // 編集モード：行全体を入力欄に
  if (editing) {
    return (
      <div className="trow" style={{ padding: "8px 4px" }}>
        <ItemInput
          initialText={itemToInput(item)}
          initialRecurring={item.recurring}
          submitLabel="保存"
          autoFocus
          onSubmit={(input, recurring) => {
            editItem(item.id, input, recurring);
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
        <div
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px 10px 4px" }}
        >
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

      {/* ステップ（あれば表示） */}
      {steps.length > 0 && (
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

      {/* 「小さな一歩を追加」を押したときだけ入力欄が出る（習慣には出さない） */}
      {!isHabit &&
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
