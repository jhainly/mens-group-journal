import { DynamoDBClient, QueryCommand, UpdateItemCommand, type AttributeValue } from "@aws-sdk/client-dynamodb";

type SyncDisplayNameEvent = {
  arguments?: {
    displayName?: string;
  };
  identity?: {
    sub?: string;
    claims?: Record<string, unknown>;
  };
};

type SyncDisplayNameResult = {
  displayName: string;
  updatedScoreCount: number;
};

const dynamo = new DynamoDBClient({});
const userScoreTableName = requiredEnv("USER_SCORE_TABLE_NAME");
const userScoreUserIdIndexName = requiredEnv("USER_SCORE_USER_ID_INDEX_NAME");

export const handler = async (event: SyncDisplayNameEvent): Promise<SyncDisplayNameResult> => {
  const displayName = event.arguments?.displayName?.trim();
  const userId = getUserId(event);

  if (!displayName) {
    throw new Error("Display name is required.");
  }

  if (!userId) {
    throw new Error("You must be signed in to update your display name.");
  }

  const now = new Date().toISOString();
  const scores = await loadUserScores(userId);

  await Promise.all(
    scores.map((score) =>
      dynamo.send(
        new UpdateItemCommand({
          TableName: userScoreTableName,
          Key: {
            scoreId: { S: score.scoreId }
          },
          ConditionExpression: "userId = :userId",
          UpdateExpression: "SET displayName = :displayName, updatedAt = :now",
          ExpressionAttributeValues: {
            ":displayName": { S: displayName },
            ":now": { S: now },
            ":userId": { S: userId }
          }
        })
      )
    )
  );

  return {
    displayName,
    updatedScoreCount: scores.length
  };
};

async function loadUserScores(userId: string): Promise<Array<{ scoreId: string }>> {
  const scores: Array<{ scoreId: string }> = [];
  let exclusiveStartKey: Record<string, AttributeValue> | undefined;

  do {
    const result = await dynamo.send(
      new QueryCommand({
        TableName: userScoreTableName,
        IndexName: userScoreUserIdIndexName,
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {
          ":userId": { S: userId }
        },
        ExclusiveStartKey: exclusiveStartKey
      })
    );

    for (const item of result.Items ?? []) {
      const scoreId = getString(item, "scoreId");

      if (scoreId) {
        scores.push({ scoreId });
      }
    }

    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return scores;
}

function getUserId(event: SyncDisplayNameEvent): string | undefined {
  const claimSub = event.identity?.claims?.sub;
  return event.identity?.sub ?? (typeof claimSub === "string" ? claimSub : undefined);
}

function getString(item: Record<string, AttributeValue>, fieldName: string): string | undefined {
  const value = item[fieldName];
  return value && "S" in value ? value.S : undefined;
}

function requiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}
