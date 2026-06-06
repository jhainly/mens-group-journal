import { defineFunction } from "@aws-amplify/backend";

export const syncUserScore = defineFunction({
  name: "sync-user-score",
  entry: "./handler.ts",
  resourceGroupName: "data",
  timeoutSeconds: 30,
  runtime: 24
});
