"use client";

import { generateClient } from "aws-amplify/data";
import { getCurrentUser, fetchUserAttributes } from "aws-amplify/auth";
import { configureAmplify } from "@/lib/amplifyClient";
import { encryptJournalAnswer } from "@/lib/encryption";
import { getJournalEncryptionSecret } from "@/lib/journalKey";
import { calculateScores, sectionKey, type CompletedSectionKey, type ScoreSummary } from "@/lib/scoring";
import type { Schema } from "@/amplify/data/resource";
import type { Program, ProgramImportPreview } from "@/types/program";

type DataClient = ReturnType<typeof generateClient<Schema>>;

let dataClient: DataClient | null = null;

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string };

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

export async function joinGroupByCode(groupCode: string): Promise<ServiceResult<string>> {
  try {
    await configureAmplify();
    const client = getDataClient();
    const user = await getCurrentUser();
    const now = new Date().toISOString();
    const joinCodeHash = await hashJoinCode(groupCode);
    const groups = await client.models.Group.list({
      filter: {
        joinCodeHash: {
          eq: joinCodeHash
        }
      }
    });
    const group = groups.data[0];

    if (!group) {
      return { ok: false, error: "No group matched that code." };
    }

    await ensureUserProfile();
    await client.models.GroupMembership.create({
      membershipId: `${group.groupId}:${user.userId}`,
      groupId: group.groupId,
      userId: user.userId,
      role: "member",
      displayName: await getDisplayName(user.userId),
      joinedAt: now
    });

    return { ok: true, data: group.groupId };
  } catch (error) {
    return serviceError(error);
  }
}

export async function publishProgram(groupId: string, preview: ProgramImportPreview): Promise<ServiceResult<string>> {
  try {
    await configureAmplify();
    const client = getDataClient();
    const user = await getCurrentUser();
    const now = new Date().toISOString();
    const programId = `${preview.program.program.id}:${preview.contentHash}`;

    await client.models.ProgramSnapshot.create({
      programId,
      groupId,
      title: preview.program.program.title,
      version: preview.program.program.version,
      contentHash: preview.contentHash,
      content: preview.program,
      publishedByUserId: user.userId,
      publishedAt: now
    });

    await client.models.Group.update({
      groupId,
      activeProgramId: programId,
      updatedAt: now
    });

    return { ok: true, data: programId };
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
    const score = await syncUserScoreFromProgress({
      client,
      displayName: await getDisplayName(user.userId),
      groupId: input.groupId,
      now: new Date().toISOString(),
      program: input.program,
      userId: user.userId,
      weekNumber: input.activeWeekNumber
    });

    return { ok: true, data: score };
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

async function syncUserScoreFromProgress(input: {
  client: DataClient;
  displayName: string;
  groupId: string;
  now: string;
  program: Program;
  userId: string;
  weekNumber: number;
}): Promise<ScoreSummary> {
  const completedSections = await getCompletedSectionsFromProgress({
    client: input.client,
    groupId: input.groupId,
    programId: input.program.program.id,
    userId: input.userId
  });
  const score = calculateScores(input.program, input.weekNumber, completedSections);
  const scoreId = getScoreId(input.userId, input.groupId, input.program.program.id, input.weekNumber);

  await upsert(
    async () =>
      input.client.models.UserScore.create({
        scoreId,
        userId: input.userId,
        groupId: input.groupId,
        programId: input.program.program.id,
        displayName: input.displayName,
        weekNumber: input.weekNumber,
        weeklyScore: score.weeklyScore,
        cumulativeScore: score.cumulativeScore,
        updatedAt: input.now
      }),
    async () =>
      input.client.models.UserScore.update({
        scoreId,
        displayName: input.displayName,
        weeklyScore: score.weeklyScore,
        cumulativeScore: score.cumulativeScore,
        updatedAt: input.now
      })
  );

  return score;
}

function getScoreId(userId: string, groupId: string, programId: string, weekNumber: number): string {
  return `${userId}:${groupId}:${programId}:${weekNumber}`;
}

export async function saveJournalDay(input: {
  groupId: string;
  program: Program;
  weekNumber: number;
  dayNumber: number;
  completedSectionIds: string[];
  answers: Record<string, { sectionId: string; value: string }>;
}): Promise<ServiceResult<void>> {
  try {
    await configureAmplify();
    const client = getDataClient();
    const user = await getCurrentUser();
    const now = new Date().toISOString();
    const secret = getJournalEncryptionSecret();

    for (const sectionId of input.completedSectionIds) {
      const section = input.program.weeks
        .find((week) => week.weekNumber === input.weekNumber)
        ?.days.find((day) => day.dayNumber === input.dayNumber)
        ?.sections.find((candidate) => candidate.id === sectionId);

      const progressId = `${user.userId}:${input.groupId}:${input.program.program.id}:${input.weekNumber}:${input.dayNumber}:${sectionId}`;

      await upsert(
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
    }

    const allSectionIds =
      input.program.weeks
        .find((week) => week.weekNumber === input.weekNumber)
        ?.days.find((day) => day.dayNumber === input.dayNumber)
        ?.sections.map((section) => section.id) ?? [];

    for (const sectionId of allSectionIds.filter((sectionId) => !input.completedSectionIds.includes(sectionId))) {
      const progressId = `${user.userId}:${input.groupId}:${input.program.program.id}:${input.weekNumber}:${input.dayNumber}:${sectionId}`;

      await client.models.SectionProgress.update({
        progressId,
        completed: false,
        pointsEarned: 0,
        updatedAt: now
      });
    }

    const displayName = await getDisplayName(user.userId);

    await syncUserScoreFromProgress({
      client,
      displayName,
      groupId: input.groupId,
      now,
      program: input.program,
      userId: user.userId,
      weekNumber: input.weekNumber
    });

    if (!secret && Object.values(input.answers).some((answer) => answer.value.trim())) {
      return { ok: false, error: "Sign in again before saving reflections." };
    }

    for (const [promptId, answer] of Object.entries(input.answers)) {
      if (!answer.value.trim() || !secret) {
        continue;
      }

      const encrypted = await encryptJournalAnswer(answer.value, secret);
      const answerId = `${user.userId}:${input.groupId}:${input.program.program.id}:${input.weekNumber}:${input.dayNumber}:${answer.sectionId}:${promptId}`;

      await upsert(
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
    }

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

  await create();
}

function hasData(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && "data" in value && value.data);
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
