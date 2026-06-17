// 今日画面：毎日の習慣も今日のタスクも「チェック付きリスト」で統一。
// 頭の○を押すと完了。タスクは「小さく分ける」で小さなステップに砕ける。
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
  isRecurringDoneToday,
  toggleRecurringToday,
} from "../store";
import type { DB, Item } from "../types";
import { TagChip } from "./ListScreen";

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

export default function TodayScreen() {
  const db = useStore();
  const [picking, setPicking] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // 「今日やることを選ぶ」を開いたら、その候補リストへスクロール
  useEffect(() => {
    if (picking) pickerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [picking]);

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
      {habits.length > 0 && (
        <>
          <p className="section-title">
            毎日の習慣
            <Count done={habitsDone} total={habits.length} />
          </p>
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

      <p className="section-title">
        今日のタスク
        <Count done={taskDone} total={todayItems.length} />
      </p>
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
    </div>
  );
}

function TodayTaskRow({ item, db }: { item: Item; db: DB }) {
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
          className="icon-btn icon-btn--active"
          title="今日から外す"
          aria-label="今日から外す"
          onClick={() => removeFromToday(item.id)}
        >
          🌱
        </button>
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

      {/* 「小さく分ける」を押したときだけ入力欄が出る */}
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
          ＋ 小さなステップに分ける
        </button>
      )}
    </div>
  );
}
