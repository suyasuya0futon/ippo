// アイテムの入力欄。
// 文中に #タグ と書くとタグになる。# を打つと既存タグの候補が出る。
// 「毎日」トグルで習慣にできる。追加にも編集にも使う。
import { useRef, useState, type ReactNode } from "react";
import { useStore, allTags } from "../store";

type Props = {
  onSubmit: (input: string, recurring: boolean) => void;
  initialText?: string;
  initialRecurring?: boolean;
  placeholder?: string;
  submitLabel?: ReactNode;
  submitClassName?: string;
  leftAdornment?: ReactNode; // 入力欄の左に置く要素（編集時のゴミ箱など）
  compact?: boolean; // 入力欄を行と同じ高さに詰める（編集パネル用）
  showRecurring?: boolean;
  autoFocus?: boolean;
};

export default function ItemInput({
  onSubmit,
  initialText = "",
  initialRecurring = false,
  placeholder = "例：ジムに行く #健康",
  submitLabel = "＋",
  submitClassName = "btn",
  leftAdornment,
  compact = false,
  showRecurring = true,
  autoFocus = false,
}: Props) {
  const db = useStore();
  const [text, setText] = useState(initialText);
  const [recurring, setRecurring] = useState(initialRecurring);
  const inputRef = useRef<HTMLInputElement>(null);

  // いま入力中の末尾が "#部分文字列" なら、その続きのタグ候補を出す
  const match = text.match(/[#＃]([^\s#＃]*)$/);
  const partial = match ? match[1] : null;
  const suggestions =
    partial !== null
      ? allTags(db)
          .filter((t) => t.startsWith(partial) && t !== partial)
          .slice(0, 8)
      : [];

  function pickTag(tag: string) {
    setText(text.replace(/[#＃][^\s#＃]*$/, `#${tag} `));
    inputRef.current?.focus();
  }

  function submit() {
    if (!text.trim()) return;
    onSubmit(text, recurring);
    setText("");
    setRecurring(false);
  }

  return (
    <div>
      <div className="row">
        {leftAdornment}
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={text}
          autoFocus={autoFocus}
          style={{ minWidth: 0, ...(compact ? { height: 34, paddingTop: 0, paddingBottom: 0 } : null) }}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
        <button className={submitClassName} style={{ flexShrink: 0 }} onClick={submit}>
          {submitLabel}
        </button>
      </div>

      {suggestions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {suggestions.map((t) => (
            <button
              key={t}
              className="btn btn--small"
              style={{ borderRadius: 999 }}
              onClick={() => pickTag(t)}
            >
              #{t}
            </button>
          ))}
        </div>
      )}

      {showRecurring && (
        <label
          className="row"
          style={{ marginTop: 10, fontSize: 14, color: "var(--text-soft)", cursor: "pointer" }}
        >
          <input
            type="checkbox"
            checked={recurring}
            onChange={(e) => setRecurring(e.target.checked)}
            style={{ width: 18, height: 18 }}
          />
          毎日くりかえす（習慣にする）
        </label>
      )}
    </div>
  );
}
