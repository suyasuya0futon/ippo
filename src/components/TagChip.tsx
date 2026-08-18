// タグのチップ表示（共通部品）。同じタグには、どの画面でも同じ色が付く。
import { getTagStyle } from "../tagColors";
import { canonicalTag } from "../tags";

export function TagChip({ tag }: { tag: string | null }) {
  if (!tag) return null;
  const displayTag = canonicalTag(tag);
  return (
    <span
      className="chip"
      style={{
        ...getTagStyle(displayTag),
        borderStyle: "solid",
        borderWidth: 1,
        marginRight: 6,
      }}
    >
      {displayTag}
    </span>
  );
}
