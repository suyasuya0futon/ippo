import { describe, expect, it } from "vitest";
import { parseVoiceTask } from "./voiceTask";

describe("音声から今日のやることを解析", () => {
  it.each(["猫砂", "猫砂。", "　猫砂　"])("タグ省略は買物: %s", (text) => {
    expect(parseVoiceTask(text, ["猫", "勉強"])).toEqual({ title: "猫砂", tag: "買物" });
  });
  it.each(["買物 猫砂", "買い物、猫砂。", "買い物猫砂"])("買物の表記ゆれと区切り: %s", (text) => {
    expect(parseVoiceTask(text, [])).toEqual({ title: "猫砂", tag: "買物" });
  });
  it.each(["勉強　漏電遮断器まとめ", "勉強漏電遮断器まとめ"])("勉強も初回から使用できる: %s", (text) => {
    expect(parseVoiceTask(text, [])).toEqual({ title: "漏電遮断器まとめ", tag: "勉強" });
  });
  it("登録済みタグは長い名前を優先する", () => {
    expect(parseVoiceTask("仕事準備、資料を読む", ["仕事", "仕事準備"])).toEqual({ title: "資料を読む", tag: "仕事準備" });
  });
  it("タグなしを指定できる", () => {
    expect(parseVoiceTask("タグなし、部屋の片付け", [])).toEqual({ title: "部屋の片付け", tag: null });
  });
  it("1文字のタグは区切りで明示する", () => {
    expect(parseVoiceTask("猫、ごはん", ["猫"])).toEqual({ title: "ごはん", tag: "猫" });
  });
  it.each(["", "　", "。", "買物", "勉強、", "タグなし"])("本文なしは追加しない: %s", (text) => {
    expect(parseVoiceTask(text, [])).toBeNull();
  });
});
