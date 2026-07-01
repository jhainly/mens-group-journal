"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { confirmSignUp, fetchAuthSession, resendSignUpCode, signIn } from "aws-amplify/auth";
import { configureAmplify } from "@/lib/amplifyClient";
import { ensureJournalKeyEnvelope, ensureUserProfile } from "@/lib/services/dataClient";

type LoginMode = "login" | "confirm";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accountConfirmed = searchParams.get("account") === "confirmed";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState<LoginMode>("login");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsSubmitting(true);

    try {
      await configureAmplify();

      if (mode === "confirm") {
        await confirmSignUp({ username: normalizedEmail(email), confirmationCode: confirmationCode.trim() });
      }

      await completeSignIn(email, password);
    } catch (caught) {
      if (isUnconfirmedUserError(caught)) {
        setMode("confirm");
        setNotice("Enter the verification code sent to your email, or resend a new code.");
        return;
      }

      setError(caught instanceof Error ? caught.message : "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendCode() {
    setError("");
    setNotice("");
    setIsResending(true);

    try {
      await configureAmplify();
      await resendSignUpCode({ username: normalizedEmail(email) });
      setMode("confirm");
      setNotice("A new verification code was sent to your email.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not resend the verification code.");
    } finally {
      setIsResending(false);
    }
  }

  async function completeSignIn(username: string, signInPassword: string) {
    const result = await signIn({ username: normalizedEmail(username), password: signInPassword });

    if (!result.isSignedIn) {
      if (result.nextStep.signInStep === "CONFIRM_SIGN_UP") {
        setMode("confirm");
        setNotice("Enter the verification code sent to your email, or resend a new code.");
        return;
      }

      setError("Additional account verification is required before signing in.");
      return;
    }

    await waitForAuthenticatedSession();
    const profile = await ensureUserProfile();

    if (!profile.ok) {
      setError(`Signed in, but profile setup failed: ${profile.error}`);
      return;
    }

    const journalKey = await ensureJournalKeyEnvelope({ email: username, password: signInPassword });

    if (!journalKey.ok) {
      setError(`Signed in, but journal key setup failed: ${journalKey.error}`);
      return;
    }

    router.push(searchParams.get("next") ?? "/dashboard");
    router.refresh();
  }

  function updateEmail(value: string) {
    setEmail(value);

    if (mode === "confirm") {
      setConfirmationCode("");
      setMode("login");
      setNotice("");
    }
  }

  return (
    <form className="panel stack" onSubmit={handleSubmit} suppressHydrationWarning>
      <div>
        <h1>{mode === "confirm" ? "Verify account" : "Sign in"}</h1>
        {accountConfirmed ? <p className="muted">Your account is verified. Sign in to continue.</p> : null}
        {mode === "confirm" ? <p className="muted">Enter the code sent to your email to finish account setup.</p> : null}
      </div>
      <label className="field">
        <span>Email</span>
        <input
          type="email"
          value={email}
          onChange={(event) => updateEmail(event.target.value)}
          required
          suppressHydrationWarning
        />
      </label>
      <label className="field">
        <span>Password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          suppressHydrationWarning
        />
      </label>
      {mode === "confirm" ? (
        <label className="field">
          <span>Confirmation code</span>
          <input
            autoComplete="one-time-code"
            inputMode="numeric"
            value={confirmationCode}
            onChange={(event) => setConfirmationCode(event.target.value)}
            required
            suppressHydrationWarning
          />
        </label>
      ) : null}
      {notice ? <p className="muted">{notice}</p> : null}
      {error ? <p className="warning">{error}</p> : null}
      <button className="button" disabled={isSubmitting} type="submit">
        {isSubmitting ? (mode === "confirm" ? "Verifying..." : "Logging in...") : mode === "confirm" ? "Verify and sign in" : "Log in"}
      </button>
      {mode === "confirm" ? (
        <button className="button secondary" disabled={isResending || !email.trim()} onClick={() => void handleResendCode()} type="button">
          {isResending ? "Sending..." : "Resend code"}
        </button>
      ) : null}
    </form>
  );
}

function normalizedEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isUnconfirmedUserError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.name === "UserNotConfirmedException" || /not confirmed|confirm/i.test(error.message);
}

async function waitForAuthenticatedSession(): Promise<void> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const session = await fetchAuthSession({ forceRefresh: attempt === 0 });

      if (session.tokens?.accessToken && session.tokens.idToken) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error("Sign-in succeeded, but the session was not ready. Please try again.");
}
