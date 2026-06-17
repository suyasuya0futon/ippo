// 管理画面：タスクとカテゴリを登録・一覧・削除する場所。
import { useState } from "react";
import {
  useStore,
  addTask,
  deleteTask,
  addCategory,
  deleteCategory,
  addToToday,
  addHabit,
  deleteHabit,
} from "../store";

export default function ManageScreen() {
  const db = useStore();
  const [taskTitle, setTaskTitle] = useState("");
  const [taskCat, setTaskCat] = useState<string>("");
  const [catName, setCatName] = useState("");
  const [habitTitle, setHabitTitle] = useState("");
  const [habitCat, setHabitCat] = useState<string>("");

  const openTasks = db.tasks.filter((t) => t.status === "open");
  const todayTaskIds = new Set(db.today.map((t) => t.refId));

  const catName_ = (id: string | null) =>
    id ? db.categories.find((c) => c.id === id) ?? null : null;

  function submitTask() {
    addTask(taskTitle, taskCat || null);
    setTaskTitle("");
  }

  return (
    <div>
      <p className="section-title">タスクを追加</p>
      <div className="card">
        <input
          type="text"
          placeholder="やること（例：病院に電話する）"
          value={taskTitle}
          onChange={(e) => setTaskTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitTask()}
        />
        <div className="row" style={{ marginTop: 10 }}>
          <select value={taskCat} onChange={(e) => setTaskCat(e.target.value)} style={{ flex: 1 }}>
            <option value="">未分類</option>
            {db.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button className="btn btn--primary" onClick={submitTask}>
            追加
          </button>
        </div>
      </div>

      <p className="section-title">タスク一覧</p>
      <div className="card">
        {openTasks.length === 0 ? (
          <div className="empty">まだタスクはありません。{"\n"}ひとつ、小さなことから書いてみましょう。</div>
        ) : (
          openTasks.map((t) => {
            const cat = catName_(t.categoryId);
            const inToday = todayTaskIds.has(t.id);
            return (
              <div className="taskitem" key={t.id}>
                <span className="taskitem__title">
                  {t.title}
                  {cat && (
                    <span className="chip" style={{ background: cat.color, marginLeft: 8 }}>
                      {cat.name}
                    </span>
                  )}
                </span>
                <button
                  className="btn btn--small"
                  disabled={inToday}
                  onClick={() => addToToday(t.id)}
                >
                  {inToday ? "今日に追加済" : "今日に追加"}
                </button>
                <button className="btn--ghost btn" onClick={() => deleteTask(t.id)}>
                  削除
                </button>
              </div>
            );
          })
        )}
      </div>

      <p className="section-title">習慣（毎日）</p>
      <div className="card">
        <input
          type="text"
          placeholder="毎日やること（例：プロテイン飲む）"
          value={habitTitle}
          onChange={(e) => setHabitTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              addHabit(habitTitle, habitCat || null);
              setHabitTitle("");
            }
          }}
        />
        <div className="row" style={{ marginTop: 10 }}>
          <select value={habitCat} onChange={(e) => setHabitCat(e.target.value)} style={{ flex: 1 }}>
            <option value="">未分類</option>
            {db.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            className="btn btn--primary"
            onClick={() => {
              addHabit(habitTitle, habitCat || null);
              setHabitTitle("");
            }}
          >
            追加
          </button>
        </div>
        {db.habits.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {db.habits.map((h) => {
              const cat = catName_(h.categoryId);
              return (
                <div className="taskitem" key={h.id}>
                  <span className="taskitem__title">
                    {h.title}
                    {cat && (
                      <span className="chip" style={{ background: cat.color, marginLeft: 8 }}>
                        {cat.name}
                      </span>
                    )}
                  </span>
                  <button className="btn--ghost btn" onClick={() => deleteHabit(h.id)}>
                    削除
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="section-title">カテゴリ</p>
      <div className="card">
        <div className="row">
          <input
            type="text"
            placeholder="カテゴリ名（例：家事、からだ）"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addCategory(catName);
                setCatName("");
              }
            }}
          />
          <button
            className="btn btn--primary"
            onClick={() => {
              addCategory(catName);
              setCatName("");
            }}
          >
            追加
          </button>
        </div>
        {db.categories.length > 0 && (
          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {db.categories.map((c) => (
              <span key={c.id} className="chip" style={{ background: c.color, paddingRight: 4 }}>
                {c.name}
                <button
                  onClick={() => deleteCategory(c.id)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#fff",
                    cursor: "pointer",
                    marginLeft: 4,
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
