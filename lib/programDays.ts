const weekDayLabels = ["Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Monday", "Tuesday"] as const;

export function getProgramDayLabel(dayNumber: number): string {
  return weekDayLabels[(dayNumber - 1) % weekDayLabels.length] ?? `Day ${dayNumber}`;
}
