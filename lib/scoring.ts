import type { Program, ProgramSection } from "@/types/program";

export type CompletedSectionKey = `${number}:${number}:${string}`;

export type ScoreSummary = {
  weeklyScore: number;
  cumulativeScore: number;
  maxWeeklyScore: number;
  maxCumulativeScore: number;
};

export function sectionKey(weekNumber: number, dayNumber: number, sectionId: string): CompletedSectionKey {
  return `${weekNumber}:${dayNumber}:${sectionId}`;
}

export function calculateScores(
  program: Program,
  activeWeekNumber: number,
  completedSections: Set<CompletedSectionKey>
): ScoreSummary {
  let weeklyScore = 0;
  let cumulativeScore = 0;
  let maxWeeklyScore = 0;
  let maxCumulativeScore = 0;

  for (const week of program.weeks) {
    for (const day of week.days) {
      for (const section of day.sections) {
        const points = getSectionPoints(section);
        maxCumulativeScore += points;
        if (week.weekNumber === activeWeekNumber) {
          maxWeeklyScore += points;
        }
        if (completedSections.has(sectionKey(week.weekNumber, day.dayNumber, section.id))) {
          cumulativeScore += points;
          if (week.weekNumber === activeWeekNumber) {
            weeklyScore += points;
          }
        }
      }
    }
  }

  return { weeklyScore, cumulativeScore, maxWeeklyScore, maxCumulativeScore };
}

export function getSectionPoints(section: ProgramSection): number {
  return Math.max(0, section.points);
}

export function calculateStreak(completedDayKeys: Set<string>, orderedDayKeys: string[]): number {
  let streak = 0;
  for (let index = orderedDayKeys.length - 1; index >= 0; index -= 1) {
    if (!completedDayKeys.has(orderedDayKeys[index])) {
      break;
    }
    streak += 1;
  }
  return streak;
}
