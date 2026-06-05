# Lifepoint Men's Group Journal

Private guided journaling and discipleship app for Lifepoint men's groups.

Members work through weekly discipleship content with daily prompts across five sections (Mind, Spirit, Body, End-of-Day reflection, Bonus). Personal reflections are encrypted in the browser — the server never sees plaintext. Group scores are visible on a leaderboard; reflection content is not.

Built with Next.js, TypeScript, AWS Amplify, Amazon Cognito, and DynamoDB.

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
- Dashboard with group selection, weekly score, cumulative score, week navigation, and clear empty states when no content has been published yet.
- Daily program screen with five sections (Mind, Spirit, Body, End-of-Day, Bonus), section completion tracking, optional private reflections, and back-to-week navigation. Days are labeled Wednesday through Tuesday.
- Leaderboard showing member names and scores — no reflection content is visible.
- Account page showing signed-in user, journal key status, and option to leave the current group.
- PDF export of the current week's reflections, decrypted locally in the browser. Scripture is italicized; journal questions are formatted as bullet prompts.

### Admins and Leaders

- Create groups, assign join codes, view member counts, and edit group names and codes.
- Import weekly program content via YAML with validation, a rendered preview of the member experience, multi-group assignment, and replacement warnings before publishing.
- Remove active weeks from one or more groups.
- Program management panel showing which weeks are assigned to each group, plus a recent audit trail of imports, replacements, and removals.
- Drill into a group to change its name, change its join code, or remove active weeks from that group only.
- Admin user management: enumerate Cognito users and toggle `ADMINS` group membership. The backend prevents an admin from removing their own access.

## Project Structure

```text
app/                         Next.js App Router routes
  auth/                      Login page
  account/                   Signed-in account and journal key status
  create-account/            Account creation and verification
  join/                      Group code join flow
  dashboard/                 Member dashboard and score summary
  program/week/[...]/        Program day journal screens
  leaderboard/               Group score visibility
  admin/                     Admin landing page
  admin/groups/              Admin group list and per-group drilldown
  admin/programs/            Program assignment and week removal management
  admin/programs/import/     YAML week import, validation, rendered preview, publish
  admin/programs/audit/      Program import/replacement/removal audit log
  admin/users/               Admin role management
components/                  Shared UI and feature components
data/                        Sample six-week program content
docs/                        Architecture notes
lib/                         Amplify, validation, encryption, scoring, PDF, export utilities
schemas/                     Example YAML program schema
types/                       Domain and program TypeScript types
amplify/                     Amplify Gen 2 auth and data backend
  functions/                 Node.js 24 AppSync resolver Lambdas for joins and admin role management
```

## Roles

There are three access levels:

| Role | Access |
|------|--------|
| **Authenticated member** | Dashboard, program days, leaderboard, join flow |
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

## Program YAML

Program content is structured as a hierarchy: **program → weeks → days → sections**. Each section has scripture, journal prompts, and a point value.

Top-level fields:

- `program`: id, title, version, description
- `weeks` → `days` → `sections` → `scripture`, `prompts`, point values

See `schemas/program.schema.yaml` for the full schema.

Admins paste YAML into `/admin/programs/import`, validate and preview it, then publish it to one or more groups. If an imported week number is already active for a selected group, the import flow warns before replacing it. Weeks can also be removed from groups from `/admin/programs` or from the per-group drilldown at `/admin/groups`.

## Git Notes

Generated local artifacts are gitignored:

- `.amplify/`
- `.next/`
- `node_modules/`
- `amplify_outputs.json`
- local environment files

Keep the repository outside OneDrive to avoid file-locking issues with `.git/objects`.

## Remaining Work

- Add group-scoped authorization for leaders (currently LEADERS have global access to all groups).
- Add tests for YAML validation, encryption round trips, scoring, PDF export, and authorization rules.
- Add UAT coverage for admin-role toggling and group-scoped leader permissions.
