import { after, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

const PIXEL_HEADERS = {
  "Content-Type": "image/gif",
  "Content-Length": String(TRANSPARENT_GIF.length),
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Expires: "0",
  Pragma: "no-cache",
};

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

function pixelResponse() {
  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: PIXEL_HEADERS,
  });
}

async function logOpen({ trackingId, ipAddress, userAgent }) {
  try {
    const [{ default: dbConnect }, { default: TrackingLog }] =
      await Promise.all([
        import("@/lib/mongodb"),
        import("@/models/TrackingLog"),
      ]);

    await dbConnect();
    await TrackingLog.create({
      trackingId,
      ipAddress,
      userAgent,
      openedAt: new Date(),
    });
  } catch (error) {
    console.error("Failed to save tracking log:", error);
  }
}

export async function GET(request, { params }) {
  const { trackingId: rawTrackingId } = await params;
  const trackingId = String(rawTrackingId || "").replace(/\.png$/i, "");
  const ipAddress = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || "unknown";

  if (trackingId) {
    after(() => logOpen({ trackingId, ipAddress, userAgent }));
  }

  return pixelResponse();
}
