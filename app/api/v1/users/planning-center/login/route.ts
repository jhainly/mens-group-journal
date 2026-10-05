import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  getPlanningCenterCallbackUrl,
  getPlanningCenterConfig,
  planningCenterNextCookie,
  planningCenterStateCookie
} from "@/lib/planningCenterAuth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const config = getPlanningCenterConfig(request.nextUrl.origin);
    const state = randomBytes(16).toString("base64url");
    const nextPath = getSafeNextPath(request.nextUrl.searchParams.get("next"));
    const authorizeUrl = new URL("/authorize", config.infraUrl);
    authorizeUrl.searchParams.set("client_id", config.clientId);
    authorizeUrl.searchParams.set("redirect_uri", getPlanningCenterCallbackUrl(config.publicUrl));
    authorizeUrl.searchParams.set("state", state);

    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set(planningCenterStateCookie, state, {
      httpOnly: true,
      maxAge: 10 * 60,
      path: "/",
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:"
    });
    response.cookies.set(planningCenterNextCookie, nextPath, {
      httpOnly: true,
      maxAge: 10 * 60,
      path: "/",
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:"
    });

    return response;
  } catch (error) {
    const url = new URL("/auth", request.url);
    url.searchParams.set("error", error instanceof Error ? error.message : "Planning Center sign-in is not configured.");
    return NextResponse.redirect(url);
  }
}

function getSafeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  return value;
}
