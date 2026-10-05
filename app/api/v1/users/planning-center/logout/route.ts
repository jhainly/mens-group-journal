import { NextRequest, NextResponse } from "next/server";

const DEFAULT_LP_INFRA_URL = "https://auth.lifepointapplications.com";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const publicUrl = (process.env.APP_PUBLIC_URL?.trim() || request.nextUrl.origin).replace(/\/+$/, "");
  const infraUrl = process.env.LP_INFRA_URL?.trim() || DEFAULT_LP_INFRA_URL;
  const logoutUrl = new URL("/logout", infraUrl);
  logoutUrl.searchParams.set("return_to", `${publicUrl}/auth`);

  return NextResponse.redirect(logoutUrl);
}
