import { createHmac, timingSafeEqual } from "crypto";
import {
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
    throw new Error("Planning Center account resolution is not configured.");
  }

  if (!proof) {
    throw new Error("Planning Center sign-in expired. Please try again.");
  }

  const users = await listAllUsers(userPoolId);
  const personMatches = users.filter(
    (user) => getAttribute(user, "custom:pcPersonId") === proof.planningCenterPersonId
  );

  if (personMatches.length > 1) {
    throw new Error("This Planning Center profile is linked to more than one app account. Contact an administrator.");
  }

  let target: UserType | undefined = personMatches[0];
  let matchType = "planningCenterPersonId";

  if (!target) {
    target = users.find((user) => normalizeEmail(getAttribute(user, "email")) === proof.email);
    matchType = "email";
  }

  if (!target) {
    return null;
  }

  const existingPersonId = getAttribute(target, "custom:pcPersonId");

  if (existingPersonId && existingPersonId !== proof.planningCenterPersonId) {
    throw new Error("This app account is already linked to a different Planning Center profile.");
  }

  return {
    loginId: getLoginId(target),
    matchType
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
