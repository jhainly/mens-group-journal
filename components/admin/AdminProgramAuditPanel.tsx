"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  listAdminGroups,
  listProgramAuditEntries,
  type AdminGroupSummary,
  type ProgramAuditEntry
} from "@/lib/services/dataClient";

export function AdminProgramAuditPanel() {
  const [groups, setGroups] = useState<AdminGroupSummary[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [entries, setEntries] = useState<ProgramAuditEntry[]>([]);
  const [status, setStatus] = useState("Loading audit log...");
  const [groupsStatus, setGroupsStatus] = useState("Loading groups...");

  const loadGroups = useCallback(async () => {
    setGroupsStatus("Loading groups...");
    const result = await listAdminGroups();

    if (!result.ok) {
      setGroupsStatus(result.error);
      return;
    }

    setGroups(result.data);
    setGroupsStatus(result.data.length > 0 ? "" : "No groups have been created yet.");
  }, []);

  const refreshAudit = useCallback(async (groupIds = selectedGroupIds) => {
    setStatus("Loading audit log...");
    const result = await listProgramAuditEntries(groupIds);

    if (!result.ok) {
      setEntries([]);
      setStatus(result.error);
      return;
    }

    setEntries(result.data);
    setStatus(result.data.length > 0 ? "" : "No program changes have been recorded yet.");
  }, [selectedGroupIds]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    void refreshAudit();
  }, [refreshAudit]);

  function toggleGroup(groupId: string, checked: boolean) {
    setSelectedGroupIds((current) => {
      const next = checked
        ? Array.from(new Set([...current, groupId]))
        : current.filter((candidate) => candidate !== groupId);

      return next;
    });
  }

  function clearFilters() {
    setSelectedGroupIds([]);
  }

  return (
    <div className="stack">
      <section className="panel stack">
        <div>
          <p className="eyebrow">Program management</p>
          <h1>Audit log</h1>
          <p>Review program week imports, replacements, and removals.</p>
        </div>
        <Link className="button secondary" href="/admin/programs">
          Back to program management
        </Link>
      </section>

      <section className="panel stack">
        <div className="row">
          <div>
            <p className="eyebrow">Filters</p>
            <h2>Groups</h2>
          </div>
          <button className="button secondary" onClick={clearFilters} type="button">
            Show all
          </button>
        </div>
        {groups.length > 0 ? (
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
        ) : (
          <p className="muted">{groupsStatus}</p>
        )}
      </section>

      <section className="panel stack">
        <div className="row">
          <div>
            <p className="eyebrow">Changes</p>
            <h2>Recent program changes</h2>
          </div>
          <button className="button secondary" onClick={() => void refreshAudit()} type="button">
            Refresh
          </button>
        </div>
        {entries.length > 0 ? (
          <ul className="list">
            {entries.map((entry) => (
              <li className="card stack" key={entry.eventId}>
                <div>
                  <h3>{formatAuditAction(entry.action)} Week {entry.weekNumber}: {entry.weekTitle}</h3>
                  <p className="muted">
                    {entry.groupName} by {entry.actorDisplayName} on {formatDateTime(entry.createdAt)}
                  </p>
                  {entry.details ? <p className="muted">{entry.details}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{status}</p>
        )}
      </section>
    </div>
  );
}

function formatAuditAction(action: string): string {
  if (action === "replace_week") {
    return "Replaced";
  }

  if (action === "remove_week") {
    return "Removed";
  }

  return "Imported";
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
