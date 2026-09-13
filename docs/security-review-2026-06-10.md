# Security Review — Men's Group Journal

**Date:** 2026-06-10
**Scope:** Full codebase — Amplify backend (auth, data model, Lambda functions), Next.js middleware/routes, client data layer, crypto, dependencies.

## Summary

No XSS, SQL/NoSQL injection, command injection, RCE, or committed secrets were found. React's default escaping is intact (no `dangerouslySetInnerHTML`), `js-yaml@4`'s `load` is safe by default, the Cognito `ListUsers` filter is escaped, and `amplify_outputs.json` / `.env` / diagnostic logs are correctly gitignored. AppSync auth is enforced server-side, so the middleware is defense-in-depth rather than the only gate.

The meaningful issues are authorization-design problems, not code bugs. The most serious is that the **LEADERS** role is granted blanket access to *every* group's data with no per-group scoping. Group join codes are also weak, and the journal "encryption" provides less protection than it appears to.

| # | Severity | Issue |
|---|----------|-------|
| 1 | High | LEADERS can read/modify every group's data (no per-group scoping) |
| 2 | High | Group join codes are user-chosen, low-entropy, stored in plaintext, and indexed by unsalted SHA-256 |
| 3 | Medium | Journal key derived from non-secret Cognito `sub`; secret persisted in localStorage indefinitely |
| 4 | Low | `joinGroupByCode` overwrites "phantom" membership records based on `__typename` |
| 5 | Low | No rate limiting on join-code attempts |

---

## 1. High — Cross-group privilege escalation for LEADERS

`amplify/data/resource.ts` grants the `LEADERS` Cognito group static, model-wide access:

```ts
Group:            allow.groups(["ADMINS", "LEADERS"])                        // full CRUD on ALL groups
GroupMembership:  allow.groups(["ADMINS", "LEADERS"]).to([...crud...])       // ALL memberships
ProgramSnapshot / GroupProgramWeek / LeaderMetric / ProgramAuditEvent: same
```

These rules key off membership in the `LEADERS` group only — there is no row-level condition tying a leader to the groups they actually lead. The schema even carries `leaderUserIds` and `createdByUserId` fields (lines 107–111) but no authorization rule references them.

**Impact:** Any user in the `LEADERS` group can read and modify *every* group in the system — rename groups, rotate or read any group's join code (see #2), add/remove/relabel members in groups they have nothing to do with, alter published program content, and read all groups' leaderboard metrics and audit events. In a multi-congregation deployment this is a horizontal authz breach across tenants.

**Recommendation:** Scope leader access per group. Amplify's static-group rules can't express "leader of *this* group," so enforce it either by (a) moving all leader-privileged writes behind Lambda resolvers (like `joinGroupByCode`) that check `leaderUserIds`/`createdByUserId` against the caller's `sub`, or (b) using a dynamic owner/ownership relationship per group. At minimum, restrict `joinCode`/`joinCodeHash` reads so a leader cannot pull other groups' codes.

## 2. High — Weak group join codes

Join codes are the sole credential for joining a group, and the design weakens them on three axes:

- **User-chosen, low entropy.** The admin UI takes a free-text code (`AdminGroupsPanel.tsx:95`, placeholder `GRACE-2026`). There is no generator and no entropy/complexity requirement, so codes are short and guessable.
- **Stored in plaintext.** `Group.joinCode` is persisted as-is (`dataClient.ts:345`, `createGroup`) alongside the hash, and is returned to and displayed in the admin UI (`AdminGroupsPanel.tsx:115`). Combined with #1, any leader can read every group's plaintext code.
- **Unsalted, uppercased SHA-256 lookup index.** `hashJoinCode` (`join-group-by-code/handler.ts:131` and the client `hashJoinCode`) is `sha256(code.trim().toUpperCase())` with no salt, exposed as a queryable GSI (`groupsByJoinCodeHash`). That makes the hash a dictionary/rainbow-table target and removes case as an entropy source.

**Impact:** A guessed or brute-forced code lets any authenticated user join (and appear on the leaderboard / see program content of) an arbitrary group. There is no attempt limiting on the mutation.

**Recommendation:** Generate codes server-side with a CSPRNG (e.g., 8–10 chars from an unambiguous alphabet), stop storing/displaying the plaintext (show once at creation, then only the hash), and add throttling on `joinGroupByCode`. The hash being unsalted is acceptable only if codes are high-entropy; if they stay short, salting/peppering doesn't help a GSI lookup, so entropy is the real fix.

## 3. Medium — Journal encryption keyed on a non-secret value and cached indefinitely

The journal answers are AES-GCM encrypted client-side (`lib/encryption.ts`) with a random 32-byte secret — good. But the secret's protection is undermined:

- **V2 wrapping key is derived from the Cognito `sub`** (`journalKey.ts:159`, `deriveWrappingKeyV2`). The `sub` is not secret: it travels in tokens, and admins/leaders can enumerate it. Anyone who obtains both the wrapped envelope (stored in `UserProfile`, which `ADMINS` can read per the data model) and a user's `EncryptedAnswer` rows can re-derive the wrapping key and decrypt. The only thing preventing admin decryption today is that `EncryptedAnswer` is owner-only — i.e., the encryption adds little beyond the existing DynamoDB ACL. A single DB dump of both tables is full plaintext recovery.
- **The unwrapped secret is stored in `localStorage` with no expiry.** `setCurrentJournalSecret` (`journalKey.ts:178`) writes `{ secret }` with no `expiresAt`, while the reader (`getJournalEncryptionSecret`, line 79) only expires entries that *have* one. So the raw key persists indefinitely on the device and would be exfiltrated by any future XSS or shared-machine access.

**Recommendation:** Derive the wrapping key from a genuine secret (the user's password, as the V1 path does, or a server-held secret), not the `sub`. Set a real `expiresAt` on every write so the cached secret has a bounded lifetime, and clear it on logout.

## 4. Low — Phantom-membership overwrite in `joinGroupByCode`

`join-group-by-code/handler.ts:69–94` treats any existing membership record lacking `__typename === "GroupMembership"` as absent and overwrites it. This is a deliberate migration workaround, but it means a malformed/partial record is silently replaced rather than investigated. Low risk; flagging for awareness. Consider logging when this path triggers.

## 5. Low — No rate limiting on join-code verification

`joinGroupByCode` performs an indexed lookup per attempt with no throttling, which (given #2's weak codes) enables online brute force. Add per-user/IP rate limiting or exponential backoff.

---

## Things checked and found clean

- **XSS:** no `dangerouslySetInnerHTML`, `innerHTML`, `eval`, or markdown-to-HTML rendering; program `body`/`scripture` text rendered as React text nodes (`DayJournal.tsx:676–680`).
- **YAML import:** `js-yaml@4` `load` (safe schema) + strict Zod validation in `programValidation.ts`.
- **Cognito filter injection:** `escapeCognitoFilterValue` escapes `\` and `"` before the `ListUsers` filter (`manage-admin-users/handler.ts:201`).
- **Admin/Lambda authz:** `assertAdmin` re-checks `cognito:groups` inside the resolver in addition to AppSync's `allow.groups(["ADMINS"])`; self-demotion is blocked.
- **Secrets:** `amplify_outputs.json`, `.env*`, `.codex-dev-*.log`, `.amplify/` all gitignored; no AWS keys or hardcoded credentials in tracked files.
- **Middleware:** fails closed (returns unauthenticated on any error) and IAM policies for the Lambdas are scoped to the specific tables/indexes/user pool.

> Dependency CVE scan (`npm audit`) could not run — the npm registry audit endpoint is blocked by the sandbox network allowlist. Re-run `npm audit` in your environment; Next.js is at 15.5.18, which is current as of the knowledge cutoff.
