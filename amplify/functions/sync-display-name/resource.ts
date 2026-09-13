import { defineFunction } from "@aws-amplify/backend";

export const syncDisplayName = defineFunction({
  name: "sync-display-name",
  entry: "./handler.ts",
  resourceGroupName: "data",
  timeoutSeconds: 30,
  runtime: 24
});
