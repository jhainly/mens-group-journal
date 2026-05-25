"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getAdminGroupDetail,
  type AdminGroupDetail as AdminGroupDetailData
} from "@/lib/services/dataClient";

type AdminGroupDetailProps = {
  groupId: string;
};

export function AdminGroupDetail({ groupId }: AdminGroupDetailProps) {
  const [group, setGroup] = useState<AdminGroupDetailData | null>(null);
  const [status, setStatus] = useState("Loading group...");

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
      setStatus("");
    });

    return () => {
      cancelled = true;
    };
  }, [groupId]);

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

  return (
    <div className="stack">
      <div>
        <Link className="button secondary" href="/admin/groups">
          Back to groups
        </Link>
      </div>

      <section className="panel stack">
        <div>
          <p className="eyebrow">Group detail</p>
          <h1>{group.name}</h1>
          <p>Leaders and members in this group. Journal answers and section-level activity are not visible.</p>
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
      </section>

      <MemberSection members={leaders} title="Leaders" />
      <MemberSection members={members} title="Members" />
    </div>
  );
}

function MemberSection({
  members,
  title
}: {
  members: AdminGroupDetailData["members"];
  title: string;
}) {
  return (
    <section className="panel stack">
      <div>
        <p className="eyebrow">{members.length} total</p>
        <h2>{title}</h2>
      </div>
      {members.length > 0 ? (
        <ul className="list">
          {members.map((member) => (
            <li className="card row" key={member.membershipId}>
              <div>
                <strong>{member.displayName}</strong>
                <p className="muted">{member.userId}</p>
              </div>
              <div className="stack tight-stack">
                <span className="role-label">{member.role ?? "member"}</span>
                <small>Joined {formatDate(member.joinedAt)}</small>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No {title.toLowerCase()} in this group.</p>
      )}
    </section>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium"
  }).format(new Date(value));
}

