# Lifepoint Men's Group Journal

Private guided journaling and discipleship app for Lifepoint men's groups.

Members work through weekly program content with daily prompts. Personal reflections are encrypted in the browser — the server never sees plaintext. Group scores are visible on a leaderboard; reflection content is not.

Built with Next.js, TypeScript, AWS Amplify Gen 2, Amazon Cognito, AppSync, and DynamoDB.

## Current State

- The app is branded for Lifepoint Church. Program content now comes from Priority One's **Deep Roots** weekly missions (8-week sessions, two per year), adapted to the men's group schedule: reflection days Wednesday, Thursday, Friday, Monday, Tuesday, with the week due before the Tuesday evening group meeting. `docs/program-yaml-reference.md` is the source of truth for the format and `npm run adapt-week` converts a Priority One week into it.
- Each group runs one program. A member who belongs to several groups picks one from a "Program - Group" switcher; the original 12-week program lives on in archived, read-only groups alongside the new Deep Roots groups.
- Weekly missions support partial scoring: count pickers (`0 1 2` days completed) and named checkboxes (Wednesday through Tuesday, Introduction / Chapter 1), plus structured breath prayers.
- The leaderboard shows member rankings within a group and group standings across groups on the same program; group scores are the group's average individual score multiplied by 3 (maximum 120 for a 40-point week).
- Changes are tracked in [CHANGELOG.md](CHANGELOG.md).

## Local Setup

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

Run checks:

```bash
npm run typecheck
npm run lint
npm run build
```

## Amplify Backend

The backend is defined in:

- `amplify/auth/resource.ts`
- `amplify/data/resource.ts`
- `amplify/backend.ts`
- `amplify/functions/*`

Run a sandbox backend:

```bash
npx ampx sandbox
```

This generates `amplify_outputs.json` for Cognito and Amplify Data. The file is gitignored — it is local environment output.

For a one-time backend validation/deploy:

```bash
npx ampx sandbox --once
```

If AWS SSO credentials have expired, refresh them first:

```bash
aws sso login
```

Production deploys from `main` through Amplify Hosting. Schema changes must stay additive (new optional fields and models only) because the production tables hold live member data.

## Local HTTPS and Journal Encryption

Journal encryption requires the browser Web Crypto API. `localhost` works for same-machine testing. A LAN URL like `http://192.168.x.x:3000` will not work because it is not a secure origin.

For LAN testing:

```bash
npm run dev:https
```

Then open the HTTPS URL shown by Next.js.

## Features

### Members

- Create an account with email verification; new accounts are guided into the group join flow automatically.
- Join a group using a server-verified group code.
- Switch between programs (one per group) from the dashboard and leaderboard; archived programs are labeled and read-only.
- Dashboard with weekly and lifetime score bars, week navigation, and clear empty states when no content has been published yet.
- Daily journal screen with section completion, partial-scoring pickers and checkboxes, breath prayers, and private encrypted reflections. Days use the labels defined in the program (Weekly Mission, then Wednesday through Tuesday for Deep Roots content).
- Leaderboard with weekly and all-time views: member rankings within the group and group standings across the program. No reflection content is visible.
- Account page to change display name (leaderboard names follow automatically) and password, and to leave a group.
- PDF export of the selected week's journal, decrypted locally in the browser: sections, points, completion checkboxes, scripture, breath prayers, prompts, and answers.

### Admins and Leaders

- Create groups, assign join codes, view member counts, and edit group names and codes.
- Import weekly program content via YAML with validation, a rendered preview of the member experience, multi-group targeting, replacement warnings, and a choice of whether the imported weeks are visible to members immediately.
- Show or hide imported weeks per group without deleting them.
- Archive a group when its program ends: members keep read-only access to their journals, scores, and leaderboard, while new entries and score sync are turned off. Archived groups cannot receive imports until unarchived.
- Program management panel showing which weeks each group has, with visibility controls, plus an audit trail of imports, replacements, and show/hide actions.
- Admin user management: enumerate Cognito users and toggle `ADMINS` group membership. The backend prevents an admin from removing their own access.

## Program Content Workflow

1. Receive the week's `deep-roots-week-{n}.yaml` from Priority One and save it under `imports/deep-roots/`.
2. Convert it: `npm run adapt-week -- imports/deep-roots/deep-roots-week-{n}.yaml --program-id <session id>` (use the same id for all eight weeks of a session, e.g. `lifepoint-deep-roots-fall-2026`).
3. Review the converter's notes and the checklist in `docs/program-yaml-reference.md`.
4. Paste `imports/mens-group-week-{n}.yaml` into `/admin/programs/import`, preview, and import to the Deep Roots groups.

To start a new session, create new groups (members join with a new code), archive the previous session's groups, and import Week 1 with a new program id.

## Documentation

- [CHANGELOG.md](CHANGELOG.md): notable changes by date.
- [docs/program-yaml-reference.md](docs/program-yaml-reference.md): YAML conventions, converter rules, and the import review checklist.
- [docs/dynamodb-data-model.md](docs/dynamodb-data-model.md): data model notes.
- [docs/security-review-2026-06-10.md](docs/security-review-2026-06-10.md): June 2026 security review and open findings.
- [docs/uat-program-import-active-content.md](docs/uat-program-import-active-content.md): UAT script for import and active content loading.

## Project Structure

```text
app/                         Next.js App Router routes
  auth/                      Login page
  account/                   Signed-in account, display name, password, groups
  create-account/            Account creation and verification
  reset-password/            Password reset flow
  join/                      Group code join flow
  dashboard/                 Member dashboard, program switcher, score summary
  program/week/[...]/        Program day journal screens
  leaderboard/               Member rankings and group standings
  admin/                     Redirects to admin/groups
  admin/groups/              Admin group list and per-group drilldown (weeks, archive)
  admin/programs/            Week assignments and visibility per group
  admin/programs/import/     YAML week import, validation, rendered preview, import to groups
  admin/programs/audit/      Program import/replacement/show/hide audit log
  admin/users/               Admin role management
components/                  Shared UI and feature components
data/                        Starter YAML template shown on the admin import page
docs/                        YAML reference, data model, security review, UAT notes
imports/                     Converted weekly YAML ready to import (deep-roots/ holds the originals)
lib/                         Amplify, validation, encryption, scoring, PDF export, and service utilities
scripts/                     adapt-deep-roots-week.mjs converter
types/                       Program TypeScript types
amplify/                     Amplify Gen 2 auth, data, and function backend
  functions/                 AppSync resolver Lambdas
```

## Backend Functions

- `join-group-by-code`: hashes a submitted join code, finds the matching group, and creates membership.
- `manage-admin-users`: lists Cognito users and toggles Cognito `ADMINS` group membership.
- `sync-user-score`: recalculates and persists weekly/cumulative score rows from section progress; skips the write for archived groups.
- `sync-display-name`: updates leaderboard score rows after a profile display-name change.

## Roles

There are three access levels:

| Role | Access |
|------|--------|
| **Authenticated member** | Dashboard, program days, leaderboard, join flow, account page |
| **LEADERS** | Everything above, plus group and program management |
| **ADMINS** | Everything above, plus admin-role management and full user visibility |

Admins manage role assignments from `/admin/users` by toggling Cognito group membership.

## Security Model

**The core rule:** journal reflections must be encrypted in the browser before storage. The backend never receives plaintext answers, and no admin or leader can read another member's reflection content.

How it works:

1. The user authenticates with Cognito.
2. On first sign-in, the browser generates a random 32-byte per-user journal key.
3. That key is wrapped (encrypted) using a key derived from the user's **Cognito sub** (a stable, unique user ID) via PBKDF2-SHA-256 with a random salt and 310,000 iterations. The result is stored as a V2 envelope on the user profile.
4. On later sign-ins, the browser re-derives the wrapping key from the Cognito sub and unwraps the journal key locally. The unwrapped key lives only in `localStorage` for the current session.
5. Each journal answer is encrypted locally with AES-GCM, using a per-answer key derived from the journal key via PBKDF2 with a fresh random salt.
6. The server stores only ciphertext, IV, salt, algorithm metadata, prompt identity, completion status, and scoring metadata — never plaintext.

**Recovery:** if the session key is lost, it is recovered automatically on the next sign-in as long as the user can authenticate with Cognito. Cognito supports email-based account recovery. Journal content cannot be recovered if the Cognito account itself is permanently lost.

**Legacy V1 envelopes** (wrapped with email+password from before the V2 migration) are still readable — the app detects `version: 1` and unwraps using the email+password path.

Additional rules:

- Do not send plaintext answers to APIs, logs, analytics, or DynamoDB.
- Do not expose another member's encrypted answers to leaders or admins.
- PDF export decrypts locally in the browser and exports the currently selected week only.
- `UserScore` rows are written only by the `sync-user-score` Lambda, never by the client.

## Program YAML

Program content is structured as a hierarchy: **program → weeks → days → sections → prompts / breath prayers / scripture**. Each section has a point value and may define partial-scoring fields:

```yaml
completionUnit: day
maxCompletions: 5
pointsPerCompletion: 1
points: 5
completionItems:
  - id: wednesday
    label: Wednesday
```

Admins paste YAML into `/admin/programs/import`, validate and preview it, then import it to one or more groups. If an imported week number already exists for a selected group, the import flow warns before replacing it. The import page is pre-filled with a starter template from `data/sampleProgram.ts`; ready-to-import weeks live in `imports/`. See `docs/program-yaml-reference.md` for the full rules.

## Git Notes

Generated local artifacts are gitignored:

- `.amplify/`
- `.next/`
- `node_modules/`
- `amplify_outputs.json`
- local environment files and `.claude/settings.local.json`

Line endings are normalized to LF by `.gitattributes`, so Windows checkouts do not produce CRLF-only diffs.

Keep the repository outside OneDrive to avoid file-locking issues with `.git/objects`.

Add a line to `CHANGELOG.md` under today's date for any user-visible change.

## Remaining Work

- Add group-scoped authorization for leaders (currently LEADERS have global access to all groups); see the security review for details.
- Add tests for YAML validation, the week converter, encryption round trips, scoring, PDF export, and authorization rules.
- Add UAT coverage for admin-role toggling, archiving, and group-scoped leader permissions.
- Lifetime-points badges are parked on the `badges` branch (uncommitted work from June, including a `UserBadge` model) pending review.
