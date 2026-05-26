"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { JournalExportButton } from "@/components/JournalExportButton";
import { ProgramNavigator } from "@/components/ProgramNavigator";
import { resolveSelectedGroup, setSelectedGroupId } from "@/lib/groupSelection";
import {
  getCurrentUserScoreSummary,
  listCurrentUserGroups,
  type UserGroupSummary
} from "@/lib/services/dataClient";
import type { ScoreSummary } from "@/lib/scoring";
import type { Program } from "@/types/program";

type DashboardProps = {
  initialWeekNumber: number;
  program: Program;
};

export function Dashboard({ initialWeekNumber, program }: DashboardProps) {
  const [selectedWeekNumber, setSelectedWeekNumber] = useState(initialWeekNumber);
  const [scores, setScores] = useState<ScoreSummary>(() => getEmptyScores(program, initialWeekNumber));
  const [groups, setGroups] = useState<UserGroupSummary[]>([]);
  const [activeGroup, setActiveGroup] = useState<UserGroupSummary | null>(null);
  const [groupStatus, setGroupStatus] = useState("Loading group...");
  const [status, setStatus] = useState("Loading scores...");

  useEffect(() => {
    let cancelled = false;

    setGroupStatus("Loading group...");

    void listCurrentUserGroups().then((result) => {
      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setGroupStatus(result.error);
        setStatus("");
        return;
      }

      const selectedGroup = resolveSelectedGroup(result.data);
      setGroups(result.data);
      setActiveGroup(selectedGroup);

      if (selectedGroup) {
        setSelectedGroupId(selectedGroup.groupId);
        setGroupStatus("");
      } else {
        setGroupStatus("Join a group to start tracking progress.");
        setStatus("");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!activeGroup) {
      return () => {
        cancelled = true;
      };
    }

    setStatus("Loading scores...");
    setScores((current) => ({
      ...current,
      weeklyScore: 0,
      maxWeeklyScore: getMaxWeeklyScore(program, selectedWeekNumber)
    }));

    void getCurrentUserScoreSummary({
      groupId: activeGroup.groupId,
      program,
      activeWeekNumber: selectedWeekNumber
    }).then((result) => {
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
  }, [activeGroup, program, selectedWeekNumber]);

  function changeGroup(groupId: string) {
    const nextGroup = groups.find((group) => group.groupId === groupId) ?? null;

    if (!nextGroup) {
      return;
    }

    setSelectedGroupId(nextGroup.groupId);
    setActiveGroup(nextGroup);
  }

  return (
    <div className="stack">
      <section className="panel stack">
        <div>
          <p className="eyebrow">Current group</p>
          <h1>{activeGroup?.name ?? "No group selected"}</h1>
          <p>{program.program.title}: {program.program.description}</p>
        </div>
        {groups.length > 1 ? (
          <label className="field compact-field">
            <span>Group</span>
            <select value={activeGroup?.groupId ?? ""} onChange={(event) => changeGroup(event.target.value)}>
              {groups.map((group) => (
                <option key={group.groupId} value={group.groupId}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
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
        {!activeGroup ? (
          <div className="row">
            <Link className="button" href="/join">
              Join group
            </Link>
          </div>
        ) : null}
        {groupStatus ? <p className="muted">{groupStatus}</p> : null}
        {status ? <p className="muted">{status}</p> : null}
      </section>
      <ProgramNavigator
        action={
          activeGroup ? (
            <JournalExportButton
              groupId={activeGroup.groupId}
              groupName={activeGroup.name}
              program={program}
              weekNumber={selectedWeekNumber}
            />
          ) : null
        }
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
