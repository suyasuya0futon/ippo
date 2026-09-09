import { describe, expect, it } from "vitest";
import { sortTagsByUsage } from "./tags";

describe("sortTagsByUsage", () => {
  it("よく使うタグが先に来る", () => {
    const counts = new Map([
      ["散歩", 3],
      ["買物", 9],
      ["掃除", 5],
    ]);
    expect(sortTagsByUsage(["散歩", "買物", "掃除"], counts)).toEqual(["買物", "掃除", "散歩"]);
  });

  it("同じ件数なら五十音順", () => {
    const counts = new Map([
      ["猫", 2],
      ["health", 2],
      ["あいさつ", 2],
    ]);
    expect(sortTagsByUsage(["猫", "health", "あいさつ"], counts)).toEqual(["health", "あいさつ", "猫"]);
  });

  it("数えられていないタグは0件あつかいで最後に回る", () => {
    const counts = new Map([["買物", 1]]);
    expect(sortTagsByUsage(["未使用", "買物"], counts)).toEqual(["買物", "未使用"]);
  });

  it("渡した配列は書き換えない", () => {
    const tags = ["散歩", "買物"];
    sortTagsByUsage(tags, new Map([["買物", 4]]));
    expect(tags).toEqual(["散歩", "買物"]);
  });
});
