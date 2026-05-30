import { defineFunction } from "@aws-amplify/backend";

export const manageAdminUsers = defineFunction({
  name: "manage-admin-users",
  entry: "./handler.ts",
  resourceGroupName: "data",
  timeoutSeconds: 30,
  runtime: 24
});
