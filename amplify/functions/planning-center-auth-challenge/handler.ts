import { createHmac, timingSafeEqual } from "crypto";

type CognitoCustomAuthEvent = {
  request: {
    challengeAnswer?: string;
    session?: Array<{
      challengeName?: string;
      challengeResult?: boolean;
    }>;
    userAttributes?: Record<string, string>;
  };
  response: {
    answerCorrect?: boolean;
    challengeName?: "CUSTOM_CHALLENGE";
    failAuthentication?: boolean;
    issueTokens?: boolean;
    privateChallengeParameters?: Record<string, string>;
    publicChallengeParameters?: Record<string, string>;
  };
  triggerSource?: string;
  userName: string;
};

type PlanningCenterLoginProof = {
  email: string;
  exp: number;
  lpInfraUserId: string;
  planningCenterPersonId: string;
  role: "member" | "admin";
  username: string;
  v: 1;
};

export const handler = async (event: CognitoCustomAuthEvent): Promise<CognitoCustomAuthEvent> => {
  switch (event.triggerSource) {
    case "DefineAuthChallenge_Authentication":
      return defineAuthChallenge(event);
    case "CreateAuthChallenge_Authentication":
      return createAuthChallenge(event);
    case "VerifyAuthChallengeResponse_Authentication":
      return verifyAuthChallengeResponse(event);
    default:
      return event;
  }
};

function defineAuthChallenge(event: CognitoCustomAuthEvent): CognitoCustomAuthEvent {
  const session = event.request.session ?? [];
  const lastChallenge = session[session.length - 1];

  if (lastChallenge?.challengeName === "CUSTOM_CHALLENGE" && lastChallenge.challengeResult === true) {
    event.response.issueTokens = true;
    event.response.failAuthentication = false;
    return event;
  }

  if (session.length >= 2) {
    event.response.issueTokens = false;
    event.response.failAuthentication = true;
    return event;
  }

  event.response.issueTokens = false;
  event.response.failAuthentication = false;
  event.response.challengeName = "CUSTOM_CHALLENGE";

  return event;
}

function createAuthChallenge(event: CognitoCustomAuthEvent): CognitoCustomAuthEvent {
  event.response.publicChallengeParameters = {
    challenge: "planning-center"
  };
  event.response.privateChallengeParameters = {};

  return event;
}

function verifyAuthChallengeResponse(event: CognitoCustomAuthEvent): CognitoCustomAuthEvent {
  const proof = verifyPlanningCenterLoginProof(event.request.challengeAnswer ?? "");
  const userAttributes = event.request.userAttributes ?? {};
  const proofMatchesUser =
    proof != null &&
    (proof.username === event.userName ||
      proof.email === userAttributes.email ||
      proof.planningCenterPersonId === userAttributes["custom:pcPersonId"]);

  event.response.answerCorrect = Boolean(proofMatchesUser);

  return event;
}

function verifyPlanningCenterLoginProof(token: string): PlanningCenterLoginProof | null {
  const [payload, signature] = token.split(".");
  const secret = process.env.LP_INFRA_CLIENT_SECRET;

  if (!payload || !signature || !secret) {
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
