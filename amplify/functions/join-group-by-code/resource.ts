import { defineFunction } from "@aws-amplify/backend";

export const joinGroupByCode = defineFunction({
  name: "join-group-by-code",
  entry: "./handler.ts",
  resourceGroupName: "data",
  timeoutSeconds: 30,
  runtime: 24
});
