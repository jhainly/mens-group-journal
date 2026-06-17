"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatPoints } from "@/lib/format";
import { resolveSelectedGroup, setSelectedGroupId } from "@/lib/groupSelection";
import {
  listCurrentUserGroups,
  listLeaderboard,
  loadActiveProgramForGroup,
  type LeaderboardRow,
  type UserGroupSummary
} from "@/lib/services/dataClient";
import type { Program } from "@/types/program";

type LeaderboardView = "weekly" | "allTime";
type WeekOption = {
  title: string;
  weekNumber: number;
};

export function Leaderboard() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [view, setView] = useState<LeaderboardView>("weekly");
  const [groups, setGroups] = useState<UserGroupSummary[]>([]);
  const [activeGroup, setActiveGroup] = useState<UserGroupSummary | null>(null);
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

    setRows([]);
    setActiveWeekNumber(null);
    setWeekOptions([]);
    setStatus("Loading weeks...");

    void loadActiveProgramForGroup(activeGroup.groupId).then((programResult) => {
      if (cancelled) {
        return;
      }

      if (!programResult.ok) {
        setActiveWeekNumber(null);
        setWeekOptions([]);
        setRows([]);
        setStatus("Your leader has not published content for this group yet.");
        return;
      }

      const weeks = getWeekOptions(programResult.data.program);

      setWeekOptions(weeks);
      setActiveWeekNumber(weeks.at(-1)?.weekNumber ?? null);
      setStatus("");
    });

    return () => {
      cancelled = true;
    };
  }, [activeGroup]);

  useEffect(() => {
    let cancelled = false;

    if (!activeGroup || activeWeekNumber == null) {
      return () => {
        cancelled = true;
      };
    }

    setRows([]);
    setStatus("Loading scores...");

    void listLeaderboard({
      groupId: activeGroup.groupId,
      weekNumber: activeWeekNumber
    }).then((leaderboardResult) => {
      if (cancelled) {
        return;
      }

      if (!leaderboardResult.ok) {
        setStatus(leaderboardResult.error);
        return;
      }

      setRows(leaderboardResult.data);
      setStatus("");
    });

    return () => {
      cancelled = true;
    };
  }, [activeGroup, activeWeekNumber]);

  function changeGroup(groupId: string) {
    const nextGroup = groups.find((group) => group.groupId === groupId) ?? null;

    if (!nextGroup) {
      return;
    }

    setSelectedGroupId(nextGroup.groupId);
    setActiveGroup(nextGroup);
    setActiveWeekNumber(null);
    setWeekOptions([]);
    setRows([]);
  }

  return (
    <section className="panel stack">
      <h1>Leaderboard</h1>
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
                    Week {week.weekNumber}: {week.title}
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
      {rows.length > 0 ? (
        <ul className="list">
          {getSortedRows(rows, view).map((row, index) => (
            <li className="card row" key={row.displayName}>
              <div className="row">
                <span className="leaderboard-rank">{index + 1}</span>
                <strong>{row.displayName}</strong>
              </div>
              <span>{formatPoints(getRowScore(row, view))}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">{status || "No scores yet."}</p>
      )}
    </section>
  );
}

function getRowScore(row: LeaderboardRow, view: LeaderboardView): number {
  return view === "weekly" ? row.weeklyScore : row.cumulativeScore;
}

function getSortedRows(rows: LeaderboardRow[], view: LeaderboardView): LeaderboardRow[] {
  return [...rows].sort(
    (left, right) => getRowScore(right, view) - getRowScore(left, view) || left.displayName.localeCompare(right.displayName)
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
