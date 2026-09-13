"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getProgramWeekDisplayName } from "@/lib/programDays";
import {
  getAdminGroupDetail,
  listActiveProgramWeeksForGroups,
  setGroupArchived,
  setProgramWeekVisibility,
  updateGroupSettings,
  type ActiveProgramWeekSummary,
  type AdminGroupDetail as AdminGroupDetailData
} from "@/lib/services/dataClient";

type AdminGroupDetailProps = {
  groupId: string;
};

export function AdminGroupDetail({ groupId }: AdminGroupDetailProps) {
  const [group, setGroup] = useState<AdminGroupDetailData | null>(null);
  const [status, setStatus] = useState("Loading group...");
  const [activeWeeks, setActiveWeeks] = useState<ActiveProgramWeekSummary[]>([]);
  const [weeksStatus, setWeeksStatus] = useState("Loading active weeks...");
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [weekMessage, setWeekMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [visibilityWeekSnapshotId, setVisibilityWeekSnapshotId] = useState("");
  const [archiveMessage, setArchiveMessage] = useState("");
  const [isArchiving, setIsArchiving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void getAdminGroupDetail(groupId).then((result) => {
      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setStatus(result.error);
        return;
      }

      setGroup(result.data);
      setName(result.data.name);
      setJoinCode(result.data.joinCode ?? "");
      setStatus("");
    });

    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const refreshWeeks = useCallback(async () => {
    setWeeksStatus("Loading active weeks...");
    const result = await listActiveProgramWeeksForGroups([groupId]);

    if (!result.ok) {
      setActiveWeeks([]);
      setWeeksStatus(result.error);
      return;
    }

    setActiveWeeks(result.data);
    setWeeksStatus(result.data.length > 0 ? "" : "No weeks have been imported for this group.");
  }, [groupId]);

  useEffect(() => {
    void refreshWeeks();
  }, [refreshWeeks]);

  if (!group) {
    return (
      <section className="panel stack">
        <Link className="button secondary" href="/admin/groups">
          Back to groups
        </Link>
        <p className="muted">{status}</p>
      </section>
    );
  }

  const leaders = group.members.filter((member) => member.role === "leader" || member.role === "admin");
  const members = group.members.filter((member) => member.role !== "leader" && member.role !== "admin");

  async function refreshGroup() {
    const result = await getAdminGroupDetail(groupId);

    if (!result.ok) {
      setStatus(result.error);
      return;
    }

    setGroup(result.data);
    setName(result.data.name);
    setJoinCode(result.data.joinCode ?? "");
    setStatus("");
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSettingsMessage("");
    setIsSaving(true);
    const result = await updateGroupSettings({
      groupId,
      joinCode,
      name
    });
    setIsSaving(false);

    if (!result.ok) {
      setSettingsMessage(result.error);
      return;
    }

    setSettingsMessage("Group updated.");
    await refreshGroup();
  }

  async function toggleArchived() {
    if (!group) {
      return;
    }

    const nextIsArchived = !group.isArchived;
    const confirmation = nextIsArchived
      ? `Archive ${group.name}? Members keep read-only access to their journals and scores, but nothing new can be saved and score sync stops.`
      : `Make ${group.name} active again? Members will be able to save journal entries and earn points.`;

    if (!window.confirm(confirmation)) {
      return;
    }

    setArchiveMessage("");
    setIsArchiving(true);
    const result = await setGroupArchived({ groupId, isArchived: nextIsArchived });
    setIsArchiving(false);

    if (!result.ok) {
      setArchiveMessage(result.error);
      return;
    }

    setArchiveMessage(result.data);
    await refreshGroup();
  }

  async function changeWeekVisibility(week: ActiveProgramWeekSummary) {
    setWeekMessage("");
    setVisibilityWeekSnapshotId(week.weekSnapshotId);
    const result = await setProgramWeekVisibility({
      groupId,
      isVisible: !week.isVisible,
      weekSnapshotId: week.weekSnapshotId
    });
    setVisibilityWeekSnapshotId("");

    if (!result.ok) {
      setWeekMessage(result.error);
      return;
    }

    setWeekMessage(result.data);
    await refreshWeeks();
  }

  return (
    <div className="stack">
      <section className="panel stack">
        <div className="row">
          <div>
            <h1>{group.name}</h1>
            <p className="muted">
              {group.activeProgramTitle ? `${group.activeProgramTitle} - ` : ""}
              {group.memberCount} {group.memberCount === 1 ? "member" : "members"} - {group.leaderCount}{" "}
              {group.leaderCount === 1 ? "leader" : "leaders"}
              {group.isArchived ? " - Archived" : ""}
            </p>
          </div>
          <Link className="button secondary" href="/admin/groups">
            Back
          </Link>
        </div>
        <form className="stack" onSubmit={saveSettings}>
          <div className="grid two">
            <label className="field">
              <span>Group name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label className="field">
              <span>Join code</span>
              <input value={joinCode} onChange={(event) => setJoinCode(event.target.value)} required />
            </label>
          </div>
          {settingsMessage ? <p>{settingsMessage}</p> : null}
          <div>
            <button className="button" disabled={isSaving} type="submit">
              {isSaving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel stack">
        <div className="row">
          <div>
            <h2>{group.isArchived ? "Archived program" : "Archive program"}</h2>
            <p className="muted">
              {group.isArchived
                ? "This group is read-only. Members can review their journals, scores, and leaderboard, but cannot save anything new."
                : "Archive this group when its program ends. Members keep read-only access to their journals and scores; new entries and score sync are turned off."}
            </p>
          </div>
          <button className="button secondary" disabled={isArchiving} onClick={() => void toggleArchived()} type="button">
            {isArchiving ? "Saving..." : group.isArchived ? "Unarchive group" : "Archive group"}
          </button>
        </div>
        {archiveMessage ? <p>{archiveMessage}</p> : null}
      </section>

      <section className="panel stack">
        <div className="row">
          <h2>Imported weeks</h2>
          <button className="button secondary" onClick={() => void refreshWeeks()} type="button">
            Refresh
          </button>
        </div>
        {activeWeeks.length > 0 ? (
          <ul className="list">
            {activeWeeks.map((week) => (
              <li className="card row" key={week.weekNumber}>
                <div>
                  <h3>{getProgramWeekDisplayName(week)}</h3>
                  <p className="muted">{week.isVisible ? "Visible to members" : "Hidden from members"}</p>
                </div>
                <button
                  className="button secondary"
                  disabled={visibilityWeekSnapshotId === week.weekSnapshotId}
                  onClick={() => void changeWeekVisibility(week)}
                  type="button"
                >
                  {visibilityWeekSnapshotId === week.weekSnapshotId ? "Saving..." : week.isVisible ? "Hide week" : "Show week"}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{weeksStatus}</p>
        )}
        {weekMessage ? <p>{weekMessage}</p> : null}
      </section>

      <section className="panel stack">
        <h2>Members ({group.members.length})</h2>
        {group.members.length > 0 ? (
          <ul className="list">
            {[...leaders, ...members].map((member) => (
              <li className="card row" key={member.membershipId}>
                <strong>{member.displayName}</strong>
                <div className="stack tight-stack">
                  <span className="role-label">{member.role ?? "member"}</span>
                  <small>Joined {formatDate(member.joinedAt)}</small>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No members yet.</p>
        )}
      </section>
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium"
  }).format(new Date(value));
}
