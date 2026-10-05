"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { confirmSignIn, fetchAuthSession, signIn, signOut } from "aws-amplify/auth";
import { configureAmplify } from "@/lib/amplifyClient";
import { clearJournalEncryptionSecret } from "@/lib/journalKey";
import { ensureUserProfile } from "@/lib/services/dataClient";

type ProofResponse = {
  error?: string;
  proof?: string;
};

export function PlanningCenterCompleteSignIn() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function completeSignIn() {
      try {
        await configureAmplify();
        clearJournalEncryptionSecret();
        await signOut().catch(() => undefined);

        const loginId = searchParams.get("loginId");

        if (!loginId) {
          throw new Error("Planning Center sign-in is missing the user identity.");
        }

        const proofResponse = await fetch("/api/v1/users/planning-center/proof", {
          credentials: "include"
        });
        const proofPayload = (await proofResponse.json().catch(() => ({}))) as ProofResponse;

        if (!proofResponse.ok || !proofPayload.proof) {
          throw new Error(proofPayload.error || "Planning Center sign-in expired. Please try again.");
        }

        const signInResult = await signIn({
          username: loginId,
          options: {
            authFlowType: "CUSTOM_WITHOUT_SRP"
          }
        });

        if (!signInResult.isSignedIn) {
          const confirmed = await confirmSignIn({
            challengeResponse: proofPayload.proof
          });

          if (!confirmed.isSignedIn) {
            throw new Error("Additional account verification is required before signing in.");
          }
        }

        await waitForAuthenticatedSession();
        const profile = await ensureUserProfile();

        if (!profile.ok) {
          throw new Error(`Signed in, but profile setup failed: ${profile.error}`);
        }

        if (cancelled) {
          return;
        }

        router.push(getSafeNextPath(searchParams.get("next")));
        router.refresh();
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Planning Center sign-in failed.");
        }
      }
    }

    void completeSignIn();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <section className="panel stack">
      <div>
        <p className="eyebrow">Planning Center</p>
        <h1>Signing you in</h1>
        <p className="muted">Finishing your Lifepoint Men session...</p>
      </div>
      {error ? (
        <>
          <p className="warning">{error}</p>
          <a className="button" href="/api/v1/users/planning-center/login">
            Try again
          </a>
        </>
      ) : null}
    </section>
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

function getSafeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  return value;
}
