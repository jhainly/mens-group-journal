import { a, defineData, type ClientSchema } from "@aws-amplify/backend";
import { joinGroupByCode } from "../functions/join-group-by-code/resource.ts";
import { manageAdminUsers } from "../functions/manage-admin-users/resource.ts";
import { syncUserScore } from "../functions/sync-user-score/resource.ts";

const schema = a.schema({
  AdminRoleUser: a.customType({
    displayName: a.string().required(),
    email: a.string().required(),
    enabled: a.boolean().required(),
    isAdmin: a.boolean().required(),
    status: a.string().required(),
    username: a.string().required()
  }),

  AdminRoleMutationResult: a.customType({
    email: a.string().required(),
    isAdmin: a.boolean().required(),
    message: a.string().required(),
    username: a.string().required()
  }),

  JoinGroupResult: a.customType({
    groupId: a.id().required(),
    groupName: a.string().required()
  }),

  listAdminUsers: a
    .query()
    .returns(a.ref("AdminRoleUser").array())
    .authorization((allow) => [allow.groups(["ADMINS"])])
    .handler(a.handler.function(manageAdminUsers)),

  setUserAdminRole: a
    .mutation()
    .arguments({
      email: a.email().required(),
      enabled: a.boolean().required()
    })
    .returns(a.ref("AdminRoleMutationResult"))
    .authorization((allow) => [allow.groups(["ADMINS"])])
    .handler(a.handler.function(manageAdminUsers)),

  joinGroupByCode: a
    .mutation()
    .arguments({
      groupCode: a.string().required()
    })
    .returns(a.ref("JoinGroupResult"))
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(joinGroupByCode)),

  SyncUserScoreResult: a.customType({
    weeklyScore: a.integer().required(),
    cumulativeScore: a.integer().required()
  }),

  syncUserScore: a
    .mutation()
    .arguments({
      groupId: a.id().required(),
      weekNumber: a.integer().required(),
      programId: a.string().required()
    })
    .returns(a.ref("SyncUserScoreResult"))
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(syncUserScore)),

  UserProfile: a
    .model({
      userId: a.id().required(),
      displayName: a.string().required(),
      email: a.email(),
      journalKeyAlgorithm: a.string(),
      journalKeyCiphertext: a.string(),
      journalKeyDerivation: a.string(),
      journalKeyIterations: a.integer(),
      journalKeyIv: a.string(),
      journalKeySalt: a.string(),
      journalKeyVersion: a.integer(),
      createdAt: a.datetime().required(),
      updatedAt: a.datetime().required()
    })
    .identifier(["userId"])
    .authorization((allow) => [
      allow.ownerDefinedIn("userId").identityClaim("sub"),
      allow.groups(["ADMINS"]).to(["read", "update", "delete"])
    ]),

  Group: a
    .model({
      groupId: a.id().required().authorization((allow) => [
        allow.groups(["ADMINS", "LEADERS"]),
        allow.authenticated().to(["read"])
      ]),
      name: a.string().required().authorization((allow) => [
        allow.groups(["ADMINS", "LEADERS"]),
        allow.authenticated().to(["read"])
      ]),
      joinCodeHash: a.string().authorization((allow) => [
        allow.groups(["ADMINS", "LEADERS"]).to(["read", "create", "update"])
      ]),
      joinCode: a.string().authorization((allow) => [
        allow.groups(["ADMINS", "LEADERS"]).to(["read", "create", "update"])
      ]),
      activeProgramId: a.string(),
      createdByUserId: a.string().required().authorization((allow) => [
        allow.groups(["ADMINS", "LEADERS"]),
        allow.authenticated().to(["read"])
      ]),
      leaderUserIds: a.string().array(),
      createdAt: a.datetime().required().authorization((allow) => [
        allow.groups(["ADMINS", "LEADERS"]),
        allow.authenticated().to(["read"])
      ]),
      updatedAt: a.datetime().required().authorization((allow) => [
        allow.groups(["ADMINS", "LEADERS"]),
        allow.authenticated().to(["read"])
      ])
    })
    .identifier(["groupId"])
    .secondaryIndexes((index) => [index("joinCodeHash")])
    .authorization((allow) => [
      allow.groups(["ADMINS", "LEADERS"]),
      allow.authenticated().to(["read"])
    ]),

  GroupMembership: a
    .model({
      membershipId: a.id().required(),
      groupId: a.id().required(),
      userId: a.id().required(),
      role: a.enum(["member", "leader", "admin"]),
      displayName: a.string().required(),
      joinedAt: a.datetime().required()
    })
    .identifier(["membershipId"])
    .secondaryIndexes((index) => [index("groupId"), index("userId")])
    .authorization((allow) => [
      allow.ownerDefinedIn("userId").identityClaim("sub"),
      allow.groups(["ADMINS", "LEADERS"]).to(["read", "create", "update", "delete"])
    ]),

  ProgramSnapshot: a
    .model({
      programId: a.id().required(),
      groupId: a.id().required(),
      title: a.string().required(),
      version: a.string().required(),
      contentHash: a.string().required(),
      content: a.json().required(),
      publishedByUserId: a.string().required(),
      publishedAt: a.datetime().required()
    })
    .identifier(["programId"])
    .secondaryIndexes((index) => [index("groupId")])
    .authorization((allow) => [
      allow.authenticated().to(["read"]),
      allow.groups(["ADMINS", "LEADERS"]).to(["create", "read", "update", "delete"])
    ]),

  GroupProgramWeek: a
    .model({
      weekSnapshotId: a.id().required(),
      groupId: a.id().required(),
      programId: a.string().required(),
      programTitle: a.string().required(),
      programVersion: a.string().required(),
      programDescription: a.string(),
      weekNumber: a.integer().required(),
      title: a.string().required(),
      contentHash: a.string().required(),
      content: a.json().required(),
      isActive: a.boolean().required(),
      publishedByUserId: a.string().required(),
      publishedAt: a.datetime().required(),
      updatedAt: a.datetime().required()
    })
    .identifier(["weekSnapshotId"])
    .secondaryIndexes((index) => [index("groupId"), index("programId"), index("weekNumber")])
    .authorization((allow) => [
      allow.authenticated().to(["read"]),
      allow.groups(["ADMINS", "LEADERS"]).to(["create", "read", "update", "delete"])
    ]),

  ProgramAuditEvent: a
    .model({
      eventId: a.id().required(),
      action: a.string().required(),
      groupId: a.id().required(),
      groupName: a.string().required(),
      programId: a.string().required(),
      weekNumber: a.integer().required(),
      weekTitle: a.string().required(),
      actorUserId: a.string().required(),
      actorDisplayName: a.string().required(),
      createdAt: a.datetime().required(),
      details: a.string()
    })
    .identifier(["eventId"])
    .secondaryIndexes((index) => [index("groupId"), index("weekNumber")])
    .authorization((allow) => [allow.groups(["ADMINS", "LEADERS"]).to(["create", "read"])]),

  SectionProgress: a
    .model({
      progressId: a.id().required(),
      userId: a.id().required(),
      groupId: a.id().required(),
      programId: a.id().required(),
      weekNumber: a.integer().required(),
      dayNumber: a.integer().required(),
      sectionId: a.string().required(),
      completed: a.boolean().required(),
      pointsEarned: a.integer().required(),
      updatedAt: a.datetime().required()
    })
    .identifier(["progressId"])
    .secondaryIndexes((index) => [index("userId"), index("groupId"), index("programId")])
    .authorization((allow) => [
      allow.ownerDefinedIn("userId").identityClaim("sub"),
      allow.groups(["ADMINS"]).to(["read", "delete"])
    ]),

  EncryptedAnswer: a
    .model({
      answerId: a.id().required(),
      userId: a.id().required(),
      groupId: a.id().required(),
      programId: a.id().required(),
      weekNumber: a.integer().required(),
      dayNumber: a.integer().required(),
      sectionId: a.string().required(),
      promptId: a.string().required(),
      ciphertext: a.string().required(),
      iv: a.string().required(),
      salt: a.string().required(),
      keyDerivation: a.string().required(),
      iterations: a.integer().required(),
      algorithm: a.string().required(),
      version: a.integer().required(),
      updatedAt: a.datetime().required()
    })
    .identifier(["answerId"])
    .secondaryIndexes((index) => [index("userId"), index("groupId"), index("programId")])
    .authorization((allow) => [allow.ownerDefinedIn("userId").identityClaim("sub")]),

  UserScore: a
    .model({
      scoreId: a.id().required(),
      userId: a.id().required(),
      groupId: a.id().required(),
      programId: a.id().required(),
      displayName: a.string().required(),
      weekNumber: a.integer().required(),
      weeklyScore: a.integer().required(),
      cumulativeScore: a.integer().required(),
      updatedAt: a.datetime().required()
    })
    .identifier(["scoreId"])
    .secondaryIndexes((index) => [index("groupId"), index("userId")])
    .authorization((allow) => [
      allow.authenticated().to(["read"]),
      allow.groups(["ADMINS", "LEADERS"]).to(["read"])
    ]),

  LeaderMetric: a
    .model({
      metricId: a.id().required(),
      groupId: a.id().required(),
      programId: a.id().required(),
      memberCount: a.integer().required(),
      activeMemberCount: a.integer().required(),
      cumulativeCompletionCount: a.integer().required(),
      updatedAt: a.datetime().required()
    })
    .identifier(["metricId"])
    .secondaryIndexes((index) => [index("groupId")])
    .authorization((allow) => [allow.groups(["ADMINS", "LEADERS"]).to(["read", "create", "update", "delete"])])
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool"
  },
  logging: {
    excludeVerboseContent: true,
    fieldLogLevel: "none"
  }
});
