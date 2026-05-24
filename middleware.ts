import { NextRequest, NextResponse } from "next/server";
import { createServerRunner } from "@aws-amplify/adapter-nextjs";
import { fetchAuthSession } from "aws-amplify/auth/server";

const protectedPrefixes = ["/dashboard", "/program", "/leaderboard"];
const adminPrefixes = ["/admin"];

type AmplifyConfig = Parameters<typeof createServerRunner>[0]["config"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = matchesPrefix(pathname, protectedPrefixes);
  const isAdminRoute = matchesPrefix(pathname, adminPrefixes);

  if (!isProtected && !isAdminRoute) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const session = await getSession(request, response);

  if (!session.authenticated) {
    return redirectToLogin(request);
  }

  if (isAdminRoute && !session.groups.some((group) => group === "ADMINS" || group === "LEADERS")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/program/:path*", "/leaderboard/:path*", "/admin/:path*"]
};

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = new URL("/auth", request.url);
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

async function getSession(request: NextRequest, response: NextResponse): Promise<{ authenticated: boolean; groups: string[] }> {
  try {
    const outputs = (await import("@/amplify_outputs.json")) as { default: AmplifyConfig };
    const { runWithAmplifyServerContext } = createServerRunner({ config: outputs.default });
    const session = await runWithAmplifyServerContext({
      nextServerContext: { request, response },
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
