import { defineBackend } from "@aws-amplify/backend";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { auth } from "./auth/resource.ts";
import { data } from "./data/resource.ts";
import { joinGroupByCode } from "./functions/join-group-by-code/resource.ts";
import { manageAdminUsers } from "./functions/manage-admin-users/resource.ts";

const backend = defineBackend({
  auth,
  data,
  joinGroupByCode,
  manageAdminUsers
});

backend.manageAdminUsers.addEnvironment("USER_POOL_ID", backend.auth.resources.userPool.userPoolId);
backend.manageAdminUsers.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: [
      "cognito-idp:AdminAddUserToGroup",
      "cognito-idp:AdminRemoveUserFromGroup",
      "cognito-idp:ListUsers",
      "cognito-idp:ListUsersInGroup"
    ],
    resources: [backend.auth.resources.userPool.userPoolArn]
  })
);

const groupTable = backend.data.resources.tables.Group;
const membershipTable = backend.data.resources.tables.GroupMembership;
const userProfileTable = backend.data.resources.tables.UserProfile;

backend.joinGroupByCode.addEnvironment("GROUP_TABLE_NAME", groupTable.tableName);
backend.joinGroupByCode.addEnvironment("GROUP_JOIN_CODE_HASH_INDEX_NAME", "groupsByJoinCodeHash");
backend.joinGroupByCode.addEnvironment("GROUP_MEMBERSHIP_TABLE_NAME", membershipTable.tableName);
backend.joinGroupByCode.addEnvironment("USER_PROFILE_TABLE_NAME", userProfileTable.tableName);
backend.joinGroupByCode.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query"],
    resources: [
      groupTable.tableArn,
      `${groupTable.tableArn}/index/*`,
      membershipTable.tableArn,
      userProfileTable.tableArn
    ]
  })
);
