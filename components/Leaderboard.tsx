"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatPoints } from "@/lib/format";
import { resolveSelectedGroup, setSelectedGroupId } from "@/lib/groupSelection";
import {
  listCurrentUserGroups,
  listLeaderboard,
  type UserGroupSummary
} from "@/lib/services/dataClient";

export function Leaderboard() {
  const [rows, setRows] = useState<Array<{ displayName: string; score: number }>>([]);
  const [groups, setGroups] = useState<UserGroupSummary[]>([]);
  const [activeGroup, setActiveGroup] = useState<UserGroupSummary | null>(null);
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

    setStatus("Loading scores...");

    void listLeaderboard(activeGroup.groupId).then((result) => {
      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setStatus(result.error);
        return;
      }

      setRows(result.data);
      setStatus("");
    });

    return () => {
      cancelled = true;
    };
  }, [activeGroup]);

  function changeGroup(groupId: string) {
    const nextGroup = groups.find((group) => group.groupId === groupId) ?? null;

    if (!nextGroup) {
      return;
    }

    setSelectedGroupId(nextGroup.groupId);
    setActiveGroup(nextGroup);
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
      {!activeGroup ? (
        <div className="row">
          <Link className="button" href="/join">
            Join group
          </Link>
        </div>
      ) : null}
      {rows.length > 0 ? (
        <ul className="list">
          {rows.map((row, index) => (
            <li className="card row" key={row.displayName}>
              <div className="row">
                <span className="leaderboard-rank">{index + 1}</span>
                <strong>{row.displayName}</strong>
              </div>
              <span>{formatPoints(row.score)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">{status || "No scores yet."}</p>
      )}
    </section>
  );
}
