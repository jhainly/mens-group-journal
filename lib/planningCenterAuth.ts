import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminRemoveUserFromGroupCommand,
  AdminSetUserPasswordCommand,
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  type AttributeType,
  type UserType
} from "@aws-sdk/client-cognito-identity-provider";

const DEFAULT_LP_INFRA_URL = "https://auth.lifepointapplications.com";
const PROOF_TTL_SECONDS = 2 * 60;

export const planningCenterStateCookie = "pc_login_state";
export const planningCenterNextCookie = "pc_login_next";
export const planningCenterProofCookie = "pc_login_proof";

type AmplifyOutputs = {
  auth?: {
    aws_region?: string;
    user_pool_id?: string;
  };
};

type LpInfraTokenResponse = {
  user?: {
    id?: string;
    planningCenterPersonId?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    avatar?: string;
    role?: string;
  };
};

export type PlanningCenterUser = {
  avatar?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  lpInfraUserId: string;
  name: string;
  planningCenterPersonId: string;
  role: "member" | "admin";
};

export type CognitoPlanningCenterUser = {
  loginId: string;
  username: string;
};

export type PlanningCenterLoginProof = {
  avatar?: string;
  email: string;
  exp: number;
  lpInfraUserId: string;
  name: string;
  nonce: string;
  planningCenterPersonId: string;
  role: "member" | "admin";
  username: string;
  v: 1;
};

export function getPlanningCenterConfig(requestOrigin?: string) {
  const clientId = process.env.LP_INFRA_CLIENT_ID?.trim();
  const clientSecret = process.env.LP_INFRA_CLIENT_SECRET?.trim();
  const publicUrl = process.env.APP_PUBLIC_URL?.trim() || requestOrigin;

  if (!clientId) {
    throw new Error("LP_INFRA_CLIENT_ID is not configured.");
  }

  if (!clientSecret) {
    throw new Error("LP_INFRA_CLIENT_SECRET is not configured.");
  }

  if (!publicUrl) {
    throw new Error("APP_PUBLIC_URL is not configured.");
  }

  return {
    clientId,
    clientSecret,
    infraUrl: process.env.LP_INFRA_URL?.trim() || DEFAULT_LP_INFRA_URL,
    publicUrl: publicUrl.replace(/\/+$/, "")
  };
}

export function getPlanningCenterCallbackUrl(publicUrl: string): string {
  return `${publicUrl}/api/v1/users/planning-center/callback`;
}

export async function exchangePlanningCenterCode(input: {
  code: string;
  requestOrigin?: string;
}): Promise<PlanningCenterUser> {
  const config = getPlanningCenterConfig(input.requestOrigin);
  const response = await fetch(`${config.infraUrl}/v1/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      code: input.code,
      client_id: config.clientId,
      client_secret: config.clientSecret
    }),
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    throw new Error("Planning Center sign-in failed.");
  }

  const payload = (await response.json()) as LpInfraTokenResponse;
  const user = payload.user;
  const email = user?.email?.trim().toLowerCase();
  const lpInfraUserId = user?.id?.trim();
  const planningCenterPersonId = user?.planningCenterPersonId?.trim();

  if (!user || !email || !lpInfraUserId || !planningCenterPersonId) {
    throw new Error("Planning Center returned an incomplete user profile.");
  }

  const name = user.name?.trim() || `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || email;

  return {
    avatar: user.avatar,
    email,
    firstName: user.firstName,
    lastName: user.lastName,
    lpInfraUserId,
    name,
    planningCenterPersonId,
    role: user.role === "admin" ? "admin" : "member"
  };
}

export async function upsertPlanningCenterCognitoUser(user: PlanningCenterUser): Promise<CognitoPlanningCenterUser> {
  const { client, userPoolId } = await getCognitoClient();
  const existingByPlanningCenterId = await findUserByPlanningCenterPersonId(client, userPoolId, user.planningCenterPersonId);
  const existingByEmail = existingByPlanningCenterId ? null : await findUserByEmail(client, userPoolId, user.email);
  const existing = existingByPlanningCenterId ?? existingByEmail;

  if (existing?.Username) {
    await updateCognitoUserAttributes(client, userPoolId, existing.Username, user);
    await syncAdminGroup(client, userPoolId, existing.Username, user.role);
    return {
      loginId: user.email,
      username: existing.Username
    };
  }

  const username = user.email;
  await client.send(
    new AdminCreateUserCommand({
      DesiredDeliveryMediums: [],
      MessageAction: "SUPPRESS",
      UserAttributes: getCognitoUserAttributes(user),
      UserPoolId: userPoolId,
      Username: username
    })
  );
  await client.send(
    new AdminSetUserPasswordCommand({
      Password: randomPermanentPassword(),
      Permanent: true,
      UserPoolId: userPoolId,
      Username: username
    })
  );
  await syncAdminGroup(client, userPoolId, username, user.role);

  return {
    loginId: user.email,
    username
  };
}

export function createPlanningCenterLoginProof(input: {
  cognitoUsername: string;
  user: PlanningCenterUser;
}): string {
  const proof: PlanningCenterLoginProof = {
    avatar: input.user.avatar,
    email: input.user.email,
    exp: Math.floor(Date.now() / 1000) + PROOF_TTL_SECONDS,
    lpInfraUserId: input.user.lpInfraUserId,
    name: input.user.name,
    nonce: randomBytes(16).toString("base64url"),
    planningCenterPersonId: input.user.planningCenterPersonId,
    role: input.user.role,
    username: input.cognitoUsername,
    v: 1
  };
  const payload = Buffer.from(JSON.stringify(proof), "utf8").toString("base64url");
  const signature = signPayload(payload, getPlanningCenterClientSecret());

  return `${payload}.${signature}`;
}

export function verifyPlanningCenterLoginProof(token: string, secret: string): PlanningCenterLoginProof | null {
  const [payload, signature] = token.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expected = signPayload(payload, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const proof = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as PlanningCenterLoginProof;

    if (proof.v !== 1 || proof.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return proof;
  } catch {
    return null;
  }
}

function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function getPlanningCenterClientSecret(): string {
  const clientSecret = process.env.LP_INFRA_CLIENT_SECRET?.trim();

  if (!clientSecret) {
    throw new Error("LP_INFRA_CLIENT_SECRET is not configured.");
  }

  return clientSecret;
}

async function getCognitoClient() {
  const outputs = (await import("@/amplify_outputs.json")) as { default: AmplifyOutputs };
  const region = outputs.default.auth?.aws_region;
  const userPoolId = outputs.default.auth?.user_pool_id;

  if (!region || !userPoolId) {
    throw new Error("Cognito outputs are not available.");
  }

  return {
    client: new CognitoIdentityProviderClient({ region }),
    userPoolId
  };
}

async function findUserByPlanningCenterPersonId(
  client: CognitoIdentityProviderClient,
  userPoolId: string,
  planningCenterPersonId: string
): Promise<UserType | null> {
  let paginationToken: string | undefined;

  do {
    const result = await client.send(
      new ListUsersCommand({
        PaginationToken: paginationToken,
        UserPoolId: userPoolId
      })
    );
    const match = result.Users?.find(
      (user) => getAttribute(user.Attributes, "custom:pcPersonId") === planningCenterPersonId
    );

    if (match) {
      return match;
    }

    paginationToken = result.PaginationToken;
  } while (paginationToken);

  return null;
}

async function findUserByEmail(
  client: CognitoIdentityProviderClient,
  userPoolId: string,
  email: string
): Promise<UserType | null> {
  const result = await client.send(
    new ListUsersCommand({
      Filter: `email = "${escapeCognitoFilterValue(email)}"`,
      UserPoolId: userPoolId
    })
  );

  return result.Users?.find((user) => user.Enabled) ?? result.Users?.[0] ?? null;
}

async function updateCognitoUserAttributes(
  client: CognitoIdentityProviderClient,
  userPoolId: string,
  username: string,
  user: PlanningCenterUser
): Promise<void> {
  await client.send(
    new AdminUpdateUserAttributesCommand({
      UserAttributes: getCognitoUserAttributes(user),
      UserPoolId: userPoolId,
      Username: username
    })
  );
}

function getCognitoUserAttributes(user: PlanningCenterUser): AttributeType[] {
  const attributes: AttributeType[] = [
    { Name: "email", Value: user.email },
    { Name: "email_verified", Value: "true" },
    { Name: "preferred_username", Value: user.name },
    { Name: "custom:pcPersonId", Value: user.planningCenterPersonId },
    { Name: "custom:lpInfraUserId", Value: user.lpInfraUserId }
  ];

  if (user.avatar) {
    attributes.push({ Name: "picture", Value: user.avatar });
  }

  return attributes;
}

async function syncAdminGroup(
  client: CognitoIdentityProviderClient,
  userPoolId: string,
  username: string,
  role: PlanningCenterUser["role"]
): Promise<void> {
  if (role === "admin") {
    await client.send(
      new AdminAddUserToGroupCommand({
        GroupName: "ADMINS",
        UserPoolId: userPoolId,
        Username: username
      })
    );
    return;
  }

  try {
    await client.send(
      new AdminRemoveUserFromGroupCommand({
        GroupName: "ADMINS",
        UserPoolId: userPoolId,
        Username: username
      })
    );
  } catch {
    // If the user is not in ADMINS, Cognito can throw. The desired state is already satisfied.
  }
}

function getAttribute(attributes: AttributeType[] | undefined, name: string): string | undefined {
  return attributes?.find((attribute) => attribute.Name === name)?.Value;
}

function escapeCognitoFilterValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function randomPermanentPassword(): string {
  return `${randomBytes(18).toString("base64url")}Aa1!`;
}
