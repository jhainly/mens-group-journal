import type { Program } from "@/types/program";
import type { SectionProgress } from "@/types/domain";

export type WeeklyExportTotal = {
  maxScore: number;
  score: number;
};

export type JournalExportInput = {
  program: Program;
  displayName: string;
  decryptedAnswers: Record<string, string>;
  progress: SectionProgress[];
  weeklyTotals: Record<number, WeeklyExportTotal>;
  cumulativeScore: number;
  maxCumulativeScore: number;
  groupName?: string;
  exportedAt?: string;
  weekNumber?: number;
};

type PdfLine = {
  bold?: boolean;
  gapAfter?: number;
  fontSize?: number;
  indent?: number;
  text: string;
};

type PdfPage = PdfLine[];

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 54;
const TOP_Y = 738;
const LINE_HEIGHT = 15;
const BODY_FONT_SIZE = 10;
const TITLE_FONT_SIZE = 15;
const WEEK_FONT_SIZE = 13;
const DAY_FONT_SIZE = 11;
const SECTION_FONT_SIZE = 12;
const MAX_CHARS = 92;
const INDENT_STEP = 18;

export async function exportJournalPdf(input: JournalExportInput): Promise<Blob> {
  const pages = layoutJournalExport(input);
  const pdf = buildPdf(pages);
  return new Blob([pdf], { type: "application/pdf" });
}

function layoutJournalExport(input: JournalExportInput): PdfPage[] {
  const pages: PdfPage[] = [[]];
  const completedSections = new Set(
    input.progress
      .filter((item) => item.completed)
      .map((item) => `${item.weekNumber}:${item.dayNumber}:${item.sectionId}`)
  );
  const progressBySection = new Map(
    input.progress.map((item) => [`${item.weekNumber}:${item.dayNumber}:${item.sectionId}`, item])
  );

  function addLine(value = "", options: Omit<PdfLine, "text"> = {}) {
    let page = pages[pages.length - 1];
    if (page.length >= 45) {
      page = [];
      pages.push(page);
    }
    page.push({ text: value, ...options });
  }

  function addWrapped(label: string, value: string, options: Omit<PdfLine, "text"> = {}) {
    const prefix = label ? `${label}: ` : "";
    const lines = wrapText(`${prefix}${value || ""}`, MAX_CHARS);
    for (const line of lines) {
      addLine(line, options);
    }
  }

  const weeks = input.weekNumber
    ? input.program.weeks.filter((week) => week.weekNumber === input.weekNumber)
    : input.program.weeks;

  addLine("Lifepoint Men's Group", { bold: true, fontSize: TITLE_FONT_SIZE, gapAfter: 22 });
  if (input.groupName) {
    addLine(`Group: ${input.groupName}`);
  }
  if (input.weekNumber) {
    addLine(`Week ${input.weekNumber}`);
  } else {
    addLine(`Cumulative score: ${input.cumulativeScore}/${input.maxCumulativeScore}`);
  }
  addLine("");

  for (const week of weeks) {
    const weeklyTotal = input.weeklyTotals[week.weekNumber] ?? { score: 0, maxScore: 0 };
    addLine(`Week ${week.weekNumber}: ${week.title}`, {
      bold: true,
      fontSize: WEEK_FONT_SIZE,
      gapAfter: 18
    });
    if (week.summary) {
      addWrapped("Summary", week.summary);
    }
    addLine(`Weekly score: ${weeklyTotal.score}/${weeklyTotal.maxScore}`);
    addLine("");

    for (const day of week.days) {
      addLine(`Day ${day.dayNumber}: ${day.title}`, {
        bold: true,
        fontSize: DAY_FONT_SIZE,
        gapAfter: 17
      });

      for (const section of day.sections) {
        const key = `${week.weekNumber}:${day.dayNumber}:${section.id}`;
        const completed = completedSections.has(key);
        const progress = progressBySection.get(key);
        const earned = completed ? progress?.pointsEarned ?? section.points : 0;

        addLine(`${completed ? "[x]" : "[ ]"} ${section.title} (${earned}/${section.points} points)`, {
          bold: true,
          fontSize: SECTION_FONT_SIZE,
          gapAfter: 18,
          indent: 0.5
        });

        if (section.body) {
          for (const line of wrapText(section.body, MAX_CHARS - 10)) {
            addLine(line, { indent: 1 });
          }
        }

        for (const scripture of section.scripture ?? []) {
          addLine(scripture.reference, {
            bold: true,
            gapAfter: 14,
            indent: 1
          });
          addWrapped("", scripture.text, { indent: 1.35 });
        }

        for (const prompt of section.prompts ?? []) {
          addWrapped("", prompt.label, { indent: 1 });
          const answer = input.decryptedAnswers[prompt.id];

          if (answer) {
            for (const line of wrapText(answer, MAX_CHARS - 14)) {
              addLine(line, { indent: 1.35 });
            }
          } else {
            addLine("", { gapAfter: LINE_HEIGHT + 2 });
            addLine("", { gapAfter: LINE_HEIGHT + 2 });
          }
        }

        addLine("");
      }
    }
  }

  return pages;
}

function buildPdf(pages: PdfPage[]): string {
  const objects: string[] = [];
  const pageObjectNumbers: number[] = [];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [] /Count 0 >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  for (const page of pages) {
    const stream = buildPageStream(page);
    const streamObjectNumber = objects.length + 1;
    objects.push(`<< /Length ${byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    const pageObjectNumber = objects.length + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamObjectNumber} 0 R >>`
    );
    pageObjectNumbers.push(pageObjectNumber);
  }

  objects[1] = `<< /Type /Pages /Kids [${pageObjectNumbers.map((objectNumber) => `${objectNumber} 0 R`).join(" ")}] /Count ${pageObjectNumbers.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return pdf;
}

function buildPageStream(lines: PdfLine[]): string {
  const commands: string[] = [];
  let y = TOP_Y;

  for (const line of lines) {
    const fontSize = line.fontSize ?? BODY_FONT_SIZE;
    const font = line.bold ? "/F2" : "/F1";
    const x = MARGIN_X + (line.indent ?? 0) * INDENT_STEP;
    commands.push(`BT ${font} ${fontSize} Tf ${x} ${y} Td (${escapePdfText(line.text)}) Tj ET`);
    y -= line.gapAfter ?? LINE_HEIGHT;
  }

  return commands.join("\n");
}

function wrapText(value: string, maxChars: number): string[] {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return [""];
  }

  const lines: string[] = [];
  let current = "";

  for (const word of normalized.split(" ")) {
    if (!current) {
      current = word;
      continue;
    }

    if (`${current} ${word}`.length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}
