// アイテムの入力欄。
// 文中に #タグ と書くとタグになる。# を打つと既存タグの候補が出る。
// 習慣では曜日も指定できる。追加にも編集にも使う。
import { useRef, useState, type ReactNode } from "react";
import { useStore, allTags } from "../store";
import {
  ALL_REPEAT_DAYS,
  WEEKDAY_REPEAT_DAYS,
  REPEAT_DAY_OPTIONS,
  formatRepeatDays,
  hasRepeatDay,
  toggleRepeatDay,
} from "../recurrence";

// 送信ボタンの既定アイコン（✓）。追加・編集ともこの確定ボタンを使う。
function CheckIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

type Props = {
  onSubmit: (input: string, recurring: boolean, repeatDays: number) => void;
  initialText?: string;
  initialRecurring?: boolean;
  initialRepeatDays?: number;
  placeholder?: string;
  submitLabel?: ReactNode;
  submitClassName?: string;
  leftAdornment?: ReactNode; // 入力欄の左に置く要素（編集時のゴミ箱など）
  compact?: boolean; // 入力欄を行と同じ高さに詰める（編集パネル用）
  alwaysShowTags?: boolean; // 入力に関係なく既存タグを最初から出す（追加時）
  showRecurring?: boolean;
  showRepeatDays?: boolean;
  autoFocus?: boolean;
};

export default function ItemInput({
  onSubmit,
  initialText = "",
  initialRecurring = false,
  initialRepeatDays = ALL_REPEAT_DAYS,
  placeholder = "例：ジムに行く #健康",
  submitLabel = <CheckIcon />,
  submitClassName = "icon-btn icon-btn--accent",
  leftAdornment,
  compact = false,
  alwaysShowTags = false,
  showRecurring = true,
  showRepeatDays = false,
  autoFocus = false,
}: Props) {
  const db = useStore();
  const [text, setText] = useState(initialText);
  const [recurring, setRecurring] = useState(initialRecurring);
  const [repeatDays, setRepeatDays] = useState(initialRepeatDays);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 末尾で "#部分文字列" を入力中なら、それで絞り込む。
  // そうでなくても alwaysShowTags なら既存タグを全部出す（スマホで # を打たずにタップで付けられる）。
  const match = text.match(/[#＃]([^\s#＃]*)$/);
  const partial = match ? match[1] : null;
  const suggestions =
    partial !== null
      ? allTags(db).filter((t) => t.startsWith(partial) && t !== partial)
      : alwaysShowTags
        ? allTags(db)
        : [];

  // タグは1個だけ。タップしたら既存の #タグ を消して、選んだものに置き換える。
  function pickTag(tag: string) {
    const base = text
      .replace(/[#＃][^\s#＃]*/g, "")
      .replace(/\s+/g, " ")
      .trim();
    setText(base ? `${base} #${tag} ` : `#${tag} `);
    inputRef.current?.focus();
  }

  function submit() {
    if (!text.trim()) return;
    onSubmit(text, recurring, repeatDays);
    setText("");
    setRecurring(false);
    setRepeatDays(ALL_REPEAT_DAYS);
    setRepeatOpen(false);
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

      {showRepeatDays && (
        <div className="repeat-setting">
          <button
            type="button"
            className="repeat-setting__summary"
            aria-expanded={repeatOpen}
            onClick={() => setRepeatOpen((open) => !open)}
          >
            <span>くりかえし</span>
            <span className="repeat-setting__value">
              {formatRepeatDays(repeatDays)} <span aria-hidden="true">{repeatOpen ? "▾" : "▸"}</span>
            </span>
          </button>

          {repeatOpen && (
            <div className="repeat-setting__panel">
              <div className="repeat-setting__presets">
                <button
                  type="button"
                  className={`repeat-preset ${repeatDays === ALL_REPEAT_DAYS ? "repeat-preset--active" : ""}`}
                  onClick={() => setRepeatDays(ALL_REPEAT_DAYS)}
                >
                  毎日
                </button>
                <button
                  type="button"
                  className={`repeat-preset ${repeatDays === WEEKDAY_REPEAT_DAYS ? "repeat-preset--active" : ""}`}
                  onClick={() => setRepeatDays(WEEKDAY_REPEAT_DAYS)}
                >
                  平日
                </button>
              </div>
              <div className="repeat-days" aria-label="くりかえす曜日">
                {REPEAT_DAY_OPTIONS.map(({ day, label }) => {
                  const selected = hasRepeatDay(repeatDays, day);
                  return (
                    <button
                      key={day}
                      type="button"
                      className={`repeat-day ${selected ? "repeat-day--active" : ""}`}
                      aria-pressed={selected}
                      aria-label={`${label}曜日`}
                      onClick={() => setRepeatDays((days) => toggleRepeatDay(days, day))}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
