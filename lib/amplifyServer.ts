import { cookies } from "next/headers";
import { createServerRunner } from "@aws-amplify/adapter-nextjs";
import { fetchAuthSession } from "aws-amplify/auth/server";

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

  return {
    runWithAmplifyServerContext: runner.runWithAmplifyServerContext
  };
}

export async function getServerAuthState(): Promise<{ authenticated: boolean; groups: string[] }> {
  const amplify = await getServerAmplify();

  if (!amplify) {
    return {
      authenticated: false,
      groups: []
    };
  }

  try {
    const session = await amplify.runWithAmplifyServerContext({
      nextServerContext: { cookies },
      operation: (contextSpec) => fetchAuthSession(contextSpec)
    });
    const groups = session.tokens?.accessToken.payload["cognito:groups"];

    return {
      authenticated: Boolean(session.tokens),
      groups: Array.isArray(groups) ? groups.map(String) : []
    };
  } catch {
    return {
      authenticated: false,
      groups: []
    };
  }
}
