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
 *     the TEAM Meeting, which becomes the "Weekly Meeting" (the whole program meets Tuesday evening,
 *     then splits into TEAMs; week total stays 40) and is moved to the end of Day 1 so it is the
 *     last weekly mission task.
 *   - "by Friday at midnight" deadlines become "before Tuesday evening's meeting".
 *   - "or contact me at <someone>@priorityone.org" becomes "or a group leader"; any other Priority One
 *     contact detail is reported for manual review.
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
const MEETING_BODY_TO =
  "Attend the Tuesday evening weekly meeting. The whole program meets together for group discussion, then splits into TEAMs for small group discussion.";
const REMOVED_SECTION_IDS = new Set(["friday-zoom", "zoom-meeting", "weekly-check-in", "team-scoring"]);
const SOURCE_MEETING_SECTION_ID = "team-meeting";
const MEETING_SECTION_ID = "weekly-meeting";
const MEETING_SECTION_TITLE = "Weekly Meeting";

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
 * Remove the Zoom Meeting and Weekly Check-In sections, add their points to the Deep Roots TEAM
 * Meeting, and turn that section into the "Weekly Meeting" (the whole program meets Tuesday
 * evening, then splits into TEAMs). The meeting is moved to the end of the day so it is the last
 * weekly mission task.
 */
function foldMeetingSections(sections, notes, weekNumber, dayNumber) {
  const removed = sections.filter((section) => REMOVED_SECTION_IDS.has(section.id));
  const meeting = sections.find((section) => section.id === SOURCE_MEETING_SECTION_ID);
  const kept = sections.filter(
    (section) => !REMOVED_SECTION_IDS.has(section.id) && section.id !== SOURCE_MEETING_SECTION_ID
  );

  if (!meeting) {
    if (removed.length > 0) {
      notes.push(
        `week ${weekNumber} day ${dayNumber}: removed ${removed.map((s) => s.id).join(", ")} but found no "${SOURCE_MEETING_SECTION_ID}" section to receive their points.`
      );
    }
    return kept;
  }

  const foldedPoints = removed.reduce((total, section) => total + (section.points ?? 0), 0);
  let body;
  if (meeting.body?.includes(MEETING_BODY_FROM)) {
    body = meeting.body.replace(MEETING_BODY_FROM, MEETING_BODY_TO);
  } else {
    body = meeting.body ? `${MEETING_BODY_TO} ${meeting.body}` : MEETING_BODY_TO;
    notes.push(
      `week ${weekNumber} day ${dayNumber}: TEAM Meeting body did not start with "${MEETING_BODY_FROM}"; the weekly meeting lead-in was prepended instead - read the result.`
    );
  }

  return [
    ...kept,
    {
      ...meeting,
      id: MEETING_SECTION_ID,
      title: MEETING_SECTION_TITLE,
      body,
      points: (meeting.points ?? 0) + foldedPoints
    }
  ];
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

  // Priority One contact details do not apply to the Lifepoint program.
  result = result.replace(/\bor contact me at \S+@priorityone\.org\b/gi, "or a group leader");
  if (/@priorityone\.org|priorityone\.org/i.test(result)) {
    notes.push(`${where}: still contains a Priority One contact/link - "${truncate(result)}"`);
  }

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
