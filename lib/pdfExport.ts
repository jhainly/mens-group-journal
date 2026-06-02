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
  bullet?: boolean;
  gapAfter?: number;
  fontSize?: number;
  indent?: number;
  italic?: boolean;
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
const SCRIPTURE_MAX_CHARS = 100;
const DAY_PAGE_MAX_LINES = 54;
const INDENT_STEP = 18;

export async function exportJournalPdf(input: JournalExportInput): Promise<Blob> {
  const pages = layoutJournalExport(input);
  const pdf = buildPdf(pages);
  return new Blob([pdf], { type: "application/pdf" });
}

function layoutJournalExport(input: JournalExportInput): PdfPage[] {
  const pages: PdfPage[] = [];
  const completedSections = new Set(
    input.progress
      .filter((item) => item.completed)
      .map((item) => `${item.weekNumber}:${item.dayNumber}:${item.sectionId}`)
  );
  const progressBySection = new Map(
    input.progress.map((item) => [`${item.weekNumber}:${item.dayNumber}:${item.sectionId}`, item])
  );

  const weeks = input.weekNumber
    ? input.program.weeks.filter((week) => week.weekNumber === input.weekNumber)
    : input.program.weeks;

  for (const week of weeks) {
    for (const day of week.days) {
      const page: PdfPage = [];
      const addLine = (value = "", options: Omit<PdfLine, "text"> = {}) => {
        if (page.length < DAY_PAGE_MAX_LINES) {
          page.push({ text: value, ...options });
        }
      };
      const addWrapped = (
        label: string,
        value: string,
        options: Omit<PdfLine, "text"> = {},
        maxLines = 3,
        maxChars = MAX_CHARS - Math.ceil((options.indent ?? 0) * 4)
      ) => {
        const prefix = label ? `${label}: ` : "";
        const lines = wrapText(`${prefix}${value || ""}`, maxChars);
        const visibleLines = lines.slice(0, maxLines);

        for (const line of visibleLines) {
          addLine(line, options);
        }

        if (lines.length > visibleLines.length) {
          addLine("...", options);
        }
      };

      addLine(`Week ${week.weekNumber}: ${week.title}`, { bold: true, fontSize: WEEK_FONT_SIZE, gapAfter: 14 });
      addLine(`Day ${day.dayNumber}: ${day.title}`, { bold: true, fontSize: DAY_FONT_SIZE, gapAfter: 14 });
      addLine("");

      for (const section of day.sections) {
        const key = `${week.weekNumber}:${day.dayNumber}:${section.id}`;
        const completed = completedSections.has(key);
        const progress = progressBySection.get(key);
        const earned = completed ? progress?.pointsEarned ?? section.points : 0;

        addLine(`${completed ? "[x]" : "[ ]"} ${section.title} (${earned}/${section.points} points)`, {
          bold: true,
          fontSize: SECTION_FONT_SIZE,
          gapAfter: 14,
          indent: 0.5
        });

        if (section.body) {
          addWrapped("", section.body, { indent: 1 }, 2);
        }

        for (const scripture of section.scripture ?? []) {
          addWrapped("", `${scripture.reference}: ${scripture.text}`, { indent: 1, italic: true }, 4, SCRIPTURE_MAX_CHARS);
        }

        for (const prompt of section.prompts ?? []) {
          addWrapped("", prompt.label, { bullet: true, indent: 1 }, 2);
          const answer = input.decryptedAnswers[prompt.id];

          if (answer) {
            addWrapped("", answer, { indent: 1.35 }, 3);
          } else {
            addLine("", { gapAfter: 13 });
          }
        }

        addLine("", { gapAfter: 8 });
      }

      pages.push(page);
    }
  }

  return pages.length > 0 ? pages : [[{ text: "No journal content available." }]];
}

function buildPdf(pages: PdfPage[]): string {
  const objects: string[] = [];
  const pageObjectNumbers: number[] = [];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [] /Count 0 >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>");

  for (const page of pages) {
    const stream = buildPageStream(page);
    const streamObjectNumber = objects.length + 1;
    objects.push(`<< /Length ${byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    const pageObjectNumber = objects.length + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${streamObjectNumber} 0 R >>`
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
    const font = line.bold ? "/F2" : line.italic ? "/F3" : "/F1";
    const x = MARGIN_X + (line.indent ?? 0) * INDENT_STEP;
    const textX = line.bullet ? x + 12 : x;
    if (line.bullet) {
      commands.push(`${x} ${y + 3} 3 3 re f`);
    }
    commands.push(`BT ${font} ${fontSize} Tf ${textX} ${y} Td (${escapePdfText(line.text)}) Tj ET`);
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
  return transliterateToAscii(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function transliterateToAscii(value: string): string {
  return value
    .replace(/[‘’‚‛′‵]/g, "'") // curly/smart single quotes, primes
    .replace(/[“”„‟″‶]/g, '"') // curly/smart double quotes
    .replace(/[–—―]/g, "-")                   // en dash, em dash, horizontal bar
    .replace(/…/g, "...")                                // ellipsis
    .replace(/•/g, "*")                                  // bullet
    .replace(/[À-Å]/g, "A")                        // À Á Â Ã Ä Å
    .replace(/Æ/g, "AE")
    .replace(/Ç/g, "C")
    .replace(/[È-Ë]/g, "E")                        // È É Ê Ë
    .replace(/[Ì-Ï]/g, "I")                        // Ì Í Î Ï
    .replace(/Ð/g, "D")
    .replace(/Ñ/g, "N")
    .replace(/[Ò-ÖØ]/g, "O")                  // Ò Ó Ô Õ Ö Ø
    .replace(/[Ù-Ü]/g, "U")                        // Ù Ú Û Ü
    .replace(/Ý/g, "Y")
    .replace(/[à-å]/g, "a")                        // à á â ã ä å
    .replace(/æ/g, "ae")
    .replace(/ç/g, "c")
    .replace(/[è-ë]/g, "e")                        // è é ê ë
    .replace(/[ì-ï]/g, "i")                        // ì í î ï
    .replace(/ð/g, "d")
    .replace(/ñ/g, "n")
    .replace(/[ò-öø]/g, "o")                  // ò ó ô õ ö ø
    .replace(/[ù-ü]/g, "u")                        // ù ú û ü
    .replace(/ý/g, "y")
    .replace(/ß/g, "ss")                                 // ß
    .replace(/[^\x00-\x7F]/g, "?");                          // anything else → ?
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}
