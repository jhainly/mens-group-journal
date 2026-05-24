"use client";

import Link from "next/link";
import { useState } from "react";
import { createGroup } from "@/lib/services/dataClient";

export function AdminGroupsPanel() {
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    setMessage("Group created.");
    setName("");
    setJoinCode("");
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
        <h2>Leader metrics</h2>
        <p>Leaders see cumulative participation metrics only. They do not receive answers or section-level details.</p>
        <div className="grid two">
          <div className="metric">
            <span>Members</span>
            <strong>0</strong>
          </div>
        </div>
      </section>
    </div>
  );
}
