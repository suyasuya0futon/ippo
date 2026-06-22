// できた帳：やったこと（できたこと）を日付ごとに振り返る一覧。
// タグで絞り込めば「前回◯◯したのいつ?」が分かる。
import { useState } from "react";
import { useStore } from "../store";
import { TagChip } from "../components/TagChip";

const DOW = ["日", "月", "火", "水", "木", "金", "土"];

function formatJpDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${y}年${m}月${d}日（${DOW[new Date(y, m - 1, d).getDay()]}）`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function DoneBookScreen() {
  const db = useStore();
  const [tag, setTag] = useState<string | null>(null);

  // できた帳に載せるのは親タスク（item）だけ。手順（step）は親遂行のための足場なので含めない。
  const itemLogs = db.doneLogs.filter((l) => l.refType === "item");

  // できたことに付いているタグ一覧
  const tags = [
    ...new Set(itemLogs.map((l) => l.tag).filter((t): t is string => Boolean(t))),
  ].sort((a, b) => a.localeCompare(b, "ja"));

  // 絞り込んだログ
  const logs = itemLogs.filter((l) => (tag ? l.tag === tag : true));

  // 表示する日付（新しい日が上）
  const dates = [...new Set(logs.map((l) => l.date))].sort((a, b) => b.localeCompare(a));

  return (
    <div>
      {tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "16px 2px 4px" }}>
          <button
            className={`btn btn--small ${tag === null ? "btn--primary" : ""}`}
            style={{ borderRadius: 999 }}
            onClick={() => setTag(null)}
          >
            すべて
          </button>
          {tags.map((t) => (
            <button
              key={t}
              className={`btn btn--small ${tag === t ? "btn--primary" : ""}`}
              style={{ borderRadius: 999 }}
              onClick={() => setTag(tag === t ? null : t)}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      {dates.length === 0 ? (
        <div className="empty" style={{ marginTop: 24 }}>
          {tag
            ? `#${tag} のできたことは、まだありません。`
            : "できたことは、まだありません。\nタスクを完了すると、ここに記録されます。"}
        </div>
      ) : (
        <div className="donebook">
          {dates.map((date) => {
            const dayLogs = logs
              .filter((l) => l.date === date)
              .sort((a, b) => b.doneAt.localeCompare(a.doneAt));
            return (
              <div className="donebook-day" key={date}>
                <div className="donebook-date">{formatJpDate(date)}にできたこと</div>
                {dayLogs.map((log) => (
                  <div className="donebook-entry" key={log.id}>
                    <span className="donebook-time">{formatTime(log.doneAt)}</span>
                    <span style={{ flex: 1 }}>
                      <TagChip tag={log.tag} />
                      {log.title}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
