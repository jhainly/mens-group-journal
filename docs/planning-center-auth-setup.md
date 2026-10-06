# Planning Center authentication setup

The app uses LifePoint Infrastructure as the Planning Center identity provider, then exchanges that verified identity for the existing Cognito user session. Keeping Cognito as the app session preserves current AppSync owner authorization, group memberships, scores, and journal data.

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
- Starts a Cognito custom auth flow using the verified email address.
- Allows sign-in when the verified Planning Center email matches an existing Cognito user's email.

Existing password sign-in remains available as "Legacy account sign-in" during the migration.

## Current limitation

This version does not auto-create Cognito users and does not update Cognito attributes during Planning Center sign-in. New users should still be created through the legacy account flow or by an admin until a separate provisioning path is added.
