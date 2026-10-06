import { NextRequest, NextResponse } from "next/server";
import {
  createPlanningCenterLoginProof,
  exchangePlanningCenterCode,
  planningCenterNextCookie,
  planningCenterProofCookie,
  planningCenterStateCookie
} from "@/lib/planningCenterAuth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const publicUrl = getPublicUrl(request);
  const authUrl = new URL("/auth", publicUrl);
  const expectedState = request.cookies.get(planningCenterStateCookie)?.value;
  const returnedState = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const nextPath = getSafeNextPath(request.cookies.get(planningCenterNextCookie)?.value);

  try {
    if (!expectedState || !returnedState || expectedState !== returnedState) {
      throw new Error("Planning Center sign-in expired. Please try again.");
    }

    if (error || !code) {
      throw new Error(error === "access_denied" ? "Planning Center sign-in was cancelled." : "Planning Center sign-in failed.");
    }

    const planningCenterUser = await exchangePlanningCenterCode({
      code,
      requestOrigin: publicUrl
    });
    const proof = createPlanningCenterLoginProof({
      cognitoUsername: planningCenterUser.email,
      user: planningCenterUser
    });
    const completeUrl = new URL("/auth/planning-center/complete", publicUrl);
    completeUrl.searchParams.set("loginId", planningCenterUser.email);
    completeUrl.searchParams.set("next", nextPath);

    const response = NextResponse.redirect(completeUrl);
    clearOauthCookies(response);
    response.cookies.set(planningCenterProofCookie, proof, {
      httpOnly: true,
      maxAge: 2 * 60,
      path: "/",
      sameSite: "lax",
      secure: publicUrl.startsWith("https:")
    });

    return response;
  } catch (caught) {
    authUrl.searchParams.set("error", caught instanceof Error ? caught.message : "Planning Center sign-in failed.");
    const response = NextResponse.redirect(authUrl);
    clearOauthCookies(response);
    response.cookies.delete(planningCenterProofCookie);
    return response;
  }
}

function getPublicUrl(request: NextRequest): string {
  return (process.env.APP_PUBLIC_URL?.trim() || request.nextUrl.origin).replace(/\/+$/, "");
}

function clearOauthCookies(response: NextResponse): void {
  response.cookies.delete(planningCenterStateCookie);
  response.cookies.delete(planningCenterNextCookie);
}

function getSafeNextPath(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  return value;
}
