import { defineFunction, secret } from "@aws-amplify/backend";

export const planningCenterAuthChallenge = defineFunction({
  name: "planning-center-auth-challenge",
  entry: "./handler.ts",
  resourceGroupName: "auth",
  timeoutSeconds: 10,
  runtime: 24,
  environment: {
    LP_INFRA_CLIENT_SECRET: secret("LP_INFRA_CLIENT_SECRET")
  }
});
