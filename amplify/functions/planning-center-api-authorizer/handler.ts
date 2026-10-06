import { createHmac, timingSafeEqual } from "crypto";

type AppSyncAuthorizerEvent = {
  authorizationToken?: string;
};

type PlanningCenterLoginProof = {
  email: string;
  exp: number;
  lpInfraUserId: string;
  planningCenterPersonId: string;
  username: string;
  v: 1;
};

export const handler = async (event: AppSyncAuthorizerEvent) => {
  const proof = verifyPlanningCenterLoginProof(
    event.authorizationToken ?? "",
    process.env.LP_INFRA_CLIENT_SECRET ?? ""
  );

  if (!proof) {
    return {
      isAuthorized: false,
      ttlOverride: 0
    };
  }

  return {
    isAuthorized: true,
    resolverContext: {
      email: proof.email,
      planningCenterPersonId: proof.planningCenterPersonId
    },
    ttlOverride: 0
  };
};

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

    return proof;
  } catch {
    return null;
  }
}
