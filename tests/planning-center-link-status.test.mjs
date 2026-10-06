import assert from "node:assert/strict";
import test from "node:test";
import { updatePlanningCenterAttributes } from "../amplify/functions/link-planning-center-account/handler.ts";
import { toAdminRoleUser } from "../amplify/functions/manage-admin-users/handler.ts";

test("backfills the verified Planning Center email on an older linked account", async () => {
  const commands = [];
  const client = {
    async send(command) {
      commands.push(command);
      return {};
    }
  };
  const user = makeUser({ planningCenterEmail: undefined });

  await updatePlanningCenterAttributes("us-east-1_testpool", user, makeProof(), client);

  assert.equal(commands.length, 1);
  assert.equal(attributeValue(commands[0].input.UserAttributes, "custom:pcEmail"), "planning@example.com");
});

test("does not rewrite Planning Center attributes when all values are current", async () => {
  const commands = [];
  const client = {
    async send(command) {
      commands.push(command);
      return {};
    }
  };

  await updatePlanningCenterAttributes(
    "us-east-1_testpool",
    makeUser({ planningCenterEmail: "planning@example.com" }),
    makeProof(),
    client
  );

  assert.equal(commands.length, 0);
});

test("admin user output reports linkage and the Planning Center email", () => {
  const result = toAdminRoleUser(
    makeUser({ planningCenterEmail: "planning@example.com" }),
    new Set(["cognito-user"])
  );

  assert.equal(result.planningCenterLinked, true);
  assert.equal(result.planningCenterEmail, "planning@example.com");
  assert.equal(result.isAdmin, true);
});

test("an older linked account remains linked before its email is backfilled", () => {
  const result = toAdminRoleUser(makeUser({ planningCenterEmail: undefined }), new Set());

  assert.equal(result.planningCenterLinked, true);
  assert.equal(result.planningCenterEmail, null);
});

test("an account without stable Planning Center identifiers is not linked", () => {
  const result = toAdminRoleUser(
    makeUser({ includePlanningCenterIds: false, planningCenterEmail: undefined }),
    new Set()
  );

  assert.equal(result.planningCenterLinked, false);
  assert.equal(result.planningCenterEmail, null);
});

function makeUser({ includePlanningCenterIds = true, planningCenterEmail } = {}) {
  return {
    Attributes: [
      { Name: "sub", Value: "sub-123" },
      { Name: "email", Value: "legacy@example.com" },
      { Name: "preferred_username", Value: "Test Person" },
      ...(includePlanningCenterIds
        ? [
            { Name: "custom:pcPersonId", Value: "pc-person-123" },
            { Name: "custom:lpInfraUserId", Value: "lp-user-123" }
          ]
        : []),
      ...(planningCenterEmail ? [{ Name: "custom:pcEmail", Value: planningCenterEmail }] : [])
    ],
    Enabled: true,
    Username: "cognito-user",
    UserStatus: "CONFIRMED"
  };
}

function makeProof() {
  return {
    email: "planning@example.com",
    exp: Math.floor(Date.now() / 1000) + 60,
    lpInfraUserId: "lp-user-123",
    planningCenterPersonId: "pc-person-123",
    username: "planning@example.com",
    v: 1
  };
}

function attributeValue(attributes, name) {
  return attributes.find((attribute) => attribute.Name === name)?.Value;
}
