"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  listProgramWeekAssignments,
  setProgramWeekVisibility,
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
  const [assignments, setAssignments] = useState<ProgramWeekAssignment[]>([]);
  const [assignmentStatus, setAssignmentStatus] = useState("Loading group assignments...");
  const [message, setMessage] = useState("");
  const [visibilityKey, setVisibilityKey] = useState("");

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
    void refreshAssignments();
  }, [refreshAssignments]);

  async function changeWeekVisibility(input: {
    groupId: string;
    isVisible: boolean;
    weekSnapshotId: string;
  }) {
    setMessage("");
    setVisibilityKey(input.weekSnapshotId);
    const result = await setProgramWeekVisibility(input);
    setVisibilityKey("");

    if (!result.ok) {
      setMessage(result.error);
      return;
    }

    setMessage(result.data);
    await refreshAssignments();
    onProgramChanged();
  }

  return (
    <section className="panel stack">
      <div className="row">
        <h2>Week assignments</h2>
        <div className="row">
          <Link className="button" href="/admin/programs/import">
            Import weeks
          </Link>
          <Link className="button secondary" href="/admin/programs/audit">
            Audit log
          </Link>
        </div>
      </div>

      <section className="section-block stack">
        {assignments.length > 0 ? (
          <ul className="list">
            {assignments.map((assignment) => (
              <li key={assignment.groupId}>
                <details className="group-accordion">
                  <summary className="group-accordion-summary">
                    <span className="group-accordion-name">{assignment.groupName}</span>
                    <span className="muted group-accordion-count">
                      {assignment.weeks.length} imported {assignment.weeks.length === 1 ? "week" : "weeks"}
                    </span>
                  </summary>
                  <div className="group-accordion-body">
                    {assignment.weeks.length > 0 ? (
                      <ul className="assignment-week-list">
                        {assignment.weeks.map((week) => (
                          <li className="assignment-week-row" key={`${assignment.groupId}:${week.weekNumber}`}>
                            <div>
                              <strong>Week {week.weekNumber}: {week.title}</strong>
                              <p className="muted">
                                {week.isVisible ? "Visible to members" : "Hidden from members"} - Imported {formatDate(week.publishedAt)}
                              </p>
                            </div>
                            <button
                              className="button secondary"
                              disabled={visibilityKey === week.weekSnapshotId}
                              onClick={() =>
                                void changeWeekVisibility({
                                  groupId: assignment.groupId,
                                  isVisible: !week.isVisible,
                                  weekSnapshotId: week.weekSnapshotId
                                })
                              }
                              type="button"
                            >
                              {visibilityKey === week.weekSnapshotId ? "Saving..." : week.isVisible ? "Hide" : "Show"}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted">No weeks imported.</p>
                    )}
                  </div>
                </details>
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
