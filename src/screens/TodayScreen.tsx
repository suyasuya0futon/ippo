// 今日画面：毎日の習慣も今日のタスクも「チェック付きリスト」で統一。
// 頭の○を押すと完了。手順は「＋手順」を押したときだけ入力欄が出る。
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

// タグ降順で並べる（タグ無しは末尾）
const byTagDesc = (a: Item, b: Item) => (b.tag ?? "").localeCompare(a.tag ?? "", "ja");

export default function TodayScreen() {
  const db = useStore();
  const [picking, setPicking] = useState(false);

  const date = todayStr();
  const habits = db.items.filter((i) => i.recurring).sort(byTagDesc);

  const todayItems = db.today
    .filter((t) => t.date === date)
    .map((t) => db.items.find((i) => i.id === t.itemId))
    .filter((i): i is Item => Boolean(i) && !i!.recurring)
    .sort(byTagDesc);

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
                    <TagChip tag={h.tag} />
                    {h.title}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <p className="section-title">今日のタスク</p>
      <div className="card">
        {todayItems.length === 0 ? (
          <div className="empty">
            今日やることは、まだありません。{"\n"}
            下のボタンから、ひとつだけ選んでみましょう。{"\n"}
            ひとつで十分です。
          </div>
        ) : (
          todayItems.map((item) => <TodayTaskRow key={item.id} item={item} db={db} />)
        )}
      </div>

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
                  <TagChip tag={it.tag} />
                  {it.title}
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

function TodayTaskRow({ item, db }: { item: Item; db: DB }) {
  const [adding, setAdding] = useState(false);
  const [stepText, setStepText] = useState("");

  const steps = db.steps.filter((s) => s.itemId === item.id).sort((a, b) => a.order - b.order);
  const nextStepId = steps.find((s) => !s.done)?.id;
  const isDone = item.status === "done";

  function submitStep() {
    addStep(item.id, stepText);
    setStepText("");
  }

  return (
    <div className="trow">
      {/* タスク本体の行 */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 4px" }}>
        <button
          className={`step__check ${isDone ? "step__check--done" : ""}`}
          onClick={() => (isDone ? reopenItem(item.id) : completeItem(item.id))}
          aria-label={isDone ? "完了を取り消す" : "完了にする"}
        >
          {isDone ? "✓" : ""}
        </button>
        <span className={`step__label ${isDone ? "step__label--done" : ""}`} style={{ flex: 1 }}>
          <TagChip tag={item.tag} />
          {item.title}
        </span>
        <button
          className="btn--ghost btn"
          style={{ padding: "2px 6px", fontSize: 12 }}
          onClick={() => setAdding((v) => !v)}
        >
          ＋手順
        </button>
        <button
          className="btn--ghost btn"
          style={{ padding: "2px 6px", fontSize: 12 }}
          onClick={() => removeFromToday(item.id)}
        >
          今日から外す
        </button>
      </div>

      {/* 手順（あれば表示） */}
      {steps.length > 0 && (
        <div style={{ paddingLeft: 30 }}>
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

      {/* 「＋手順」を押したときだけ入力欄が出る */}
      {adding && (
        <div className="row" style={{ paddingLeft: 30, marginBottom: 10 }}>
          <input
            type="text"
            placeholder="手順を足す（例：上着を着る）"
            value={stepText}
            autoFocus
            onChange={(e) => setStepText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitStep()}
          />
          <button className="btn btn--small" onClick={submitStep}>
            足す
          </button>
        </div>
      )}
    </div>
  );
}
