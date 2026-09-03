import { after, NextResponse } from "next/server";
import { parseSafeHttpUrl } from "@/lib/rewriteLinks";
import { getRequestContext } from "@/lib/requestMeta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function invalidUrlResponse() {
  return NextResponse.json(
    { error: "A valid http or https destination URL is required." },
    { status: 400 }
  );
}

async function logClick(event) {
  try {
    const [{ default: dbConnect }, { default: LinkClick }] = await Promise.all([
      import("@/lib/mongodb"),
      import("@/models/LinkClick"),
    ]);

    await dbConnect();
    await LinkClick.create({
      trackingId: event.trackingId,
      targetUrl: event.targetUrl,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      clientType: event.clientType,
      device: event.device,
      country: event.country,
      city: event.city,
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

  const context = getRequestContext(request);

  if (trackingId) {
    after(() =>
      logClick({
        trackingId,
        targetUrl: destination,
        ...context,
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
