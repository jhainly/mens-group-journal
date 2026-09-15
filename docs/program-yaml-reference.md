# Program YAML Reference

This guide is the source of truth for the YAML the Lifepoint men's group app imports. Update it whenever YAML structure, wording rules, scoring behavior, or import expectations change.

The app currently runs two kinds of content:

- The original 12-week Lifepoint program (`lifepoint-mens-group-v1`): seven-day weeks with Mind / Spirit / Body / End of Day sections. Its groups are archived and read-only; the format is documented here only so old content can still be understood.
- Priority One Deep Roots weekly missions, adapted for the men's group schedule. This is the active format and the rest of this guide describes it.

## Converting a Deep Roots Week

Priority One delivers one week at a time as `deep-roots-week-{n}.yaml`. Keep their original under `imports/deep-roots/` and generate the men's group version with:

```bash
npm run adapt-week -- imports/deep-roots/deep-roots-week-3.yaml --program-id lifepoint-deep-roots-fall-2026
```

This writes `imports/mens-group-week-3.yaml`. Options: `--out <path>` and `--description <text>`.

Use one `--program-id` for the whole 8-week session (for example `lifepoint-deep-roots-fall-2026`, then `lifepoint-deep-roots-spring-2027`). Progress, journals, and scores are keyed by program id, so every week of a session must share it, and a new session must use a new id so it starts over at Week 1.

The converter applies these rules and prints anything it wants a human to double-check:

| Deep Roots source | Men's group result |
| --- | --- |
| Reflection days labeled Monday, Tuesday, Wednesday, Thursday, Friday | Relabeled Wednesday, Thursday, Friday, Monday, Tuesday (same order, same day numbers). Section, prompt, and checkbox ids that embed the weekday are renamed to match (`monday-q1` -> `wednesday-q1`). |
| Weekday checkbox lists (Chapter Challenge, Physical Action) | Same relabeling, so the checkboxes read Wednesday, Thursday, Friday, Monday, Tuesday. |
| "every day, Monday through Friday" | "every mission day (Wednesday, Thursday, Friday, Monday, and Tuesday)" |
| `TEAM Meeting` (5 points), `Zoom Meeting` (2 points), and `Weekly Check-In` / TEAM Scoring (1 point) | Combined into one 8-point `Weekly Meeting` section (`id: weekly-meeting`), moved to the end of Day 1 so it is the last weekly mission task. Its body starts "Attend the Tuesday evening weekly meeting. The whole program meets together for group discussion, then splits into TEAMs for small group discussion." followed by the rest of the Deep Roots meeting text. The week still totals 40 points. |
| "by Friday at midnight" | "before Tuesday evening's meeting" |
| "or contact me at <someone>@priorityone.org" | "or a group leader". Any other Priority One contact detail is reported for manual review. |
| `sourcePdfUrl` | Dropped. The men's group app exports the member's own journal as a PDF instead of serving the Priority One handout. |
| `program.id` | Replaced by `--program-id`. |
| `program.description` | Replaced with a men's group description. |
| Everything else | Kept verbatim, including Deep Roots, TEAM, and TEAM Captain wording. |

After converting, open `/admin/programs/import`, paste the file, preview it, and check the review list at the end of this guide before importing.

## File Conventions

- Priority One originals: `imports/deep-roots/deep-roots-week-{n}.yaml`.
- Converted weeks ready to import: `imports/mens-group-week-{n}.yaml`.
- Do not add PDF links or `sourcePdfUrl` to men's group YAML.

## Required YAML Shape

```yaml
program:
  id: lifepoint-deep-roots-fall-2026
  title: Deep Roots
  version: "1.0.0"
  description: Deep Roots weekly missions adapted for the Lifepoint men's group.
weeks:
  - weekNumber: 1
    title: Week One Mission
    summary: Complete the Week One mission, including the daily Reading and Reflection, before Tuesday evening's meeting.
    days:
      - dayNumber: 1
        label: Weekly Mission
        title: Weekly Mission
        sections:
          - id: chapter-challenge
            title: Chapter Challenge
            body: Weekly challenge instructions from the source content.
            completionUnit: day
            completionItems:
              - id: wednesday
                label: Wednesday
              - id: thursday
                label: Thursday
              - id: friday
                label: Friday
              - id: monday
                label: Monday
              - id: tuesday
                label: Tuesday
            maxCompletions: 5
            points: 5
            pointsPerCompletion: 1
          # Other Weekly Mission sections go here. The Weekly Meeting is always last.
          - id: weekly-meeting
            title: Weekly Meeting
            body: Attend the Tuesday evening weekly meeting. The whole program meets together for group discussion, then splits into TEAMs for small group discussion. Check in with each other, recite the memory verse, discuss the daily book questions, and pray for each other.
            points: 8
```

## Program Rules

- `program.id` is the session id shared by every week of an 8-week run and unique across runs.
- `program.title` is shown in the member switcher as "Program - Group", so keep it short (`Deep Roots`).
- `program.version` should be a string.
- A YAML file may include one or more weeks, but the usual workflow imports one week at a time.

## Week Rules

- `weekNumber` must be a positive integer and must not duplicate another week in the same file.
- `title` should match the source content, such as `Week One Mission`. Titles that already start with "Week" are shown as-is; other titles are shown as `Week N: Title`.
- `summary` should give the completion deadline (`before Tuesday evening's meeting`) and mention the daily Reading and Reflection when the source requires it.

## Day Rules

- Day 1 is the weekly mission overview: `label: Weekly Mission`, `title: Weekly Mission`.
- Reflection days use `title: Reading and Reflection` and, in order, `label: Wednesday`, `Thursday`, `Friday`, `Monday`, `Tuesday` (day numbers 2-6). The group meets Tuesday evening and the new week starts Wednesday; there is no weekend content.
- `dayNumber` must be unique within a week.
- Days without a `label` fall back to the positional weekday starting from Wednesday (used by the original 12-week content).

## Section Rules

- Every section needs `id`, `title`, and `points`.
- `id` values are lowercase, stable, and hyphenated. Section ids must be unique within a day.
- Use `body` for instructions copied or adapted from the source.
- Use `points: 0` for instructional sections. Zero-point sections are display-only: no checkbox, no point label, no fallback reflection box, but they can still show instructions, breath prayers, or prompts.
- There is no `TEAM Meeting`, `Weekly Check-In`, or `Zoom Meeting` section. Unlike Deep Roots, where TEAMs meet on their own, the whole Lifepoint program meets together on Tuesday evening and then splits into TEAMs, and the app tracks scores.
- `Weekly Meeting` (`id: weekly-meeting`) is the last section of Day 1 and is worth 8 points (5 former TEAM Meeting + 2 former Zoom + 1 former check-in) so a week still totals 40.
- Do not include Priority One contact details (for example the author's email) in men's group content; the converter strips them and reports the affected prompt for review.
- The weekly `Chapter Challenge` belongs on Day 1 and uses one named checkbox per mission day when it is worth 1 point per day.
- Daily book-question sections use `title: Answer the daily book question.` and are zero-point prompt sections when the weekly `Chapter Challenge` already awards those points.
- A multi-part `Chapter Reading` stays one section with one named checkbox per chapter or reading.
- Each Reading and Reflection day has exactly one scored section (`spiritual-action`, 1 point). Supporting sections are zero-point.

## Partial Scoring Rules

Use partial scoring for any item that awards points per repeated completion.

```yaml
- id: aerobic-exercise
  title: Aerobic Exercise
  body: 10 minutes, 2 days this week. Some suggestions are walking, running, hiking, bike riding, swimming, etc.
  completionUnit: day
  maxCompletions: 2
  points: 2
  pointsPerCompletion: 1
```

- `points` is the maximum total for the section.
- `pointsPerCompletion` is earned for each completed unit.
- `maxCompletions` is the most a member can report.
- `completionUnit` is singular (`day`); the app pluralizes it.
- Without `completionItems` the app shows a `0` to `maxCompletions` picker. With `completionItems` it shows named checkboxes; keep `maxCompletions` equal to the number of items.

## Prompts

- Use `prompts` for questions that need a written response. Each prompt needs a unique `id` and a `label`.
- Prefer source-faithful labels.
- Prompts do not support an `optional` flag; the old content's `optional: true` entries are ignored.

## Breath Prayers

```yaml
- id: breath-prayer
  title: Breath Prayer
  breathPrayer:
    - inhale: You breathed life into me...
      exhale: Every breath is Your gift to me.
  points: 0
```

Keep inhale and exhale in separate fields, keep the source order, and place the breath prayer section after the Bible reading questions and before the `Apply God's Truth to Your Life` prompts. Reflection days are ordered: book question, spiritual action (scored), breath prayer, apply.

## Scripture

Use `scripture` (`reference` + `text`) only when the full passage text should be displayed. If the source only says to read a passage, put that instruction in `body`.

## Journal PDF Export

Members export their own week as a PDF from the dashboard. The export renders section titles and points, completion checkboxes and counts, scripture, breath prayers, prompts, and the member's decrypted answers. It does not include any Priority One handout.

## Import Review Checklist

Before importing a converted week:

- Run `npm run adapt-week` and read any "Review these by hand" notes.
- Confirm `program.id` matches the current session id used by earlier weeks.
- Confirm Day 1 is `Weekly Mission` and reflection days are labeled Wednesday, Thursday, Friday, Monday, Tuesday.
- Confirm `Chapter Challenge` checkboxes read Wednesday through Tuesday.
- Confirm there is no `TEAM Meeting`, `Zoom Meeting`, or `Weekly Check-In` section, and that `Weekly Meeting` is the last Day 1 section worth 8 points.
- Confirm no Priority One contact details remain in the text.
- Confirm deadlines say `before Tuesday evening's meeting`.
- Confirm every question from the source is present as a prompt and breath prayers are between the Bible questions and the apply prompts.
- Confirm the week totals 40 points (35 on Day 1 plus 1 per reflection day).
- Run `npm run typecheck` and `npm run lint` if any code changed.
- Preview the import page and choose whether the week should be visible immediately.
