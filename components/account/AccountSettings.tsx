"use client";

import { useEffect, useState } from "react";
import {
  changeCurrentUserPassword,
  getCurrentUserProfile,
  updateCurrentUserDisplayName
} from "@/lib/services/dataClient";

export function AccountSettings() {
  const [displayName, setDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileStatus, setProfileStatus] = useState("Loading account...");
  const [passwordStatus, setPasswordStatus] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void getCurrentUserProfile().then((result) => {
      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setProfileStatus(result.error);
        return;
      }

      setDisplayName(result.data.displayName);
      setProfileStatus("");
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
