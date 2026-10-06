import { defineFunction, secret } from "@aws-amplify/backend";

export const planningCenterApiAuthorizer = defineFunction({
  name: "planning-center-api-authorizer",
  entry: "./handler.ts",
  resourceGroupName: "data",
  timeoutSeconds: 5,
  runtime: 24,
  environment: {
    LP_INFRA_CLIENT_SECRET: secret("LP_INFRA_CLIENT_SECRET")
  }
});
