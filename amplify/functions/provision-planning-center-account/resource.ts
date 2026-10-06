import { defineFunction, secret } from "@aws-amplify/backend";

export const provisionPlanningCenterAccount = defineFunction({
  name: "provision-planning-center-account",
  entry: "./handler.ts",
  resourceGroupName: "data",
  timeoutSeconds: 30,
  runtime: 24,
  environment: {
    LP_INFRA_CLIENT_SECRET: secret("LP_INFRA_CLIENT_SECRET")
  }
});
