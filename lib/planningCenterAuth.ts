import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const DEFAULT_LP_INFRA_URL = "https://auth.lifepointapplications.com";
const PROOF_TTL_SECONDS = 10 * 60;

export const planningCenterStateCookie = "pc_login_state";
export const planningCenterNextCookie = "pc_login_next";
export const planningCenterProofCookie = "pc_login_proof";

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
