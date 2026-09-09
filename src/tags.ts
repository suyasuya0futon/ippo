/** 表記揺れするタグを、保存・表示・絞り込みで同じ名前にまとめる。 */
const TAG_ALIASES = new Map<string, string>([
  ["ねこ", "猫"],
]);

export function canonicalTag(tag: string): string {
  const normalized = tag.normalize("NFKC").trim();
  return TAG_ALIASES.get(normalized.toLocaleLowerCase("ja")) ?? normalized;
}

/**
 * タグの表示順。よく使うもの（件数が多いもの）を先に、同数なら五十音順。
 * counts は「タグ → 使った回数」。数えかたは呼ぶ側で決める。
 */
export function sortTagsByUsage(tags: string[], counts: Map<string, number>): string[] {
  return [...tags].sort((a, b) => {
    const diff = (counts.get(b) ?? 0) - (counts.get(a) ?? 0);
    if (diff !== 0) return diff;
    return a.localeCompare(b, "ja");
  });
}
