import {
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  ListUsersInGroupCommand,
  type UserType
} from "@aws-sdk/client-cognito-identity-provider";

const ADMIN_GROUP = "ADMINS";
const client = new CognitoIdentityProviderClient({});

type AdminRoleEvent = {
  arguments?: {
    email?: string;
    enabled?: boolean;
  };
  identity?: {
    claims?: Record<string, unknown>;
  } | null;
  info?: {
    fieldName: string;
  };
};

export const handler = async (event: AdminRoleEvent) => {
  const userPoolId = process.env.USER_POOL_ID;
  const args = event.arguments ?? {};

  if (!userPoolId) {
    throw new Error("Admin role management is not configured.");
  }

  assertAdmin(event.identity);

  const fieldName = event.info?.fieldName;

  if (fieldName === "listAdminUsers" || isListAdminUsersEvent(event)) {
    return listUsersWithAdminRole(userPoolId);
  }

  if (fieldName === "setUserAdminRole" || isSetUserAdminRoleEvent(event)) {
    const { email, enabled } = args;

    if (typeof email !== "string" || typeof enabled !== "boolean") {
      throw new Error("Email and enabled status are required.");
    }

    const target = await findUserByEmail(userPoolId, email);

    if (!target.Username) {
      throw new Error("User was found but does not have a Cognito username.");
    }

    const targetSub = getAttribute(target, "sub");
    const callerSub = getClaim(event.identity, "sub");

    if (!enabled && targetSub && callerSub && targetSub === callerSub) {
      throw new Error("You cannot remove your own admin access.");
    }

    if (enabled) {
      await client.send(
        new AdminAddUserToGroupCommand({
          GroupName: ADMIN_GROUP,
          UserPoolId: userPoolId,
          Username: target.Username
        })
      );
    } else {
      await client.send(
        new AdminRemoveUserFromGroupCommand({
          GroupName: ADMIN_GROUP,
          UserPoolId: userPoolId,
          Username: target.Username
        })
      );
    }

    return {
      email: getAttribute(target, "email") ?? email.trim().toLowerCase(),
      isAdmin: enabled,
      message: enabled ? "User added to admin role." : "User removed from admin role.",
      username: target.Username
    };
  }

  throw new Error("Unsupported admin role operation.");
};

function isListAdminUsersEvent(event: AdminRoleEvent): boolean {
  const args = event.arguments ?? {};
  return !("email" in args) && !("enabled" in args);
}

function isSetUserAdminRoleEvent(event: AdminRoleEvent): boolean {
  const args = event.arguments ?? {};
  return "email" in args || "enabled" in args;
}

async function listUsersWithAdminRole(userPoolId: string) {
  const adminUsernames = await listAdminUsernames(userPoolId);
  const users: UserType[] = [];
  let token: string | undefined;

  do {
    const result = await client.send(
      new ListUsersCommand({
        Limit: 60,
        PaginationToken: token,
        UserPoolId: userPoolId
      })
    );

    users.push(...(result.Users ?? []));
    token = result.PaginationToken;
  } while (token);

  return users
    .map((user) => ({
      displayName: getAttribute(user, "preferred_username") ?? getAttribute(user, "email") ?? user.Username ?? "User",
      email: getAttribute(user, "email") ?? "",
      enabled: user.Enabled ?? false,
      isAdmin: user.Username ? adminUsernames.has(user.Username) : false,
      status: user.UserStatus ?? "UNKNOWN",
      username: user.Username ?? ""
    }))
    .sort((left, right) => {
      const leftLabel = left.email || left.displayName || left.username;
      const rightLabel = right.email || right.displayName || right.username;
      return leftLabel.localeCompare(rightLabel);
    });
}

async function listAdminUsernames(userPoolId: string): Promise<Set<string>> {
  const users: UserType[] = [];
  let token: string | undefined;

  do {
    const result = await client.send(
      new ListUsersInGroupCommand({
        GroupName: ADMIN_GROUP,
        Limit: 60,
        NextToken: token,
        UserPoolId: userPoolId
      })
    );

    users.push(...(result.Users ?? []));
    token = result.NextToken;
  } while (token);

  return new Set(users.map((user) => user.Username).filter((username): username is string => Boolean(username)));
}

async function findUserByEmail(userPoolId: string, email: string): Promise<UserType> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error("Enter an email address.");
  }

  const result = await client.send(
    new ListUsersCommand({
      Filter: `email = "${escapeCognitoFilterValue(normalizedEmail)}"`,
      Limit: 1,
      UserPoolId: userPoolId
    })
  );
  const user = result.Users?.[0];

  if (!user) {
    throw new Error("No Cognito user matched that email address.");
  }

  return user;
}

function assertAdmin(identity: unknown): void {
  const groups = getClaim(identity, "cognito:groups");
  const groupList = Array.isArray(groups) ? groups.map(String) : [];

  if (!groupList.includes(ADMIN_GROUP)) {
    throw new Error("Only admins can manage admin role access.");
  }
}

function getClaim(identity: unknown, key: string): unknown {
  if (!identity || typeof identity !== "object" || !("claims" in identity)) {
    return undefined;
  }

  const claims = (identity as { claims?: Record<string, unknown> }).claims;
  return claims?.[key];
}

function getAttribute(user: UserType, name: string): string | undefined {
  return user.Attributes?.find((attribute) => attribute.Name === name)?.Value;
}

function escapeCognitoFilterValue(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}
