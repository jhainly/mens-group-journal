import type { Program } from "@/types/program";
import type { SectionProgress } from "@/types/domain";

export type JournalExportInput = {
  program: Program;
  displayName: string;
  decryptedAnswers: Record<string, string>;
  progress: SectionProgress[];
  weeklyTotals: Record<number, number>;
  cumulativeScore: number;
};

export async function exportJournalPdf(_input: JournalExportInput): Promise<Blob> {
  throw new Error("PDF export is a v1 stub. Wire this to a browser PDF renderer before release.");
}
