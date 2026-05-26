"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { getProgramDayLabel } from "@/lib/programDays";
import type { Program } from "@/types/program";

type ProgramNavigatorProps = {
  action?: ReactNode;
  onSelectedWeekNumberChange: (weekNumber: number) => void;
  program: Program;
  selectedWeekNumber: number;
};

export function ProgramNavigator({ action, onSelectedWeekNumberChange, program, selectedWeekNumber }: ProgramNavigatorProps) {
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
          <p className="eyebrow">Program</p>
          <h2>Choose a week</h2>
          <p>Select one week to review its days and continue at your own pace.</p>
        </div>
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
      </div>

      <div className="section-block stack">
        <div>
          <p className="eyebrow">
            Week {selectedWeek.weekNumber} of {program.weeks.length}
          </p>
          <h2>{selectedWeek.title}</h2>
          {selectedWeek.summary ? <p>{selectedWeek.summary}</p> : null}
        </div>
        {action ? <div>{action}</div> : null}

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
          {selectedWeek.days.map((day) => (
            <li className="card row" key={day.dayNumber}>
              <span>
                {getProgramDayLabel(day.dayNumber)}: <strong>{day.title}</strong>
              </span>
              <Link className="button secondary" href={`/program/week/${selectedWeek.weekNumber}/day/${day.dayNumber}`}>
                Open
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
