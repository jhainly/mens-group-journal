import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { handler } from "../amplify/functions/planning-center-auth-challenge/handler.ts";

const secret = "planning-center-test-secret";
process.env.LP_INFRA_CLIENT_SECRET = secret;

test("starts the Planning Center custom challenge", async () => {
  const result = await handler(makeEvent("DefineAuthChallenge_Authentication"));

  assert.equal(result.response.challengeName, "CUSTOM_CHALLENGE");
  assert.equal(result.response.issueTokens, false);
  assert.equal(result.response.failAuthentication, false);
});

test("accepts a proof linked by Planning Center person ID when emails differ", async () => {
  const event = makeEvent("VerifyAuthChallengeResponse_Authentication");
  event.userName = "cognito-user-id";
  event.request.userAttributes = {
    email: "jhainly@comcast.net",
    "custom:pcPersonId": "pc-person-123"
  };
  event.request.challengeAnswer = makeProof({
    email: "jhainly@gmail.com",
    planningCenterPersonId: "pc-person-123",
    username: "jhainly@gmail.com"
  });

  const result = await handler(event);

  assert.equal(result.response.answerCorrect, true);
});

test("rejects a proof for a different Planning Center person", async () => {
  const event = makeEvent("VerifyAuthChallengeResponse_Authentication");
  event.userName = "cognito-user-id";
  event.request.userAttributes = {
    email: "jhainly@comcast.net",
    "custom:pcPersonId": "pc-person-123"
  };
  event.request.challengeAnswer = makeProof({
    email: "someone@example.com",
    planningCenterPersonId: "pc-person-999",
    username: "someone@example.com"
  });

  const result = await handler(event);

  assert.equal(result.response.answerCorrect, false);
});

test("issues tokens after a successful custom challenge", async () => {
  const event = makeEvent("DefineAuthChallenge_Authentication");
  event.request.session = [
    {
      challengeName: "CUSTOM_CHALLENGE",
      challengeResult: true
    }
  ];

  const result = await handler(event);

  assert.equal(result.response.issueTokens, true);
  assert.equal(result.response.failAuthentication, false);
});

function makeEvent(triggerSource) {
  return {
    triggerSource,
    userName: "test-user",
    request: {
      session: [],
      userAttributes: {}
    },
    response: {}
  };
}

function makeProof(overrides = {}) {
  const proof = {
    email: "person@example.com",
    exp: Math.floor(Date.now() / 1000) + 60,
    lpInfraUserId: "lp-user-123",
    planningCenterPersonId: "pc-person-123",
    role: "member",
    username: "person@example.com",
    v: 1,
    ...overrides
  };
  const payload = Buffer.from(JSON.stringify(proof), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");

  return `${payload}.${signature}`;
}
