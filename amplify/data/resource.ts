import { a, defineData, type ClientSchema } from "@aws-amplify/backend";

const schema = a.schema({
  UserProfile: a
    .model({
      userId: a.id().required(),
      displayName: a.string().required(),
      email: a.email(),
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
      allow.ownerDefinedIn("userId").identityClaim("sub").to(["create", "update", "delete", "read"]),
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
