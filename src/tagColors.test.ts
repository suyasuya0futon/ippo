import { describe, expect, it } from "vitest";
import { getTagColor, getTagStyle } from "./tagColors";
import { canonicalTag } from "./tags";

describe("tag colors", () => {
  it("keeps the same color for the same tag", () => {
    expect(getTagColor("プロジェクトA")).toEqual(getTagColor("プロジェクトA"));
  });

  it("normalizes case and full-width characters", () => {
    expect(getTagColor("ＴＥＳＴ")).toEqual(getTagColor("test"));
  });

  it("keeps health tags consistent while separating walking", () => {
    expect(getTagColor("健康管理")).toEqual(getTagColor("健康習慣"));
    expect(getTagColor("健康")).not.toEqual(getTagColor("散歩"));
  });

  it("makes a selected tag visually stronger", () => {
    expect(getTagStyle("買物", true)).not.toEqual(getTagStyle("買物"));
  });

  it("uses the same purple for study and morning activities", () => {
    expect(getTagColor("勉強")).toEqual(getTagColor("朝活"));
  });

  it("gives common categories more distinct colors", () => {
    const tags = ["DIY", "猫", "覚書", "健康", "散歩", "視聴", "整頓", "掃除", "勉強", "買物", "美容", "病院"];
    expect(new Set(tags.map((tag) => getTagColor(tag).background)).size).toBe(tags.length);
  });

  it("merges hiragana cat tags into the kanji tag", () => {
    expect(canonicalTag("ねこ")).toBe("猫");
    expect(getTagColor("ねこ")).toEqual(getTagColor("猫"));
  });
});
