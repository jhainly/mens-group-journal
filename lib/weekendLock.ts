const lockTimeZone = "America/New_York";
const weekendDays = new Set(["Sat", "Sun"]);

export const weekendLockMessage =
  "Content is locked on Saturday and Sunday. You can read your journal and scores, but nothing new can be saved until Monday.";

export function isWeekendContentLocked(date = new Date()): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: lockTimeZone,
    weekday: "short"
  }).format(date);

  return weekendDays.has(weekday);
}
