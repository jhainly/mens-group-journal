# Lifepoint Men's Group Journal

Private guided journaling and discipleship app for Lifepoint men's groups.

The app is built with Next.js, TypeScript, AWS Amplify, Amazon Cognito, and DynamoDB-backed Amplify Data. It is mobile-browser friendly, text-focused, and centered on guided weekly content, private reflections, visible group scoring, and leader-admin group management.

## Current Features

- Cognito account creation, verification, login, logout, and protected member routes.
- Display name captured during account creation and reused across join, leaderboard, and admin views.
- Group join flow by server-verified group code.
- Member dashboard with group selection, weekly score, cumulative score, and week navigation.
- Member dashboard and day views load the selected group's published active program snapshot.
- Program day screen with Wednesday-to-Tuesday labels, section completion, optional reflections, and back-to-week navigation.
- Daily sections for mind, spirit, body, end-of-day reflection, and bonus point items.
- Optional plain-text reflections encrypted in the browser before storage.
- Leaderboard showing member names and scores only.
- Admin group management with group creation, visible join codes, member counts, and per-group member/leader detail pages.
- Admin YAML import with validation, rendered preview, and publish flow.
- Immutable published program snapshots by content hash.
- Week-scoped PDF export built from locally decrypted reflections.
- Account page for viewing the signed-in user and journal key status.
- Admin access management that enumerates Cognito users and toggles the `ADMINS` role with a checkbox.

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
  admin/groups/              Admin and leader group management
  admin/import/              YAML import, validation, rendered preview, publish
components/                  Shared UI and feature components
data/                        Sample six-week program content
docs/                        Architecture notes
lib/                         Amplify, validation, encryption, scoring, PDF, export utilities
schemas/                     Example YAML program schema
types/                       Domain and program TypeScript types
amplify/                     Amplify Gen 2 auth and data backend
  functions/                 AppSync resolver Lambdas for joins and admin role management
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

For a one-time backend validation/deploy, run:

```bash
npx ampx sandbox --once
```

If AWS SSO credentials have expired, refresh them first:

```bash
aws sso login
```

## Security Model

Journal answers must be encrypted in the browser before storage. The backend should never receive plaintext journal answers.

Current flow:

1. User authenticates with Cognito.
2. On first sign-in for a new profile, the browser generates a random per-user journal key. Existing profiles without an envelope wrap the prior sign-in-derived journal secret once so previously encrypted answers remain readable.
3. The browser wraps that journal key with an AES-GCM key derived from the user's email and password with PBKDF2-SHA-256, random salt, and 310,000 iterations.
4. The app stores only the wrapped journal key envelope on the user profile: ciphertext, IV, salt, algorithm metadata, and version.
5. On later sign-ins, the browser unwraps the journal key locally and keeps the unwrapped key only for the current browser session.
6. `lib/encryption.ts` uses the unwrapped journal key to encrypt each answer locally with AES-GCM and a random IV.
7. The app stores only answer ciphertext, IV, salt, algorithm metadata, prompt identity, completion status, and scoring metadata.
8. There is intentionally no recovery mechanism for encrypted journal content if the user loses access to the password needed to unwrap the journal key.

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

- `ADMINS`: admin routes, group visibility, YAML publishing, and admin-role management.
- `LEADERS`: leader/admin group management routes.
- Authenticated members: dashboard, program days, leaderboard, and join flow.

Admins can manage admin access from `/admin/groups`. The admin access panel lists Cognito users and toggles membership in the Cognito `ADMINS` group. The backend prevents an admin from removing their own admin access.

## Git Notes

Generated local artifacts are intentionally ignored:

- `.amplify/`
- `.next/`
- `node_modules/`
- `amplify_outputs.json`
- local environment files

Keep the repository outside OneDrive to avoid file-locking issues with `.git/objects`.

## Remaining Work

- Add stronger group-scoped authorization beyond global `ADMINS` and `LEADERS` roles.
- Add tests for YAML validation, encryption round trips, scoring, PDF export, and authorization rules.
- Add UAT coverage for admin-role toggling and group-scoped leader permissions.
