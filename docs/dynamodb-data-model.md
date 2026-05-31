# DynamoDB Data Model

Use a single-table design for v1 unless access patterns grow beyond the list below. All journal answer text is encrypted client-side before any write.

## Table

`MensGroupJournal`

Primary key:

- `PK` string
- `SK` string

Recommended GSIs:

- `GSI1PK`, `GSI1SK` for group membership and leader group lists.
- `GSI2PK`, `GSI2SK` for leaderboard and score reads.

## Entities

| Entity | PK | SK | Notes |
| --- | --- | --- | --- |
| User profile | `USER#<userId>` | `PROFILE` | Cognito `sub`, display name, timestamps, wrapped journal key envelope metadata. |
| Group | `GROUP#<groupId>` | `META` | Name, hashed join code, active program id, leader ids. |
| Membership | `GROUP#<groupId>` | `MEMBER#<userId>` | Role, display name, joined date. |
| User membership lookup | `USER#<userId>` | `GROUP#<groupId>` | Lets a user list their groups. |
| Program snapshot | `GROUP#<groupId>` | `PROGRAM#<programId>` | Immutable YAML-derived JSON, content hash, publish metadata. |
| Active program pointer | `GROUP#<groupId>` | `ACTIVE_PROGRAM` | One active program per group. Points to immutable snapshot. |
| Group program week | `GROUP#<groupId>` | `WEEK#<programId>#<week>#<contentHash>` | One group has many active week records. Content is immutable week JSON; `isActive` controls whether the week appears. |
| Program audit event | `GROUP#<groupId>` | `AUDIT#<timestamp>#<eventId>` | Records week import, replacement, and removal events with actor, group, week, and timestamp. |
| Section progress | `USER#<userId>#GROUP#<groupId>` | `PROGRESS#<programId>#W#<week>#D#<day>#S#<sectionId>` | Completion and point metadata only. |
| Encrypted answer | `USER#<userId>#GROUP#<groupId>` | `ANSWER#<programId>#W#<week>#D#<day>#S#<sectionId>#P#<promptId>` | Ciphertext, IV, salt, algorithm metadata only. |
| Score | `GROUP#<groupId>` | `SCORE#<programId>#W#<week>#USER#<userId>` | Exact weekly, cumulative, streak. |
| Leader metric | `GROUP#<groupId>` | `METRIC#<programId>` | Aggregate participation only, no section-level detail. |

## Access Patterns

- Authenticated user reads/writes their own profile.
- Authenticated user joins a group by submitting a code to a server-side mutation; the backend hashes the normalized code, compares it against stored group hashes, and creates the membership.
- Member reads group metadata, active program week records, their own progress, their own encrypted answers, and group score rows. Older active program snapshots are read only as a compatibility fallback.
- Member writes only their own encrypted answers, progress, and derived score rows.
- Member reads/writes only their own wrapped journal key envelope on their user profile.
- Leader creates groups and active program week records for groups where they are a leader.
- Leader/admin reads program audit events for assigned groups.
- Leader reads aggregate metrics, membership, and score rows. Leader cannot read `ANSWER#` rows for other users.
- Admin has operational access through explicit RBAC claims, not broad client access.

## Least-Privilege Notes

- Cognito groups or custom claims should map users to `member`, `leader`, and `admin`.
- Prefer owner checks on `userId` for answer/progress mutations.
- Week content snapshots are append-only by content hash. Publishing a changed week creates a new week record and deactivates the prior active record for that group/week.
- Program audit events are append-only operational records and must not include journal answer content.
- Store only wrapped journal key material, never raw journal keys or plaintext answers.
- Do not project answer ciphertext into leader/admin indexes unless needed for owner reads.
