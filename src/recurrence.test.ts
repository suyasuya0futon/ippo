import { describe, expect, it } from "vitest";
import type { Item } from "./types";
import {
  ALL_REPEAT_DAYS,
  WEEKDAY_REPEAT_DAYS,
  formatRepeatDays,
  isHabitScheduledOn,
  toggleRepeatDay,
  weekdayOf,
} from "./recurrence";

function habit(repeatDays: number, recurring = true): Item {
  return {
    id: "habit-1",
    title: "テスト習慣",
    tag: null,
    recurring,
    repeatDays,
    bucket: "someday",
    sortOrder: 0,
    status: "open",
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("曜日のくりかえし", () => {
  it("日付文字列を端末のタイムゾーンにずらさず曜日へ変換する", () => {
    expect(weekdayOf("2026-07-20")).toBe(1);
    expect(weekdayOf("2026-07-26")).toBe(0);
  });

  it("毎日は平日・土日・祝日のすべてに表示する", () => {
    const item = habit(ALL_REPEAT_DAYS);
    expect(isHabitScheduledOn(item, "2026-07-18")).toBe(true);
    expect(isHabitScheduledOn(item, "2026-07-20")).toBe(true); // 海の日
    expect(isHabitScheduledOn(item, "2026-07-21")).toBe(true);
  });

  it("平日は通常の月〜金だけに表示する", () => {
    const item = habit(WEEKDAY_REPEAT_DAYS);
    expect(isHabitScheduledOn(item, "2026-07-17")).toBe(true); // 金
    expect(isHabitScheduledOn(item, "2026-07-18")).toBe(false); // 土
    expect(isHabitScheduledOn(item, "2026-07-19")).toBe(false); // 日
  });

  it("平日は祝日・振替休日・国民の休日を除外する", () => {
    const item = habit(WEEKDAY_REPEAT_DAYS);
    expect(isHabitScheduledOn(item, "2026-07-20")).toBe(false); // 海の日
    expect(isHabitScheduledOn(item, "2026-05-06")).toBe(false); // 振替休日
    expect(isHabitScheduledOn(item, "2026-09-22")).toBe(false); // 祝日に挟まれた休日
    expect(isHabitScheduledOn(item, "2026-07-21")).toBe(true); // 通常の火曜
  });

  it("個別に選んだ曜日は祝日でも表示する", () => {
    const mondayOnly = habit(1 << 1);
    expect(isHabitScheduledOn(mondayOnly, "2026-07-20")).toBe(true);
    expect(isHabitScheduledOn(mondayOnly, "2026-07-21")).toBe(false);
  });

  it("通常タスクは曜日が合っても習慣として表示しない", () => {
    expect(isHabitScheduledOn(habit(ALL_REPEAT_DAYS, false), "2026-07-20")).toBe(false);
  });

  it("曜日の表示名を短く整形する", () => {
    expect(formatRepeatDays(ALL_REPEAT_DAYS)).toBe("毎日");
    expect(formatRepeatDays(WEEKDAY_REPEAT_DAYS)).toBe("平日");
    expect(formatRepeatDays((1 << 1) | (1 << 3) | (1 << 5))).toBe("月・水・金");
  });

  it("最後の1曜日は解除しない", () => {
    expect(toggleRepeatDay(1 << 6, 6)).toBe(1 << 6);
  });
});
