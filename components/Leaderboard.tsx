"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatPoints } from "@/lib/format";
import { getGroupDisplayName, resolveSelectedGroup, setSelectedGroupId } from "@/lib/groupSelection";
import { getProgramWeekDisplayName } from "@/lib/programDays";
import {
  listCurrentUserGroups,
  listLeaderboard,
  loadActiveProgramForGroup,
  type LeaderboardRow,
  type TeamLeaderboardRow,
  type UserGroupSummary
} from "@/lib/services/dataClient";
import type { Program } from "@/types/program";

type LeaderboardView = "weekly" | "allTime";
type WeekOption = {
  title: string;
  weekNumber: number;
};

export function Leaderboard() {
  const [individualRows, setIndividualRows] = useState<LeaderboardRow[]>([]);
  const [teamRows, setTeamRows] = useState<TeamLeaderboardRow[]>([]);
  const [view, setView] = useState<LeaderboardView>("weekly");
  const [groups, setGroups] = useState<UserGroupSummary[]>([]);
  const [activeGroup, setActiveGroup] = useState<UserGroupSummary | null>(null);
  const [activeProgramId, setActiveProgramId] = useState<string | null>(null);
  const [activeProgramTitle, setActiveProgramTitle] = useState("");
  const [activeWeekNumber, setActiveWeekNumber] = useState<number | null>(null);
  const [weekOptions, setWeekOptions] = useState<WeekOption[]>([]);
  const [status, setStatus] = useState("Loading group...");

  useEffect(() => {
    let cancelled = false;

    void listCurrentUserGroups().then((result) => {
      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setStatus(result.error);
        return;
      }

      const selectedGroup = resolveSelectedGroup(result.data);
      setGroups(result.data);
      setActiveGroup(selectedGroup);

      if (selectedGroup) {
        setSelectedGroupId(selectedGroup.groupId);
      } else {
        setStatus("Join a group to see scores.");
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

    setIndividualRows([]);
    setTeamRows([]);
    setActiveProgramId(null);
    setActiveProgramTitle("");
    setActiveWeekNumber(null);
    setWeekOptions([]);
    setStatus("Loading weeks...");

    void loadActiveProgramForGroup(activeGroup.groupId).then((programResult) => {
      if (cancelled) {
        return;
      }

      if (!programResult.ok) {
        setActiveWeekNumber(null);
        setActiveProgramId(null);
        setActiveProgramTitle("");
        setWeekOptions([]);
        setIndividualRows([]);
        setTeamRows([]);
        setStatus("Your leader has not published content for this group yet.");
        return;
      }

      const weeks = getWeekOptions(programResult.data.program);

      setWeekOptions(weeks);
      setActiveProgramId(programResult.data.programId);
      setActiveProgramTitle(programResult.data.program.program.title);
      setActiveWeekNumber(weeks.at(-1)?.weekNumber ?? null);
      setStatus("");
    });

    return () => {
      cancelled = true;
    };
  }, [activeGroup]);

  useEffect(() => {
    let cancelled = false;

    if (!activeGroup || !activeProgramId || activeWeekNumber == null) {
      return () => {
        cancelled = true;
      };
    }

    setIndividualRows([]);
    setTeamRows([]);
    setStatus("Loading scores...");

    void listLeaderboard({
      groupId: activeGroup.groupId,
      programId: activeProgramId,
      programTitle: activeProgramTitle,
      weekNumber: activeWeekNumber
    }).then((leaderboardResult) => {
      if (cancelled) {
        return;
      }

      if (!leaderboardResult.ok) {
        setStatus(leaderboardResult.error);
        return;
      }

      setIndividualRows(leaderboardResult.data.individualRows);
      setTeamRows(leaderboardResult.data.teamRows);
      setStatus("");
    });

    return () => {
      cancelled = true;
    };
  }, [activeGroup, activeProgramId, activeProgramTitle, activeWeekNumber]);

  function changeGroup(groupId: string) {
    const nextGroup = groups.find((group) => group.groupId === groupId) ?? null;

    if (!nextGroup) {
      return;
    }

    setSelectedGroupId(nextGroup.groupId);
    setActiveGroup(nextGroup);
    setActiveProgramId(null);
    setActiveProgramTitle("");
    setActiveWeekNumber(null);
    setWeekOptions([]);
    setIndividualRows([]);
    setTeamRows([]);
  }

  return (
    <section className="panel stack">
      <h1>Leaderboard</h1>
      {groups.length > 1 ? (
        <label className="field compact-field">
          <span>Program</span>
          <select value={activeGroup?.groupId ?? ""} onChange={(event) => changeGroup(event.target.value)}>
            {groups.map((group) => (
              <option key={group.groupId} value={group.groupId}>
                {getGroupDisplayName(group)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {activeGroup ? (
        <div className="row wrap">
          <div className="segmented-control" aria-label="Leaderboard view">
            <button
              aria-pressed={view === "weekly"}
              className={view === "weekly" ? "active" : ""}
              onClick={() => setView("weekly")}
              type="button"
            >
              Weekly
            </button>
            <button
              aria-pressed={view === "allTime"}
              className={view === "allTime" ? "active" : ""}
              onClick={() => setView("allTime")}
              type="button"
            >
              All time
            </button>
          </div>
          {view === "weekly" && weekOptions.length > 0 ? (
            <div className="week-select-pill">
              <select
                className="week-select"
                value={activeWeekNumber ?? ""}
                onChange={(event) => setActiveWeekNumber(Number(event.target.value))}
              >
                {weekOptions.map((week) => (
                  <option key={week.weekNumber} value={week.weekNumber}>
                    {getProgramWeekDisplayName(week)}
                  </option>
                ))}
              </select>
              <svg
                aria-hidden="true"
                fill="none"
                height="14"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                style={{ pointerEvents: "none", flexShrink: 0 }}
                viewBox="0 0 24 24"
                width="14"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          ) : null}
        </div>
      ) : null}
      {!activeGroup ? (
        <div className="row">
          <Link className="button" href="/join">
            Join group
          </Link>
        </div>
      ) : null}
      {status ? <p className="muted">{status}</p> : null}
      {activeGroup && !status ? (
        <div className="grid two leaderboard-grid">
          <LeaderboardList
            emptyMessage="No group member scores yet."
            rows={getSortedRows(individualRows, view)}
            title="My Group's Leaderboard"
            view={view}
          />
          <LeaderboardList
            emptyMessage="No group scores yet."
            rows={getSortedTeamRows(teamRows, view)}
            title="Group Leaderboard"
            view={view}
          />
        </div>
      ) : null}
    </section>
  );
}

function LeaderboardList({
  emptyMessage,
  rows,
  title,
  view
}: {
  emptyMessage: string;
  rows: Array<LeaderboardRow | TeamLeaderboardRow>;
  title: string;
  view: LeaderboardView;
}) {
  return (
    <section className="leaderboard-list stack">
      <h2>{title}</h2>
      {rows.length > 0 ? (
        <ul className="list">
          {rows.map((row, index) => (
            <li className="card leaderboard-row" key={getLeaderboardRowKey(row)}>
              <span className="leaderboard-rank">{index + 1}</span>
              <strong className="leaderboard-name">{getLeaderboardRowName(row)}</strong>
              <span className="leaderboard-score">{formatPoints(getRowScore(row, view))}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">{emptyMessage}</p>
      )}
    </section>
  );
}

function getRowScore(row: Pick<LeaderboardRow, "cumulativeScore" | "weeklyScore">, view: LeaderboardView): number {
  return view === "weekly" ? row.weeklyScore : row.cumulativeScore;
}

function getLeaderboardRowKey(row: LeaderboardRow | TeamLeaderboardRow): string {
  return "groupId" in row ? row.groupId : row.displayName;
}

function getLeaderboardRowName(row: LeaderboardRow | TeamLeaderboardRow): string {
  return "groupName" in row ? row.groupName : row.displayName;
}

function getSortedRows(rows: LeaderboardRow[], view: LeaderboardView): LeaderboardRow[] {
  return [...rows].sort(
    (left, right) => getRowScore(right, view) - getRowScore(left, view) || left.displayName.localeCompare(right.displayName)
  );
}

function getSortedTeamRows(rows: TeamLeaderboardRow[], view: LeaderboardView): TeamLeaderboardRow[] {
  return [...rows].sort(
    (left, right) => getRowScore(right, view) - getRowScore(left, view) || left.groupName.localeCompare(right.groupName)
  );
}

function getWeekOptions(program: Program): WeekOption[] {
  return [...program.weeks]
    .sort((left, right) => left.weekNumber - right.weekNumber)
    .map((week) => ({
      title: week.title,
      weekNumber: week.weekNumber
    }));
}
