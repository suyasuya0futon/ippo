// カレンダー画面：月表示で「できた数」が見える。日付を押すとその日のできたこと一覧。
// メモはその日に1つだけ書ける。
import { useState } from "react";
import { useStore, todayStr, logsForDate, doneCountByDate, getDayNote, setDayNote } from "../store";
import { TagChip } from "./ListScreen";
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
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() }; // month: 0-11
  });
  const [selected, setSelected] = useState<string>(today);

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

      <p className="section-title">{formatJpDate(selected)}</p>
      <div className="card">
        <DayMemo key={selected} date={selected} />

        {logs.length === 0 ? (
          <div className="empty" style={{ padding: "16px 8px 4px" }}>
            この日の「できたこと」はまだありません。
          </div>
        ) : (
          <>
            <p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
              できたこと {logs.length} 件
            </p>
            {logs.map((log) => (
              <LogRow key={log.id} log={log} />
            ))}
          </>
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
        placeholder="今日のメモ（1日に1つ）"
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
