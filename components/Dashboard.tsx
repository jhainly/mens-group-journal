"use client";

import { useEffect, useState } from "react";
import { ProgramNavigator } from "@/components/ProgramNavigator";
import { getCurrentUserScoreSummary } from "@/lib/services/dataClient";
import type { ScoreSummary } from "@/lib/scoring";
import type { Program } from "@/types/program";

type DashboardProps = {
  groupId: string;
  initialWeekNumber: number;
  program: Program;
};

export function Dashboard({ groupId, initialWeekNumber, program }: DashboardProps) {
  const [selectedWeekNumber, setSelectedWeekNumber] = useState(initialWeekNumber);
  const [scores, setScores] = useState<ScoreSummary>(() => getEmptyScores(program, initialWeekNumber));
  const [status, setStatus] = useState("Loading scores...");

  useEffect(() => {
    let cancelled = false;

    setStatus("Loading scores...");
    setScores((current) => ({
      ...current,
      weeklyScore: 0,
      maxWeeklyScore: getMaxWeeklyScore(program, selectedWeekNumber)
    }));

    void getCurrentUserScoreSummary({ groupId, program, activeWeekNumber: selectedWeekNumber }).then((result) => {
      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setStatus(result.error);
        return;
      }

      setScores(result.data);
      setStatus("");
    });

    return () => {
      cancelled = true;
    };
  }, [groupId, program, selectedWeekNumber]);

  return (
    <div className="stack">
      <section className="panel stack">
        <div>
          <p className="eyebrow">Current group</p>
          <h1>{program.program.title}</h1>
          <p>{program.program.description}</p>
        </div>
        <div className="grid two">
          <div className="metric">
            <span>Weekly score</span>
            <strong>{scores.weeklyScore}/{scores.maxWeeklyScore}</strong>
          </div>
          <div className="metric">
            <span>Cumulative score</span>
            <strong>{scores.cumulativeScore}/{scores.maxCumulativeScore}</strong>
          </div>
        </div>
        {status ? <p className="muted">{status}</p> : null}
      </section>
      <ProgramNavigator
        onSelectedWeekNumberChange={setSelectedWeekNumber}
        program={program}
        selectedWeekNumber={selectedWeekNumber}
      />
    </div>
  );
}

function getEmptyScores(program: Program, activeWeekNumber: number): ScoreSummary {
  let maxWeeklyScore = 0;
  let maxCumulativeScore = 0;

  for (const week of program.weeks) {
    for (const day of week.days) {
      for (const section of day.sections) {
        maxCumulativeScore += section.points;

        if (week.weekNumber === activeWeekNumber) {
          maxWeeklyScore += section.points;
        }
      }
    }
  }

  return {
    weeklyScore: 0,
    cumulativeScore: 0,
    maxWeeklyScore,
    maxCumulativeScore
  };
}

function getMaxWeeklyScore(program: Program, activeWeekNumber: number): number {
  return (
    program.weeks
      .find((week) => week.weekNumber === activeWeekNumber)
      ?.days.reduce(
        (weekTotal, day) => weekTotal + day.sections.reduce((dayTotal, section) => dayTotal + section.points, 0),
        0
      ) ?? 0
  );
}
