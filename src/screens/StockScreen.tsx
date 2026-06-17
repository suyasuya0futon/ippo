// ストック画面：買い物・視聴・行きたい場所・メモなど、ためておく情報。
// 「やること」ではないので手順分解はしない。done は買った／見た／行ったの印。
import { useState } from "react";
import { useStore, addStock, toggleStock, deleteStock } from "../store";
import type { StockList } from "../types";

const LISTS: { key: StockList; label: string; icon: string; placeholder: string }[] = [
  { key: "shopping", label: "買い物", icon: "🛒", placeholder: "買うもの（例：マグカップ）" },
  { key: "watch", label: "視聴", icon: "📺", placeholder: "見たいもの（例：無職転生）" },
  { key: "places", label: "行きたい場所", icon: "📍", placeholder: "行きたい場所" },
  { key: "memo", label: "メモ", icon: "📝", placeholder: "メモ" },
];

export default function StockScreen() {
  const db = useStore();
  const [active, setActive] = useState<StockList>("shopping");
  const [text, setText] = useState("");

  const current = LISTS.find((l) => l.key === active)!;
  const items = db.stock.filter((s) => s.list === active);

  function submit() {
    addStock(active, text);
    setText("");
  }

  return (
    <div>
      <div className="row" style={{ flexWrap: "wrap", margin: "8px 0 4px" }}>
        {LISTS.map((l) => (
          <button
            key={l.key}
            className={`btn btn--small ${active === l.key ? "btn--primary" : ""}`}
            onClick={() => setActive(l.key)}
          >
            {l.icon} {l.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ marginTop: 10 }}>
        <div className="row">
          <input
            type="text"
            placeholder={current.placeholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <button className="btn btn--primary" onClick={submit}>
            追加
          </button>
        </div>
      </div>

      <div className="card">
        {items.length === 0 ? (
          <div className="empty" style={{ padding: 16 }}>
            {current.label}リストは空です。
          </div>
        ) : (
          items.map((s) => (
            <div key={s.id} className="step">
              <button
                className={`step__check ${s.done ? "step__check--done" : ""}`}
                onClick={() => toggleStock(s.id)}
                aria-label={s.done ? "未完了に戻す" : "完了にする"}
              >
                {s.done ? "✓" : ""}
              </button>
              <span className={`step__label ${s.done ? "step__label--done" : ""}`}>{s.title}</span>
              <button
                className="btn--ghost btn"
                onClick={() => deleteStock(s.id)}
                style={{ padding: "2px 6px" }}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
