import { NextRequest, NextResponse } from "next/server";
import {
  createPlanningCenterLoginProof,
  exchangePlanningCenterCode,
  getPlanningCenterAuthIntent,
  planningCenterIntentCookie,
  planningCenterNextCookie,
  planningCenterProofCookie,
  planningCenterStateCookie
} from "@/lib/planningCenterAuth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const publicUrl = getPublicUrl(request);
  const expectedState = request.cookies.get(planningCenterStateCookie)?.value;
  const returnedState = request.nextUrl.searchParams.get("state");
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const nextPath = getSafeNextPath(request.cookies.get(planningCenterNextCookie)?.value);
  const intent = getPlanningCenterAuthIntent(request.cookies.get(planningCenterIntentCookie)?.value);
  const errorUrl = new URL(intent === "create" ? "/create-account" : "/auth", publicUrl);

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
      intent,
      user: planningCenterUser
    });
    const completeUrl = new URL("/auth/planning-center/complete", publicUrl);
    completeUrl.searchParams.set("loginId", planningCenterUser.email);
    completeUrl.searchParams.set("next", nextPath);
    completeUrl.searchParams.set("intent", intent);

    const response = NextResponse.redirect(completeUrl);
    clearOauthCookies(response);
    response.cookies.set(planningCenterProofCookie, proof, {
      httpOnly: true,
      maxAge: 10 * 60,
      path: "/",
      sameSite: "lax",
      secure: publicUrl.startsWith("https:")
    });

    return response;
  } catch (caught) {
    errorUrl.searchParams.set("error", caught instanceof Error ? caught.message : "Planning Center sign-in failed.");
    const response = NextResponse.redirect(errorUrl);
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
  response.cookies.delete(planningCenterIntentCookie);
}

function getSafeNextPath(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  return value;
}
