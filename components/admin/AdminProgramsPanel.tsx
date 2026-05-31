"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ProgramManagementPanel } from "@/components/admin/ProgramManagementPanel";
import {
  listAdminGroups,
  type AdminGroupSummary
} from "@/lib/services/dataClient";

export function AdminProgramsPanel() {
  const optimisticGroupsRef = useRef<AdminGroupSummary[]>([]);
  const [groups, setGroups] = useState<AdminGroupSummary[]>([]);
  const [status, setStatus] = useState("Loading groups...");

  useEffect(() => {
    void refreshGroups();
  }, []);

  async function refreshGroups() {
    setStatus("Loading groups...");
    const result = await listAdminGroups();

    if (!result.ok) {
      setStatus(result.error);
      return;
    }

    const mergedGroups = mergeGroups(result.data, optimisticGroupsRef.current);
    setGroups(mergedGroups);
    setStatus(mergedGroups.length > 0 ? "" : "Create a group before managing programs.");
  }

  return (
    <div className="stack">
      <section className="panel stack">
        <div>
          <p className="eyebrow">Admin tools</p>
          <h1>Program management</h1>
          <p>Manage which weeks are assigned to which groups.</p>
        </div>
        <div className="row">
          <Link className="button secondary" href="/admin">
            Back to admin tools
          </Link>
          <Link className="button" href="/admin/programs/import">
            Import new week
          </Link>
          <Link className="button secondary" href="/admin/programs/audit">
            View audit log
          </Link>
        </div>
      </section>

      {status && groups.length === 0 ? <p className="muted">{status}</p> : null}

      <section id="program-assignments">
        <ProgramManagementPanel groups={groups} onProgramChanged={refreshGroups} />
      </section>
    </div>
  );
}

function mergeGroups(primary: AdminGroupSummary[], fallback: AdminGroupSummary[]): AdminGroupSummary[] {
  const groupsById = new Map<string, AdminGroupSummary>();

  for (const group of primary) {
    groupsById.set(group.groupId, group);
  }

  for (const group of fallback) {
    const current = groupsById.get(group.groupId);
    groupsById.set(group.groupId, current ? { ...group, ...current, joinCode: current.joinCode ?? group.joinCode } : group);
  }

  return Array.from(groupsById.values()).sort((left, right) => left.name.localeCompare(right.name));
}
