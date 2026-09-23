import { defineAuth } from "@aws-amplify/backend";

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
  groups: ["ADMINS", "LEADERS"],
  userAttributes: {
    preferredUsername: {
      required: false,
      mutable: true
    }
  },
  accountRecovery: "EMAIL_ONLY"
});
