// 今日やる / 今後やる の共通ビュー。mode で振る舞いを切り替える。
// 3a: まずは mode="today" を、これまでの今日画面と同じ挙動で実装。
//     今日固有の部分（習慣・達成数・「今日やることを選ぶ」）は mode === "today" で囲い、
//     3b で mode="future" を差し込めるようにしてある。
import { useEffect, useRef, useState } from "react";
import {
  useStore,
  todayStr,
  addToToday,
  removeFromToday,
  addStep,
  toggleStep,
  deleteStep,
  completeItem,
  reopenItem,
  isDoneToday,
  toggleRecurringToday,
} from "../store";
import type { DB, Item } from "../types";
import { TagChip } from "./ListScreen";

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
      {mode === "today" && habits.length > 0 && (
        <>
          <p className="section-title">
            毎日の習慣
            <Count done={habitsDone} total={habits.length} />
          </p>
          <div className="card">
            {habits.map((h) => {
              const done = isDoneToday(db, h.id);
              return (
                <div key={h.id} className="step">
                  <button
                    className={`step__check ${done ? "step__check--done" : ""}`}
                    onClick={() => toggleRecurringToday(h.id)}
                    aria-label={done ? "完了を取り消す" : "完了にする"}
                  >
                    {done ? "✓" : ""}
                  </button>
                  <span className={`step__label ${done ? "step__label--done" : ""}`}>
                    <TagChip tag={h.tag} />
                    {h.title}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <p className="section-title">
        今日のタスク
        {mode === "today" && <Count done={taskDone} total={todayItems.length} />}
      </p>
      <div className="card">
        {todayItems.length === 0 ? (
          <div className="empty">
            今日やることは、まだありません。{"\n"}
            下のボタンから、ひとつだけ選んでみましょう。{"\n"}
            ひとつで十分です。
          </div>
        ) : (
          todayItems.map((item) => <TaskRow key={item.id} item={item} db={db} mode={mode} />)
        )}
      </div>

      {mode === "today" && (
        <>
          <button className="btn" style={{ width: "100%" }} onClick={() => setPicking((v) => !v)}>
            {picking ? "閉じる" : "＋ 今日やることを選ぶ"}
          </button>

          {picking && (
            <div className="card" style={{ marginTop: 12, scrollMarginTop: 12 }} ref={pickerRef}>
              {candidates.length === 0 ? (
                <div className="empty" style={{ padding: 12 }}>
                  追加できるものがありません。{"\n"}「一覧」タブで先に書けます。
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
        </>
      )}
    </div>
  );
}

function TaskRow({ item, db, mode }: { item: Item; db: DB; mode: Mode }) {
  const [adding, setAdding] = useState(false);
  const [stepText, setStepText] = useState("");

  const steps = db.steps.filter((s) => s.itemId === item.id).sort((a, b) => a.order - b.order);
  const isDone = item.status === "done";

  function submitStep() {
    addStep(item.id, stepText);
    setStepText("");
  }

  return (
    <div className="trow">
      {/* タスク本体の行 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 4px" }}>
        {/* 今日やるはチェックで完了。今後やるは完了させない（3bで日付操作に置き換え） */}
        {mode === "today" && (
          <button
            className={`step__check ${isDone ? "step__check--done" : ""}`}
            onClick={() => (isDone ? reopenItem(item.id) : completeItem(item.id))}
            aria-label={isDone ? "完了を取り消す" : "完了にする"}
          >
            {isDone ? "✓" : ""}
          </button>
        )}
        <span className={`step__label ${isDone ? "step__label--done" : ""}`} style={{ flex: 1 }}>
          <TagChip tag={item.tag} />
          {item.title}
        </span>
        {/* 完了済みは「今日完了したものは残す」仕様なので、外すボタンは出さない */}
        {mode === "today" && !isDone && (
          <button
            className="icon-btn icon-btn--active"
            title="今日から外す"
            aria-label="今日から外す"
            onClick={() => removeFromToday(item.id)}
          >
            🌱
          </button>
        )}
      </div>

      {/* ステップ（あれば表示） */}
      {steps.length > 0 && (
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

      {/* 「小さな一歩を追加」を押したときだけ入力欄が出る */}
      {adding ? (
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
      )}
    </div>
  );
}
