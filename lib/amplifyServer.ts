import { cookies } from "next/headers";
import { createServerRunner } from "@aws-amplify/adapter-nextjs";
import { generateServerClientUsingCookies } from "@aws-amplify/adapter-nextjs/api";
import { fetchAuthSession, getCurrentUser } from "aws-amplify/auth/server";
import type { Schema } from "@/amplify/data/resource";

type AmplifyConfig = Parameters<typeof createServerRunner>[0]["config"];

async function loadOutputs(): Promise<AmplifyConfig | null> {
  try {
    const outputs = (await import("@/amplify_outputs.json")) as { default: AmplifyConfig };
    return outputs.default;
  } catch {
    return null;
  }
}

export async function getServerAmplify() {
  const outputs = await loadOutputs();

  if (!outputs) {
    return null;
  }

  const runner = createServerRunner({ config: outputs });
  const cookiesClient = generateServerClientUsingCookies<Schema>({
    config: outputs,
    cookies
  });

  return {
    cookiesClient,
    runWithAmplifyServerContext: runner.runWithAmplifyServerContext
  };
}

export async function getAuthenticatedUser() {
  const amplify = await getServerAmplify();

  if (!amplify) {
    return null;
  }

  try {
    return await amplify.runWithAmplifyServerContext({
      nextServerContext: { cookies },
      operation: (contextSpec) => getCurrentUser(contextSpec)
    });
  } catch {
    return null;
  }
}

export async function getServerSessionGroups(): Promise<string[]> {
  const amplify = await getServerAmplify();

  if (!amplify) {
    return [];
  }

  try {
    const session = await amplify.runWithAmplifyServerContext({
      nextServerContext: { cookies },
      operation: (contextSpec) => fetchAuthSession(contextSpec)
    });
    const groups = session.tokens?.accessToken.payload["cognito:groups"];
    return Array.isArray(groups) ? groups.map(String) : [];
  } catch {
    return [];
  }
}
