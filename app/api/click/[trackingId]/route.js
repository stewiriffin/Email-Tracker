import { after, NextResponse } from "next/server";
import { parseSafeHttpUrl } from "@/lib/rewriteLinks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function getClientIp(request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const clientIp = forwardedFor.split(",")[0]?.trim();
    if (clientIp) return clientIp;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}

function invalidUrlResponse() {
  return NextResponse.json(
    { error: "A valid http or https destination URL is required." },
    { status: 400 }
  );
}

async function logClick({ trackingId, targetUrl, ipAddress, userAgent }) {
  try {
    const [{ default: dbConnect }, { default: LinkClick }] = await Promise.all([
      import("@/lib/mongodb"),
      import("@/models/LinkClick"),
    ]);

    await dbConnect();
    await LinkClick.create({
      trackingId,
      targetUrl,
      ipAddress,
      userAgent,
      clickedAt: new Date(),
    });
  } catch (error) {
    console.error("Failed to save link click:", error);
  }
}

export async function GET(request, { params }) {
  const { trackingId } = await params;
  const destination = parseSafeHttpUrl(request.nextUrl.searchParams.get("url"));

  if (!destination) {
    return invalidUrlResponse();
  }

  if (trackingId) {
    after(() =>
      logClick({
        trackingId,
        targetUrl: destination,
        ipAddress: getClientIp(request),
        userAgent: request.headers.get("user-agent") || "unknown",
      })
    );
  }

  return new NextResponse(null, {
    status: 302,
    headers: {
      Location: destination,
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Expires: "0",
      Pragma: "no-cache",
    },
  });
}
