#!/usr/bin/env node
/**
 * Convert a Priority One Deep Roots week YAML into the Lifepoint men's group format.
 *
 *   npm run adapt-week -- imports/deep-roots/deep-roots-week-1.yaml --program-id lifepoint-deep-roots-fall-2026
 *
 * What changes (see docs/program-yaml-reference.md for the full rules):
 *   - program.id is replaced with --program-id (one stable id per 8-week session) and the
 *     description is rewritten for the men's group; program.title stays "Deep Roots".
 *   - Reflection days are relabeled Monday..Friday -> Wednesday, Thursday, Friday, Monday, Tuesday.
 *     Section, prompt, and completion-item ids that embed the old weekday are renamed to match.
 *   - Weekday checkbox lists (Chapter Challenge etc.) are relabeled the same way.
 *   - "Monday through Friday" style phrases become the five mission days.
 *   - The Zoom Meeting and Weekly Check-In sections are removed and their points are folded into
 *     the TEAM Meeting, which becomes the Tuesday evening group meeting (week total stays 40).
 *   - "by Friday at midnight" deadlines become "before Tuesday evening's meeting".
 *   - sourcePdfUrl is dropped; the men's group app exports the member's own journal instead.
 *
 * Everything else (questions, breath prayers, TEAM wording, Deep Roots references) is kept verbatim.
 */
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const DAY_MAP = new Map([
  ["monday", "wednesday"],
  ["tuesday", "thursday"],
  ["wednesday", "friday"],
  ["thursday", "monday"],
  ["friday", "tuesday"]
]);
const MISSION_DAYS_SENTENCE = "Wednesday, Thursday, Friday, Monday, and Tuesday";
const DEFAULT_DESCRIPTION = "Deep Roots weekly missions adapted for the Lifepoint men's group.";
const MEETING_BODY_FROM = "Meet with your TEAM for 1 hour this week.";
const MEETING_BODY_TO = "Meet with your TEAM at the Tuesday evening group meeting.";
const REMOVED_SECTION_IDS = new Set(["friday-zoom", "zoom-meeting", "weekly-check-in", "team-scoring"]);
const MEETING_SECTION_ID = "team-meeting";

main();

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.input || !args.programId) {
    console.error(
      "Usage: npm run adapt-week -- <deep-roots-week.yaml> --program-id <id> [--out <path>] [--description <text>]"
    );
    process.exit(1);
  }

  const source = yaml.load(fs.readFileSync(args.input, "utf8"));
  const notes = [];
  const program = adaptProgram(source, args, notes);
  const weekNumber = program.weeks[0]?.weekNumber ?? "unknown";
  const outPath = args.out ?? path.join("imports", `mens-group-week-${weekNumber}.yaml`);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, yaml.dump(program, { lineWidth: -1, noRefs: true, quotingType: '"' }), "utf8");

  console.log(`Wrote ${outPath}`);
  for (const week of program.weeks) {
    console.log(`  Week ${week.weekNumber}: ${week.title} - ${totalPoints(week)} points, ${week.days.length} days`);
    for (const day of week.days) {
      console.log(`    Day ${day.dayNumber} ${day.label ?? ""}: ${day.sections.length} sections, ${dayPoints(day)} points`);
    }
  }
  if (notes.length > 0) {
    console.log("\nReview these by hand:");
    for (const note of notes) console.log(`  - ${note}`);
  }
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--program-id") args.programId = argv[++index];
    else if (value === "--out") args.out = argv[++index];
    else if (value === "--description") args.description = argv[++index];
    else if (!value.startsWith("--") && !args.input) args.input = value;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function adaptProgram(source, args, notes) {
  if (!source?.program || !Array.isArray(source?.weeks)) {
    throw new Error("Input does not look like a program YAML (expected program + weeks).");
  }

  return {
    program: {
      id: args.programId,
      title: source.program.title ?? "Deep Roots",
      version: String(source.program.version ?? "1.0.0"),
      description: args.description ?? DEFAULT_DESCRIPTION
    },
    weeks: source.weeks.map((week) => adaptWeek(week, notes))
  };
}

function adaptWeek(week, notes) {
  const { sourcePdfUrl: _dropped, ...rest } = week;
  const adapted = {
    ...rest,
    summary: week.summary ? adaptText(week.summary, notes, `week ${week.weekNumber} summary`) : undefined,
    days: week.days.map((day) => adaptDay(day, notes, week.weekNumber))
  };
  if (adapted.summary === undefined) delete adapted.summary;
  return adapted;
}

function adaptDay(day, notes, weekNumber) {
  const label = day.label ? remapDayWord(day.label) : day.label;
  const sections = foldMeetingSections(day.sections, notes, weekNumber, day.dayNumber).map((section) =>
    adaptSection(section, notes, `week ${weekNumber} day ${day.dayNumber}`)
  );

  const adapted = { ...day, sections };
  if (label !== undefined) adapted.label = label;
  return adapted;
}

/**
 * Remove the Zoom Meeting and Weekly Check-In sections and add their points to the TEAM Meeting,
 * which becomes the Tuesday evening group meeting.
 */
function foldMeetingSections(sections, notes, weekNumber, dayNumber) {
  const removed = sections.filter((section) => REMOVED_SECTION_IDS.has(section.id));
  if (removed.length === 0) {
    return sections;
  }

  const meeting = sections.find((section) => section.id === MEETING_SECTION_ID);
  if (!meeting) {
    notes.push(
      `week ${weekNumber} day ${dayNumber}: removed ${removed.map((s) => s.id).join(", ")} but found no "${MEETING_SECTION_ID}" section to receive their points.`
    );
    return sections.filter((section) => !REMOVED_SECTION_IDS.has(section.id));
  }

  const foldedPoints = removed.reduce((total, section) => total + (section.points ?? 0), 0);
  return sections
    .filter((section) => !REMOVED_SECTION_IDS.has(section.id))
    .map((section) => {
      if (section.id !== MEETING_SECTION_ID) return section;
      const body = section.body?.includes(MEETING_BODY_FROM)
        ? section.body.replace(MEETING_BODY_FROM, MEETING_BODY_TO)
        : section.body;
      if (body === section.body) {
        notes.push(`week ${weekNumber} day ${dayNumber}: TEAM Meeting body did not contain "${MEETING_BODY_FROM}"; check it mentions the Tuesday evening meeting.`);
      }
      return { ...section, body, points: (section.points ?? 0) + foldedPoints };
    });
}

function adaptSection(section, notes, where) {
  const adapted = { ...section, id: remapIdWords(section.id) };

  if (section.body) adapted.body = adaptText(section.body, notes, `${where} section ${section.id}`);
  if (section.title) adapted.title = adaptText(section.title, notes, `${where} section ${section.id} title`);

  if (Array.isArray(section.completionItems)) {
    adapted.completionItems = section.completionItems.map((item) => ({
      ...item,
      id: remapIdWords(item.id),
      label: remapDayWord(item.label)
    }));
  }

  if (Array.isArray(section.prompts)) {
    adapted.prompts = section.prompts.map((prompt) => ({
      ...prompt,
      id: remapIdWords(prompt.id),
      label: adaptText(prompt.label, notes, `${where} prompt ${prompt.id}`)
    }));
  }

  return adapted;
}

/** Replace a lone weekday word (e.g. a day label or checkbox label) with its men's group counterpart. */
function remapDayWord(value) {
  const key = value.trim().toLowerCase();
  if (!DAY_MAP.has(key)) return value;
  const mapped = DAY_MAP.get(key);
  return mapped[0].toUpperCase() + mapped.slice(1);
}

/** Rename weekday tokens inside hyphenated ids: monday-q1 -> wednesday-q1. */
function remapIdWords(id) {
  return id
    .split("-")
    .map((part) => (DAY_MAP.has(part) ? DAY_MAP.get(part) : part))
    .join("-");
}

function adaptText(text, notes, where) {
  let result = text;

  result = result.replace(/\bby Friday at midnight\b/gi, "before Tuesday evening's meeting");
  result = result.replace(/\bevery day, Monday through Friday\b/g, `every mission day (${MISSION_DAYS_SENTENCE})`);
  result = result.replace(/\bMonday through Friday\b/g, MISSION_DAYS_SENTENCE);

  const leftoverDays = result.match(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/g);
  if (leftoverDays && !result.includes(MISSION_DAYS_SENTENCE) && !result.includes("Tuesday evening")) {
    notes.push(`${where}: still mentions ${[...new Set(leftoverDays)].join(", ")} - "${truncate(result)}"`);
  }

  return result;
}

function totalPoints(week) {
  return week.days.reduce((total, day) => total + dayPoints(day), 0);
}

function dayPoints(day) {
  return day.sections.reduce((total, section) => total + (section.points ?? 0), 0);
}

function truncate(value, max = 90) {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}
