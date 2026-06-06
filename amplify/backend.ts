import { defineBackend } from "@aws-amplify/backend";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { auth } from "./auth/resource.ts";
import { data } from "./data/resource.ts";
import { joinGroupByCode } from "./functions/join-group-by-code/resource.ts";
import { manageAdminUsers } from "./functions/manage-admin-users/resource.ts";
import { syncUserScore } from "./functions/sync-user-score/resource.ts";

const backend = defineBackend({
  auth,
  data,
  joinGroupByCode,
  manageAdminUsers,
  syncUserScore
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
      userProfileTable.tableArn
    ]
  })
);
