import type { Item } from "./types";

/** JavaScript の getDay() と同じ並びで、日曜を最下位ビットにする。 */
export const ALL_REPEAT_DAYS = 0b1111111;
export const WEEKDAY_REPEAT_DAYS = 0b0111110;

export const REPEAT_DAY_OPTIONS = [
  { day: 1, label: "月" },
  { day: 2, label: "火" },
  { day: 3, label: "水" },
  { day: 4, label: "木" },
  { day: 5, label: "金" },
  { day: 6, label: "土" },
  { day: 0, label: "日" },
] as const;

export function hasRepeatDay(mask: number, day: number): boolean {
  return (mask & (1 << day)) !== 0;
}

export function toggleRepeatDay(mask: number, day: number): number {
  const next = mask ^ (1 << day);
  return next === 0 ? mask : next;
}

export function formatRepeatDays(mask: number): string {
  if (mask === ALL_REPEAT_DAYS) return "毎日";
  if (mask === WEEKDAY_REPEAT_DAYS) return "平日";
  return REPEAT_DAY_OPTIONS.filter(({ day }) => hasRepeatDay(mask, day))
    .map(({ label }) => label)
    .join("・");
}

/** YYYY-MM-DD を端末時刻にずらさず曜日へ変換する。 */
export function weekdayOf(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).getDay();
}

export function isHabitScheduledOn(item: Item, date: string): boolean {
  return item.recurring && hasRepeatDay(item.repeatDays, weekdayOf(date));
}
