// アイテムの入力欄。
// 文中に #タグ と書くとタグになる。既存タグは入力内容に関係なく常に表示する。
// 習慣では曜日も指定できる。追加にも編集にも使う。
import { useRef, useState, type ReactNode } from "react";
import { useStore, allTags, parseTag } from "../store";
import { getTagStyle } from "../tagColors";
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
  rightAdornment?: ReactNode;
  submitPosition?: "start" | "end";
  compact?: boolean; // 入力欄を行と同じ高さに詰める（編集パネル用）
  showRecurring?: boolean;
  showRepeatDays?: boolean;
  autoFocus?: boolean;
  initialTag?: string | null;
  separateTagSelection?: boolean;
};

export default function ItemInput({
  onSubmit,
  initialText = "",
  initialRecurring = false,
  initialRepeatDays = ALL_REPEAT_DAYS,
  placeholder = "例：ジムに行く #健康",
  submitLabel = <CheckIcon />,
  submitClassName = "icon-btn icon-btn--accent",
  rightAdornment,
  submitPosition = "end",
  compact = false,
  showRecurring = true,
  showRepeatDays = false,
  autoFocus = false,
  initialTag = null,
  separateTagSelection = false,
}: Props) {
  const db = useStore();
  const [text, setText] = useState(initialText);
  const [recurring, setRecurring] = useState(initialRecurring);
  const [repeatDays, setRepeatDays] = useState(initialRepeatDays);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(initialTag);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = allTags(db);

  function titleWithoutTagDraft(input: string) {
    return input
      .replace(/[#＃][^\s#＃]*/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // タグは1個だけ。タップしたら既存の #タグ を消して、選んだものに置き換える。
  function pickTag(tag: string) {
    if (separateTagSelection) {
      setSelectedTag((current) => (current === tag ? null : tag));
      setText((current) => titleWithoutTagDraft(current));
      inputRef.current?.focus();
      return;
    }
    const base = text
      .replace(/[#＃][^\s#＃]*/g, "")
      .replace(/\s+/g, " ")
      .trim();
    setText(base ? `${base} #${tag} ` : `#${tag} `);
    inputRef.current?.focus();
  }

  function addNewTag() {
    setSelectedTag(null);
    setText((current) => {
      const title = titleWithoutTagDraft(current);
      return title ? `${title} #` : "#";
    });
    window.requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  }

  function submit() {
    const parsed = parseTag(text);
    const title = separateTagSelection ? titleWithoutTagDraft(text) : parsed.title;
    if (!title) return;
    const tag = separateTagSelection ? (parsed.tag ?? selectedTag) : parsed.tag;
    const input = tag ? `${title} #${tag}` : title;
    onSubmit(input, recurring, repeatDays);
    setText("");
    setSelectedTag(null);
    setRecurring(false);
    setRepeatDays(ALL_REPEAT_DAYS);
    setRepeatOpen(false);
  }

  return (
    <div>
      <div className="row">
        {submitPosition === "start" && (
          <button className={submitClassName} style={{ flexShrink: 0 }} onClick={submit} aria-label="保存">
            {submitLabel}
          </button>
        )}
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
        {rightAdornment}
        {submitPosition === "end" && (
          <button className={submitClassName} style={{ flexShrink: 0 }} onClick={submit} aria-label="保存">
            {submitLabel}
          </button>
        )}
      </div>

      {(suggestions.length > 0 || separateTagSelection) && (
        <div className="tag-options">
          {suggestions.map((t) => (
            <button
              key={t}
              type="button"
              className="btn btn--small tag-option"
              style={{ ...getTagStyle(t, separateTagSelection && selectedTag === t) }}
              onClick={() => pickTag(t)}
              aria-pressed={separateTagSelection ? selectedTag === t : undefined}
            >
              #{t}
            </button>
          ))}
          {separateTagSelection && (
            <button type="button" className="btn btn--small tag-option tag-option--add" onClick={addNewTag}>
              ＋タグ追加
            </button>
          )}
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
