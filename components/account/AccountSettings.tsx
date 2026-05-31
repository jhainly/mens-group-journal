"use client";

import { useEffect, useState } from "react";
import { clearSelectedGroupId, getSelectedGroupId, setSelectedGroupId } from "@/lib/groupSelection";
import {
  changeCurrentUserPassword,
  getCurrentUserProfile,
  leaveCurrentUserGroup,
  listCurrentUserGroups,
  type UserGroupSummary,
  updateCurrentUserDisplayName
} from "@/lib/services/dataClient";

export function AccountSettings() {
  const [displayName, setDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [groups, setGroups] = useState<UserGroupSummary[]>([]);
  const [profileStatus, setProfileStatus] = useState("Loading account...");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [groupStatus, setGroupStatus] = useState("Loading groups...");
  const [isSavingName, setIsSavingName] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [leavingGroupId, setLeavingGroupId] = useState("");

  useEffect(() => {
    let cancelled = false;

    void Promise.all([getCurrentUserProfile(), listCurrentUserGroups()]).then(([profileResult, groupsResult]) => {
      if (cancelled) {
        return;
      }

      if (!profileResult.ok) {
        setProfileStatus(profileResult.error);
      } else {
        setDisplayName(profileResult.data.displayName);
        setProfileStatus("");
      }

      if (!groupsResult.ok) {
        setGroupStatus(groupsResult.error);
      } else {
        setGroups(groupsResult.data);
        setGroupStatus(groupsResult.data.length > 0 ? "" : "You are not currently in a group.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function saveDisplayName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileStatus("");
    setIsSavingName(true);

    try {
      const result = await updateCurrentUserDisplayName(displayName);
      setProfileStatus(result.ok ? "Display name updated." : result.error);
    } finally {
      setIsSavingName(false);
    }
  }

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordStatus("");

    if (newPassword !== confirmPassword) {
      setPasswordStatus("New passwords do not match.");
      return;
    }

    setIsChangingPassword(true);

    try {
      const result = await changeCurrentUserPassword({
        currentPassword,
        newPassword
      });

      if (!result.ok) {
        setPasswordStatus(result.error);
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordStatus("Password changed.");
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function refreshGroups() {
    const result = await listCurrentUserGroups();

    if (!result.ok) {
      setGroupStatus(result.error);
      return;
    }

    setGroups(result.data);
    setGroupStatus(result.data.length > 0 ? "" : "You are not currently in a group.");
  }

  async function leaveGroup(group: UserGroupSummary) {
    if (!window.confirm(`Leave ${group.name}? You will need a group code to join again.`)) {
      return;
    }

    setGroupStatus("");
    setLeavingGroupId(group.groupId);
    const result = await leaveCurrentUserGroup(group.groupId);
    setLeavingGroupId("");

    if (!result.ok) {
      setGroupStatus(result.error);
      return;
    }

    const remainingGroups = groups.filter((candidate) => candidate.groupId !== group.groupId);
    const selectedGroupId = getSelectedGroupId();

    if (selectedGroupId === group.groupId) {
      const nextGroup = remainingGroups[0];

      if (nextGroup) {
        setSelectedGroupId(nextGroup.groupId);
      } else {
        clearSelectedGroupId();
      }
    }

    setGroupStatus(`Left ${group.name}.`);
    await refreshGroups();
  }

  return (
    <div className="stack">
      <section className="panel stack">
        <div>
          <p className="eyebrow">Account</p>
          <h1>Account settings</h1>
          <p>Manage the name your group sees and keep your account password current.</p>
        </div>
      </section>

      <form className="panel stack" onSubmit={saveDisplayName}>
        <div>
          <p className="eyebrow">Display name</p>
          <h2>Group identity</h2>
          <p>This name appears in group membership, leaderboard, and leader views.</p>
        </div>
        <label className="field">
          <span>Display name</span>
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
        </label>
        {profileStatus ? <p className={profileStatus.includes("updated") ? "muted" : "warning"}>{profileStatus}</p> : null}
        <button className="button" disabled={isSavingName} type="submit">
          {isSavingName ? "Saving..." : "Save display name"}
        </button>
      </form>

      <section className="panel stack">
        <div>
          <p className="eyebrow">Groups</p>
          <h2>Group membership</h2>
          <p>Leave a group if you no longer want it connected to this account.</p>
        </div>
        {groups.length > 0 ? (
          <ul className="list">
            {groups.map((group) => (
              <li className="card row" key={group.groupId}>
                <div>
                  <h3>{group.name}</h3>
                  <p className="muted">{group.role ?? "member"}</p>
                </div>
                <button
                  className="button secondary"
                  disabled={leavingGroupId === group.groupId}
                  onClick={() => void leaveGroup(group)}
                  type="button"
                >
                  {leavingGroupId === group.groupId ? "Leaving..." : "Leave group"}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {groupStatus ? <p className={groupStatus.startsWith("Left ") ? "muted" : "warning"}>{groupStatus}</p> : null}
      </section>

      <form className="panel stack" onSubmit={savePassword}>
        <div>
          <p className="eyebrow">Password</p>
          <h2>Change password</h2>
          <p>Your journal key is re-protected when your password changes.</p>
        </div>
        <label className="field">
          <span>Current password</span>
          <input
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
            type="password"
          />
        </label>
        <label className="field">
          <span>New password</span>
          <input
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            required
            type="password"
          />
        </label>
        <label className="field">
          <span>Confirm new password</span>
          <input
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            type="password"
          />
        </label>
        {passwordStatus ? (
          <p className={passwordStatus === "Password changed." ? "muted" : "warning"}>{passwordStatus}</p>
        ) : null}
        <button className="button" disabled={isChangingPassword} type="submit">
          {isChangingPassword ? "Changing..." : "Change password"}
        </button>
      </form>
    </div>
  );
}
