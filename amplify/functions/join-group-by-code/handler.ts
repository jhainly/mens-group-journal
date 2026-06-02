import { createHash } from "node:crypto";
import {
  ConditionalCheckFailedException,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  QueryCommand,
  type AttributeValue
} from "@aws-sdk/client-dynamodb";

type JoinGroupEvent = {
  arguments?: {
    groupCode?: string;
  };
  identity?: {
    sub?: string;
    username?: string;
    claims?: Record<string, unknown>;
  };
};

type JoinGroupResult = {
  groupId: string;
  groupName: string;
};

const client = new DynamoDBClient({});

const groupTableName = requiredEnv("GROUP_TABLE_NAME");
const groupJoinCodeHashIndexName = requiredEnv("GROUP_JOIN_CODE_HASH_INDEX_NAME");
const membershipTableName = requiredEnv("GROUP_MEMBERSHIP_TABLE_NAME");
const userProfileTableName = requiredEnv("USER_PROFILE_TABLE_NAME");

export const handler = async (event: JoinGroupEvent): Promise<JoinGroupResult> => {
  const groupCode = event.arguments?.groupCode?.trim();
  const userId = getUserId(event);

  if (!groupCode) {
    throw new Error("Enter a group code.");
  }

  if (!userId) {
    throw new Error("You must be signed in to join a group.");
  }

  const joinCodeHash = hashJoinCode(groupCode);
  const group = await findGroupByJoinCodeHash(joinCodeHash);

  if (!group) {
    throw new Error("No group matched that code.");
  }

  const groupId = getString(group, "groupId");
  const groupName = getString(group, "name");

  if (!groupId || !groupName) {
    throw new Error("The matched group record is incomplete.");
  }

  const membershipId = `${groupId}:${userId}`;
  const existingMembership = await client.send(
    new GetItemCommand({
      TableName: membershipTableName,
      Key: {
        membershipId: { S: membershipId }
      }
    })
  );

  if (!existingMembership.Item) {
    const displayName = (await getDisplayName(userId)) ?? "Member";
    const now = new Date().toISOString();

    try {
      await client.send(
        new PutItemCommand({
          TableName: membershipTableName,
          Item: {
            __typename: { S: "GroupMembership" },
            membershipId: { S: membershipId },
            groupId: { S: groupId },
            userId: { S: userId },
            role: { S: "member" },
            displayName: { S: displayName },
            joinedAt: { S: now },
            createdAt: { S: now },
            updatedAt: { S: now }
          },
          ConditionExpression: "attribute_not_exists(membershipId)"
        })
      );
    } catch (error) {
      if (!(error instanceof ConditionalCheckFailedException)) {
        throw error;
      }
    }
  }

  return {
    groupId,
    groupName
  };
};

async function findGroupByJoinCodeHash(joinCodeHash: string) {
  const result = await client.send(
    new QueryCommand({
      TableName: groupTableName,
      IndexName: groupJoinCodeHashIndexName,
      KeyConditionExpression: "joinCodeHash = :joinCodeHash",
      ExpressionAttributeValues: {
        ":joinCodeHash": { S: joinCodeHash }
      },
      Limit: 1
    })
  );

  return result.Items?.[0];
}

async function getDisplayName(userId: string): Promise<string | undefined> {
  const result = await client.send(
    new GetItemCommand({
      TableName: userProfileTableName,
      Key: {
        userId: { S: userId }
      }
    })
  );

  return result.Item ? getString(result.Item, "displayName") : undefined;
}

function hashJoinCode(value: string): string {
  return createHash("sha256").update(value.trim().toUpperCase()).digest("hex");
}

function getUserId(event: JoinGroupEvent): string | undefined {
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
