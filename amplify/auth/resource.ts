import { defineAuth } from "@aws-amplify/backend";
import { planningCenterAuthChallenge } from "../functions/planning-center-auth-challenge/resource";

/**
 * Email sender for Cognito verification and password-reset messages.
 *
 * Lifepoint Men intentionally uses Cognito's built-in sender until the next production email integration is chosen.
 * Do not add Mailgun or SES sender wiring here.
 */
export const auth = defineAuth({
  loginWith: {
    email: {
      verificationEmailSubject: "Verify your Lifepoint Men account"
    }
  },
  triggers: {
    createAuthChallenge: planningCenterAuthChallenge,
    defineAuthChallenge: planningCenterAuthChallenge,
    verifyAuthChallengeResponse: planningCenterAuthChallenge
  },
  groups: ["ADMINS", "LEADERS"],
  userAttributes: {
    "custom:lpInfraUserId": {
      dataType: "String",
      mutable: true
    },
    "custom:pcPersonId": {
      dataType: "String",
      mutable: true
    },
    preferredUsername: {
      required: false,
      mutable: true
    }
  },
  accountRecovery: "EMAIL_ONLY"
});
