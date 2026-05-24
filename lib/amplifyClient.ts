"use client";

import { Amplify } from "aws-amplify";
import { cognitoUserPoolsTokenProvider } from "aws-amplify/auth/cognito";
import { CookieStorage } from "aws-amplify/utils";

type AmplifyOutputs = Parameters<typeof Amplify.configure>[0];

let configured = false;
let configurePromise: Promise<void> | null = null;

export async function configureAmplify() {
  if (configured) {
    return;
  }

  configurePromise ??= configureAmplifyOnce();
  await configurePromise;
}

async function configureAmplifyOnce() {
  try {
    const outputs = (await import("@/amplify_outputs.json")) as { default: AmplifyOutputs };
    Amplify.configure(outputs.default, { ssr: true });
    configureLocalHttpCookieStorage();
    configured = true;
  } catch {
    // Local scaffold can run before Amplify resources are generated.
    configurePromise = null;
  }
}

function configureLocalHttpCookieStorage() {
  if (typeof window === "undefined" || window.location.protocol !== "http:") {
    return;
  }

  cognitoUserPoolsTokenProvider.setKeyValueStorage(
    new CookieStorage({
      path: "/",
      sameSite: "lax",
      secure: false
    })
  );
}
