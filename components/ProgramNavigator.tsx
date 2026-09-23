"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { getProgramDayDisplayName, getProgramWeekDisplayName } from "@/lib/programDays";
import type { DayProgress } from "@/lib/scoring";
import type { Program, ProgramDay, ProgramSection } from "@/types/program";

export type DayCompletionChange = {
  completed: boolean;
  dayNumber: number;
  sectionId: string;
  weekNumber: number;
};

type ProgramNavigatorProps = {
  action?: ReactNode;
  dayProgress?: DayProgress[];
  disabledDayCompletion?: boolean;
  onDayCompletionChange?: (input: DayCompletionChange) => void | Promise<void>;
  onSelectedWeekNumberChange: (weekNumber: number) => void;
  program: Program;
  selectedWeekNumber: number;
  updatingDayNumbers?: number[];
};

export function ProgramNavigator({
  action,
  dayProgress = [],
  disabledDayCompletion = false,
  onDayCompletionChange,
  onSelectedWeekNumberChange,
  program,
  selectedWeekNumber,
  updatingDayNumbers = []
}: ProgramNavigatorProps) {
  const selectedWeek = useMemo(
    () => program.weeks.find((week) => week.weekNumber === selectedWeekNumber) ?? program.weeks[0],
    [program.weeks, selectedWeekNumber]
  );

  if (!selectedWeek) {
    return null;
  }

  return (
    <section className="panel stack">
      <div className="navigator-header">
        <div className="week-select-pill">
          <select
            className="week-select"
            value={selectedWeekNumber}
            onChange={(event) => onSelectedWeekNumberChange(Number(event.target.value))}
          >
            {program.weeks.map((week) => (
              <option key={week.weekNumber} value={week.weekNumber}>
                {getProgramWeekDisplayName(week)}
              </option>
            ))}
          </select>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ pointerEvents: "none", flexShrink: 0 }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
        {action ?? null}
      </div>
      {selectedWeek.summary ? <p className="muted">{selectedWeek.summary}</p> : null}

      <div className="section-block stack">
        <ul className="list">
          {selectedWeek.days.map((day) => {
            const maxPoints = day.sections.reduce((sum, s) => sum + Math.max(0, s.points), 0);
            const progress = dayProgress.find((d) => d.dayNumber === day.dayNumber);
            const earnedPoints = progress?.pointsEarned ?? 0;
            const pct = maxPoints > 0 ? Math.round((earnedPoints / maxPoints) * 100) : 0;
            const completionSection = getDashboardCompletionSection(day);
            const isUpdating = updatingDayNumbers.includes(day.dayNumber);
            const completionChecked = completionSection
              ? earnedPoints >= Math.max(0, completionSection.points)
              : false;

            return (
              <li className="card day-card" key={day.dayNumber}>
                {completionSection ? (
                  <label className="day-card-complete" aria-label={`Mark ${getProgramDayDisplayName(day)} complete`}>
                    <input
                      checked={completionChecked}
                      disabled={disabledDayCompletion || isUpdating || !onDayCompletionChange}
                      onChange={(event) =>
                        void onDayCompletionChange?.({
                          completed: event.target.checked,
                          dayNumber: day.dayNumber,
                          sectionId: completionSection.id,
                          weekNumber: selectedWeek.weekNumber
                        })
                      }
                      type="checkbox"
                    />
                  </label>
                ) : (
                  <span className="day-card-complete-spacer" aria-hidden="true" />
                )}
                <span className="day-card-name">
                  <strong>{getProgramDayDisplayName(day)}</strong>
                </span>
                <div className="day-progress day-card-bar">
                  <div className="day-progress-track">
                    <div className="day-progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="day-progress-label">{earnedPoints}/{maxPoints} pts</span>
                </div>
                <Link className="button secondary day-card-open" href={`/program/week/${selectedWeek.weekNumber}/day/${day.dayNumber}`}>
                  Open
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function getDashboardCompletionSection(day: ProgramDay): ProgramSection | null {
  if (day.title.trim().toLowerCase() !== "reading and reflection") {
    return null;
  }

  const scoredSections = day.sections.filter((section) => section.points > 0);
  const simpleCompletionSections = scoredSections.filter((section) => !isPartialSection(section));

  return simpleCompletionSections.length === 1 ? simpleCompletionSections[0] : null;
}

function isPartialSection(section: ProgramSection): boolean {
  return Boolean(section.completionItems?.length || (section.maxCompletions && section.maxCompletions > 1));
}
