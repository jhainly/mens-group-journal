const weekDayLabels = ["Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Monday", "Tuesday"] as const;

function getProgramDayLabel(dayNumber: number, label?: string): string {
  if (label) {
    return label;
  }

  return weekDayLabels[(dayNumber - 1) % weekDayLabels.length] ?? `Day ${dayNumber}`;
}

export function getProgramDayDisplayName(day: { dayNumber: number; label?: string; title: string }): string {
  const label = getProgramDayLabel(day.dayNumber, day.label);
  return label === day.title ? day.title : `${label}: ${day.title}`;
}

export function getProgramWeekDisplayName(week: { weekNumber: number; title: string }): string {
  const title = week.title.trim();
  return /^week\b/i.test(title) ? title : `Week ${week.weekNumber}: ${title}`;
}
