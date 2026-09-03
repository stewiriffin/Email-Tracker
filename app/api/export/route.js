import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Email from "@/models/Email";
import TrackingLog from "@/models/TrackingLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CSV_HEADERS = [
  "Recipient",
  "Subject",
  "SentAt",
  "Status",
  "TotalOpens",
  "FirstOpenedAt",
  "LastOpenedAt",
  "Devices",
];

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toIso(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function buildCsv(emails, logsByTrackingId) {
  const rows = emails.map((email) => {
    const logs = logsByTrackingId.get(email.trackingId) || [];
    const openedAt = logs
      .map((log) => (log.openedAt instanceof Date ? log.openedAt : new Date(log.openedAt)))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => a - b);
    const devices = [
      ...new Set(logs.map((log) => log.device).filter(Boolean)),
    ].join("; ");

    return [
      email.recipient || "",
      email.subject || "",
      toIso(email.createdAt),
      logs.length > 0 ? "Opened" : "Unopened",
      logs.length,
      toIso(openedAt[0]),
      toIso(openedAt[openedAt.length - 1]),
      devices,
    ]
      .map(csvEscape)
      .join(",");
  });

  return [CSV_HEADERS.join(","), ...rows].join("\r\n");
}

export async function GET() {
  try {
    await dbConnect();

    const emails = await Email.find().sort({ createdAt: -1 }).lean();
    const trackingIds = emails.map((email) => email.trackingId);
    const logs =
      trackingIds.length > 0
        ? await TrackingLog.find({ trackingId: { $in: trackingIds } })
            .sort({ openedAt: 1 })
            .lean()
        : [];

    const logsByTrackingId = new Map();
    for (const log of logs) {
      const existing = logsByTrackingId.get(log.trackingId) || [];
      existing.push(log);
      logsByTrackingId.set(log.trackingId, existing);
    }

    const csv = buildCsv(emails, logsByTrackingId);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="email-tracker-report.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to export tracking report:", error);
    return NextResponse.json(
      { error: "Could not export tracking report." },
      { status: 500 }
    );
  }
}
