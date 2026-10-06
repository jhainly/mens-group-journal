# Planning Center authentication setup

The app uses LifePoint Infrastructure as the Planning Center identity provider, then exchanges that verified identity for a Cognito app session. Keeping Cognito as the app session preserves current AppSync owner authorization, group memberships, scores, and journal data.

## LifePoint Infrastructure app settings

Configure the LifePoint Infrastructure app with these URLs:

- Launch URL: `https://men.lifepointapplications.com/api/v1/users/planning-center/login`
- Redirect URI: `https://men.lifepointapplications.com/api/v1/users/planning-center/callback`

## Runtime environment

Set these environment variables for the deployed Next.js app:

```text
APP_PUBLIC_URL=https://men.lifepointapplications.com
LP_INFRA_URL=https://auth.lifepointapplications.com
LP_INFRA_CLIENT_ID=lifepoint-men-7023c7
LP_INFRA_CLIENT_SECRET=<stored secret value>
```

Do not commit the client secret. Store it only in the hosting environment and Amplify backend secrets.

## Amplify backend secret

The Cognito custom auth trigger also needs `LP_INFRA_CLIENT_SECRET` as an Amplify secret. Set the secret for each backend environment before deploying the auth changes.

For local sandbox work:

```powershell
npx ampx sandbox secret set LP_INFRA_CLIENT_SECRET --profile lifepoint
```

For production, set the same secret in the Amplify app/backend environment before deployment.

## Migration behavior

On each Planning Center sign-in, the app:

- Exchanges the Planning Center code for the verified LifePoint user profile.
- Resolves an existing link by the stable Planning Center person ID.
- Falls back to an exact email match the first time an existing account is connected.
- Starts a Cognito custom auth flow for the linked Cognito user, preserving that user's existing `sub`, groups, scores, and journal data.
- Refreshes the stored Planning Center and LifePoint Infrastructure IDs on every successful sign-in.

If the Planning Center email and existing app email do not match, the user is prompted once for the existing app email and password. The app verifies both identities, upgrades any legacy journal-key envelope, and links Planning Center to the existing Cognito user. Future Planning Center sign-ins use the saved person ID and do not require the emails to match.

The pre-authentication account lookup uses AppSync Lambda authorization. Only the short-lived proof signed after a successful Planning Center OAuth callback can invoke that read-only lookup. The operation does not use a public API key. Writing the link requires both that proof and an authenticated Cognito session.

Existing password sign-in remains available as "Legacy account sign-in" during the migration.

## New users

Planning Center is the primary account-creation path. OAuth requests started from `/create-account` carry a signed, short-lived creation intent. If no Cognito account matches the verified Planning Center person ID or email, the proof-authorized provisioning function:

- Creates a Cognito user with the verified email and stable Planning Center identifiers.
- Suppresses Cognito's invitation email.
- Confirms the account with an internal generated password that is never exposed to the browser.
- Starts the same custom auth flow and creates the app profile and journal-key envelope.

The provisioning operation is idempotent. Retries return the matching account, and only an interrupted account with the same Planning Center and LifePoint Infrastructure IDs can be moved out of `FORCE_CHANGE_PASSWORD`.

Normal Planning Center sign-in never auto-creates an account. That separation prevents a user with an older app account under a different email from accidentally creating a duplicate instead of linking it.

Legacy email/password account creation remains available from `/create-account` as an emergency backup during rollout.
