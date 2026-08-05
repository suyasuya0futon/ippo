import { describe, expect, it } from "vitest";
import { getTagColor, getTagStyle } from "./tagColors";

describe("tag colors", () => {
  it("keeps the same color for the same tag", () => {
    expect(getTagColor("プロジェクトA")).toEqual(getTagColor("プロジェクトA"));
  });

  it("normalizes case and full-width characters", () => {
    expect(getTagColor("ＴＥＳＴ")).toEqual(getTagColor("test"));
  });

  it("uses a semantic color for related health tags", () => {
    expect(getTagColor("健康管理")).toEqual(getTagColor("朝の運動"));
  });

  it("makes a selected tag visually stronger", () => {
    expect(getTagStyle("買物", true)).not.toEqual(getTagStyle("買物"));
  });
});
