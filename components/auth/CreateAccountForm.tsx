"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { confirmSignUp, resendSignUpCode, signUp } from "aws-amplify/auth";
import { configureAmplify } from "@/lib/amplifyClient";

export function CreateAccountForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [showLegacyForm, setShowLegacyForm] = useState(false);
  const planningCenterError = searchParams.get("error");

  if (!showLegacyForm && !needsConfirmation) {
    return (
      <section className="panel stack">
        <div>
          <p className="eyebrow">Planning Center</p>
          <h1>Create account</h1>
          <p className="muted">Use your church account to create your Lifepoint Men account.</p>
        </div>
        {planningCenterError ? <p className="warning">{planningCenterError}</p> : null}
        <a
          className="button"
          href="/api/v1/users/planning-center/login?intent=create&next=%2Fjoin"
        >
          Create with Planning Center
        </a>
        <button className="button secondary" onClick={() => setShowLegacyForm(true)} type="button">
          Create with legacy email (emergency backup)
        </button>
        <p className="muted">
          Already have an account? <Link href="/auth">Sign in</Link>
        </p>
      </section>
    );
  }

  async function resendCode() {
    setError("");
    setNotice("");
    setIsResending(true);

    try {
      await configureAmplify();
      await resendSignUpCode({ username: email });
      setNotice(`A new code was sent to ${email}. Check your spam folder if it does not arrive within a minute.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The code could not be resent.");
    } finally {
      setIsResending(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsSubmitting(true);

    try {
      await configureAmplify();

      if (!needsConfirmation) {
        const result = await signUp({
          username: email,
          password,
          options: {
            userAttributes: {
              email,
              preferred_username: displayName
            }
          }
        });

        if (result.nextStep.signUpStep === "CONFIRM_SIGN_UP") {
          setNeedsConfirmation(true);
          return;
        }
      } else {
        await confirmSignUp({ username: email, confirmationCode });
      }

      router.push("/auth?account=confirmed&next=%2Fjoin");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Account creation failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="panel stack" onSubmit={handleSubmit} suppressHydrationWarning>
      <div>
        <p className="eyebrow">Emergency backup</p>
        <h1>{needsConfirmation ? "Verify account" : "Create account"}</h1>
        {needsConfirmation ? <p className="muted">Enter the code sent to your email.</p> : null}
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
      <label className="field">
        <span>Display name</span>
        <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required suppressHydrationWarning />
      </label>
      {needsConfirmation ? (
        <label className="field">
          <span>Confirmation code</span>
          <input
            value={confirmationCode}
            onChange={(event) => setConfirmationCode(event.target.value)}
            required
            suppressHydrationWarning
          />
        </label>
      ) : null}
      {error ? <p className="warning">{error}</p> : null}
      {notice ? <p className="muted">{notice}</p> : null}
      <div className="row">
        <button className="button" disabled={isSubmitting || isResending} type="submit">
          {needsConfirmation ? "Confirm account" : "Create account"}
        </button>
        {needsConfirmation ? (
          <button className="button secondary" disabled={isSubmitting || isResending} onClick={() => void resendCode()} type="button">
            {isResending ? "Sending..." : "Resend code"}
          </button>
        ) : null}
        {!needsConfirmation ? (
          <button className="button secondary" onClick={() => setShowLegacyForm(false)} type="button">
            Back to Planning Center
          </button>
        ) : null}
      </div>
    </form>
  );
}
