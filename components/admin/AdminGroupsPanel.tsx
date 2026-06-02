"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { setSelectedGroupId } from "@/lib/groupSelection";
import {
  createGroup,
  listAdminGroups,
  type AdminGroupSummary
} from "@/lib/services/dataClient";

export function AdminGroupsPanel() {
  const optimisticGroupsRef = useRef<AdminGroupSummary[]>([]);
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [groups, setGroups] = useState<AdminGroupSummary[]>([]);
  const [directoryStatus, setDirectoryStatus] = useState("Loading groups...");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    void refreshGroups();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);
    const groupName = name.trim();
    const groupJoinCode = joinCode.trim();
    const result = await createGroup(name, joinCode);
    setIsSubmitting(false);

    if (!result.ok) {
      setMessage(result.error);
      return;
    }

    const createdGroup = {
      groupId: result.data,
      joinCode: groupJoinCode,
      leaderCount: 1,
      memberCount: 1,
      name: groupName
    } satisfies AdminGroupSummary;

    optimisticGroupsRef.current = mergeGroups(optimisticGroupsRef.current, [createdGroup]);
    setSelectedGroupId(result.data);
    setGroups((current) => mergeGroups(current, [createdGroup]));
    setDirectoryStatus("");
    setMessage("Group created.");
    setName("");
    setJoinCode("");
    setShowCreateForm(false);
    void refreshGroups();
  }

  async function refreshGroups() {
    setDirectoryStatus("Loading groups...");
    const result = await listAdminGroups();

    if (!result.ok) {
      setDirectoryStatus(result.error);
      return;
    }

    const mergedGroups = mergeGroups(result.data, optimisticGroupsRef.current);
    setGroups(mergedGroups);
    setDirectoryStatus(mergedGroups.length > 0 ? "" : "No groups have been created yet.");
  }

  return (
    <div className="stack">
      <AdminNav />

      <section className="panel stack" id="groups">
        <div className="row">
          <h2>Groups</h2>
          <div className="row">
            <button className="button secondary" onClick={() => void refreshGroups()} type="button">
              Refresh
            </button>
            <button className="button" onClick={() => setShowCreateForm((v) => !v)} type="button">
              {showCreateForm ? "Cancel" : "New group"}
            </button>
          </div>
        </div>

        {showCreateForm ? (
          <form className="stack" id="create-group" onSubmit={handleSubmit}>
            <div className="grid two">
              <label className="field">
                <span>Group name</span>
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Tuesday Morning Men" required />
              </label>
              <label className="field">
                <span>Join code</span>
                <input value={joinCode} onChange={(event) => setJoinCode(event.target.value)} placeholder="GRACE-2026" required />
              </label>
            </div>
            <div>
              <button className="button" disabled={isSubmitting} type="submit">
                {isSubmitting ? "Creating..." : "Create group"}
              </button>
            </div>
          </form>
        ) : null}

        {message ? <p className="muted">{message}</p> : null}

        {groups.length > 0 ? (
          <ul className="list">
            {groups.map((group) => (
              <li className="card row" key={group.groupId}>
                <div>
                  <strong>{group.name}</strong>
                  <p className="muted">
                    {group.memberCount} {group.memberCount === 1 ? "member" : "members"} · {group.leaderCount} {group.leaderCount === 1 ? "leader" : "leaders"}{group.joinCode ? ` · ${group.joinCode}` : ""}
                  </p>
                </div>
                <Link className="button secondary" href={`/admin/groups/${group.groupId}`}>
                  View
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{directoryStatus}</p>
        )}
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
