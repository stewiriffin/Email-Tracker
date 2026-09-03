import dbConnect from "@/lib/mongodb";
import Email from "@/models/Email";
import TrackingLog from "@/models/TrackingLog";
import EmailTable from "@/components/EmailTable";
import ComposeModal from "@/components/ComposeModal";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function serializeLogs(logs) {
  return logs.map((log) => ({
    id: String(log._id),
    openedAt:
      log.openedAt instanceof Date
        ? log.openedAt.toISOString()
        : new Date(log.openedAt).toISOString(),
    ipAddress: log.ipAddress || "unknown",
    userAgent: log.userAgent || "unknown",
  }));
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

  const rows = emails.map((email) => {
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

  return rows;
}

export default async function Home() {
  let emails = [];
  let error = null;

  try {
    emails = await getDashboardData();
  } catch (err) {
    console.error("Failed to load dashboard emails:", err);
    error = "Could not load emails. Check that MongoDB is running and MONGODB_URI is set.";
  }

  const openedCount = emails.filter((email) => email.openCount > 0).length;
  const unopenedCount = emails.length - openedCount;

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-800">
            Dashboard
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">
            Email tracker
          </h1>
          <p className="mt-2 max-w-2xl text-stone-600">
            Sent messages and their open activity, including timestamps, IP
            addresses, and user-agents for every tracked open.
          </p>
        </div>
        <ComposeModal />
      </header>

      {error ? (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      ) : null}

      {emails.length > 0 ? (
        <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Sent" value={emails.length} />
          <StatCard label="Opened" value={openedCount} />
          <StatCard label="Unopened" value={unopenedCount} />
        </section>
      ) : null}

      <EmailTable emails={emails} />
    </main>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">
        {value}
      </p>
    </div>
  );
}
