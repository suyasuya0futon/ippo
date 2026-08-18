/** 表記揺れするタグを、保存・表示・絞り込みで同じ名前にまとめる。 */
const TAG_ALIASES = new Map<string, string>([
  ["ねこ", "猫"],
]);

export function canonicalTag(tag: string): string {
  const normalized = tag.normalize("NFKC").trim();
  return TAG_ALIASES.get(normalized.toLocaleLowerCase("ja")) ?? normalized;
}
