import dbConnect from "@/lib/mongodb";
import Email from "@/models/Email";
import TrackingLog from "@/models/TrackingLog";
import LinkClick from "@/models/LinkClick";

export const EMPTY_ANALYTICS = {
  totalSent: 0,
  totalOpens: 0,
  uniqueOpenRate: 0,
  clickThroughRate: 0,
  deviceBreakdown: {
    desktop: 0,
    mobile: 0,
  },
};

function roundPercent(part, whole) {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

export async function getAnalyticsSummary() {
  await dbConnect();

  const emails = await Email.find({ deliveryStatus: { $ne: "failed" } })
    .select("trackingId")
    .lean();
  const totalSent = emails.length;
  const trackingIds = emails.map((email) => email.trackingId);

  if (totalSent === 0) {
    return {
      ...EMPTY_ANALYTICS,
      deviceBreakdown: { desktop: 0, mobile: 0 },
    };
  }

  const humanOpenMatch = {
    trackingId: { $in: trackingIds },
    isBotOrProxy: { $ne: true },
  };

  const [totalOpens, uniqueOpenedIds, clickedIds, deviceRows] = await Promise.all([
    TrackingLog.countDocuments(humanOpenMatch),
    TrackingLog.distinct("trackingId", humanOpenMatch),
    LinkClick.distinct("trackingId", { trackingId: { $in: trackingIds } }),
    TrackingLog.aggregate([
      { $match: humanOpenMatch },
      { $group: { _id: "$device", count: { $sum: 1 } } },
    ]),
  ]);

  const deviceBreakdown = { desktop: 0, mobile: 0 };
  for (const row of deviceRows) {
    if (row._id === "Mobile" || row._id === "Tablet") {
      deviceBreakdown.mobile += row.count;
    } else {
      deviceBreakdown.desktop += row.count;
    }
  }

  return {
    totalSent,
    totalOpens,
    uniqueOpenRate: roundPercent(uniqueOpenedIds.length, totalSent),
    clickThroughRate: roundPercent(clickedIds.length, totalSent),
    deviceBreakdown,
  };
}
