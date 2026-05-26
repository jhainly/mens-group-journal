# Lifepoint Men's Group Journal

Private guided journaling and discipleship app for Lifepoint men's groups.

The app is built with Next.js, TypeScript, AWS Amplify, Amazon Cognito, and DynamoDB-backed Amplify Data. It is mobile-browser friendly, text-focused, and centered on guided weekly content, private reflections, visible group scoring, and leader-admin group management.

## Current Features

- Cognito account creation, verification, login, logout, and protected member routes.
- Display name captured during account creation and reused across join, leaderboard, and admin views.
- Group join flow by group code.
- Member dashboard with group selection, weekly score, cumulative score, and week navigation.
- Program day screen with Wednesday-to-Tuesday labels, section completion, optional reflections, and back-to-week navigation.
- Daily sections for mind, spirit, body, end-of-day reflection, and bonus point items.
- Optional plain-text reflections encrypted in the browser before storage.
- Leaderboard showing member names and scores only.
- Admin group management with group creation, visible join codes, member counts, and per-group member/leader detail pages.
- Admin YAML import with validation, rendered preview, and publish flow.
- Immutable published program snapshots by content hash.
- Week-scoped PDF export built from locally decrypted reflections.

## Project Structure

```text
app/                         Next.js App Router routes
  auth/                      Login page
  create-account/            Account creation and verification
  join/                      Group code join flow
  dashboard/                 Member dashboard and score summary
  program/week/[...]/        Program day journal screens
  leaderboard/               Group score visibility
  admin/groups/              Admin and leader group management
  admin/import/              YAML import, validation, rendered preview, publish
components/                  Shared UI and feature components
data/                        Sample six-week program content
docs/                        Architecture notes
lib/                         Amplify, validation, encryption, scoring, PDF, export utilities
schemas/                     Example YAML program schema
types/                       Domain and program TypeScript types
amplify/                     Amplify Gen 2 auth and data backend
```

## Local Setup

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Run checks:

```bash
npm run typecheck
npm run lint
npm run build
```

## Local HTTPS and Journal Encryption

Journal reflection encryption requires the browser Web Crypto API. `localhost` works for same-machine testing. A LAN URL like `http://192.168.x.x:3000` may not allow Web Crypto because it is not a secure origin.

For LAN testing, use:

```bash
npm run dev:https
```

Then open the HTTPS URL shown by Next.js.

## Amplify Setup

The backend is defined in:

- `amplify/auth/resource.ts`
- `amplify/data/resource.ts`
- `amplify/backend.ts`

Run a sandbox backend:

```bash
npx ampx sandbox
```

That generates `amplify_outputs.json` for Cognito and Amplify Data. This file is ignored because it is local environment output.

## Security Model

Journal answers must be encrypted in the browser before storage. The backend should never receive plaintext journal answers.

Current flow:

1. User authenticates with Cognito.
2. The browser keeps account-linked journal key material in session storage after login.
3. `lib/encryption.ts` derives an AES-GCM key with PBKDF2-SHA-256, random salt, and 310,000 iterations.
4. Each answer is encrypted locally with a random IV.
5. The app stores only ciphertext, IV, salt, algorithm metadata, prompt identity, completion status, and scoring metadata.
6. There is intentionally no recovery mechanism for encrypted journal content if the user loses access to the encryption secret.

Rules:

- Do not send plaintext answers to APIs, logs, analytics, or DynamoDB.
- Do not expose another member's encrypted answers to leaders or admins.
- PDF export decrypts locally in the browser and exports the currently selected week only.

## Program YAML

Programs contain:

- `program`: id, title, version, description
- `weeks`
- `days`
- `sections`
- `scripture`
- `prompts`
- point values

See:

```text
schemas/program.schema.yaml
```

Admins can paste YAML into `/admin/import`, validate it, preview the rendered member experience, and publish it to a selected group.

## RBAC

- `ADMINS`: admin routes, group visibility, and YAML publishing.
- `LEADERS`: leader/admin group management routes.
- Authenticated members: dashboard, program days, leaderboard, and join flow.

## Git Notes

Generated local artifacts are intentionally ignored:

- `.amplify/`
- `.next/`
- `node_modules/`
- `amplify_outputs.json`
- local environment files

Keep the repository outside OneDrive to avoid file-locking issues with `.git/objects`.

## Remaining Work

- Replace sample program loading with persisted active program snapshots in member views.
- Add stronger group-scoped authorization beyond global `ADMINS` and `LEADERS` roles.
- Move join-code verification into a stricter server-side mutation path.
- Replace the temporary session-storage journal key handoff with a wrapped per-user journal key envelope.
- Add tests for YAML validation, encryption round trips, scoring, PDF export, and authorization rules.
