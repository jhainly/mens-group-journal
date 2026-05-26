"use client";

import { useState } from "react";
import { exportJournalPdf } from "@/lib/pdfExport";
import { loadJournalExport } from "@/lib/services/dataClient";
import type { Program } from "@/types/program";

type JournalExportButtonProps = {
  groupId: string;
  groupName: string;
  program: Program;
  weekNumber: number;
};

export function JournalExportButton({ groupId, groupName, program, weekNumber }: JournalExportButtonProps) {
  const [status, setStatus] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  async function exportJournal() {
    setStatus("");
    setIsExporting(true);

    const data = await loadJournalExport({
      groupId,
      groupName,
      program,
      weekNumber
    });

    if (!data.ok) {
      setStatus(data.error);
      setIsExporting(false);
      return;
    }

    const blob = await exportJournalPdf(data.data);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(program.program.title)}-week-${weekNumber}-journal.pdf`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setIsExporting(false);
    setStatus("Export generated.");
  }

  return (
    <div className="stack export-action">
      <button className="button secondary" disabled={isExporting} onClick={exportJournal} type="button">
        {isExporting ? "Exporting..." : "Export week PDF"}
      </button>
      {status ? <p className="muted">{status}</p> : null}
    </div>
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
