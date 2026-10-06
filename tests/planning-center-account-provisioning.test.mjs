import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  provisionPlanningCenterAccount
} from "../amplify/functions/provision-planning-center-account/handler.ts";

const secret = "planning-center-provisioning-test-secret";
process.env.LP_INFRA_CLIENT_SECRET = secret;
process.env.USER_POOL_ID = "us-east-1_testpool";

test("creates and confirms a Planning Center account without sending a Cognito invitation", async () => {
  const client = new FakeCognitoClient();
  const result = await provisionPlanningCenterAccount({ arguments: { proof: makeProof() } }, client);

  assert.deepEqual(result, {
    created: true,
    loginId: "person@example.com"
  });
  assert.deepEqual(client.commandNames, ["ListUsersCommand", "AdminCreateUserCommand", "AdminSetUserPasswordCommand"]);

  const createInput = client.commands[1].input;
  assert.equal(createInput.MessageAction, "SUPPRESS");
  assert.equal(createInput.Username, "person@example.com");
  assert.equal(attributeValue(createInput.UserAttributes, "email_verified"), "true");
  assert.equal(attributeValue(createInput.UserAttributes, "custom:pcEmail"), "person@example.com");
  assert.equal(attributeValue(createInput.UserAttributes, "custom:pcPersonId"), "pc-person-123");
  assert.equal(attributeValue(createInput.UserAttributes, "preferred_username"), "Test Person");

  const passwordInput = client.commands[2].input;
  assert.equal(passwordInput.Permanent, true);
  assert.equal(passwordInput.Username, "person@example.com");
});

test("returns an existing linked account without changing its password", async () => {
  const client = new FakeCognitoClient([
    makeUser({
      email: "old-email@example.com",
      planningCenterPersonId: "pc-person-123",
      lpInfraUserId: "lp-user-123"
    })
  ]);

  const result = await provisionPlanningCenterAccount({ arguments: { proof: makeProof() } }, client);

  assert.deepEqual(result, {
    created: false,
    loginId: "old-email@example.com"
  });
  assert.deepEqual(client.commandNames, ["ListUsersCommand"]);
});

test("finishes a matching account left in FORCE_CHANGE_PASSWORD by an interrupted request", async () => {
  const client = new FakeCognitoClient([
    makeUser({
      status: "FORCE_CHANGE_PASSWORD",
      planningCenterPersonId: "pc-person-123",
      lpInfraUserId: "lp-user-123"
    })
  ]);

  const result = await provisionPlanningCenterAccount({ arguments: { proof: makeProof() } }, client);

  assert.equal(result.created, false);
  assert.deepEqual(client.commandNames, ["ListUsersCommand", "AdminSetUserPasswordCommand"]);
  assert.equal(client.commands[1].input.Permanent, true);
});

test("refuses to reuse an email linked to a different Planning Center person", async () => {
  const client = new FakeCognitoClient([
    makeUser({
      planningCenterPersonId: "pc-person-999",
      lpInfraUserId: "lp-user-999"
    })
  ]);

  await assert.rejects(
    provisionPlanningCenterAccount({ arguments: { proof: makeProof() } }, client),
    /already linked to a different Planning Center profile/
  );
  assert.deepEqual(client.commandNames, ["ListUsersCommand"]);
});

test("does not provision from a proof issued for ordinary sign-in", async () => {
  const client = new FakeCognitoClient();

  await assert.rejects(
    provisionPlanningCenterAccount(
      { arguments: { proof: makeProof({ intent: "login" }) } },
      client
    ),
    /Start account creation from the Create account page/
  );
  assert.deepEqual(client.commandNames, []);
});

class FakeCognitoClient {
  constructor(users = []) {
    this.users = users;
    this.commands = [];
  }

  get commandNames() {
    return this.commands.map((command) => command.constructor.name);
  }

  async send(command) {
    this.commands.push(command);

    if (command.constructor.name === "ListUsersCommand") {
      return { Users: this.users };
    }

    if (command.constructor.name === "AdminCreateUserCommand") {
      const user = {
        Attributes: command.input.UserAttributes,
        Username: command.input.Username,
        UserStatus: "FORCE_CHANGE_PASSWORD"
      };
      this.users.push(user);
      return { User: user };
    }

    if (command.constructor.name === "AdminSetUserPasswordCommand") {
      const user = this.users.find((candidate) => candidate.Username === command.input.Username);
      if (user) user.UserStatus = "CONFIRMED";
      return {};
    }

    throw new Error(`Unexpected command: ${command.constructor.name}`);
  }
}

function makeProof(overrides = {}) {
  const proof = {
    email: "person@example.com",
    exp: Math.floor(Date.now() / 1000) + 60,
    intent: "create",
    lpInfraUserId: "lp-user-123",
    name: "Test Person",
    nonce: "nonce-123",
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

function makeUser({
  email = "person@example.com",
  lpInfraUserId,
  planningCenterPersonId,
  status = "CONFIRMED"
} = {}) {
  return {
    Attributes: [
      { Name: "email", Value: email },
      ...(planningCenterPersonId ? [{ Name: "custom:pcPersonId", Value: planningCenterPersonId }] : []),
      ...(lpInfraUserId ? [{ Name: "custom:lpInfraUserId", Value: lpInfraUserId }] : [])
    ],
    Username: email,
    UserStatus: status
  };
}

function attributeValue(attributes, name) {
  return attributes.find((attribute) => attribute.Name === name)?.Value;
}
