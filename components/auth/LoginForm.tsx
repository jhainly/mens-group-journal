"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchAuthSession, signIn } from "aws-amplify/auth";
import { configureAmplify } from "@/lib/amplifyClient";
import { ensureJournalKeyEnvelope, ensureUserProfile } from "@/lib/services/dataClient";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accountConfirmed = searchParams.get("account") === "confirmed";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await configureAmplify();
      const result = await signIn({ username: email.trim(), password });

      if (!result.isSignedIn) {
        setError("Additional account verification is required before signing in.");
        return;
      }

      await waitForAuthenticatedSession();
      const profile = await ensureUserProfile();

      if (!profile.ok) {
        setError(`Signed in, but profile setup failed: ${profile.error}`);
        return;
      }

      const journalKey = await ensureJournalKeyEnvelope({ email, password });

      if (!journalKey.ok) {
        setError(`Signed in, but journal key setup failed: ${journalKey.error}`);
        return;
      }

      router.push(searchParams.get("next") ?? "/dashboard");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="panel stack" onSubmit={handleSubmit} suppressHydrationWarning>
      <div>
        <p className="eyebrow">Account</p>
        <h1>Sign in</h1>
        <p>
          {accountConfirmed
            ? "Your account is verified. Sign in to continue."
            : "Continue your Lifepoint Church men's group program and keep your personal journal private."}
        </p>
      </div>
      <label className="field">
        <span>Email</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
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
      {error ? <p className="warning">{error}</p> : null}
      <button className="button" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Logging in..." : "Log in"}
      </button>
    </form>
  );
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
