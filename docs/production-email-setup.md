# Production Email Setup

Cognito sends the account verification and password reset emails. Today it uses its built-in sender
(`no-reply@verificationemail.com`), which is capped at 50 emails per day per user pool and is frequently dropped or
spam-foldered by Comcast, Gmail, and corporate mail gateways. The fix is to send through Amazon SES as:

```text
Lifepoint Men <no-reply@lifepointpa.org>
```

No replies are expected or monitored.

The code for this is already in place behind a switch so nothing changes until the domain is verified:

- `amplify/auth/resource.ts` - sender name/address, enabled when `LIFEPOINT_SES_SENDER=1`.
- `amplify/backend.ts` - points the Cognito user pool at the `lifepointpa.org` SES domain identity when enabled.

Do **not** set `LIFEPOINT_SES_SENDER=1` before step 4 below is complete; Cognito will refuse to deploy against an
unverified identity and sign-up emails would stop entirely.

## Target

```text
AWS account: 984454381602
Region: us-east-1 (same account and region as the production Cognito user pool)
SES identity: lifepointpa.org (domain identity, not a single address)
Sender address: no-reply@lifepointpa.org
```

Verify the whole domain rather than the single address. Domain verification gives DKIM signing, lets the address be
changed later without re-verifying, and is what mailbox providers weigh most when deciding whether to deliver.

## Step 1 - Permissions

The Amplify deploy role (`AWSReservedSSO_amplify-policy_.../amplify-admin`) cannot manage SES. Whoever runs steps 2-4
needs, at minimum, on account `984454381602`:

```text
ses:CreateEmailIdentity
ses:GetEmailIdentity
ses:ListEmailIdentities
ses:PutEmailIdentityMailFromAttributes
ses:PutAccountDetails          (to request production access)
ses:GetAccount
```

Attaching the AWS-managed `AmazonSESFullAccess` policy to the permission set in IAM Identity Center is the simplest
way to get these. It is also worth adding `AmazonCognitoPowerUser` at the same time so admins can confirm users and
manage the `ADMINS` group from the CLI.

## Step 2 - Create the identity and read the DNS records

```powershell
aws sesv2 create-email-identity --region us-east-1 --email-identity lifepointpa.org
aws sesv2 get-email-identity --region us-east-1 --email-identity lifepointpa.org --query "DkimAttributes.Tokens"
```

The second command prints three tokens. Each token becomes one CNAME record (see the template below). Keep the output;
you will paste it into the DNS request.

Optional but recommended: a custom MAIL FROM subdomain so SPF aligns with the sending domain too.

```powershell
aws sesv2 put-email-identity-mail-from-attributes --region us-east-1 --email-identity lifepointpa.org --mail-from-domain mail.lifepointpa.org --behavior-on-mx-failure USE_DEFAULT_VALUE
```

Only use `mail.lifepointpa.org` after confirming that subdomain is not already used for anything else.

## Step 3 - DNS records for whoever manages lifepointpa.org

The identity was created on 2026-09-14 and SES issued the tokens below, so these records are final and can be sent
as-is. (If the identity is ever deleted and recreated, SES issues new tokens and this section must be updated.)

### Required - DKIM (proves the mail really comes from lifepointpa.org)

```text
Type: CNAME
Host/Name:    scr5rggq4wri7fdetmchuivs6tnc6aio._domainkey.lifepointpa.org
Value/Target: scr5rggq4wri7fdetmchuivs6tnc6aio.dkim.amazonses.com

Type: CNAME
Host/Name:    tgrqggdpqf72tiprgd63sqv3qbg6mgai._domainkey.lifepointpa.org
Value/Target: tgrqggdpqf72tiprgd63sqv3qbg6mgai.dkim.amazonses.com

Type: CNAME
Host/Name:    nizpc7pdkmiphp3jzmzkx3srkjhppc7b._domainkey.lifepointpa.org
Value/Target: nizpc7pdkmiphp3jzmzkx3srkjhppc7b.dkim.amazonses.com
```

Notes for the DNS admin:

- Some DNS providers want only the part before `.lifepointpa.org` in the Host field (for example `[token-1]._domainkey`).
- Do not proxy these records (turn the orange cloud off in Cloudflare).
- Leave the records in place permanently; SES re-checks them.
- These do not affect the church's existing email. They only add a signing key for this app's sender.

### Recommended - custom MAIL FROM (only if step 2's optional command was run)

```text
Type: MX
Host/Name:    mail.lifepointpa.org
Value/Target: 10 feedback-smtp.us-east-1.amazonses.com

Type: TXT
Host/Name:    mail.lifepointpa.org
Value/Target: "v=spf1 include:amazonses.com ~all"
```

### Recommended - DMARC (only if lifepointpa.org has no `_dmarc` record yet)

```text
Type: TXT
Host/Name:    _dmarc.lifepointpa.org
Value/Target: "v=DMARC1; p=none; rua=mailto:dmarc@lifepointpa.org"
```

If a `_dmarc` record already exists, leave it alone; DKIM alignment from the records above satisfies it.

## Step 4 - Confirm verification and leave the SES sandbox

DNS usually propagates within an hour, sometimes up to 72. Check with:

```powershell
aws sesv2 get-email-identity --region us-east-1 --email-identity lifepointpa.org --query "{Verified:VerifiedForSendingStatus,Dkim:DkimAttributes.Status,MailFrom:MailFromAttributes.MailFromDomainStatus}"
```

`Verified` must be `true` and `Dkim` must be `SUCCESS`.

New SES regions start in the **SES sandbox**, which can only deliver to addresses you have individually verified. Check
and, if needed, request production access:

```powershell
aws sesv2 get-account --region us-east-1 --query "ProductionAccessEnabled"
aws sesv2 put-account-details --region us-east-1 --production-access-enabled --mail-type TRANSACTIONAL --website-url https://lifepointpa.org --use-case-description "Account verification and password reset emails for the Lifepoint Men discipleship app (Amazon Cognito). Low volume, transactional only, recipients are members who signed up themselves."
```

AWS typically approves within 24 hours. Until `ProductionAccessEnabled` is `true`, do not enable the sender.

## Step 5 - Enable the sender

1. In the Amplify Hosting console for the men's group app, add the environment variable `LIFEPOINT_SES_SENDER` = `1`
   for the `main` branch, then redeploy (or push a commit).
2. For the sandbox: `$env:LIFEPOINT_SES_SENDER = "1"; npm run sandbox`.
3. Create a test account with a Gmail and a Comcast address and confirm both receive the code from
   `Lifepoint Men <no-reply@lifepointpa.org>`.

The user pool update is in place; existing users, passwords, and groups are unaffected.

## Rollback

Remove the `LIFEPOINT_SES_SENDER` variable and redeploy. Cognito returns to its default sender immediately.
