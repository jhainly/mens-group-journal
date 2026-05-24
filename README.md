# Men's Group Journal

Private guided journaling and discipleship app for men's groups.

The app is built with Next.js, TypeScript, AWS Amplify, Amazon Cognito, and DynamoDB-backed Amplify Data. It is mobile-browser friendly, text-focused, and designed around weekly group programs with private client-side encrypted journal answers.

## Current V1 Features

- Cognito account creation, verification, login, logout, and route protection.
- Display-name capture during account creation.
- Group join flow by group code.
- Member dashboard with weekly score, cumulative score, and week/day navigation.
- Program day screen with Wednesday-to-Tuesday day labels.
- Daily sections for mind, spirit, body, end-of-day reflection, and bonus point items.
- Section-level completion checkboxes and scoring.
- Optional plain-text reflections encrypted in the browser before storage.
- Leaderboard showing member names and scores.
- Admin group management.
- Admin YAML import with validation and rendered content preview before publishing.
- Immutable published program snapshots by content hash.
- PDF export utility stub for future personal journal export.

## Project Structure

```text
app/                         Next.js App Router routes
  auth/                      Login page
  create-account/            Account creation and verification
  join/                      Group code join flow
  dashboard/                 Member dashboard and week selector
  program/week/[...]/        Program day journal screens
  leaderboard/               Group score visibility
  admin/groups/              Leader group management
  admin/import/              YAML import, validation, rendered preview, publish
components/                  Shared UI and feature components
data/                        Sample program content
docs/                        Architecture notes
lib/                         Amplify, validation, encryption, scoring, export utilities
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

## Local HTTPS

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
- PDF export must decrypt locally in the browser.

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

Admins can paste YAML into `/admin/import`, validate it, preview the rendered member experience, and publish it to a group.

## RBAC

- `ADMINS`: admin routes and group management.
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

- Move join-code verification into a custom server-side mutation.
- Replace the temporary session-storage journal key handoff with a wrapped per-user journal key envelope.
- Load active groups/program snapshots from persisted data instead of sample content.
- Persist and rehydrate prior answers and completion status in the UI.
- Build local-only PDF rendering from decrypted answers.
- Add tests for YAML validation, encryption round trips, scoring, and authorization rules.
- Add group-scoped authorization beyond global `ADMINS` and `LEADERS` roles.
