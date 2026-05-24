# Men's Group Journal

Private guided journaling and discipleship app for men's groups. Built with Next.js, TypeScript, AWS Amplify, Amazon Cognito, and DynamoDB-backed Amplify Data.

## What This V1 Scaffold Includes

- Mobile-first Next.js app shell with member and admin routes.
- Cognito sign-in and account creation forms with display name capture.
- Group join and leader group management screens wired to Amplify Data.
- Route guards for member-only and admin-only pages using Cognito sessions and Cognito groups.
- YAML program schema, TypeScript types, and import validation.
- Admin YAML preview and publish flow with deterministic content hash for immutable program snapshots.
- Program/week/day journal views with optional reflection prompts.
- Client-side AES-GCM encryption utility using the Web Crypto API.
- Scoring utility for weekly and cumulative points.
- Leaderboard view with member names and scores.
- PDF export utility stub.
- DynamoDB data model in [docs/dynamodb-data-model.md](./docs/dynamodb-data-model.md).

## Proposed Project Structure

```text
app/                         Next.js App Router pages
  auth/                      Login/signup scaffold
  join/                      Group code join flow
  dashboard/                 Member dashboard and program navigator
  program/week/[...]/        Week/day journal screens
  leaderboard/               Group score visibility
  admin/groups/              Leader group management
  admin/import/              YAML import, validation, preview, publish stub
components/                  Shared UI components
data/                        Sample program and demo rows
docs/                        Architecture notes
lib/                         Amplify, validation, encryption, scoring, export utilities
schemas/                     Example YAML program schema
types/                       Domain and program TypeScript types
amplify/                     Amplify Gen 2 auth and data backend
```

## Encryption Model

Journal answers are encrypted in the browser before storage. The backend should never receive plaintext answers.

The intended flow:

1. Users authenticate with Cognito email/password.
2. The browser keeps account-linked journal key material in session storage after login or account creation.
3. `lib/encryption.ts` derives an AES-GCM key from that client-side material with PBKDF2-SHA-256, a random salt, and 310,000 iterations.
4. Each answer is encrypted locally with a random 96-bit IV.
5. The app sends only ciphertext, IV, salt, algorithm, key derivation metadata, prompt identity, and non-sensitive scoring/completion metadata to DynamoDB.
6. Raw encryption key material is never stored in DynamoDB, app models, analytics, or server logs.
7. Decryption happens only in the browser for the authenticated account.
8. There is intentionally no recovery mechanism for encrypted journal content if the user loses access to the account-linked key material.

Implementation rules:

- API request types for answers must not include plaintext fields.
- Server actions, route handlers, logs, and validation errors must never print answer bodies.
- Leader/admin queries must be unable to read another user's `ANSWER#` rows.
- PDF export must decrypt locally and render in the browser from local plaintext.

## YAML Program Shape

See [schemas/program.schema.yaml](./schemas/program.schema.yaml).

Top-level fields:

- `program`: id, title, version, optional description.
- `weeks`: arbitrary-length list.
- `days`: arbitrary-length list per week.
- `sections`: structured content blocks with points.
- `scripture`: embedded reference/text blocks. No external Bible API is required.
- `prompts`: optional reflection prompts.

Published programs should be stored as immutable snapshots with a content hash. A group has exactly one `ACTIVE_PROGRAM` pointer at a time.

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

Journal reflection encryption requires the browser Web Crypto API. For local testing, use `http://localhost:3000` on the same machine. If you test from another device on your network, `http://192.168.x.x:3000` may not allow Web Crypto because it is not a secure origin. Use HTTPS for LAN testing:

```bash
npm run dev:https
```

Then open the HTTPS URL shown by Next.js.

Type-check:

```bash
npm run typecheck
```

Other checks:

```bash
npm run lint
npm run build
```

## Amplify Setup

The Amplify Gen 2 backend is defined in:

- `amplify/auth/resource.ts`
- `amplify/data/resource.ts`
- `amplify/backend.ts`

Run a sandbox backend:

```bash
npx ampx sandbox
```

That generates a real `amplify_outputs.json` for Cognito and Data. A local ignored `{}` placeholder exists so the app can build before sandbox generation; the sandbox output should replace it.

RBAC:

- Cognito group `ADMINS` can access admin routes.
- Cognito group `LEADERS` can access leader/admin group management routes.
- Members must be authenticated to access dashboard, program days, and leaderboard.

## Remaining Hardening Tasks

- Move join-code verification into a custom server-side mutation so clients never query join-code hashes directly.
- Replace the session-storage journal key handoff with a wrapped per-user journal key envelope.
- Build local-only PDF rendering from decrypted answers.
- Add tests for YAML validation, encryption round trips, scoring, and authorization rules.
- Add group-scoped authorization beyond global `ADMINS` and `LEADERS` roles if one deployment will host unrelated groups.
