import { after, NextResponse } from "next/server";
import { getRequestContext } from "@/lib/requestMeta";

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

function pixelResponse() {
  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: PIXEL_HEADERS,
  });
}

async function logOpen(event) {
  try {
    const [{ default: dbConnect }, { default: TrackingLog }] =
      await Promise.all([
        import("@/lib/mongodb"),
        import("@/models/TrackingLog"),
      ]);

    await dbConnect();
    await TrackingLog.create({
      trackingId: event.trackingId,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      clientType: event.clientType,
      device: event.device,
      country: event.country,
      city: event.city,
      openedAt: new Date(),
    });
  } catch (error) {
    console.error("Failed to save tracking log:", error);
  }
}

export async function GET(request, { params }) {
  const { trackingId: rawTrackingId } = await params;
  const trackingId = String(rawTrackingId || "").replace(/\.png$/i, "");
  const context = getRequestContext(request);

  if (trackingId) {
    after(() => logOpen({ trackingId, ...context }));
  }

  return pixelResponse();
}
