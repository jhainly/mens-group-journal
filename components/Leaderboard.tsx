"use client";

import { useEffect, useState } from "react";
import { formatPoints } from "@/lib/format";
import { listLeaderboard } from "@/lib/services/dataClient";

export function Leaderboard() {
  const [rows, setRows] = useState<Array<{ displayName: string; score: number }>>([]);

  useEffect(() => {
    void listLeaderboard("demo-group").then((result) => {
      if (result.ok) {
        setRows(result.data);
      }
    });
  }, []);

  return (
    <section className="panel stack">
      <div>
        <p className="eyebrow">Group scores</p>
        <h1>Leaderboard</h1>
        <p>Members can see where the group stands this week.</p>
      </div>
      {rows.length > 0 ? (
        <ul className="list">
          {rows.map((row) => (
            <li className="card row" key={row.displayName}>
              <strong>{row.displayName}</strong>
              <span>{formatPoints(row.score)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">No scores yet.</p>
      )}
    </section>
  );
}
