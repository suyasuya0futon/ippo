// 今日画面：今日やることを選び、手順を一つずつチェックしていく中心の画面。
import { useState } from "react";
import {
  useStore,
  todayStr,
  addToToday,
  removeFromToday,
  addStep,
  toggleStep,
  deleteStep,
  completeTask,
  reopenTask,
  isHabitDone,
  toggleHabitToday,
} from "../store";
import type { DB, Task } from "../types";

export default function TodayScreen() {
  const db = useStore();
  const [picking, setPicking] = useState(false);

  const date = todayStr();
  const todayItems = db.today
    .filter((t) => t.date === date)
    .sort((a, b) => a.order - b.order);

  const todayTasks = todayItems
    .map((ti) => db.tasks.find((t) => t.id === ti.refId))
    .filter((t): t is Task => Boolean(t));

  const todayIds = new Set(todayTasks.map((t) => t.id));
  const candidates = db.tasks.filter((t) => t.status === "open" && !todayIds.has(t.id));

  const doneCount = todayTasks.filter((t) => t.status === "done").length;

  return (
    <div>
      {todayTasks.length > 0 && (
        <p className="muted" style={{ margin: "8px 4px", fontSize: 13 }}>
          今日のやること {todayTasks.length} 件のうち {doneCount} 件できました。
        </p>
      )}

      {db.habits.length > 0 && (
        <>
          <p className="section-title">毎日の習慣</p>
          <div className="card">
            {db.habits.map((h) => {
              const done = isHabitDone(db, h.id);
              return (
                <div key={h.id} className="step">
                  <button
                    className={`step__check ${done ? "step__check--done" : ""}`}
                    onClick={() => toggleHabitToday(h.id)}
                    aria-label={done ? "完了を取り消す" : "完了にする"}
                  >
                    {done ? "✓" : ""}
                  </button>
                  <span className={`step__label ${done ? "step__label--done" : ""}`}>
                    {h.title}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {db.habits.length > 0 && <p className="section-title">今日のタスク</p>}

      {todayTasks.length === 0 ? (
        <div className="empty">
          今日やることは、まだありません。{"\n"}
          下のボタンから、ひとつだけ選んでみましょう。{"\n"}
          ひとつで十分です。
        </div>
      ) : (
        todayTasks.map((task) => <TodayCard key={task.id} task={task} db={db} />)
      )}

      <button className="btn" style={{ width: "100%" }} onClick={() => setPicking((v) => !v)}>
        {picking ? "閉じる" : "＋ 今日やることを選ぶ"}
      </button>

      {picking && (
        <div className="card" style={{ marginTop: 12 }}>
          {candidates.length === 0 ? (
            <div className="empty" style={{ padding: 12 }}>
              追加できるタスクがありません。{"\n"}「管理」タブで先に登録できます。
            </div>
          ) : (
            candidates.map((t) => (
              <div className="taskitem" key={t.id}>
                <span className="taskitem__title">{t.title}</span>
                <button
                  className="btn btn--small btn--primary"
                  onClick={() => addToToday(t.id)}
                >
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

function TodayCard({ task, db }: { task: Task; db: DB }) {
  const [stepText, setStepText] = useState("");

  const steps = db.steps
    .filter((s) => s.parentType === "task" && s.parentId === task.id)
    .sort((a, b) => a.order - b.order);

  // 「次の一歩」= まだ終わっていない最初の手順
  const nextStepId = steps.find((s) => !s.done)?.id;
  const isDone = task.status === "done";

  function submitStep() {
    addStep(task.id, stepText);
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
          {task.title}
        </strong>
        <button className="btn--ghost btn" onClick={() => removeFromToday(task.id)}>
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
        <button className="btn" style={{ width: "100%" }} onClick={() => reopenTask(task.id)}>
          「できた」を取り消す
        </button>
      ) : (
        <button
          className="btn btn--done"
          style={{ width: "100%" }}
          onClick={() => completeTask(task.id)}
        >
          できた
        </button>
      )}
    </div>
  );
}
