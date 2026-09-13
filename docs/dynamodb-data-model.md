# DynamoDB Data Model

The app uses AWS Amplify Gen 2 Data. Each `a.model()` in `amplify/data/resource.ts` is backed by its own DynamoDB table and Amplify-managed resolvers. Journal answer text is encrypted in the browser before any write.

Production tables hold live member data, so schema changes must be additive: add optional fields or new models, never rename identifiers or change key structure.

## Models

| Model | Identifier | Purpose |
| --- | --- | --- |
| `UserProfile` | `userId` | Display name, email, timestamps, and wrapped journal key envelope metadata. |
| `Group` | `groupId` | Group name, join code metadata, active program id and title, archived flag, creator, and leader ids. One group runs one program; the member switcher shows "Program - Group". |
| `GroupMembership` | `membershipId` | User-to-group membership with role and display name. |
| `ProgramSnapshot` | `programId` | Full imported program content for compatibility with earlier whole-program publishing. |
| `GroupProgramWeek` | `weekSnapshotId` | Immutable week content imported to a group. `isActive` controls whether members see the week (show/hide). Replacement creates a new record and deactivates prior records for that group/week. |
| `ProgramAuditEvent` | `eventId` | Import, replacement, and show/hide audit entries. |
| `SectionProgress` | `progressId` | Per-user completion and points-earned metadata for sections. Partial-scoring sections store the earned points, from which the completion count is derived. |
| `EncryptedAnswer` | `answerId` | Per-user encrypted reflection content plus encryption metadata. |
| `UserScore` | `scoreId` | Derived weekly and cumulative user scores used by member and group leaderboards. Written only by `syncUserScore`. |
| `LeaderMetric` | `metricId` | Aggregate participation metrics reserved for leader/admin views. |

## Programs and Archiving

- A program is identified by the `program.id` in the imported YAML. Progress, answers, and scores are keyed by `programId`, so every week of an 8-week session must share one id and a new session must use a new id.
- `Group.activeProgramId` / `Group.activeProgramTitle` are set on import. Groups created before `activeProgramTitle` existed resolve the title from their week records (or legacy snapshot) at read time.
- `Group.isArchived` makes a group read-only: the client disables journal inputs and skips saves, the import page refuses the group as a target, and `syncUserScore` returns the computed score without writing the `UserScore` row.

## Access Patterns

- Authenticated users read group metadata, their memberships, visible week content, and score rows.
- Members write only their own encrypted answers, section progress, score sync, profile, and membership actions.
- Joining a group goes through the `joinGroupByCode` function, which hashes the submitted code server-side and creates a membership.
- Score rows are updated through `syncUserScore`, which recalculates from persisted section progress and skips archived groups.
- Display name changes update profile, membership, Cognito preferred username best-effort, and score display names through `syncDisplayName`.
- Leaders and admins manage groups (including archiving), imported weeks and their visibility, and program audit records.
- Admins manage Cognito `ADMINS` group membership through `manageAdminUsers`.

## Security Notes

- Plaintext reflection answers must never be sent to APIs, logs, analytics, or DynamoDB.
- `EncryptedAnswer` rows store ciphertext, IV, salt, algorithm metadata, and prompt identity only.
- Leaders and admins must not receive another user's plaintext reflections.
- Program audit events must not include journal answer content.
- `UserScore` and `SectionProgress` contain point and completion metadata only.
- Group-scoped leader authorization is still a known gap; current `LEADERS` access is broader than the long-term target (see `security-review-2026-06-10.md`).
