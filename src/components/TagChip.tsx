// タグのチップ表示（共通部品）。色分けはせず、落ち着いた1色で統一。
export function TagChip({ tag }: { tag: string | null }) {
  if (!tag) return null;
  return (
    <span
      className="chip"
      style={{
        background: "var(--surface-2)",
        color: "var(--text-soft)",
        border: "1px solid var(--line)",
        marginRight: 6,
      }}
    >
      {tag}
    </span>
  );
}
