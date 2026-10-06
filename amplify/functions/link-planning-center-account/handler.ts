import { createHmac, timingSafeEqual } from "crypto";
import {
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
  type UserType
} from "@aws-sdk/client-cognito-identity-provider";

type PlanningCenterAccountEvent = {
  arguments?: {
    proof?: string;
  };
  identity?: {
    claims?: Record<string, unknown>;
    sub?: string;
  } | null;
};

type PlanningCenterLoginProof = {
  email: string;
  exp: number;
  lpInfraUserId: string;
  planningCenterPersonId: string;
  username: string;
  v: 1;
};

const client = new CognitoIdentityProviderClient({});

export const handler = async (event: PlanningCenterAccountEvent) => {
  const userPoolId = process.env.USER_POOL_ID;
  const proof = verifyPlanningCenterLoginProof(
    event.arguments?.proof ?? "",
    process.env.LP_INFRA_CLIENT_SECRET ?? ""
  );

  if (!userPoolId) {
    throw new Error("Planning Center account linking is not configured.");
  }

  if (!proof) {
    throw new Error("Planning Center sign-in expired. Please try again.");
  }

  const callerSub = getCallerSub(event.identity);
  const users = await listAllUsers(userPoolId);
  const target = users.find((user) => getAttribute(user, "sub") === callerSub);

  if (!target) {
    throw new Error("Your signed-in app account could not be found.");
  }

  const otherLinkedUser = users.find(
    (user) =>
      getAttribute(user, "sub") !== callerSub &&
      getAttribute(user, "custom:pcPersonId") === proof.planningCenterPersonId
  );

  if (otherLinkedUser) {
    throw new Error("This Planning Center profile is already linked to another app account.");
  }

  const existingPersonId = getAttribute(target, "custom:pcPersonId");

  if (existingPersonId && existingPersonId !== proof.planningCenterPersonId) {
    throw new Error("Your app account is already linked to a different Planning Center profile.");
  }

  await updatePlanningCenterAttributes(userPoolId, target, proof);

  return {
    loginId: getLoginId(target),
    planningCenterEmail: proof.email
  };
};

async function listAllUsers(userPoolId: string): Promise<UserType[]> {
  const users: UserType[] = [];
  let paginationToken: string | undefined;

  do {
    const result = await client.send(
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

export async function updatePlanningCenterAttributes(
  userPoolId: string,
  user: UserType,
  proof: PlanningCenterLoginProof,
  cognitoClient = client
): Promise<void> {
  if (!user.Username) {
    throw new Error("The app account does not have a Cognito username.");
  }

  if (
    getAttribute(user, "custom:pcPersonId") === proof.planningCenterPersonId &&
    getAttribute(user, "custom:lpInfraUserId") === proof.lpInfraUserId &&
    getAttribute(user, "custom:pcEmail") === proof.email
  ) {
    return;
  }

  await cognitoClient.send(
    new AdminUpdateUserAttributesCommand({
      UserAttributes: [
        { Name: "custom:pcPersonId", Value: proof.planningCenterPersonId },
        { Name: "custom:lpInfraUserId", Value: proof.lpInfraUserId },
        { Name: "custom:pcEmail", Value: proof.email }
      ],
      Username: user.Username,
      UserPoolId: userPoolId
    })
  );
}

function getCallerSub(identity: PlanningCenterAccountEvent["identity"]): string {
  const directSub = identity?.sub;
  const claimSub = identity?.claims?.sub;
  const sub = typeof directSub === "string" ? directSub : typeof claimSub === "string" ? claimSub : "";

  if (!sub) {
    throw new Error("Sign in to your existing app account before linking Planning Center.");
  }

  return sub;
}

function getLoginId(user: UserType): string {
  const email = normalizeEmail(getAttribute(user, "email"));

  if (email) {
    return email;
  }

  if (user.Username) {
    return user.Username;
  }

  throw new Error("The linked app account does not have a login ID.");
}

function getAttribute(user: UserType, name: string): string | undefined {
  return user.Attributes?.find((attribute) => attribute.Name === name)?.Value;
}

function normalizeEmail(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? "";
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
      !proof.lpInfraUserId ||
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
