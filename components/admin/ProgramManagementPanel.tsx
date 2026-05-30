"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { setSelectedGroupId } from "@/lib/groupSelection";
import {
  listActiveProgramWeeksForGroups,
  removeWeekFromGroups,
  type ActiveProgramWeekSummary,
  type AdminGroupSummary
} from "@/lib/services/dataClient";

export function ProgramManagementPanel({ groups, onProgramChanged }: {
  groups: AdminGroupSummary[];
  onProgramChanged: () => void;
}) {
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(groups[0] ? [groups[0].groupId] : []);
  const [activeWeeks, setActiveWeeks] = useState<ActiveProgramWeekSummary[]>([]);
  const [status, setStatus] = useState(groups.length > 0 ? "Loading active weeks..." : "Create a group before managing programs.");
  const [message, setMessage] = useState("");
  const [removingWeekNumber, setRemovingWeekNumber] = useState<number | null>(null);
  const primaryGroupId = selectedGroupIds[0] ?? "";

  const refreshActiveWeeks = useCallback(async (groupIds = selectedGroupIds) => {
    setStatus("Loading active weeks...");
    setMessage("");
    const result = await listActiveProgramWeeksForGroups(groupIds);

    if (!result.ok) {
      setActiveWeeks([]);
      setStatus(result.error);
      return;
    }

    setActiveWeeks(result.data);
    setStatus(result.data.length > 0 ? "" : "No active weeks were found for the selected groups.");
  }, [selectedGroupIds]);

  useEffect(() => {
    setSelectedGroupIds((current) => {
      const availableGroupIds = new Set(groups.map((group) => group.groupId));
      const next = current.filter((groupId) => availableGroupIds.has(groupId));
      return next.length > 0 ? next : groups[0] ? [groups[0].groupId] : [];
    });
  }, [groups]);

  useEffect(() => {
    if (!primaryGroupId) {
      setActiveWeeks([]);
      setStatus(groups.length > 0 ? "Choose at least one group." : "Create a group before managing programs.");
      return;
    }

    void refreshActiveWeeks(selectedGroupIds);
  }, [primaryGroupId, groups.length, refreshActiveWeeks, selectedGroupIds]);

  async function removeWeek(weekNumber: number) {
    if (selectedGroupIds.length === 0) {
      return;
    }

    const week = activeWeeks.find((candidate) => candidate.weekNumber === weekNumber);
    const label = week ? `Week ${week.weekNumber}: ${week.title}` : `Week ${weekNumber}`;

    const groupLabel = selectedGroupIds.length === 1 ? "this group" : `${selectedGroupIds.length} groups`;

    if (!window.confirm(`Remove ${label} from ${groupLabel}?`)) {
      return;
    }

    setMessage("");
    setRemovingWeekNumber(weekNumber);
    const result = await removeWeekFromGroups({ groupIds: selectedGroupIds, weekNumber });
    setRemovingWeekNumber(null);

    if (!result.ok) {
      setMessage(result.error);
      return;
    }

    setMessage(result.data);
    await refreshActiveWeeks(selectedGroupIds);
    onProgramChanged();
  }

  function toggleGroup(groupId: string, checked: boolean) {
    setSelectedGroupIds((current) => {
      const next = checked
        ? Array.from(new Set([...current, groupId]))
        : current.filter((candidate) => candidate !== groupId);

      if (next[0]) {
        setSelectedGroupId(next[0]);
      }

      return next;
    });
  }

  return (
    <section className="panel stack">
      <div>
        <p className="eyebrow">Programs</p>
        <h2>Program management</h2>
        <p>Import new weeks and choose which weeks are currently available to the group.</p>
      </div>

      {groups.length > 0 ? (
        <fieldset className="field">
          <span>Groups</span>
          <div className="stack compact-stack">
            {groups.map((group) => (
              <label className="checkbox-row" key={group.groupId}>
                <input
                  checked={selectedGroupIds.includes(group.groupId)}
                  onChange={(event) => toggleGroup(group.groupId, event.target.checked)}
                  type="checkbox"
                />
                <span>{group.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="row">
        <Link className="button" href="/admin/import" onClick={() => primaryGroupId && setSelectedGroupId(primaryGroupId)}>
          Import new weeks
        </Link>
        <button className="button secondary" onClick={() => void refreshActiveWeeks()} type="button" disabled={!primaryGroupId}>
          Refresh
        </button>
      </div>

      {activeWeeks.length > 0 ? (
        <div className="stack">
          <div>
            <h3>Active weeks</h3>
            <p className="muted">
              Showing weeks assigned to {selectedGroupIds.length} selected {selectedGroupIds.length === 1 ? "group" : "groups"}.
            </p>
          </div>
          <ul className="list">
            {activeWeeks.map((week) => (
              <li className="card row" key={week.weekNumber}>
                <div>
                  <h3>Week {week.weekNumber}: {week.title}</h3>
                  <p className="muted">
                    Active in {week.groupCount} selected {week.groupCount === 1 ? "group" : "groups"}.
                  </p>
                </div>
                <button
                  className="button secondary"
                  disabled={selectedGroupIds.length === 0 || removingWeekNumber === week.weekNumber}
                  onClick={() => void removeWeek(week.weekNumber)}
                  type="button"
                >
                  {removingWeekNumber === week.weekNumber ? "Removing..." : "Remove week"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="muted">{status}</p>
      )}

      {message ? <p>{message}</p> : null}
    </section>
  );
}
