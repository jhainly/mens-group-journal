import {
  DynamoDBClient,
  GetItemCommand,
  QueryCommand,
  UpdateItemCommand,
  type AttributeValue
} from "@aws-sdk/client-dynamodb";

type SyncUserScoreEvent = {
  arguments?: {
    groupId?: string;
    weekNumber?: number;
    programId?: string;
  };
  identity?: {
    sub?: string;
    claims?: Record<string, unknown>;
  };
};

type SyncUserScoreResult = {
  weeklyScore: number;
  cumulativeScore: number;
};

type SectionLite = { id: string; points: number };
type DayLite = { dayNumber: number; sections: SectionLite[] };
type WeekLite = { weekNumber: number; days: DayLite[] };

const dynamo = new DynamoDBClient({});

const sectionProgressTableName = requiredEnv("SECTION_PROGRESS_TABLE_NAME");
const sectionProgressUserIdIndexName = requiredEnv("SECTION_PROGRESS_USER_ID_INDEX_NAME");
const groupProgramWeekTableName = requiredEnv("GROUP_PROGRAM_WEEK_TABLE_NAME");
const groupProgramWeekGroupIdIndexName = requiredEnv("GROUP_PROGRAM_WEEK_GROUP_ID_INDEX_NAME");
const programSnapshotTableName = requiredEnv("PROGRAM_SNAPSHOT_TABLE_NAME");
const userScoreTableName = requiredEnv("USER_SCORE_TABLE_NAME");
const userProfileTableName = requiredEnv("USER_PROFILE_TABLE_NAME");

export const handler = async (event: SyncUserScoreEvent): Promise<SyncUserScoreResult> => {
  const groupId = event.arguments?.groupId?.trim();
  const weekNumber = event.arguments?.weekNumber;
  const programId = event.arguments?.programId?.trim();
  const userId = getUserId(event);

  if (!groupId || !programId || weekNumber == null) {
    throw new Error("groupId, programId, and weekNumber are required.");
  }

  if (!userId) {
    throw new Error("You must be signed in to sync your score.");
  }

  const [weeks, completedSectionKeys, displayName] = await Promise.all([
    loadProgramWeeks(groupId, programId),
    loadCompletedSectionKeys(userId, groupId, programId),
    loadDisplayName(userId)
  ]);

  const score = calculateScores(weeks, weekNumber, completedSectionKeys);
  const scoreId = `${userId}:${groupId}:${programId}:${weekNumber}`;
  const now = new Date().toISOString();

  await dynamo.send(
    new UpdateItemCommand({
      TableName: userScoreTableName,
      Key: { scoreId: { S: scoreId } },
      UpdateExpression: [
        "SET #typename = if_not_exists(#typename, :typename)",
        "userId = :userId",
        "groupId = :groupId",
        "programId = :programId",
        "displayName = :displayName",
        "weekNumber = :weekNumber",
        "weeklyScore = :weeklyScore",
        "cumulativeScore = :cumulativeScore",
        "updatedAt = :now",
        "createdAt = if_not_exists(createdAt, :now)"
      ].join(", "),
      ExpressionAttributeNames: { "#typename": "__typename" },
      ExpressionAttributeValues: {
        ":typename": { S: "UserScore" },
        ":userId": { S: userId },
        ":groupId": { S: groupId },
        ":programId": { S: programId },
        ":displayName": { S: displayName },
        ":weekNumber": { N: String(weekNumber) },
        ":weeklyScore": { N: String(score.weeklyScore) },
        ":cumulativeScore": { N: String(score.cumulativeScore) },
        ":now": { S: now }
      }
    })
  );

  return { weeklyScore: score.weeklyScore, cumulativeScore: score.cumulativeScore };
};

async function loadProgramWeeks(groupId: string, programId: string): Promise<WeekLite[]> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: groupProgramWeekTableName,
      IndexName: groupProgramWeekGroupIdIndexName,
      KeyConditionExpression: "groupId = :groupId",
      FilterExpression: "programId = :programId AND isActive = :true",
      ExpressionAttributeValues: {
        ":groupId": { S: groupId },
        ":programId": { S: programId },
        ":true": { BOOL: true }
      }
    })
  );

  if (result.Items && result.Items.length > 0) {
    return result.Items.flatMap((item) => {
      const raw = getString(item, "content");
      return raw ? parseWeekContent(raw) : [];
    });
  }

  // Fall back to legacy ProgramSnapshot
  const snapshot = await dynamo.send(
    new GetItemCommand({
      TableName: programSnapshotTableName,
      Key: { programId: { S: programId } }
    })
  );

  if (!snapshot.Item) {
    return [];
  }

  const raw = getString(snapshot.Item, "content");
  return raw ? parseProgramContent(raw) : [];
}

async function loadCompletedSectionKeys(
  userId: string,
  groupId: string,
  programId: string
): Promise<Set<string>> {
  const keys = new Set<string>();
  let lastKey: Record<string, AttributeValue> | undefined;

  do {
    const result = await dynamo.send(
      new QueryCommand({
        TableName: sectionProgressTableName,
        IndexName: sectionProgressUserIdIndexName,
        KeyConditionExpression: "userId = :userId",
        FilterExpression: "groupId = :groupId AND programId = :programId AND completed = :true",
        ExpressionAttributeValues: {
          ":userId": { S: userId },
          ":groupId": { S: groupId },
          ":programId": { S: programId },
          ":true": { BOOL: true }
        },
        ExclusiveStartKey: lastKey
      })
    );

    for (const item of result.Items ?? []) {
      const weekNum = getNumber(item, "weekNumber");
      const dayNum = getNumber(item, "dayNumber");
      const sectionId = getString(item, "sectionId");
      if (weekNum != null && dayNum != null && sectionId) {
        keys.add(`${weekNum}:${dayNum}:${sectionId}`);
      }
    }

    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return keys;
}

async function loadDisplayName(userId: string): Promise<string> {
  const result = await dynamo.send(
    new GetItemCommand({
      TableName: userProfileTableName,
      Key: { userId: { S: userId } }
    })
  );
  return getString(result.Item ?? {}, "displayName") ?? "Member";
}

function calculateScores(
  weeks: WeekLite[],
  activeWeekNumber: number,
  completedKeys: Set<string>
): { weeklyScore: number; cumulativeScore: number } {
  let weeklyScore = 0;
  let cumulativeScore = 0;

  for (const week of weeks) {
    for (const day of week.days) {
      for (const section of day.sections) {
        const points = Math.max(0, section.points);
        const key = `${week.weekNumber}:${day.dayNumber}:${section.id}`;
        if (completedKeys.has(key)) {
          cumulativeScore += points;
          if (week.weekNumber === activeWeekNumber) {
            weeklyScore += points;
          }
        }
      }
    }
  }

  return { weeklyScore, cumulativeScore };
}

function parseWeekContent(raw: string): WeekLite[] {
  try {
    const parsed = JSON.parse(raw) as WeekLite;
    if (typeof parsed.weekNumber === "number" && Array.isArray(parsed.days)) {
      return [parsed];
    }
    return [];
  } catch {
    return [];
  }
}

function parseProgramContent(raw: string): WeekLite[] {
  try {
    const parsed = JSON.parse(raw) as { weeks?: WeekLite[] };
    return Array.isArray(parsed.weeks) ? parsed.weeks : [];
  } catch {
    return [];
  }
}

function getUserId(event: SyncUserScoreEvent): string | undefined {
  const claimSub = event.identity?.claims?.sub;
  return event.identity?.sub ?? (typeof claimSub === "string" ? claimSub : undefined);
}

function getString(item: Record<string, AttributeValue>, field: string): string | undefined {
  const val = item[field];
  return val && "S" in val ? val.S : undefined;
}

function getNumber(item: Record<string, AttributeValue>, field: string): number | undefined {
  const val = item[field];
  if (val && "N" in val && val.N != null) {
    return Number(val.N);
  }
  return undefined;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}
