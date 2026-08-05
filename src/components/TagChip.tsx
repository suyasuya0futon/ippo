// タグのチップ表示（共通部品）。同じタグには、どの画面でも同じ色が付く。
import { getTagStyle } from "../tagColors";

export function TagChip({ tag }: { tag: string | null }) {
  if (!tag) return null;
  return (
    <span
      className="chip"
      style={{
        ...getTagStyle(tag),
        borderStyle: "solid",
        borderWidth: 1,
        marginRight: 6,
      }}
    >
      {tag}
    </span>
  );
}
