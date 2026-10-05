import { NextRequest, NextResponse } from "next/server";
import { planningCenterProofCookie } from "@/lib/planningCenterAuth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const proof = request.cookies.get(planningCenterProofCookie)?.value;

  if (!proof) {
    return NextResponse.json({ error: "Planning Center sign-in proof expired. Please try again." }, { status: 401 });
  }

  const response = NextResponse.json({ proof });
  response.cookies.delete(planningCenterProofCookie);
  return response;
}
