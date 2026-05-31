"use client";

import { useCallback, useEffect, useState } from "react";
import { setSelectedGroupId } from "@/lib/groupSelection";
import {
  listActiveProgramWeeksForGroups,
  listProgramWeekAssignments,
  removeWeekFromGroups,
  type ActiveProgramWeekSummary,
  type AdminGroupSummary,
  type ProgramWeekAssignment
} from "@/lib/services/dataClient";

export function ProgramManagementPanel({
  groups,
  onProgramChanged
}: {
  groups: AdminGroupSummary[];
  onProgramChanged: () => void;
}) {
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(groups[0] ? [groups[0].groupId] : []);
  const [activeWeeks, setActiveWeeks] = useState<ActiveProgramWeekSummary[]>([]);
  const [assignments, setAssignments] = useState<ProgramWeekAssignment[]>([]);
  const [status, setStatus] = useState(groups.length > 0 ? "Loading assigned weeks..." : "Create a group before managing programs.");
  const [assignmentStatus, setAssignmentStatus] = useState("Loading group assignments...");
  const [message, setMessage] = useState("");
  const [removingKey, setRemovingKey] = useState("");
  const primaryGroupId = selectedGroupIds[0] ?? "";

  const refreshActiveWeeks = useCallback(async (groupIds = selectedGroupIds) => {
    setStatus("Loading assigned weeks...");
    setMessage("");
    const result = await listActiveProgramWeeksForGroups(groupIds);

    if (!result.ok) {
      setActiveWeeks([]);
      setStatus(result.error);
      return;
    }

    setActiveWeeks(result.data);
    setStatus(result.data.length > 0 ? "" : "No weeks are assigned to the selected groups.");
  }, [selectedGroupIds]);

  const refreshAssignments = useCallback(async () => {
    if (groups.length === 0) {
      setAssignments([]);
      setAssignmentStatus("Create a group before managing programs.");
      return;
    }

    setAssignmentStatus("Loading group assignments...");
    const result = await listProgramWeekAssignments(groups);

    if (!result.ok) {
      setAssignments([]);
      setAssignmentStatus(result.error);
      return;
    }

    setAssignments(result.data);
    setAssignmentStatus(result.data.length > 0 ? "" : "No groups found.");
  }, [groups]);

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
      void refreshAssignments();
      return;
    }

    void refreshActiveWeeks(selectedGroupIds);
    void refreshAssignments();
  }, [primaryGroupId, groups.length, refreshActiveWeeks, refreshAssignments, selectedGroupIds]);

  async function refreshAll() {
    await refreshActiveWeeks(selectedGroupIds);
    await refreshAssignments();
  }

  async function removeWeekFromSelectedGroups(weekNumber: number) {
    if (selectedGroupIds.length === 0) {
      return;
    }

    const week = activeWeeks.find((candidate) => candidate.weekNumber === weekNumber);
    const label = week ? `Week ${week.weekNumber}: ${week.title}` : `Week ${weekNumber}`;
    const groupLabel = selectedGroupIds.length === 1 ? getGroupName(selectedGroupIds[0]) : `${selectedGroupIds.length} selected groups`;

    if (!window.confirm(`Remove ${label} from ${groupLabel}?`)) {
      return;
    }

    await removeWeek({
      groupIds: selectedGroupIds,
      key: `selected:${weekNumber}`,
      weekNumber
    });
  }

  async function removeWeekFromGroup(input: {
    groupId: string;
    groupName: string;
    title: string;
    weekNumber: number;
  }) {
    if (!window.confirm(`Remove Week ${input.weekNumber}: ${input.title} from ${input.groupName}?`)) {
      return;
    }

    await removeWeek({
      groupIds: [input.groupId],
      key: `${input.groupId}:${input.weekNumber}`,
      weekNumber: input.weekNumber
    });
  }

  async function removeWeek(input: {
    groupIds: string[];
    key: string;
    weekNumber: number;
  }) {
    setMessage("");
    setRemovingKey(input.key);
    const result = await removeWeekFromGroups({ groupIds: input.groupIds, weekNumber: input.weekNumber });
    setRemovingKey("");

    if (!result.ok) {
      setMessage(result.error);
      return;
    }

    setMessage(result.data);
    await refreshAll();
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

  function getGroupName(groupId: string): string {
    return groups.find((group) => group.groupId === groupId)?.name ?? "this group";
  }

  return (
    <section className="panel stack">
      <div className="row">
        <div>
          <p className="eyebrow">Assignments</p>
          <h2>Weeks assigned to groups</h2>
          <p>Review which weeks are active for each group and remove weeks that should no longer be available.</p>
        </div>
        <button className="button secondary" onClick={() => void refreshAll()} type="button">
          Refresh
        </button>
      </div>

      {groups.length > 0 ? (
        <fieldset className="field">
          <span>Bulk remove from selected groups</span>
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

      {activeWeeks.length > 0 ? (
        <section className="section-block stack">
          <div>
            <h3>Selected group actions</h3>
            <p className="muted">
              Remove a week from {selectedGroupIds.length} selected {selectedGroupIds.length === 1 ? "group" : "groups"}.
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
                  disabled={selectedGroupIds.length === 0 || removingKey === `selected:${week.weekNumber}`}
                  onClick={() => void removeWeekFromSelectedGroups(week.weekNumber)}
                  type="button"
                >
                  {removingKey === `selected:${week.weekNumber}` ? "Removing..." : "Remove from selected"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="muted">{status}</p>
      )}

      <section className="section-block stack">
        <div>
          <h3>Group-by-group assignments</h3>
          <p className="muted">Each group lists the active weeks currently available to its members.</p>
        </div>
        {assignments.length > 0 ? (
          <ul className="list">
            {assignments.map((assignment) => (
              <li className="card stack" key={assignment.groupId}>
                <div className="row">
                  <div>
                    <h3>{assignment.groupName}</h3>
                    <p className="muted">
                      {assignment.weeks.length} active {assignment.weeks.length === 1 ? "week" : "weeks"}
                    </p>
                  </div>
                </div>
                {assignment.weeks.length > 0 ? (
                  <ul className="assignment-week-list">
                    {assignment.weeks.map((week) => (
                      <li className="assignment-week-row" key={`${assignment.groupId}:${week.weekNumber}`}>
                        <div>
                          <strong>Week {week.weekNumber}: {week.title}</strong>
                          <p className="muted">Published {formatDate(week.publishedAt)}</p>
                        </div>
                        <button
                          className="button secondary"
                          disabled={removingKey === `${assignment.groupId}:${week.weekNumber}`}
                          onClick={() =>
                            void removeWeekFromGroup({
                              groupId: assignment.groupId,
                              groupName: assignment.groupName,
                              title: week.title,
                              weekNumber: week.weekNumber
                            })
                          }
                          type="button"
                        >
                          {removingKey === `${assignment.groupId}:${week.weekNumber}` ? "Removing..." : "Remove"}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No active weeks assigned.</p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{assignmentStatus}</p>
        )}
      </section>

      {message ? <p>{message}</p> : null}
    </section>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium"
  }).format(new Date(value));
}
