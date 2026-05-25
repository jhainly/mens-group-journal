"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setSelectedGroupId } from "@/lib/groupSelection";
import { joinGroupByCode } from "@/lib/services/dataClient";

export function JoinGroupForm() {
  const router = useRouter();
  const [groupCode, setGroupCode] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);
    const result = await joinGroupByCode(groupCode);
    setIsSubmitting(false);

    if (!result.ok) {
      setMessage(result.error);
      return;
    }

    setSelectedGroupId(result.data);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form className="panel stack" onSubmit={handleSubmit}>
      <div>
        <p className="eyebrow">Group access</p>
        <h1>Join a group</h1>
        <p>Enter the private code from your group leader to join the current program.</p>
      </div>
      <label className="field">
        <span>Group code</span>
        <input value={groupCode} onChange={(event) => setGroupCode(event.target.value)} placeholder="Example: GRACE-2026" required />
      </label>
      {message ? <p className="warning">{message}</p> : null}
      <button className="button" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Joining..." : "Join group"}
      </button>
    </form>
  );
}
