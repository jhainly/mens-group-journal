"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { setSelectedGroupId } from "@/lib/groupSelection";
import {
  createGroup,
  listAdminGroups,
  type AdminGroupSummary
} from "@/lib/services/dataClient";

export function AdminGroupsPanel() {
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [groups, setGroups] = useState<AdminGroupSummary[]>([]);
  const [directoryStatus, setDirectoryStatus] = useState("Loading groups...");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void refreshGroups();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);
    const result = await createGroup(name, joinCode);
    setIsSubmitting(false);

    if (!result.ok) {
      setMessage(result.error);
      return;
    }

    setSelectedGroupId(result.data);
    setMessage("Group created and selected.");
    setName("");
    setJoinCode("");
    await refreshGroups();
  }

  async function refreshGroups() {
    setDirectoryStatus("Loading groups...");
    const result = await listAdminGroups();

    if (!result.ok) {
      setDirectoryStatus(result.error);
      return;
    }

    setGroups(result.data);
    setDirectoryStatus(result.data.length > 0 ? "" : "No groups have been created yet.");
  }

  return (
    <div className="stack">
      <form className="panel stack" onSubmit={handleSubmit}>
        <div>
          <p className="eyebrow">Leader tools</p>
          <h1>Group management</h1>
          <p>Create groups, manage join codes, choose the active program, and view participation.</p>
        </div>
        <div className="grid two">
          <label className="field">
            <span>Group name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Tuesday Morning Men" required />
          </label>
          <label className="field">
            <span>Join code</span>
            <input value={joinCode} onChange={(event) => setJoinCode(event.target.value)} placeholder="Set a private code" required />
          </label>
        </div>
        {message ? <p>{message}</p> : null}
        <div className="row">
          <button className="button" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Creating..." : "Create group"}
          </button>
          <Link className="button secondary" href="/admin/import">Import program</Link>
        </div>
      </form>

      <section className="panel stack">
        <div className="row">
          <div>
            <p className="eyebrow">Groups</p>
            <h2>Existing groups</h2>
            <p>Admins can review group access and membership. Journal answers are never shown here.</p>
          </div>
          <button className="button secondary" onClick={refreshGroups} type="button">
            Refresh
          </button>
        </div>
        {groups.length > 0 ? (
          <ul className="list">
            {groups.map((group) => (
              <li className="card stack" key={group.groupId}>
                <div className="row">
                  <div>
                    <h3>{group.name}</h3>
                    <p className="muted">Group ID: {group.groupId}</p>
                  </div>
                  <Link className="button secondary" href={`/admin/groups/${group.groupId}`}>
                    View members
                  </Link>
                </div>
                <div className="grid three">
                  <div className="metric">
                    <span>Members</span>
                    <strong>{group.memberCount}</strong>
                  </div>
                  <div className="metric">
                    <span>Leaders</span>
                    <strong>{group.leaderCount}</strong>
                  </div>
                  <div className="metric">
                    <span>Join code</span>
                    <strong>{group.joinCode ?? "Unavailable"}</strong>
                    {group.joinCode ? (
                      <small>Visible to admins.</small>
                    ) : (
                      <small>Reset this group&apos;s code to make it visible here.</small>
                    )}
                  </div>
                </div>
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

