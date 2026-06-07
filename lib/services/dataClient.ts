"use client";

import { generateClient } from "aws-amplify/data";
import { getCurrentUser, fetchUserAttributes, updatePassword, updateUserAttribute } from "aws-amplify/auth";
import { configureAmplify } from "@/lib/amplifyClient";
import { decryptJournalAnswer, encryptJournalAnswer, type EncryptedPayload } from "@/lib/encryption";
import {
  getJournalEncryptionSecret,
  initializeJournalEncryptionSecret,
  initializeJournalEncryptionSecretFromSub,
  wrapCurrentJournalEncryptionSecret,
  wrapJournalSecretV2,
  type JournalKeyEnvelope
} from "@/lib/journalKey";
import { journalPromptAnswerKey } from "@/lib/journalAnswerKeys";
import { hashProgram, programSchema } from "@/lib/programValidation";
import { calculateScores, sectionKey, type CompletedSectionKey, type ScoreSummary } from "@/lib/scoring";
import type { Schema } from "@/amplify/data/resource";
import type { JournalExportInput } from "@/lib/pdfExport";
import type { SectionProgress } from "@/types/domain";
import type { Program, ProgramImportPreview, ProgramWeek } from "@/types/program";

type DataClient = ReturnType<typeof generateClient<Schema>>;

let dataClient: DataClient | null = null;

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string };
export type UserGroupSummary = {
  activeProgramId?: string;
  groupId: string;
  name: string;
  role?: "member" | "leader" | "admin" | null;
};
export type AdminGroupSummary = {
  activeProgramId?: string;
  groupId: string;
  joinCode?: string | null;
  memberCount: number;
  leaderCount: number;
  name: string;
};
export type AdminGroupMember = {
  displayName: string;
  joinedAt: string;
  membershipId: string;
  role?: "member" | "leader" | "admin" | null;
  userId: string;
};
export type AdminGroupDetail = AdminGroupSummary & {
  members: AdminGroupMember[];
};
export type AdminRoleUser = {
  displayName: string;
  email: string;
  enabled: boolean;
  isAdmin: boolean;
  status: string;
  username: string;
};
export type ActiveProgramSnapshot = {
  contentHash: string;
  groupId: string;
  program: Program;
  programId: string;
  publishedAt: string;
  title: string;
  version: string;
};
export type ActiveProgramWeekSummary = {
  groupCount: number;
  groupId: string;
  programId: string;
  title: string;
  weekNumber: number;
};
export type ProgramWeekAssignment = {
  groupId: string;
  groupName: string;
  weeks: Array<{
    programId: string;
    publishedAt: string;
    publishedByUserId: string;
    title: string;
    weekNumber: number;
  }>;
};
export type ProgramAuditEntry = {
  action: string;
  actorDisplayName: string;
  createdAt: string;
  details?: string | null;
  eventId: string;
  groupId: string;
  groupName: string;
  weekNumber: number;
  weekTitle: string;
};
export type WeekReplacementImpact = {
  groupId: string;
  groupName: string;
  existingTitle: string;
  importedTitle: string;
  weekNumber: number;
};
export type JournalDayState = {
  answers: Record<string, string>;
  completedSectionIds: string[];
  encryptedAnswerCount: number;
  needsReauth: boolean;
  warning?: string;
};
export type CurrentUserProfile = {
  displayName: string;
  email?: string;
};

export async function ensureUserProfile(displayName?: string): Promise<ServiceResult<void>> {
  try {
    await configureAmplify();
    const client = getDataClient();
    const user = await getCurrentUser();
    const attributes = await fetchUserAttributes();
    const now = new Date().toISOString();
    const profile = await client.models.UserProfile.get({ userId: user.userId });

    if (profile.data) {
      if (displayName && profile.data.displayName !== displayName) {
        await client.models.UserProfile.update({
          userId: user.userId,
          displayName,
          updatedAt: now
        });
      }
      return { ok: true, data: undefined };
    }

    await client.models.UserProfile.create({
      userId: user.userId,
      displayName: displayName ?? attributes.preferred_username ?? attributes.email ?? "Member",
      email: attributes.email,
      createdAt: now,
      updatedAt: now
    });

    return { ok: true, data: undefined };
  } catch (error) {
    return serviceError(error);
  }
}

export async function ensureJournalKeyEnvelope(input: {
  email: string;
  password: string;
}): Promise<ServiceResult<void>> {
  try {
    await configureAmplify();
    const client = getDataClient();
    const user = await getCurrentUser();
    const profile = await client.models.UserProfile.get({ userId: user.userId });

    if (!profile.data) {
      const created = await ensureUserProfile();
      if (!created.ok) return created;
    }

    const refreshedProfile = profile.data ?? (await client.models.UserProfile.get({ userId: user.userId })).data;
    const existingEnvelope = getJournalKeyEnvelope(refreshedProfile);

    // V2 envelope: unwrap with sub — no password needed, migration complete
    if (existingEnvelope?.version === 2) {
      await initializeJournalEncryptionSecretFromSub({ sub: user.userId, envelope: existingEnvelope });
      return { ok: true, data: undefined };
    }

    // V1 or no envelope: use password to get the journal key
    const initialized = await initializeJournalEncryptionSecret({
      email: input.email,
      legacySecret: existingEnvelope ? undefined : getLegacyJournalSecret(input.email, input.password),
      password: input.password,
      envelope: existingEnvelope
    });

    // Upgrade to V2 — from now on, password is not needed to access the key
    const v2Envelope = await wrapJournalSecretV2(user.userId, initialized.secret);
    const saved = await saveJournalKeyEnvelope(client, user.userId, v2Envelope);

    if (!saved.ok) return saved;

    return { ok: true, data: undefined };
  } catch (error) {
    return serviceError(error);
  }
}

export async function getCurrentUserProfile(): Promise<ServiceResult<CurrentUserProfile>> {
  try {
    await configureAmplify();
    const client = getDataClient();
    const user = await getCurrentUser();
    const attributes = await fetchUserAttributes();
    const profile = await client.models.UserProfile.get({ userId: user.userId });

    if (!profile.data) {
      const created = await ensureUserProfile();

      if (!created.ok) {
        return created;
      }

      const refreshed = await client.models.UserProfile.get({ userId: user.userId });
      return {
        ok: true,
        data: {
          displayName: refreshed.data?.displayName ?? attributes.preferred_username ?? attributes.email ?? "Member",
          email: refreshed.data?.email ?? attributes.email
        }
      };
    }

    return {
      ok: true,
      data: {
        displayName: profile.data.displayName,
        email: profile.data.email ?? attributes.email
      }
    };
  } catch (error) {
    return serviceError(error);
  }
}

export async function updateCurrentUserDisplayName(displayName: string): Promise<ServiceResult<void>> {
  const normalizedDisplayName = displayName.trim();

  if (!normalizedDisplayName) {
    return { ok: false, error: "Display name is required." };
  }

  try {
    await configureAmplify();
    const client = getDataClient();
    const user = await getCurrentUser();
    const now = new Date().toISOString();

    await requireSaved(
      client.models.UserProfile.update({
        userId: user.userId,
        displayName: normalizedDisplayName,
        updatedAt: now
      }),
      "The display name could not be updated."
    );

    await Promise.all([
      updateOwnMembershipDisplayNames(client, user.userId, normalizedDisplayName),
      updateOwnScoreDisplayNames(client, user.userId, normalizedDisplayName),
      updateCognitoDisplayName(normalizedDisplayName)
    ]);

    return { ok: true, data: undefined };
  } catch (error) {
    return serviceError(error);
  }
}

export async function changeCurrentUserPassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<ServiceResult<void>> {
  if (!input.currentPassword || !input.newPassword) {
    return { ok: false, error: "Current password and new password are required." };
  }

  try {
    await configureAmplify();
    const client = getDataClient();
    const user = await getCurrentUser();
    const attributes = await fetchUserAttributes();
    const email = attributes.email;

    if (!email) {
      return { ok: false, error: "Email is required to protect the journal key." };
    }

    const profile = await client.models.UserProfile.get({ userId: user.userId });
    const envelope = getJournalKeyEnvelope(profile.data);

    if (envelope) {
      await initializeJournalEncryptionSecret({
        email,
        password: input.currentPassword,
        envelope
      });
    }

    const rewrappedEnvelope = await wrapCurrentJournalEncryptionSecret({
      email,
      password: input.newPassword
    });

    await updatePassword({
      oldPassword: input.currentPassword,
      newPassword: input.newPassword
    });

    const saved = await saveJournalKeyEnvelope(client, user.userId, rewrappedEnvelope);

    if (!saved.ok) {
      return saved;
    }

    return { ok: true, data: undefined };
  } catch (error) {
    return serviceError(error);
  }
}

export async function createGroup(name: string, joinCode: string): Promise<ServiceResult<string>> {
  try {
    await configureAmplify();
    const client = getDataClient();
    const user = await getCurrentUser();
    const now = new Date().toISOString();
    const groupId = crypto.randomUUID();

    await client.models.Group.create({
      groupId,
      name,
      joinCode: joinCode.trim(),
      joinCodeHash: await hashJoinCode(joinCode),
      createdByUserId: user.userId,
      leaderUserIds: [user.userId],
      createdAt: now,
      updatedAt: now
    });

    await client.models.GroupMembership.create({
      membershipId: crypto.randomUUID(),
      groupId,
      userId: user.userId,
      role: "leader",
      displayName: await getDisplayName(user.userId),
      joinedAt: now
    });

    return { ok: true, data: groupId };
  } catch (error) {
    return serviceError(error);
  }
}

export async function updateGroupSettings(input: {
  groupId: string;
  joinCode?: string;
  name: string;
}): Promise<ServiceResult<void>> {
  const normalizedName = input.name.trim();
  const normalizedJoinCode = input.joinCode?.trim();

  if (!normalizedName) {
    return { ok: false, error: "Group name is required." };
  }

  try {
    await configureAmplify();
    const client = getDataClient();
    const now = new Date().toISOString();
    const updateInput: {
      groupId: string;
      joinCode?: string;
      joinCodeHash?: string;
      name: string;
      updatedAt: string;
    } = {
      groupId: input.groupId,
      name: normalizedName,
      updatedAt: now
    };

    if (normalizedJoinCode) {
      updateInput.joinCode = normalizedJoinCode;
      updateInput.joinCodeHash = await hashJoinCode(normalizedJoinCode);
    }

    await requireSaved(client.models.Group.update(updateInput), "The group could not be updated.");

    return { ok: true, data: undefined };
  } catch (error) {
    return serviceError(error);
  }
}

export async function joinGroupByCode(groupCode: string): Promise<ServiceResult<string>> {
  try {
    await configureAmplify();
    const client = getDataClient();
    await ensureUserProfile();
    const result = await requireSaved(
      client.mutations.joinGroupByCode({
        groupCode: groupCode.trim()
      }),
      "The group code could not be verified."
    );

    if (!result.data?.groupId) {
      return { ok: false, error: "No group matched that code." };
    }

    return { ok: true, data: result.data.groupId };
  } catch (error) {
    return serviceError(error);
  }
}

export async function listCurrentUserGroups(): Promise<ServiceResult<UserGroupSummary[]>> {
  try {
    await configureAmplify();
    const client = getDataClient();
    const user = await getCurrentUser();
    const memberships = await client.models.GroupMembership.list({
      filter: {
        userId: {
          eq: user.userId
        }
      }
    });
    const groups: Array<UserGroupSummary | null> = await Promise.all(
      memberships.data.filter((membership): membership is NonNullable<typeof membership> => membership != null).map(async (membership) => {
        const group = await client.models.Group.get({ groupId: membership.groupId });

        if (!group.data) {
          return null;
        }

        return {
          activeProgramId: group.data.activeProgramId ?? undefined,
          groupId: group.data.groupId,
          name: group.data.name,
          role: membership.role
        } satisfies UserGroupSummary;
      })
    );

    return {
      ok: true,
      data: groups
        .filter((group): group is UserGroupSummary => Boolean(group))
        .sort((left, right) => left.name.localeCompare(right.name))
    };
  } catch (error) {
    return serviceError(error);
  }
}

export async function leaveCurrentUserGroup(groupId: string): Promise<ServiceResult<void>> {
  try {
    await configureAmplify();
    const client = getDataClient();
    const user = await getCurrentUser();
    const memberships = await client.models.GroupMembership.list({
      filter: {
        userId: {
          eq: user.userId
        },
        groupId: {
          eq: groupId
        }
      }
    });

    if (memberships.data.length === 0) {
      return { ok: false, error: "You are not a member of that group." };
    }

    await Promise.all(
      memberships.data.filter((membership): membership is NonNullable<typeof membership> => membership != null).map((membership) =>
        requireSaved(
          client.models.GroupMembership.delete({
            membershipId: membership.membershipId
          }),
          "The group membership could not be removed."
        )
      )
    );

    const scores = await client.models.UserScore.list({
      filter: {
        userId: {
          eq: user.userId
        },
        groupId: {
          eq: groupId
        }
      }
    });

    await Promise.all(
      scores.data.filter((score): score is NonNullable<typeof score> => score != null).map((score) =>
        client.models.UserScore.delete({
          scoreId: score.scoreId
        })
      )
    );

    return { ok: true, data: undefined };
  } catch (error) {
    return serviceError(error);
  }
}

export async function listAdminGroups(): Promise<ServiceResult<AdminGroupSummary[]>> {
  try {
    await configureAmplify();
    const client = getDataClient();
    const groups = await client.models.Group.list();
    const summaries = await Promise.all(
      groups.data.filter((group): group is NonNullable<typeof group> => group != null).map(async (group) => {
        const memberships = await client.models.GroupMembership.list({
          filter: {
            groupId: {
              eq: group.groupId
            }
          }
        });
        const validMemberships = memberships.data.filter((membership): membership is NonNullable<typeof membership> => membership != null);

        return {
          activeProgramId: group.activeProgramId ?? undefined,
          groupId: group.groupId,
          joinCode: group.joinCode ?? null,
          leaderCount: validMemberships.filter((membership) => isLeaderRole(membership.role)).length,
          memberCount: validMemberships.length,
          name: group.name
        } satisfies AdminGroupSummary;
      })
    );

    return {
      ok: true,
      data: summaries.sort((left, right) => left.name.localeCompare(right.name))
    };
  } catch (error) {
    return serviceError(error);
  }
}

export async function getAdminGroupDetail(groupId: string): Promise<ServiceResult<AdminGroupDetail>> {
  try {
    await configureAmplify();
    const client = getDataClient();
    const group = await client.models.Group.get({ groupId });

    if (!group.data) {
      return { ok: false, error: "Group not found." };
    }

    const memberships = await client.models.GroupMembership.list({
      filter: {
        groupId: {
          eq: groupId
        }
      }
    });
    const members = memberships.data
      .filter((membership): membership is NonNullable<typeof membership> => membership != null)
      .map((membership) => ({
        displayName: membership.displayName,
        joinedAt: membership.joinedAt,
        membershipId: membership.membershipId,
        role: membership.role,
        userId: membership.userId
      }))
      .sort((left, right) => sortMembers(left, right));

    return {
      ok: true,
      data: {
        activeProgramId: group.data.activeProgramId ?? undefined,
        groupId: group.data.groupId,
        joinCode: group.data.joinCode ?? null,
        leaderCount: members.filter((member) => isLeaderRole(member.role)).length,
        memberCount: members.length,
        members,
        name: group.data.name
      }
    };
  } catch (error) {
    return serviceError(error);
  }
}

export async function listAdminRoleUsers(): Promise<ServiceResult<AdminRoleUser[]>> {
  try {
    await configureAmplify();
    const client = getDataClient();
    const result = await requireSaved(client.queries.listAdminUsers(), "Admin users could not be loaded.");

    return {
      ok: true,
      data: (result.data ?? [])
        .filter((user): user is NonNullable<typeof user> => Boolean(user))
        .map((user) => ({
          displayName: user.displayName,
          email: user.email,
          enabled: user.enabled,
          isAdmin: user.isAdmin,
          status: user.status,
          username: user.username
        }))
    };
  } catch (error) {
    return serviceError(error);
  }
}

export async function setUserAdminRole(input: {
  email: string;
  enabled: boolean;
}): Promise<ServiceResult<string>> {
  try {
    await configureAmplify();
    const client = getDataClient();
    const result = await requireSaved(
      client.mutations.setUserAdminRole({
        email: input.email.trim().toLowerCase(),
        enabled: input.enabled
      }),
      "Admin role could not be updated."
    );

    return { ok: true, data: result.data?.message ?? "Admin role updated." };
  } catch (error) {
    return serviceError(error);
  }
}

export async function publishProgram(groupId: string, preview: ProgramImportPreview): Promise<ServiceResult<string>> {
  const result = await publishProgramWeeksToGroups([groupId], preview);
  return result.ok ? { ok: true, data: result.data } : result;
}

export async function publishProgramWeeksToGroups(groupIds: string[], preview: ProgramImportPreview): Promise<ServiceResult<string>> {
  try {
    await configureAmplify();
    const client = getDataClient();
    const user = await getCurrentUser();
    const actorDisplayName = await getDisplayName(user.userId);
    const now = new Date().toISOString();
    const uniqueGroupIds = Array.from(new Set(groupIds.map((groupId) => groupId.trim()).filter(Boolean)));

    if (uniqueGroupIds.length === 0) {
      return { ok: false, error: "Choose at least one group before publishing." };
    }

    for (const groupId of uniqueGroupIds) {
      await publishWeeksForGroup({
        client,
        groupId,
        now,
        program: preview.program,
        actorDisplayName,
        publishedByUserId: user.userId
      });
    }

    const weekLabel = preview.program.weeks.length === 1 ? "week" : "weeks";
    const groupLabel = uniqueGroupIds.length === 1 ? "group" : "groups";
    return { ok: true, data: `Published ${preview.program.weeks.length} ${weekLabel} to ${uniqueGroupIds.length} ${groupLabel}.` };
  } catch (error) {
    return serviceError(error);
  }
}

async function publishWeeksForGroup(input: {
  actorDisplayName: string;
  client: DataClient;
  groupId: string;
  now: string;
  program: Program;
  publishedByUserId: string;
}): Promise<void> {
  const group = await input.client.models.Group.get({ groupId: input.groupId });
  const activeWeeks = await listActiveWeekRecords(input.client, input.groupId);

  for (const week of input.program.weeks) {
    const contentHash = await hashProgram({
      program: input.program.program,
      weeks: [week]
    });
    const weekSnapshotId = `${input.groupId}:${input.program.program.id}:${week.weekNumber}:${contentHash}`;
    const staleActiveWeeks = activeWeeks.filter(
      (record) => record.weekNumber === week.weekNumber && record.weekSnapshotId !== weekSnapshotId
    );
    const replacedWeekTitles = staleActiveWeeks.map((record) => record.title);

    await Promise.all(
      staleActiveWeeks.map((record) =>
        requireSaved(
          input.client.models.GroupProgramWeek.update({
            weekSnapshotId: record.weekSnapshotId,
            isActive: false,
            updatedAt: input.now
          }),
          "The previous active week could not be deactivated."
        )
      )
    );

    await upsert(
      () =>
        input.client.models.GroupProgramWeek.create({
          weekSnapshotId,
          groupId: input.groupId,
          programId: input.program.program.id,
          programTitle: input.program.program.title,
          programVersion: input.program.program.version,
          programDescription: input.program.program.description,
          weekNumber: week.weekNumber,
          title: week.title,
          contentHash,
          content: JSON.stringify(week),
          isActive: true,
          publishedByUserId: input.publishedByUserId,
          publishedAt: input.now,
          updatedAt: input.now
        }),
      () =>
        input.client.models.GroupProgramWeek.update({
          weekSnapshotId,
          groupId: input.groupId,
          programId: input.program.program.id,
          programTitle: input.program.program.title,
          programVersion: input.program.program.version,
          programDescription: input.program.program.description,
          weekNumber: week.weekNumber,
          title: week.title,
          contentHash,
          content: JSON.stringify(week),
          isActive: true,
          publishedByUserId: input.publishedByUserId,
          publishedAt: input.now,
          updatedAt: input.now
        })
    );

    await createProgramAuditEvent(input.client, {
      action: staleActiveWeeks.length > 0 ? "replace_week" : "import_week",
      actorDisplayName: input.actorDisplayName,
      actorUserId: input.publishedByUserId,
      createdAt: input.now,
      details:
        staleActiveWeeks.length > 0
          ? `Replaced ${replacedWeekTitles.map((title) => `"${title}"`).join(", ")}.`
          : "Imported as a new active week.",
      groupId: input.groupId,
      groupName: group.data?.name ?? input.groupId,
      programId: input.program.program.id,
      weekNumber: week.weekNumber,
      weekTitle: week.title
    });
  }

  await requireSaved(
    input.client.models.Group.update({
      groupId: input.groupId,
      activeProgramId: input.program.program.id,
      updatedAt: input.now
    }),
    "The group active program could not be updated."
  );
}

async function listActiveWeekRecords(client: DataClient, groupId: string) {
  const result = await client.models.GroupProgramWeek.list({
    filter: {
      groupId: {
        eq: groupId
      },
      isActive: {
        eq: true
      }
    }
  });

  return result.data;
}

async function createProgramAuditEvent(
  client: DataClient,
  input: {
    action: string;
    actorDisplayName: string;
    actorUserId: string;
    createdAt: string;
    details?: string;
    groupId: string;
    groupName: string;
    programId: string;
    weekNumber: number;
    weekTitle: string;
  }
): Promise<void> {
  await requireSaved(
    client.models.ProgramAuditEvent.create({
      eventId: crypto.randomUUID(),
      action: input.action,
      groupId: input.groupId,
      groupName: input.groupName,
      programId: input.programId,
      weekNumber: input.weekNumber,
      weekTitle: input.weekTitle,
      actorUserId: input.actorUserId,
      actorDisplayName: input.actorDisplayName,
      createdAt: input.createdAt,
      details: input.details
    }),
    "The program audit event could not be saved."
  );
}

export async function removeWeekFromActiveProgram(input: {
  groupId: string;
  weekNumber: number;
}): Promise<ServiceResult<string>> {
  const result = await removeWeekFromGroups({
    groupIds: [input.groupId],
    weekNumber: input.weekNumber
  });
  return result.ok ? { ok: true, data: result.data } : result;
}

export async function removeWeekFromGroups(input: {
  groupIds: string[];
  weekNumber: number;
}): Promise<ServiceResult<string>> {
  try {
    await configureAmplify();
    const client = getDataClient();
    const user = await getCurrentUser();
    const actorDisplayName = await getDisplayName(user.userId);
    const now = new Date().toISOString();
    const uniqueGroupIds = Array.from(new Set(input.groupIds.map((groupId) => groupId.trim()).filter(Boolean)));
    let removedCount = 0;

    if (uniqueGroupIds.length === 0) {
      return { ok: false, error: "Choose at least one group." };
    }

    for (const groupId of uniqueGroupIds) {
      const [activeWeeks, group] = await Promise.all([
        listActiveWeekRecords(client, groupId),
        client.models.Group.get({ groupId })
      ]);
      const matchingWeeks = activeWeeks.filter((record) => record.weekNumber === input.weekNumber);

      await Promise.all(
        matchingWeeks.map((record) =>
          requireSaved(
            client.models.GroupProgramWeek.update({
              weekSnapshotId: record.weekSnapshotId,
              isActive: false,
              updatedAt: now
            }),
            "The active week could not be removed."
          )
        )
      );
      await Promise.all(
        matchingWeeks.map((record) =>
          createProgramAuditEvent(client, {
            action: "remove_week",
            actorDisplayName,
            actorUserId: user.userId,
            createdAt: now,
            details: "Removed from active group content.",
            groupId,
            groupName: group.data?.name ?? groupId,
            programId: record.programId,
            weekNumber: record.weekNumber,
            weekTitle: record.title
          })
        )
      );
      removedCount += matchingWeeks.length;
    }

    if (removedCount === 0) {
      return { ok: false, error: "That week was not active for the selected groups." };
    }

    const groupLabel = uniqueGroupIds.length === 1 ? "group" : "groups";
    return { ok: true, data: `Removed Week ${input.weekNumber} from ${uniqueGroupIds.length} ${groupLabel}.` };
  } catch (error) {
    return serviceError(error);
  }
}

export async function listActiveProgramWeeksForGroups(groupIds: string[]): Promise<ServiceResult<ActiveProgramWeekSummary[]>> {
  try {
    const uniqueGroupIds = Array.from(new Set(groupIds.map((groupId) => groupId.trim()).filter(Boolean)));
    const weeksByNumber = new Map<number, ActiveProgramWeekSummary>();

    for (const groupId of uniqueGroupIds) {
      const active = await loadActiveProgramForGroup(groupId);

      if (!active.ok) {
        continue;
      }

      for (const week of active.data.program.weeks) {
        const current = weeksByNumber.get(week.weekNumber);

        weeksByNumber.set(week.weekNumber, {
          groupCount: (current?.groupCount ?? 0) + 1,
          groupId,
          programId: active.data.programId,
          title: current?.title ?? week.title,
          weekNumber: week.weekNumber
        });
      }
    }

    return {
      ok: true,
      data: Array.from(weeksByNumber.values()).sort((left, right) => left.weekNumber - right.weekNumber)
    };
  } catch (error) {
    return serviceError(error);
  }
}

export async function listProgramWeekAssignments(groups: AdminGroupSummary[]): Promise<ServiceResult<ProgramWeekAssignment[]>> {
  try {
    await configureAmplify();
    const client = getDataClient();
    const assignments = await Promise.all(
      groups.map(async (group) => {
        const activeWeeks = await listActiveWeekRecords(client, group.groupId);

        return {
          groupId: group.groupId,
          groupName: group.name,
          weeks: activeWeeks
            .map((week) => ({
              programId: week.programId,
              publishedAt: week.publishedAt,
              publishedByUserId: week.publishedByUserId,
              title: week.title,
              weekNumber: week.weekNumber
            }))
            .sort((left, right) => left.weekNumber - right.weekNumber)
        } satisfies ProgramWeekAssignment;
      })
    );

    return { ok: true, data: assignments };
  } catch (error) {
    return serviceError(error);
  }
}

export async function listProgramAuditEntries(groupIds?: string[]): Promise<ServiceResult<ProgramAuditEntry[]>> {
  try {
    await configureAmplify();
    const client = getDataClient();
    const uniqueGroupIds = groupIds ? Array.from(new Set(groupIds.map((groupId) => groupId.trim()).filter(Boolean))) : [];
    const results =
      uniqueGroupIds.length > 0
        ? await Promise.all(
            uniqueGroupIds.map((groupId) =>
              client.models.ProgramAuditEvent.list({
                filter: {
                  groupId: {
                    eq: groupId
                  }
                }
              })
            )
          )
        : [await client.models.ProgramAuditEvent.list()];
    const entries = results.flatMap((result) =>
      result.data.map((entry) => ({
        action: entry.action,
        actorDisplayName: entry.actorDisplayName,
        createdAt: entry.createdAt,
        details: entry.details,
        eventId: entry.eventId,
        groupId: entry.groupId,
        groupName: entry.groupName,
        weekNumber: entry.weekNumber,
        weekTitle: entry.weekTitle
      }))
    );

    return {
      ok: true,
      data: entries.sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 25)
    };
  } catch (error) {
    return serviceError(error);
  }
}

export async function previewWeekReplacementImpacts(input: {
  groupIds: string[];
  weeks: ProgramWeek[];
}): Promise<ServiceResult<WeekReplacementImpact[]>> {
  try {
    await configureAmplify();
    const client = getDataClient();
    const uniqueGroupIds = Array.from(new Set(input.groupIds.map((groupId) => groupId.trim()).filter(Boolean)));
    const importedWeeksByNumber = new Map(input.weeks.map((week) => [week.weekNumber, week]));
    const impacts: WeekReplacementImpact[] = [];

    for (const groupId of uniqueGroupIds) {
      const [group, activeWeeks] = await Promise.all([client.models.Group.get({ groupId }), listActiveWeekRecords(client, groupId)]);

      for (const activeWeek of activeWeeks) {
        const importedWeek = importedWeeksByNumber.get(activeWeek.weekNumber);

        if (importedWeek) {
          impacts.push({
            groupId,
            groupName: group.data?.name ?? groupId,
            existingTitle: activeWeek.title,
            importedTitle: importedWeek.title,
            weekNumber: activeWeek.weekNumber
          });
        }
      }
    }

    return { ok: true, data: impacts };
  } catch (error) {
    return serviceError(error);
  }
}

export async function listLeaderboard(groupId: string): Promise<ServiceResult<Array<{ displayName: string; score: number }>>> {
  try {
    await configureAmplify();
    const client = getDataClient();
    const rows = await client.models.UserScore.list({
      filter: {
        groupId: {
          eq: groupId
        }
      }
    });
    const latestRowsByUser = new Map<string, { displayName: string; score: number; updatedAt: string }>();

    for (const row of rows.data) {
      const current = latestRowsByUser.get(row.userId);

      if (!current || row.updatedAt > current.updatedAt) {
        latestRowsByUser.set(row.userId, {
          displayName: row.displayName,
          score: row.cumulativeScore,
          updatedAt: row.updatedAt
        });
      }
    }

    return {
      ok: true,
      data: Array.from(latestRowsByUser.values())
        .map(({ displayName, score }) => ({ displayName, score }))
        .sort((left, right) => right.score - left.score || left.displayName.localeCompare(right.displayName))
    };
  } catch (error) {
    return serviceError(error);
  }
}

export async function getCurrentUserScoreSummary(input: {
  groupId: string;
  program: Program;
  activeWeekNumber: number;
}): Promise<ServiceResult<ScoreSummary>> {
  try {
    await configureAmplify();
    const client = getDataClient();
    const user = await getCurrentUser();

    // Sync persists the leaderboard row. The dashboard display is derived from SectionProgress below.
    const [, completedSections] = await Promise.all([
      requireSaved(
        client.mutations.syncUserScore({
          groupId: input.groupId,
          weekNumber: input.activeWeekNumber,
          programId: input.program.program.id
        }),
        "Score sync failed."
      ),
      getCompletedSectionsFromProgress({
        client,
        groupId: input.groupId,
        programId: input.program.program.id,
        userId: user.userId
      })
    ]);

    // dayProgress and max values are derived from program structure + local SectionProgress
    const localScore = calculateScores(input.program, input.activeWeekNumber, completedSections);

    return {
      ok: true,
      data: {
        weeklyScore: localScore.weeklyScore,
        cumulativeScore: localScore.cumulativeScore,
        maxWeeklyScore: localScore.maxWeeklyScore,
        maxCumulativeScore: localScore.maxCumulativeScore,
        dayProgress: localScore.dayProgress
      }
    };
  } catch (error) {
    return serviceError(error);
  }
}

export async function loadActiveProgramForGroup(groupId: string): Promise<ServiceResult<ActiveProgramSnapshot>> {
  try {
    await configureAmplify();
    const client = getDataClient();
    const group = await client.models.Group.get({ groupId });

    if (!group.data) {
      return { ok: false, error: "Group not found." };
    }

    const activeWeekRecords = await listActiveWeekRecords(client, groupId);

    if (activeWeekRecords.length > 0) {
      const sortedWeekRecords = activeWeekRecords.sort((left, right) => left.weekNumber - right.weekNumber);
      const firstWeekRecord = sortedWeekRecords[0];
      const weeks = sortedWeekRecords
        .map((record) => parseStoredProgramWeekContent(record.content))
        .filter((week): week is ProgramWeek => Boolean(week));
      const program: Program = {
        program: {
          id: firstWeekRecord.programId,
          title: firstWeekRecord.programTitle,
          version: firstWeekRecord.programVersion,
          description: firstWeekRecord.programDescription ?? undefined
        },
        weeks
      };
      const parsed = programSchema.safeParse(program);

      if (!parsed.success) {
        return { ok: false, error: "The active program weeks are invalid." };
      }

      return {
        ok: true,
        data: {
          contentHash: await hashProgram(parsed.data),
          groupId,
          program: parsed.data,
          programId: firstWeekRecord.programId,
          publishedAt: sortedWeekRecords.reduce(
            (latest, record) => (record.publishedAt > latest ? record.publishedAt : latest),
            firstWeekRecord.publishedAt
          ),
          title: firstWeekRecord.programTitle,
          version: firstWeekRecord.programVersion
        }
      };
    }

    const activeProgramId = group.data.activeProgramId;

    if (!activeProgramId) {
      return { ok: false, error: "No active program has been published for this group yet." };
    }

    const snapshot = await client.models.ProgramSnapshot.get({ programId: activeProgramId });

    if (!snapshot.data) {
      return { ok: false, error: "The active program snapshot could not be found." };
    }

    const parsed = programSchema.safeParse(parseStoredProgramContent(snapshot.data.content));

    if (!parsed.success) {
      return { ok: false, error: "The active program content is invalid." };
    }

    return {
      ok: true,
      data: {
        contentHash: snapshot.data.contentHash,
        groupId: snapshot.data.groupId,
        program: parsed.data,
        programId: snapshot.data.programId,
        publishedAt: snapshot.data.publishedAt,
        title: snapshot.data.title,
        version: snapshot.data.version
      }
    };
  } catch (error) {
    return serviceError(error);
  }
}

function parseStoredProgramContent(content: unknown): unknown {
  if (typeof content !== "string") {
    return content;
  }

  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}

function parseStoredProgramWeekContent(content: unknown): ProgramWeek | null {
  const parsedContent = parseStoredProgramContent(content);

  if (!parsedContent || typeof parsedContent !== "object") {
    return null;
  }

  const program = programSchema.safeParse({
    program: {
      id: "week",
      title: "Week",
      version: "1"
    },
    weeks: [parsedContent]
  });

  return program.success ? program.data.weeks[0] : null;
}

export async function loadJournalExport(input: {
  groupId: string;
  groupName?: string;
  program: Program;
  weekNumber?: number;
}): Promise<ServiceResult<JournalExportInput>> {
  try {
    await configureAmplify();
    const client = getDataClient();
    const user = await getCurrentUser();
    const [progress, encryptedAnswers] = await Promise.all([
      client.models.SectionProgress.list({
        filter: {
          userId: {
            eq: user.userId
          },
          groupId: {
            eq: input.groupId
          },
          programId: {
            eq: input.program.program.id
          },
          ...(input.weekNumber
            ? {
                weekNumber: {
                  eq: input.weekNumber
                }
              }
            : {})
        }
      }),
      client.models.EncryptedAnswer.list({
        filter: {
          userId: {
            eq: user.userId
          },
          groupId: {
            eq: input.groupId
          },
          programId: {
            eq: input.program.program.id
          },
          ...(input.weekNumber
            ? {
                weekNumber: {
                  eq: input.weekNumber
                }
              }
            : {})
        }
      })
    ]);
    const secret = getJournalEncryptionSecret();

    if (encryptedAnswers.data.length > 0 && !secret) {
      return { ok: false, error: "Sign in again before exporting saved reflections." };
    }

    const decryptedAnswers: Record<string, string> = {};

    if (secret) {
      for (const answer of encryptedAnswers.data) {
        decryptedAnswers[journalPromptAnswerKey(answer.sectionId, answer.promptId)] = await decryptJournalAnswer(
          {
            algorithm: "AES-GCM",
            ciphertext: answer.ciphertext,
            iterations: answer.iterations,
            iv: answer.iv,
            keyDerivation: "PBKDF2-SHA-256",
            salt: answer.salt,
            version: 1
          } satisfies EncryptedPayload,
          secret
        );
      }
    }

    const progressRows: SectionProgress[] = progress.data.map((row) => ({
      completed: row.completed,
      dayNumber: row.dayNumber,
      groupId: row.groupId,
      pointsEarned: row.pointsEarned,
      programId: row.programId,
      sectionId: row.sectionId,
      updatedAt: row.updatedAt,
      userId: row.userId,
      weekNumber: row.weekNumber
    }));
    const completedSections = new Set<CompletedSectionKey>(
      progressRows
        .filter((row) => row.completed)
        .map((row) => sectionKey(row.weekNumber, row.dayNumber, row.sectionId))
    );
    const weeklyTotals = Object.fromEntries(
      input.program.weeks.map((week) => {
        const score = calculateScores(input.program, week.weekNumber, completedSections);
        return [
          week.weekNumber,
          {
            maxScore: score.maxWeeklyScore,
            score: score.weeklyScore
          }
        ];
      })
    );
    const cumulative = calculateScores(input.program, input.program.weeks[0]?.weekNumber ?? 1, completedSections);

    return {
      ok: true,
      data: {
        cumulativeScore: cumulative.cumulativeScore,
        decryptedAnswers,
        displayName: await getDisplayName(user.userId),
        exportedAt: new Date().toISOString(),
        groupName: input.groupName,
        maxCumulativeScore: cumulative.maxCumulativeScore,
        program: input.program,
        progress: progressRows,
        weekNumber: input.weekNumber,
        weeklyTotals
      }
    };
  } catch (error) {
    return serviceError(error);
  }
}

export async function loadJournalDay(input: {
  groupId: string;
  program: Program;
  weekNumber: number;
  dayNumber: number;
}): Promise<ServiceResult<JournalDayState>> {
  try {
    await configureAmplify();
    const client = getDataClient();
    const user = await getCurrentUser();
    const [progress, encryptedAnswers] = await Promise.all([
      client.models.SectionProgress.list({
        filter: {
          userId: {
            eq: user.userId
          },
          groupId: {
            eq: input.groupId
          },
          programId: {
            eq: input.program.program.id
          },
          weekNumber: {
            eq: input.weekNumber
          },
          dayNumber: {
            eq: input.dayNumber
          },
          completed: {
            eq: true
          }
        }
      }),
      client.models.EncryptedAnswer.list({
        filter: {
          userId: {
            eq: user.userId
          },
          groupId: {
            eq: input.groupId
          },
          programId: {
            eq: input.program.program.id
          },
          weekNumber: {
            eq: input.weekNumber
          },
          dayNumber: {
            eq: input.dayNumber
          }
        }
      })
    ]);
    let secret = getJournalEncryptionSecret();

    // If key is missing, try to recover it silently from the server (V2 envelopes only)
    if (!secret) {
      secret = await tryAutoRecoverJournalKey(client, user.userId);
    }

    const answers: Record<string, string> = {};
    let warning: string | undefined;
    const needsReauth = !secret;

    if (secret) {
      for (const answer of encryptedAnswers.data) {
        try {
          answers[journalPromptAnswerKey(answer.sectionId, answer.promptId)] = await decryptJournalAnswer(
            {
              algorithm: "AES-GCM",
              ciphertext: answer.ciphertext,
              iterations: answer.iterations,
              iv: answer.iv,
              keyDerivation: "PBKDF2-SHA-256",
              salt: answer.salt,
              version: 1
            } satisfies EncryptedPayload,
            secret
          );
        } catch {
          warning = "Some saved reflections could not be decrypted with this session.";
        }
      }
    }

    return {
      ok: true,
      data: {
        answers,
        completedSectionIds: progress.data.map((row) => row.sectionId),
        encryptedAnswerCount: encryptedAnswers.data.length,
        needsReauth,
        warning
      }
    };
  } catch (error) {
    return serviceError(error);
  }
}

async function getCompletedSectionsFromProgress(input: {
  client: DataClient;
  groupId: string;
  programId: string;
  userId: string;
}): Promise<Set<CompletedSectionKey>> {
  const progress = await input.client.models.SectionProgress.list({
    filter: {
      userId: {
        eq: input.userId
      },
      groupId: {
        eq: input.groupId
      },
      programId: {
        eq: input.programId
      },
      completed: {
        eq: true
      }
    }
  });

  return new Set<CompletedSectionKey>(
    progress.data.map((row) => sectionKey(row.weekNumber, row.dayNumber, row.sectionId))
  );
}


export async function saveJournalDay(input: {
  groupId: string;
  program: Program;
  weekNumber: number;
  dayNumber: number;
  completedSectionIds: string[];
  answers: Record<string, { promptId: string; sectionId: string; value: string }>;
}): Promise<ServiceResult<void>> {
  try {
    await configureAmplify();
    const client = getDataClient();
    const user = await getCurrentUser();
    const now = new Date().toISOString();
    const secret = getJournalEncryptionSecret();

    const allSectionIds =
      input.program.weeks
        .find((week) => week.weekNumber === input.weekNumber)
        ?.days.find((day) => day.dayNumber === input.dayNumber)
        ?.sections ?? [];

    // Write all section progress in parallel
    await Promise.all([
      ...input.completedSectionIds.map((sectionId) => {
        const section = allSectionIds.find((candidate) => candidate.id === sectionId);
        const progressId = `${user.userId}:${input.groupId}:${input.program.program.id}:${input.weekNumber}:${input.dayNumber}:${sectionId}`;
        return upsert(
          () =>
            client.models.SectionProgress.create({
              progressId,
              userId: user.userId,
              groupId: input.groupId,
              programId: input.program.program.id,
              weekNumber: input.weekNumber,
              dayNumber: input.dayNumber,
              sectionId,
              completed: true,
              pointsEarned: section?.points ?? 0,
              updatedAt: now
            }),
          () =>
            client.models.SectionProgress.update({
              progressId,
              completed: true,
              pointsEarned: section?.points ?? 0,
              updatedAt: now
            })
        );
      }),
      ...allSectionIds
        .filter((section) => !input.completedSectionIds.includes(section.id))
        .map((section) => {
          const progressId = `${user.userId}:${input.groupId}:${input.program.program.id}:${input.weekNumber}:${input.dayNumber}:${section.id}`;
          return client.models.SectionProgress.update({
            progressId,
            completed: false,
            pointsEarned: 0,
            updatedAt: now
          });
        })
    ]);

    // Score sync must come after progress writes; Lambda computes score server-side
    await requireSaved(
      client.mutations.syncUserScore({
        groupId: input.groupId,
        weekNumber: input.weekNumber,
        programId: input.program.program.id
      }),
      "Score sync failed."
    );

    // If no journal key is present, skip all answer processing entirely.
    // This prevents empty answers from being mistaken for deletions and wiping encrypted content.
    if (!secret) {
      return { ok: true, data: undefined };
    }

    // Encrypt all answers in parallel, then write in parallel
    await Promise.all(
      Object.values(input.answers).map(async (answer) => {
        const promptId = answer.promptId;
        const answerId = `${user.userId}:${input.groupId}:${input.program.program.id}:${input.weekNumber}:${input.dayNumber}:${answer.sectionId}:${promptId}`;

        if (!answer.value.trim()) {
          return client.models.EncryptedAnswer.delete({ answerId });
        }

        if (!secret) {
          return;
        }

        const encrypted = await encryptJournalAnswer(answer.value, secret);

        return upsert(
          () =>
            client.models.EncryptedAnswer.create({
              answerId,
              userId: user.userId,
              groupId: input.groupId,
              programId: input.program.program.id,
              weekNumber: input.weekNumber,
              dayNumber: input.dayNumber,
              sectionId: answer.sectionId,
              promptId,
              ciphertext: encrypted.ciphertext,
              iv: encrypted.iv,
              salt: encrypted.salt,
              keyDerivation: encrypted.keyDerivation,
              iterations: encrypted.iterations,
              algorithm: encrypted.algorithm,
              version: encrypted.version,
              updatedAt: now
            }),
          () =>
            client.models.EncryptedAnswer.update({
              answerId,
              ciphertext: encrypted.ciphertext,
              iv: encrypted.iv,
              salt: encrypted.salt,
              keyDerivation: encrypted.keyDerivation,
              iterations: encrypted.iterations,
              algorithm: encrypted.algorithm,
              version: encrypted.version,
              updatedAt: now
            })
        );
      })
    );

    return { ok: true, data: undefined };
  } catch (error) {
    return serviceError(error);
  }
}

function getDataClient(): DataClient {
  dataClient ??= generateClient<Schema>();
  return dataClient;
}

async function upsert(create: () => Promise<unknown>, update: () => Promise<unknown>): Promise<void> {
  const updated = await update();

  if (hasData(updated)) {
    return;
  }

  await requireSaved(create(), "The record could not be saved.");
}

function hasData(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && "data" in value && value.data);
}

async function tryAutoRecoverJournalKey(client: DataClient, userId: string): Promise<string | null> {
  try {
    const profile = await client.models.UserProfile.get({ userId });
    const envelope = getJournalKeyEnvelope(profile.data);

    if (!envelope || envelope.version !== 2) return null;

    await initializeJournalEncryptionSecretFromSub({ sub: userId, envelope });
    return getJournalEncryptionSecret();
  } catch {
    return null;
  }
}

function getJournalKeyEnvelope(profile: unknown): JournalKeyEnvelope | null {
  if (!profile || typeof profile !== "object") {
    return null;
  }

  const fields = profile as {
    journalKeyAlgorithm?: string | null;
    journalKeyCiphertext?: string | null;
    journalKeyDerivation?: string | null;
    journalKeyIterations?: number | null;
    journalKeyIv?: string | null;
    journalKeySalt?: string | null;
    journalKeyVersion?: number | null;
  };

  if (
    fields.journalKeyAlgorithm !== "AES-GCM" ||
    !fields.journalKeyCiphertext ||
    fields.journalKeyDerivation !== "PBKDF2-SHA-256" ||
    !fields.journalKeyIterations ||
    !fields.journalKeyIv ||
    !fields.journalKeySalt ||
    (fields.journalKeyVersion !== 1 && fields.journalKeyVersion !== 2)
  ) {
    return null;
  }

  return {
    algorithm: fields.journalKeyAlgorithm,
    ciphertext: fields.journalKeyCiphertext,
    iterations: fields.journalKeyIterations,
    iv: fields.journalKeyIv,
    keyDerivation: fields.journalKeyDerivation,
    salt: fields.journalKeySalt,
    version: fields.journalKeyVersion as 1 | 2
  };
}

async function saveJournalKeyEnvelope(
  client: DataClient,
  userId: string,
  envelope: JournalKeyEnvelope
): Promise<ServiceResult<void>> {
  try {
    await requireSaved(
      client.models.UserProfile.update({
        userId,
        journalKeyAlgorithm: envelope.algorithm,
        journalKeyCiphertext: envelope.ciphertext,
        journalKeyDerivation: envelope.keyDerivation,
        journalKeyIterations: envelope.iterations,
        journalKeyIv: envelope.iv,
        journalKeySalt: envelope.salt,
        journalKeyVersion: envelope.version,
        updatedAt: new Date().toISOString()
      }),
      "The journal key envelope could not be saved."
    );

    return { ok: true, data: undefined };
  } catch (error) {
    return serviceError(error);
  }
}

function getLegacyJournalSecret(email: string, password: string): string {
  return `${email.trim().toLowerCase()}:${password}`;
}

async function updateOwnMembershipDisplayNames(
  client: DataClient,
  userId: string,
  displayName: string
): Promise<void> {
  const memberships = await client.models.GroupMembership.list({
    filter: {
      userId: {
        eq: userId
      }
    }
  });

  await Promise.all(
    memberships.data.filter((membership): membership is NonNullable<typeof membership> => membership != null).map((membership) =>
      requireSaved(
        client.models.GroupMembership.update({
          membershipId: membership.membershipId,
          displayName
        }),
        "A group membership display name could not be updated."
      )
    )
  );
}

async function updateOwnScoreDisplayNames(client: DataClient, userId: string, displayName: string): Promise<void> {
  const scores = await client.models.UserScore.list({
    filter: {
      userId: {
        eq: userId
      }
    }
  });

  await Promise.all(
    scores.data.filter((score): score is NonNullable<typeof score> => score != null).map((score) =>
      requireSaved(
        client.models.UserScore.update({
          scoreId: score.scoreId,
          displayName,
          updatedAt: new Date().toISOString()
        }),
        "A score display name could not be updated."
      )
    )
  );
}

async function updateCognitoDisplayName(displayName: string): Promise<void> {
  try {
    await updateUserAttribute({
      userAttribute: {
        attributeKey: "preferred_username",
        value: displayName
      }
    });
  } catch {
    // UserProfile is authoritative for in-app display; Cognito is best effort.
  }
}

async function requireSaved<T>(operation: Promise<T>, fallbackMessage: string): Promise<T> {
  const result = await operation;

  if (hasData(result)) {
    return result;
  }

  const errors = getResultErrors(result);
  throw new Error(errors.length > 0 ? errors.join(" ") : fallbackMessage);
}

function getResultErrors(value: unknown): string[] {
  if (!value || typeof value !== "object" || !("errors" in value) || !Array.isArray(value.errors)) {
    return [];
  }

  return value.errors.map((error) => {
    if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
      return error.message;
    }
    return "Unknown data error.";
  });
}

function isLeaderRole(role: AdminGroupMember["role"]): boolean {
  return role === "leader" || role === "admin";
}

function sortMembers(left: AdminGroupMember, right: AdminGroupMember): number {
  const leftLeader = isLeaderRole(left.role);
  const rightLeader = isLeaderRole(right.role);

  if (leftLeader !== rightLeader) {
    return leftLeader ? -1 : 1;
  }

  return left.displayName.localeCompare(right.displayName);
}

async function getDisplayName(userId: string): Promise<string> {
  const client = getDataClient();
  const profile = await client.models.UserProfile.get({ userId });
  return profile.data?.displayName ?? "Member";
}

async function hashJoinCode(value: string): Promise<string> {
  const normalized = value.trim().toUpperCase();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function serviceError(error: unknown): ServiceResult<never> {
  if (error instanceof Error) {
    return { ok: false, error: error.message };
  }
  return { ok: false, error: "The request could not be completed." };
}
