import { defineBackend } from "@aws-amplify/backend";
import { CfnUserPoolUserToGroupAttachment } from "aws-cdk-lib/aws-cognito";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { auth } from "./auth/resource.ts";
import { data } from "./data/resource.ts";
import { joinGroupByCode } from "./functions/join-group-by-code/resource.ts";
import { manageAdminUsers } from "./functions/manage-admin-users/resource.ts";
import { syncDisplayName } from "./functions/sync-display-name/resource.ts";
import { syncUserScore } from "./functions/sync-user-score/resource.ts";

const backend = defineBackend({
  auth,
  data,
  joinGroupByCode,
  manageAdminUsers,
  syncDisplayName,
  syncUserScore
});

// One-time bootstrap: LIFEPOINT_BOOTSTRAP_ADMIN_EMAIL=<email> adds that (already signed-up) user to ADMINS during
// deploy. Useful for a fresh sandbox where no admin exists yet. Unset it again once the user is in the group.
const bootstrapAdminEmail = process.env.LIFEPOINT_BOOTSTRAP_ADMIN_EMAIL?.trim();

if (bootstrapAdminEmail) {
  new CfnUserPoolUserToGroupAttachment(backend.auth.resources.userPool, "BootstrapAdminUser", {
    groupName: "ADMINS",
    username: bootstrapAdminEmail,
    userPoolId: backend.auth.resources.userPool.userPoolId
  });
}

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

const sectionProgressTable = backend.data.resources.tables.SectionProgress;
const groupProgramWeekTable = backend.data.resources.tables.GroupProgramWeek;
const programSnapshotTable = backend.data.resources.tables.ProgramSnapshot;
const userScoreTable = backend.data.resources.tables.UserScore;

backend.syncUserScore.addEnvironment("SECTION_PROGRESS_TABLE_NAME", sectionProgressTable.tableName);
backend.syncUserScore.addEnvironment("SECTION_PROGRESS_USER_ID_INDEX_NAME", "sectionProgressesByUserId");
backend.syncUserScore.addEnvironment("GROUP_PROGRAM_WEEK_TABLE_NAME", groupProgramWeekTable.tableName);
backend.syncUserScore.addEnvironment("GROUP_PROGRAM_WEEK_GROUP_ID_INDEX_NAME", "groupProgramWeeksByGroupId");
backend.syncUserScore.addEnvironment("PROGRAM_SNAPSHOT_TABLE_NAME", programSnapshotTable.tableName);
backend.syncUserScore.addEnvironment("USER_SCORE_TABLE_NAME", userScoreTable.tableName);
backend.syncUserScore.addEnvironment("USER_PROFILE_TABLE_NAME", userProfileTable.tableName);
backend.syncUserScore.addEnvironment("GROUP_TABLE_NAME", groupTable.tableName);
backend.syncUserScore.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:GetItem", "dynamodb:Query", "dynamodb:UpdateItem"],
    resources: [
      sectionProgressTable.tableArn,
      `${sectionProgressTable.tableArn}/index/*`,
      groupProgramWeekTable.tableArn,
      `${groupProgramWeekTable.tableArn}/index/*`,
      programSnapshotTable.tableArn,
      userScoreTable.tableArn,
      userProfileTable.tableArn,
      groupTable.tableArn
    ]
  })
);

backend.syncDisplayName.addEnvironment("USER_SCORE_TABLE_NAME", userScoreTable.tableName);
backend.syncDisplayName.addEnvironment("USER_SCORE_USER_ID_INDEX_NAME", "userScoresByUserId");
backend.syncDisplayName.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ["dynamodb:Query", "dynamodb:UpdateItem"],
    resources: [userScoreTable.tableArn, `${userScoreTable.tableArn}/index/*`]
  })
);
