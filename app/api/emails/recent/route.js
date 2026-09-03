import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Email from "@/models/Email";
import TrackingLog from "@/models/TrackingLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await dbConnect();

    const emails = await Email.find({ deliveryStatus: { $ne: "failed" } })
      .sort({ createdAt: -1 })
      .limit(10)
      .select("recipient subject trackingId createdAt")
      .lean();

    const trackingIds = emails.map((email) => email.trackingId);
    const stats =
      trackingIds.length > 0
        ? await TrackingLog.aggregate([
            {
              $match: {
                trackingId: { $in: trackingIds },
                isBotOrProxy: { $ne: true },
              },
            },
            {
              $group: {
                _id: "$trackingId",
                openCount: { $sum: 1 },
                latestOpenedAt: { $max: "$openedAt" },
              },
            },
          ])
        : [];

    const statsByTrackingId = new Map(
      stats.map((row) => [
        row._id,
        {
          openCount: row.openCount || 0,
          latestOpenedAt: row.latestOpenedAt
            ? new Date(row.latestOpenedAt).toISOString()
            : null,
        },
      ])
    );

    return NextResponse.json({
      emails: emails.map((email) => {
        const openStats = statsByTrackingId.get(email.trackingId) || {
          openCount: 0,
          latestOpenedAt: null,
        };

        return {
          id: String(email._id),
          trackingId: email.trackingId,
          recipient: email.recipient,
          subject: email.subject,
          openCount: openStats.openCount,
          latestOpenedAt: openStats.latestOpenedAt,
        };
      }),
    });
  } catch (error) {
    console.error("Failed to load recent email stats:", error);
    return NextResponse.json(
      {
        error: "Could not load recent tracked emails.",
        details: error.message,
        stack: error.name,
      },
      { status: 500 }
    );
  }
}
