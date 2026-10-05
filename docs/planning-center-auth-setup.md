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

- Finds an existing Cognito user by Planning Center person ID.
- Falls back to matching by email for first-time migration.
- Creates a Cognito user when no match exists.
- Refreshes email, display name, LifePoint IDs, and admin role on every sign-in.

Existing password sign-in remains available as "Legacy account sign-in" during the migration.

## Production permission note

The callback route uses Cognito admin APIs to find or create the mapped Cognito user. The deployed server runtime must be allowed to call:

- `cognito-idp:ListUsers`
- `cognito-idp:AdminCreateUser`
- `cognito-idp:AdminSetUserPassword`
- `cognito-idp:AdminUpdateUserAttributes`
- `cognito-idp:AdminAddUserToGroup`
- `cognito-idp:AdminRemoveUserFromGroup`

If the hosting runtime cannot be granted these permissions directly, move the user upsert into an Amplify function with those permissions and call it from the callback route.
