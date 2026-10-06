"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { confirmSignIn, fetchAuthSession, signIn, signOut } from "aws-amplify/auth";
import { configureAmplify } from "@/lib/amplifyClient";
import { clearJournalEncryptionSecret } from "@/lib/journalKey";
import {
  ensureJournalKeyEnvelope,
  ensureUserProfile,
  linkCurrentUserToPlanningCenter,
  resolvePlanningCenterAccount
} from "@/lib/services/dataClient";

type ProofResponse = {
  error?: string;
  proof?: string;
};

type CompletionStage = "loading" | "link" | "error";

export function PlanningCenterCompleteSignIn() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stage, setStage] = useState<CompletionStage>("loading");
  const [proof, setProof] = useState("");
  const [legacyEmail, setLegacyEmail] = useState("");
  const [legacyPassword, setLegacyPassword] = useState("");
  const [error, setError] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const planningCenterEmail = searchParams.get("loginId") ?? "your Planning Center email";

  useEffect(() => {
    let cancelled = false;

    async function completeSignIn() {
      try {
        await configureAmplify();
        clearJournalEncryptionSecret();
        await signOut().catch(() => undefined);

        const proofPayload = await fetchPlanningCenterProof();

        if (cancelled) {
          return;
        }

        setProof(proofPayload);
        const resolution = await resolvePlanningCenterAccount(proofPayload);

        if (!resolution.ok) {
          throw new Error(resolution.error);
        }

        if (!resolution.data) {
          setStage("link");
          return;
        }

        await signInWithPlanningCenter(resolution.data.loginId, proofPayload);
        await finishLinkedSignIn(proofPayload);

        if (!cancelled) {
          router.push(getSafeNextPath(searchParams.get("next")));
          router.refresh();
        }
      } catch (caught) {
        await signOut().catch(() => undefined);

        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Planning Center sign-in failed.");
          setStage("error");
        }
      }
    }

    void completeSignIn();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  async function handleLinkAccounts(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLinking(true);

    try {
      if (!proof) {
        throw new Error("Planning Center sign-in expired. Please try again.");
      }

      await configureAmplify();
      clearJournalEncryptionSecret();
      await signOut().catch(() => undefined);

      const normalizedEmail = legacyEmail.trim().toLowerCase();
      const result = await signIn({
        username: normalizedEmail,
        password: legacyPassword
      });

      if (!result.isSignedIn) {
        throw new Error(
          result.nextStep.signInStep === "CONFIRM_SIGN_UP"
            ? "Verify your existing app account through legacy sign-in before linking it."
            : "Additional account verification is required before linking."
        );
      }

      await waitForAuthenticatedSession();
      const journalKey = await ensureJournalKeyEnvelope({
        email: normalizedEmail,
        password: legacyPassword
      });

      if (!journalKey.ok) {
        throw new Error(`Your account was verified, but the journal key could not be prepared: ${journalKey.error}`);
      }

      await finishLinkedSignIn(proof);
      router.push(getSafeNextPath(searchParams.get("next")));
      router.refresh();
    } catch (caught) {
      await signOut().catch(() => undefined);
      setError(caught instanceof Error ? caught.message : "The accounts could not be linked.");
    } finally {
      setIsLinking(false);
    }
  }

  async function finishLinkedSignIn(planningCenterProof: string) {
    const linked = await linkCurrentUserToPlanningCenter(planningCenterProof);

    if (!linked.ok) {
      throw new Error(linked.error);
    }

    await fetchAuthSession({ forceRefresh: true });
    const profile = await ensureUserProfile();

    if (!profile.ok) {
      throw new Error(`Signed in, but profile setup failed: ${profile.error}`);
    }
  }

  if (stage === "link") {
    return (
      <form className="panel stack" onSubmit={handleLinkAccounts} suppressHydrationWarning>
        <div>
          <p className="eyebrow">Connect accounts</p>
          <h1>Link your existing account</h1>
          <p>
            Planning Center signed you in as <strong>{planningCenterEmail}</strong>. Enter your current Lifepoint Men
            account credentials once to keep your groups, scores, and journal connected.
          </p>
        </div>
        <label className="field">
          <span>Current app email</span>
          <input
            autoComplete="email"
            onChange={(event) => setLegacyEmail(event.target.value)}
            required
            suppressHydrationWarning
            type="email"
            value={legacyEmail}
          />
        </label>
        <label className="field">
          <span>Current app password</span>
          <input
            autoComplete="current-password"
            onChange={(event) => setLegacyPassword(event.target.value)}
            required
            suppressHydrationWarning
            type="password"
            value={legacyPassword}
          />
        </label>
        {error ? <p className="warning">{error}</p> : null}
        <button className="button" disabled={isLinking} type="submit">
          {isLinking ? "Linking accounts..." : "Link accounts and continue"}
        </button>
        <Link className="button secondary" href="/auth">
          Back to sign in
        </Link>
      </form>
    );
  }

  return (
    <section className="panel stack">
      <div>
        <p className="eyebrow">Planning Center</p>
        <h1>{stage === "error" ? "Sign-in needs attention" : "Signing you in"}</h1>
        {stage === "loading" ? <p className="muted">Finishing your Lifepoint Men session...</p> : null}
      </div>
      {stage === "error" ? (
        <>
          <p className="warning">{error}</p>
          <a className="button" href="/api/v1/users/planning-center/login">
            Try again
          </a>
          <Link className="button secondary" href="/auth">
            Use legacy sign-in
          </Link>
        </>
      ) : null}
    </section>
  );
}

async function fetchPlanningCenterProof(): Promise<string> {
  const proofResponse = await fetch("/api/v1/users/planning-center/proof", {
    credentials: "include"
  });
  const proofPayload = (await proofResponse.json().catch(() => ({}))) as ProofResponse;

  if (!proofResponse.ok || !proofPayload.proof) {
    throw new Error(proofPayload.error || "Planning Center sign-in expired. Please try again.");
  }

  return proofPayload.proof;
}

async function signInWithPlanningCenter(loginId: string, proof: string): Promise<void> {
  const signInResult = await signIn({
    username: loginId,
    options: {
      authFlowType: "CUSTOM_WITHOUT_SRP"
    }
  });

  if (!signInResult.isSignedIn) {
    const confirmed = await confirmSignIn({
      challengeResponse: proof
    });

    if (!confirmed.isSignedIn) {
      throw new Error("Additional account verification is required before signing in.");
    }
  }

  await waitForAuthenticatedSession();
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

function getSafeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  return value;
}
