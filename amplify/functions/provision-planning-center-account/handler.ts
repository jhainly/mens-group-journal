import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import {
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  type UserType
} from "@aws-sdk/client-cognito-identity-provider";

type PlanningCenterAccountEvent = {
  arguments?: {
    proof?: string;
  };
};

type PlanningCenterLoginProof = {
  email: string;
  exp: number;
  intent: "create" | "login";
  lpInfraUserId: string;
  name: string;
  planningCenterPersonId: string;
  username: string;
  v: 1;
};

const client = new CognitoIdentityProviderClient({});

export const handler = async (event: PlanningCenterAccountEvent) =>
  provisionPlanningCenterAccount(event, client);

export async function provisionPlanningCenterAccount(
  event: PlanningCenterAccountEvent,
  cognitoClient: CognitoIdentityProviderClient
) {
  const userPoolId = process.env.USER_POOL_ID;
  const proof = verifyPlanningCenterLoginProof(
    event.arguments?.proof ?? "",
    process.env.LP_INFRA_CLIENT_SECRET ?? ""
  );

  if (!userPoolId) {
    throw new Error("Planning Center account creation is not configured.");
  }

  if (!proof) {
    throw new Error("Planning Center sign-in expired. Please try again.");
  }

  if (proof.intent !== "create") {
    throw new Error("Start account creation from the Create account page.");
  }

  const existingUser = findUserForProof(await listAllUsers(cognitoClient, userPoolId), proof);

  if (existingUser) {
    await confirmInterruptedProvision(cognitoClient, userPoolId, existingUser, proof);
    return {
      created: false,
      loginId: getLoginId(existingUser)
    };
  }

  let createdUser: UserType | undefined;

  try {
    const result = await cognitoClient.send(
      new AdminCreateUserCommand({
        MessageAction: "SUPPRESS",
        TemporaryPassword: createCognitoPassword(),
        UserAttributes: [
          { Name: "email", Value: proof.email },
          { Name: "email_verified", Value: "true" },
          { Name: "preferred_username", Value: normalizeDisplayName(proof.name, proof.email) },
          { Name: "custom:pcPersonId", Value: proof.planningCenterPersonId },
          { Name: "custom:lpInfraUserId", Value: proof.lpInfraUserId }
        ],
        Username: proof.email,
        UserPoolId: userPoolId
      })
    );
    createdUser = result.User;
  } catch (error) {
    if (!isUsernameConflict(error)) {
      throw error;
    }

    const concurrentUser = findUserForProof(await listAllUsers(cognitoClient, userPoolId), proof);

    if (!concurrentUser) {
      throw error;
    }

    await confirmInterruptedProvision(cognitoClient, userPoolId, concurrentUser, proof);
    return {
      created: false,
      loginId: getLoginId(concurrentUser)
    };
  }

  const username = createdUser?.Username ?? proof.email;
  await setPermanentGeneratedPassword(cognitoClient, userPoolId, username);

  return {
    created: true,
    loginId: proof.email
  };
}

async function listAllUsers(
  cognitoClient: CognitoIdentityProviderClient,
  userPoolId: string
): Promise<UserType[]> {
  const users: UserType[] = [];
  let paginationToken: string | undefined;

  do {
    const result = await cognitoClient.send(
      new ListUsersCommand({
        Limit: 60,
        PaginationToken: paginationToken,
        UserPoolId: userPoolId
      })
    );

    users.push(...(result.Users ?? []));
    paginationToken = result.PaginationToken;
  } while (paginationToken);

  return users;
}

function findUserForProof(users: UserType[], proof: PlanningCenterLoginProof): UserType | undefined {
  const personMatches = users.filter(
    (user) => getAttribute(user, "custom:pcPersonId") === proof.planningCenterPersonId
  );

  if (personMatches.length > 1) {
    throw new Error("This Planning Center profile is linked to more than one app account. Contact an administrator.");
  }

  const target =
    personMatches[0] ?? users.find((user) => normalizeEmail(getAttribute(user, "email")) === proof.email);

  if (!target) {
    return undefined;
  }

  const existingPersonId = getAttribute(target, "custom:pcPersonId");

  if (existingPersonId && existingPersonId !== proof.planningCenterPersonId) {
    throw new Error("This app account is already linked to a different Planning Center profile.");
  }

  return target;
}

async function confirmInterruptedProvision(
  cognitoClient: CognitoIdentityProviderClient,
  userPoolId: string,
  user: UserType,
  proof: PlanningCenterLoginProof
): Promise<void> {
  if (
    user.UserStatus !== "FORCE_CHANGE_PASSWORD" ||
    getAttribute(user, "custom:pcPersonId") !== proof.planningCenterPersonId ||
    getAttribute(user, "custom:lpInfraUserId") !== proof.lpInfraUserId
  ) {
    return;
  }

  if (!user.Username) {
    throw new Error("The Planning Center account is missing its Cognito username.");
  }

  await setPermanentGeneratedPassword(cognitoClient, userPoolId, user.Username);
}

async function setPermanentGeneratedPassword(
  cognitoClient: CognitoIdentityProviderClient,
  userPoolId: string,
  username: string
): Promise<void> {
  await cognitoClient.send(
    new AdminSetUserPasswordCommand({
      Password: createCognitoPassword(),
      Permanent: true,
      Username: username,
      UserPoolId: userPoolId
    })
  );
}

function createCognitoPassword(): string {
  return `${randomBytes(32).toString("base64url")}!aA1`;
}

function normalizeDisplayName(name: string, email: string): string {
  return (name.trim() || email).slice(0, 128);
}

function getLoginId(user: UserType): string {
  const email = normalizeEmail(getAttribute(user, "email"));

  if (email) {
    return email;
  }

  if (user.Username) {
    return user.Username;
  }

  throw new Error("The Planning Center account does not have a login ID.");
}

function getAttribute(user: UserType, name: string): string | undefined {
  return user.Attributes?.find((attribute) => attribute.Name === name)?.Value;
}

function normalizeEmail(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function isUsernameConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const name = "name" in error && typeof error.name === "string" ? error.name : "";
  return name === "AliasExistsException" || name === "UsernameExistsException";
}

function verifyPlanningCenterLoginProof(token: string, secret: string): PlanningCenterLoginProof | null {
  const [payload, signature] = token.split(".");

  if (!payload || !signature || !secret) {
    return null;
  }

  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const proof = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as PlanningCenterLoginProof;

    if (
      proof.v !== 1 ||
      proof.exp < Math.floor(Date.now() / 1000) ||
      !proof.email ||
      (proof.intent !== "create" && proof.intent !== "login") ||
      !proof.lpInfraUserId ||
      !proof.name ||
      !proof.planningCenterPersonId ||
      !proof.username
    ) {
      return null;
    }

    proof.email = normalizeEmail(proof.email);
    return proof;
  } catch {
    return null;
  }
}
