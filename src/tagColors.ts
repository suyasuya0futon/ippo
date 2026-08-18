import type { CSSProperties } from "react";
import { canonicalTag } from "./tags";

type TagColor = {
  background: string;
  border: string;
  text: string;
  activeBackground: string;
  activeText: string;
};

// 白いカードの上で穏やかに見え、文字も読みやすいパステルカラー。
const TAG_COLORS: TagColor[] = [
  { background: "#e7f1f8", border: "#bfd7e7", text: "#416f8e", activeBackground: "#709fbe", activeText: "#ffffff" },
  { background: "#e8f3ea", border: "#bfdac4", text: "#477a50", activeBackground: "#72a47b", activeText: "#ffffff" },
  { background: "#fff0df", border: "#efd0a9", text: "#95652e", activeBackground: "#c89455", activeText: "#ffffff" },
  { background: "#f2eafa", border: "#d8c4e9", text: "#73548d", activeBackground: "#9574ae", activeText: "#ffffff" },
  { background: "#fbe9ee", border: "#ecc5d0", text: "#95566a", activeBackground: "#bc788c", activeText: "#ffffff" },
  { background: "#e4f3f1", border: "#b9dcd7", text: "#3f7771", activeBackground: "#68a29b", activeText: "#ffffff" },
  { background: "#f5eddf", border: "#dfcdb0", text: "#806640", activeBackground: "#a98b5d", activeText: "#ffffff" },
  { background: "#f9e9e4", border: "#e8c3b8", text: "#995d4c", activeBackground: "#bd7966", activeText: "#ffffff" },
  { background: "#eaecf8", border: "#c7ccea", text: "#56619a", activeBackground: "#7882b5", activeText: "#ffffff" },
  { background: "#eff4df", border: "#d2dda8", text: "#66783d", activeBackground: "#8d9f5d", activeText: "#ffffff" },
  { background: "#e3f2fa", border: "#b9dced", text: "#3f7893", activeBackground: "#66a0bb", activeText: "#ffffff" },
  { background: "#fde9e7", border: "#efc2bd", text: "#9b554f", activeBackground: "#c5746c", activeText: "#ffffff" },
  { background: "#e9eef1", border: "#c7d3da", text: "#536d7b", activeBackground: "#758d9a", activeText: "#ffffff" },
  { background: "#e3f4ea", border: "#b8dfc8", text: "#397657", activeBackground: "#5d9b78", activeText: "#ffffff" },
  { background: "#fcebdc", border: "#efc9a8", text: "#9a6034", activeBackground: "#c78352", activeText: "#ffffff" },
  { background: "#f4e8f3", border: "#dec2dd", text: "#825681", activeBackground: "#a679a4", activeText: "#ffffff" },
];

// よく使うテーマは、文字列のハッシュよりも連想しやすい色を優先する。
const SEMANTIC_COLORS: Array<{ words: string[]; color: TagColor }> = [
  { words: ["朝活", "勉強", "学習", "資格", "学校"], color: TAG_COLORS[3] },
  { words: ["健康"], color: TAG_COLORS[1] },
  { words: ["散歩", "運動", "筋トレ", "ジム"], color: TAG_COLORS[9] },
  { words: ["猫"], color: TAG_COLORS[14] },
  { words: ["DIY", "工作"], color: TAG_COLORS[5] },
  { words: ["覚書", "メモ"], color: TAG_COLORS[7] },
  { words: ["視聴", "動画", "映画"], color: TAG_COLORS[8] },
  { words: ["整頓", "片付け"], color: TAG_COLORS[12] },
  { words: ["掃除", "洗濯", "家事"], color: TAG_COLORS[10] },
  { words: ["注文"], color: TAG_COLORS[0] },
  { words: ["買物", "買い物", "買う", "食事", "料理", "ごはん", "食品"], color: TAG_COLORS[2] },
  { words: ["仕事", "業務", "会社", "開発", "作業"], color: TAG_COLORS[0] },
  { words: ["読書"], color: TAG_COLORS[15] },
  { words: ["趣味", "裁縫", "手芸"], color: TAG_COLORS[13] },
  { words: ["美容", "服"], color: TAG_COLORS[4] },
  { words: ["旅行", "外出", "おでかけ"], color: TAG_COLORS[5] },
  { words: ["植物", "園芸"], color: TAG_COLORS[13] },
  { words: ["お金", "家計", "支払", "銀行", "税"], color: TAG_COLORS[6] },
  { words: ["病院", "通院", "薬", "重要", "急ぎ"], color: TAG_COLORS[11] },
];

function hashTag(tag: string): number {
  let hash = 2166136261;
  for (const character of tag) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getTagColor(tag: string): TagColor {
  const normalizedTag = canonicalTag(tag).toLocaleLowerCase("ja");
  const semanticColor = SEMANTIC_COLORS.find(({ words }) =>
    words.some((word) => normalizedTag.includes(word.toLocaleLowerCase("ja"))),
  );

  return semanticColor?.color ?? TAG_COLORS[hashTag(normalizedTag) % TAG_COLORS.length];
}

export function getTagStyle(tag: string, active = false): CSSProperties {
  const color = getTagColor(tag);
  return {
    background: active ? color.activeBackground : color.background,
    borderColor: active ? color.activeBackground : color.border,
    color: active ? color.activeText : color.text,
  };
}
