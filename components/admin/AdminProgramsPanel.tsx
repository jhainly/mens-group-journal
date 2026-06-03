"use client";

import { useEffect, useState } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { ProgramManagementPanel } from "@/components/admin/ProgramManagementPanel";
import {
  listAdminGroups,
  type AdminGroupSummary
} from "@/lib/services/dataClient";

export function AdminProgramsPanel() {
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

    setGroups(result.data);
    setStatus(result.data.length > 0 ? "" : "Create a group before managing programs.");
  }

  return (
    <div className="stack">
      <AdminNav />

      {status && groups.length === 0 ? <p className="muted">{status}</p> : null}

      <section id="program-assignments">
        <ProgramManagementPanel groups={groups} onProgramChanged={refreshGroups} />
      </section>
    </div>
  );
}

