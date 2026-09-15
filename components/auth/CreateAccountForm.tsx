"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmSignUp, resendSignUpCode, signUp } from "aws-amplify/auth";
import { configureAmplify } from "@/lib/amplifyClient";

export function CreateAccountForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

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
      </div>
    </form>
  );
}
