import { defineAuth } from "@aws-amplify/backend";

/**
 * Email sender for Cognito verification and password-reset messages.
 *
 * By default Cognito's built-in sender (no-reply@verificationemail.com, 50 emails/day, poor deliverability) is used.
 * Set LIFEPOINT_SES_SENDER=1 at deploy time to send through Amazon SES as no-reply@lifepointpa.org instead. Only do
 * this once the lifepointpa.org identity is verified in SES (us-east-1) and the account is out of the SES sandbox;
 * see docs/production-email-setup.md.
 */
export const useSesSender = process.env.LIFEPOINT_SES_SENDER === "1";
export const senderName = "Lifepoint Men";
export const senderEmail = "no-reply@lifepointpa.org";
export const senderDomain = "lifepointpa.org";

export const auth = defineAuth({
  loginWith: {
    email: {
      verificationEmailSubject: "Verify your Lifepoint Men account"
    }
  },
  ...(useSesSender
    ? {
        senders: {
          email: {
            fromName: senderName,
            fromEmail: senderEmail
          }
        }
      }
    : {}),
  groups: ["ADMINS", "LEADERS"],
  userAttributes: {
    preferredUsername: {
      required: false,
      mutable: true
    }
  },
  accountRecovery: "EMAIL_ONLY"
});
