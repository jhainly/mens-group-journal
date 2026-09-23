# Production Email Setup

Lifepoint Men currently uses Cognito's built-in sender for account verification and password reset emails
(`no-reply@verificationemail.com`). A replacement production email integration is planned, but it will not use Mailgun
or Amazon SES.

Until that integration is selected and implemented:

- Do not set `LIFEPOINT_MAILGUN_SENDER` or `LIFEPOINT_SES_SENDER`.
- Do not add Mailgun API keys, Mailgun sender Lambdas, SES identities, or SES DNS records for this app.
- Keep Cognito's default sender in place so sign-up and password-reset flows continue to work.

Priority One Deep Roots is separate and can continue using its working Cognito/SES setup.
