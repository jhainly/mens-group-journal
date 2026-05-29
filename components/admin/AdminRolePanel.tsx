"use client";

import { useEffect, useState } from "react";
import {
  listAdminRoleUsers,
  setUserAdminRole,
  type AdminRoleUser
} from "@/lib/services/dataClient";

export function AdminRolePanel() {
  const [users, setUsers] = useState<AdminRoleUser[]>([]);
  const [status, setStatus] = useState("Loading users...");
  const [message, setMessage] = useState("");
  const [updatingUsername, setUpdatingUsername] = useState("");

  useEffect(() => {
    void refreshAdmins();
  }, []);

  async function refreshAdmins() {
    setStatus("Loading users...");
    const result = await listAdminRoleUsers();

    if (!result.ok) {
      setStatus(result.error);
      return;
    }

    setUsers(result.data);
    setStatus(result.data.length > 0 ? "" : "No users found.");
  }

  async function toggleAdmin(user: AdminRoleUser, isAdmin: boolean) {
    setMessage("");
    setUpdatingUsername(user.username);
    const result = await setUserAdminRole({ email: user.email, enabled: isAdmin });
    setUpdatingUsername("");

    if (!result.ok) {
      setMessage(result.error);
      return;
    }

    setMessage(result.data);
    void refreshAdmins();
  }

  return (
    <section className="panel stack">
      <div>
        <p className="eyebrow">Admin access</p>
        <h2>User access</h2>
        <p>Choose which users can manage groups, program imports, and admin access.</p>
      </div>

      {message ? <p>{message}</p> : null}

      {users.length > 0 ? (
        <ul className="list">
          {users.map((user) => (
            <li className="card row" key={user.username}>
              <div>
                <h3>{user.displayName}</h3>
                <p className="muted">{user.email || user.username}</p>
                <p className="role-label">{user.enabled ? user.status : "DISABLED"}</p>
              </div>
              <label className="checkbox-row">
                <input
                  checked={user.isAdmin}
                  disabled={!user.email || updatingUsername === user.username}
                  onChange={(event) => void toggleAdmin(user, event.target.checked)}
                  type="checkbox"
                />
                <span>Admin</span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">{status}</p>
      )}
    </section>
  );
}
