// 今日画面：毎日の習慣が自動で並び、今日やることを選んで手順をチェックしていく中心の画面。
import { useState } from "react";
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
  isRecurringDoneToday,
  toggleRecurringToday,
} from "../store";
import type { DB, Item } from "../types";
import { TagChip } from "./ListScreen";

export default function TodayScreen() {
  const db = useStore();
  const [picking, setPicking] = useState(false);

  const date = todayStr();
  const habits = db.items.filter((i) => i.recurring);

  const todayItems = db.today
    .filter((t) => t.date === date)
    .sort((a, b) => a.order - b.order)
    .map((t) => db.items.find((i) => i.id === t.itemId))
    .filter((i): i is Item => Boolean(i) && !i!.recurring);

  const todayIds = new Set(todayItems.map((i) => i.id));
  const candidates = db.items.filter(
    (i) => !i.recurring && i.status === "open" && !todayIds.has(i.id)
  );

  const habitsDone = habits.filter((h) => isRecurringDoneToday(db, h.id)).length;
  const taskDone = todayItems.filter((i) => i.status === "done").length;

  return (
    <div>
      {(habits.length > 0 || todayItems.length > 0) && (
        <p className="muted" style={{ margin: "8px 4px", fontSize: 13 }}>
          習慣 {habitsDone}/{habits.length}・タスク {taskDone}/{todayItems.length} できました。
        </p>
      )}

      {habits.length > 0 && (
        <>
          <p className="section-title">毎日の習慣</p>
          <div className="card">
            {habits.map((h) => {
              const done = isRecurringDoneToday(db, h.id);
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
                    {h.title}
                    <TagChip tag={h.tag} />
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <p className="section-title">今日のタスク</p>
      {todayItems.length === 0 ? (
        <div className="empty">
          今日やることは、まだありません。{"\n"}
          下のボタンから、ひとつだけ選んでみましょう。{"\n"}
          ひとつで十分です。
        </div>
      ) : (
        todayItems.map((item) => <TodayCard key={item.id} item={item} db={db} />)
      )}

      <button className="btn" style={{ width: "100%" }} onClick={() => setPicking((v) => !v)}>
        {picking ? "閉じる" : "＋ 今日やることを選ぶ"}
      </button>

      {picking && (
        <div className="card" style={{ marginTop: 12 }}>
          {candidates.length === 0 ? (
            <div className="empty" style={{ padding: 12 }}>
              追加できるものがありません。{"\n"}「一覧」タブで先に書けます。
            </div>
          ) : (
            candidates.map((it) => (
              <div className="taskitem" key={it.id}>
                <span className="taskitem__title">
                  {it.title}
                  <TagChip tag={it.tag} />
                </span>
                <button className="btn btn--small btn--primary" onClick={() => addToToday(it.id)}>
                  追加
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function TodayCard({ item, db }: { item: Item; db: DB }) {
  const [stepText, setStepText] = useState("");

  const steps = db.steps
    .filter((s) => s.itemId === item.id)
    .sort((a, b) => a.order - b.order);

  const nextStepId = steps.find((s) => !s.done)?.id;
  const isDone = item.status === "done";

  function submitStep() {
    addStep(item.id, stepText);
    setStepText("");
  }

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 4 }}>
        <strong
          style={{
            flex: 1,
            fontSize: 17,
            color: isDone ? "var(--text-soft)" : "var(--text)",
            textDecoration: isDone ? "line-through" : "none",
          }}
        >
          {item.title}
          <TagChip tag={item.tag} />
        </strong>
        <button className="btn--ghost btn" onClick={() => removeFromToday(item.id)}>
          今日から外す
        </button>
      </div>

      {steps.length === 0 ? (
        <p className="muted" style={{ fontSize: 13, margin: "4px 0 10px" }}>
          手順をひとつずつ足していけます。（次回、AI が自動で分けてくれるようにします）
        </p>
      ) : (
        <div style={{ margin: "6px 0 10px" }}>
          {steps.map((s) => {
            const isNext = s.id === nextStepId;
            return (
              <div key={s.id} className={`step ${isNext ? "step--next" : ""}`}>
                <button
                  className={`step__check ${s.done ? "step__check--done" : ""}`}
                  onClick={() => toggleStep(s.id)}
                  aria-label={s.done ? "完了を取り消す" : "完了にする"}
                >
                  {s.done ? "✓" : ""}
                </button>
                <span className={`step__label ${s.done ? "step__label--done" : ""}`}>
                  {isNext && <span className="next-badge">次の一歩</span>}
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
            );
          })}
        </div>
      )}

      <div className="row" style={{ marginBottom: 12 }}>
        <input
          type="text"
          placeholder="手順を足す（例：上着を着る）"
          value={stepText}
          onChange={(e) => setStepText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitStep()}
        />
        <button className="btn btn--small" onClick={submitStep}>
          足す
        </button>
      </div>

      {isDone ? (
        <button className="btn" style={{ width: "100%" }} onClick={() => reopenItem(item.id)}>
          「できた」を取り消す
        </button>
      ) : (
        <button
          className="btn btn--done"
          style={{ width: "100%" }}
          onClick={() => completeItem(item.id)}
        >
          できた
        </button>
      )}
    </div>
  );
}
