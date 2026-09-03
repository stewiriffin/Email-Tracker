import { NextResponse } from "next/server";
import { getAnalyticsSummary } from "@/lib/analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const analytics = await getAnalyticsSummary();
    return NextResponse.json(analytics);
  } catch (error) {
    console.error("Failed to load analytics summary:", error);
    return NextResponse.json(
      { error: "Could not load engagement analytics." },
      { status: 500 }
    );
  }
}
