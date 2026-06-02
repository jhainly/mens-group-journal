"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { getProgramDayLabel } from "@/lib/programDays";
import type { DayProgress } from "@/lib/scoring";
import type { Program } from "@/types/program";

type ProgramNavigatorProps = {
  action?: ReactNode;
  dayProgress?: DayProgress[];
  onSelectedWeekNumberChange: (weekNumber: number) => void;
  program: Program;
  selectedWeekNumber: number;
};

export function ProgramNavigator({ action, dayProgress = [], onSelectedWeekNumberChange, program, selectedWeekNumber }: ProgramNavigatorProps) {
  const selectedWeek = useMemo(
    () => program.weeks.find((week) => week.weekNumber === selectedWeekNumber) ?? program.weeks[0],
    [program.weeks, selectedWeekNumber]
  );
  const selectedWeekPoints =
    selectedWeek?.days.reduce(
      (weekTotal, day) => weekTotal + day.sections.reduce((dayTotal, section) => dayTotal + section.points, 0),
      0
    ) ?? 0;

  if (!selectedWeek) {
    return null;
  }

  return (
    <section className="panel stack">
      <div className="row">
        <div>
          <h2>{selectedWeek.title}</h2>
          {selectedWeek.summary ? <p className="muted">{selectedWeek.summary}</p> : null}
        </div>
        <div className="row">
          {action ?? null}
          {program.weeks.length > 1 ? (
            <label className="field compact-field">
              <span>Week</span>
              <select
                value={selectedWeekNumber}
                onChange={(event) => onSelectedWeekNumberChange(Number(event.target.value))}
              >
                {program.weeks.map((week) => (
                  <option key={week.weekNumber} value={week.weekNumber}>
                    Week {week.weekNumber}: {week.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </div>

      <div className="section-block stack">
        <div className="grid two">
          <div className="metric">
            <span>Days</span>
            <strong>{selectedWeek.days.length}</strong>
          </div>
          <div className="metric">
            <span>Available points</span>
            <strong>{selectedWeekPoints}</strong>
          </div>
        </div>

        <ul className="list">
          {selectedWeek.days.map((day) => {
            const progress = dayProgress.find((d) => d.dayNumber === day.dayNumber);
            const pct = progress && progress.maxPoints > 0
              ? Math.round((progress.pointsEarned / progress.maxPoints) * 100)
              : 0;
            return (
              <li className="card" key={day.dayNumber}>
                <div className="day-card-row">
                  <span>{getProgramDayLabel(day.dayNumber)}: <strong>{day.title}</strong></span>
                  <Link className="button secondary" href={`/program/week/${selectedWeek.weekNumber}/day/${day.dayNumber}`}>
                    Open
                  </Link>
                </div>
                {progress ? (
                  <div className="day-progress">
                    <div className="day-progress-track">
                      <div className="day-progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="day-progress-label">{progress.pointsEarned}/{progress.maxPoints} pts</span>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
