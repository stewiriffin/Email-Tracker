import dbConnect from "@/lib/mongodb";
import Email from "@/models/Email";
import TrackingLog from "@/models/TrackingLog";
import DashboardLive from "@/components/DashboardLive";
import { parseUserAgent } from "@/lib/deviceParser";
import { inferIsBotOrProxy } from "@/lib/openFilter";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function serializeLogs(logs) {
  return logs.map((log) => {
    const parsed = parseUserAgent(log.userAgent);

    return {
      id: String(log._id),
      openedAt:
        log.openedAt instanceof Date
          ? log.openedAt.toISOString()
          : new Date(log.openedAt).toISOString(),
      ipAddress: log.ipAddress || "unknown",
      userAgent: log.userAgent || "unknown",
      device: log.device || parsed.device,
      clientType: log.clientType || parsed.clientType,
      country: log.country || "unknown",
      city: log.city || "unknown",
      isBotOrProxy: inferIsBotOrProxy(log),
    };
  });
}

async function getDashboardData() {
  await dbConnect();

  const emails = await Email.find({ deliveryStatus: { $ne: "failed" } })
    .sort({ createdAt: -1 })
    .lean();
  const trackingIds = emails.map((email) => email.trackingId);
  const logs =
    trackingIds.length > 0
      ? await TrackingLog.find({ trackingId: { $in: trackingIds } })
          .sort({ openedAt: -1 })
          .lean()
      : [];

  const logsByTrackingId = new Map();
  for (const log of logs) {
    const existing = logsByTrackingId.get(log.trackingId) || [];
    existing.push(log);
    logsByTrackingId.set(log.trackingId, existing);
  }

  return emails.map((email) => {
    const opens = serializeLogs(logsByTrackingId.get(email.trackingId) || []);

    return {
      id: String(email._id),
      recipient: email.recipient,
      subject: email.subject,
      sentAt:
        email.createdAt instanceof Date
          ? email.createdAt.toISOString()
          : new Date(email.createdAt).toISOString(),
      trackingId: email.trackingId,
      openCount: opens.length,
      opens,
    };
  });
}

export default async function Home() {
  let emails = [];
  let error = null;

  try {
    emails = await getDashboardData();
  } catch (err) {
    console.error("Failed to load dashboard emails:", err);
    error =
      "Could not load emails. Check that MongoDB is running and MONGODB_URI is set.";
  }

  return <DashboardLive initialEmails={emails} error={error} />;
}
