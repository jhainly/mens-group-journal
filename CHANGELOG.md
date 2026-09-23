# Changelog

All notable changes to Lifepoint Men (formerly the Lifepoint Men's Group Journal) are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Entries are grouped by the date they
land on `main` rather than by release number, because the app deploys continuously through Amplify Hosting. When you
commit a user-visible change, add a line under today's date (create the heading if it does not exist yet), newest
date first.

Entry types: `Added`, `Changed`, `Fixed`, `Removed`, `Content` (weekly program material), `Docs`.

## 2026-09-14

### Added

- "Resend code" button on the account verification step.
- "Join another group" on the dashboard and "Join a group" on the account page, so existing members can join a new
  program's group with a code (previously the join link only appeared for members with no group).
- `npm run sandbox`, `sandbox:once`, and `sandbox:delete` scripts pinned to the `lifepoint` AWS profile (us-east-1).
- `LIFEPOINT_BOOTSTRAP_ADMIN_EMAIL` deploy-time option that adds an existing user to `ADMINS` (for fresh sandboxes).

### Changed

- Site renamed from "Lifepoint Men's Group Journal" to "Lifepoint Men" (page title, header, home page, verification
  email subject).
- The dashboard and leaderboard switcher is labeled "Groups"; entries still read "Program - Group".
- Group standings on the leaderboard compare only groups enrolled in the same program id, so separate Deep Roots
  sessions are never mixed (previously groups were also matched by program title).
- The converter turns the Deep Roots TEAM Meeting into an 8-point "Weekly Meeting" placed last on Day 1 (the whole
  program meets Tuesday evening, then splits into TEAMs) and replaces "contact me at ...@priorityone.org" with
  "a group leader". Weeks 1-2, the import template, and the YAML reference were updated to match.

### Docs

- README documents the deployment differences from the Deep Roots app: us-east-1, Cognito default email sender, and
  default Amplify Hosting domain (no SES sender or custom domain here).

## 2026-09-12

### Added

- Deep Roots program support, ported from the Priority One Deep Roots fork of this app: partial scoring
  (`completionUnit`, `maxCompletions`, `pointsPerCompletion`) with count pickers or named checkboxes
  (`completionItems`), structured breath prayers, explicit day labels, and display-only zero-point sections.
- Groups switcher on the dashboard and leaderboard lists groups as "Program - Group", defaulting to the first
  non-archived group. Each group runs one program.
- Group archiving. Admins archive a group when its program ends; members keep read-only access to journals, scores,
  and leaderboard while saves and score sync stop. Archived groups cannot receive imports until unarchived.
- Show or hide imported weeks per group (replaces removing weeks), with `show_week` / `hide_week` audit events and a
  "visible to group members immediately" toggle on import.
- Group standings on the leaderboard alongside member rankings; group scores are the average individual score x 3.
- `sync-display-name` Lambda so leaderboard names update when a member changes their display name.
- Login form links to account creation.
- `npm run adapt-week`: converts a Priority One Deep Roots week YAML to the men's group format (Wednesday-Tuesday
  reflection days, Zoom and Check-In folded into the meeting so the week stays 40 points, Tuesday deadline wording,
  stable per-session program id).
- `.gitattributes` normalizing line endings to LF.
- This changelog.

### Changed

- Week dropdowns show "Week N: Title", or the title alone when it already starts with "Week".
- The journal PDF export renders completion checkboxes, completion counts, and breath prayers.
- Scores are computed from points earned per section rather than a completed flag, in the client and the
  `sync-user-score` Lambda.
- The import page starter template now uses the Deep Roots men's group format.
- Unauthenticated navigation no longer shows Join.

### Removed

- Week removal actions, superseded by show/hide.
- Orphaned `AdminHome` component, legacy `.eslintrc.json`, the stale `schemas/program.schema.yaml` example, and the
  unused `optional` prompt flag.

### Content

- Deep Roots Weeks 1 and 2 (`imports/mens-group-week-1.yaml`, `imports/mens-group-week-2.yaml`), 40 points each,
  with Priority One's originals under `imports/deep-roots/`.

### Docs

- `docs/program-yaml-reference.md`: men's group YAML conventions, converter rules, and import review checklist.
- README rewritten for the Deep Roots content workflow, program switcher, archiving, and current project structure.
- `docs/security-review-2026-06-10.md` committed (it had been sitting untracked).

## Earlier history (2026-05-23 to 2026-07-17)

Initial scaffold, group directory and join flow, admin import/export flows, journal auto-save and key-envelope fixes,
V2 journal key wrapping by Cognito `sub`, server-side `UserScore` writes, weekly/all-time leaderboards,
unconfirmed-account verification, and self-service password reset. See `git log` for the full record.
