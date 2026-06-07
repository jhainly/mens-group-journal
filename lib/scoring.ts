import type { Program, ProgramSection } from "@/types/program";

export type CompletedSectionKey = `${number}:${number}:${string}`;

export type DayProgress = {
  dayNumber: number;
  pointsEarned: number;
  maxPoints: number;
};

export type ScoreSummary = {
  weeklyScore: number;
  cumulativeScore: number;
  maxWeeklyScore: number;
  maxCumulativeScore: number;
  dayProgress: DayProgress[];
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
  const dayProgressMap = new Map<number, DayProgress>();

  for (const week of program.weeks) {
    for (const day of week.days) {
      for (const section of day.sections) {
        const points = getSectionPoints(section);
        maxCumulativeScore += points;

        if (week.weekNumber === activeWeekNumber) {
          maxWeeklyScore += points;
          const current = dayProgressMap.get(day.dayNumber) ?? { dayNumber: day.dayNumber, pointsEarned: 0, maxPoints: 0 };
          dayProgressMap.set(day.dayNumber, { ...current, maxPoints: current.maxPoints + points });
        }

        if (completedSections.has(sectionKey(week.weekNumber, day.dayNumber, section.id))) {
          cumulativeScore += points;
          if (week.weekNumber === activeWeekNumber) {
            weeklyScore += points;
            const current = dayProgressMap.get(day.dayNumber)!;
            dayProgressMap.set(day.dayNumber, { ...current, pointsEarned: current.pointsEarned + points });
          }
        }
      }
    }
  }

  const dayProgress = Array.from(dayProgressMap.values()).sort((a, b) => a.dayNumber - b.dayNumber);

  return { weeklyScore, cumulativeScore, maxWeeklyScore, maxCumulativeScore, dayProgress };
}

function getSectionPoints(section: ProgramSection): number {
  return Math.max(0, section.points);
}
