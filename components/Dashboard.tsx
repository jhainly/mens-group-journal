"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { JournalExportButton } from "@/components/JournalExportButton";
import { ProgramNavigator } from "@/components/ProgramNavigator";
import { resolveSelectedGroup, setSelectedGroupId } from "@/lib/groupSelection";
import {
  getCurrentUserScoreSummary,
  listCurrentUserGroups,
  loadActiveProgramForGroup,
  type UserGroupSummary
} from "@/lib/services/dataClient";
import type { ScoreSummary } from "@/lib/scoring";
import type { Program } from "@/types/program";

type DashboardProps = {
  initialWeekNumber: number;
};

export function Dashboard({ initialWeekNumber }: DashboardProps) {
  const [selectedWeekNumber, setSelectedWeekNumber] = useState(initialWeekNumber);
  const [program, setProgram] = useState<Program | null>(null);
  const [scores, setScores] = useState<ScoreSummary>(() => getEmptyScores(null, initialWeekNumber));
  const [groups, setGroups] = useState<UserGroupSummary[]>([]);
  const [activeGroup, setActiveGroup] = useState<UserGroupSummary | null>(null);
  const [groupStatus, setGroupStatus] = useState("Loading group...");
  const [programStatus, setProgramStatus] = useState("Loading program...");
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
        setGroupStatus("You need a group code from your leader before your dashboard can show program content.");
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
      setProgram(null);
      setProgramStatus("");
      return () => {
        cancelled = true;
      };
    }

    setProgram(null);
    setProgramStatus("Loading program...");
    setStatus("");

    void loadActiveProgramForGroup(activeGroup.groupId).then((result) => {
      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setScores(getEmptyScores(null, initialWeekNumber));
        setProgramStatus("Your leader has not published content for this group yet.");
        return;
      }

      const activeProgram = result.data.program;

      setProgram(activeProgram);
      setProgramStatus("");
      setSelectedWeekNumber((currentWeekNumber) =>
        activeProgram.weeks.some((week) => week.weekNumber === currentWeekNumber)
          ? currentWeekNumber
          : activeProgram.weeks[0]?.weekNumber ?? 1
      );
    });

    return () => {
      cancelled = true;
    };
  }, [activeGroup, initialWeekNumber]);

  useEffect(() => {
    let cancelled = false;

    if (!activeGroup || !program) {
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
          <h1>{activeGroup?.name ?? "Join a group"}</h1>
          {program ? <p className="muted">{program.program.title}{program.program.description ? `: ${program.program.description}` : ""}</p> : null}
          {activeGroup && !program ? <p className="muted">Your leader hasn&apos;t published content for this group yet.</p> : null}
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
        {programStatus ? <p className="muted">{programStatus}</p> : null}
        {status ? <p className="muted">{status}</p> : null}
      </section>
      {program ? (
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
      ) : null}
    </div>
  );
}

function getEmptyScores(program: Program | null, activeWeekNumber: number): ScoreSummary {
  let maxWeeklyScore = 0;
  let maxCumulativeScore = 0;

  for (const week of program?.weeks ?? []) {
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
