// カレンダー画面：月表示で「できた数」が見える。日付を押すとその日のできたこと一覧。
// 「ひとこと」はその日に1つ書ける。ひとことだけの一覧表示にも切り替えられる。
import { useState } from "react";
import {
  useStore,
  todayStr,
  logsForDate,
  doneCountByDate,
  getDayNote,
  setDayNote,
  addItem,
} from "../store";
import { TagChip } from "../components/TagChip";
import ItemInput from "../components/ItemInput";
import type { DoneLog } from "../types";

const DOW = ["日", "月", "火", "水", "木", "金", "土"];

function formatJpDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${y}年${m}月${d}日（${DOW[new Date(y, m - 1, d).getDay()]}）`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function CalendarScreen() {
  const db = useStore();
  const today = todayStr();
  const [view, setView] = useState<"calendar" | "notes">("calendar");
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() }; // month: 0-11
  });
  const [selected, setSelected] = useState<string>(today);
  const [addingPlan, setAddingPlan] = useState(false);

  // メモ一覧
  if (view === "notes") {
    const notes = db.dayNotes
      .filter((n) => n.note.trim())
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date));
    return (
      <div>
        <p
          className="section-title"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}
        >
          <span>ひとこと一覧</span>
          <button
            className="btn--ghost btn"
            style={{ fontSize: 12, padding: 0, fontWeight: 400 }}
            onClick={() => setView("calendar")}
          >
            ← カレンダー
          </button>
        </p>
        <div className="card">
          {notes.length === 0 ? (
            <div className="empty" style={{ padding: 16 }}>
              ひとことはまだありません。
            </div>
          ) : (
            notes.map((n) => (
              <div
                key={n.id}
                className="taskitem"
                style={{ display: "block", cursor: "pointer" }}
                onClick={() => {
                  setSelected(n.date);
                  setView("calendar");
                }}
              >
                <div className="muted" style={{ fontSize: 12 }}>
                  {formatJpDate(n.date)}
                </div>
                <div style={{ whiteSpace: "pre-wrap", marginTop: 2 }}>{n.note}</div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  const counts = doneCountByDate(db);
  const firstDay = new Date(cursor.year, cursor.month, 1);
  const startDow = firstDay.getDay();
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();

  const cells: (string | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(
      `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    );
  }

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const m = c.month + delta;
      const year = c.year + Math.floor(m / 12);
      const month = ((m % 12) + 12) % 12;
      return { year, month };
    });
  }

  const logs = logsForDate(db, selected);
  // この日に予定されている未完了タスク
  const scheduledTasks = db.items.filter(
    (i) => !i.recurring && i.status === "open" && i.scheduledDate === selected
  );

  return (
    <div>
      <div className="cal-head">
        <button className="btn btn--small" onClick={() => shiftMonth(-1)}>
          ‹
        </button>
        <strong>
          {cursor.year}年 {cursor.month + 1}月
        </strong>
        <button className="btn btn--small" onClick={() => shiftMonth(1)}>
          ›
        </button>
      </div>

      <div className="cal-grid">
        {DOW.map((d) => (
          <div key={d} className="cal-dow">
            {d}
          </div>
        ))}
        {cells.map((date, i) =>
          date === null ? (
            <div key={`e${i}`} className="cal-cell cal-cell--empty" />
          ) : (
            <button
              key={date}
              className={`cal-cell ${date === today ? "cal-cell--today" : ""} ${
                date === selected ? "cal-cell--selected" : ""
              }`}
              onClick={() => setSelected(date)}
            >
              <span>{Number(date.split("-")[2])}</span>
              {counts[date] ? <span className="cal-count">◯{counts[date]}</span> : null}
            </button>
          )
        )}
      </div>

      <p
        className="section-title"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}
      >
        <span>{formatJpDate(selected)}</span>
        <button
          className="btn--ghost btn"
          style={{ fontSize: 12, padding: 0, fontWeight: 400 }}
          onClick={() => setView("notes")}
        >
          ひとことを一覧で見る
        </button>
      </p>
      <div className="card">
        <DayMemo key={selected} date={selected} />
      </div>

      <div className="section-head">
        <span className="section-head__title">この日の予定</span>
        <button
          className="add-btn"
          aria-label={addingPlan ? "閉じる" : "この日に予定を追加"}
          onClick={() => setAddingPlan((v) => !v)}
        >
          {addingPlan ? "✕" : "➕"}
        </button>
      </div>
      {addingPlan && (
        <div className="card">
          <ItemInput
            showRecurring={false}
            autoFocus
            placeholder="この日に予定するタスク（例：病院に行く #からだ）"
            onSubmit={(input) => {
              addItem(input, false, { scheduledDate: selected });
              setAddingPlan(false);
            }}
          />
        </div>
      )}
      <div className="card">
        {scheduledTasks.length === 0 ? (
          <div className="empty" style={{ padding: "12px 8px" }}>
            予定はありません。
          </div>
        ) : (
          scheduledTasks.map((t) => (
            <div className="taskitem" key={t.id}>
              <span className="taskitem__title">
                <TagChip tag={t.tag} />
                {t.title}
              </span>
            </div>
          ))
        )}
      </div>

      <p className="section-title">できたこと</p>
      <div className="card">
        {logs.length === 0 ? (
          <div className="empty" style={{ padding: "12px 8px" }}>
            この日の「できたこと」はまだありません。
          </div>
        ) : (
          logs.map((log) => <LogRow key={log.id} log={log} />)
        )}
      </div>
    </div>
  );
}

function DayMemo({ date }: { date: string }) {
  const db = useStore();
  const [text, setText] = useState(() => getDayNote(db, date));

  return (
    <div style={{ marginBottom: 8 }}>
      <textarea
        rows={2}
        placeholder="ひとこと"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => setDayNote(date, text)}
        style={{ resize: "vertical" }}
      />
    </div>
  );
}

function LogRow({ log }: { log: DoneLog }) {
  return (
    <div className="taskitem">
      <span style={{ fontSize: 12, color: "var(--text-soft)", width: 42 }}>
        {formatTime(log.doneAt)}
      </span>
      <span style={{ flex: 1 }}>
        <TagChip tag={log.tag} />
        {log.title}
        {log.refType === "step" && (
          <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>
            一歩
          </span>
        )}
      </span>
    </div>
  );
}
