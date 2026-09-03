import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Email from "@/models/Email";
import TrackingLog from "@/models/TrackingLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 5;
  return Math.min(20, Math.max(1, parsed));
}

function serializeCreatedEmail(email, baseUrl) {
  const trackingId = email.trackingId;
  const origin = String(baseUrl || "").replace(/\/+$/, "");

  return {
    id: String(email._id),
    recipient: email.recipient,
    subject: email.subject,
    body: email.body,
    trackingId,
    deliveryStatus: email.deliveryStatus,
    pixelUrl: origin ? `${origin}/api/track/${trackingId}.png` : `/api/track/${trackingId}.png`,
  };
}

export async function GET(request) {
  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));

  try {
    await dbConnect();

    const emails = await Email.find({ deliveryStatus: { $ne: "failed" } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const trackingIds = emails.map((email) => email.trackingId);
    const counts =
      trackingIds.length > 0
        ? await TrackingLog.aggregate([
            {
              $match: {
                trackingId: { $in: trackingIds },
                isBotOrProxy: { $ne: true },
              },
            },
            { $group: { _id: "$trackingId", openCount: { $sum: 1 } } },
          ])
        : [];

    const countByTrackingId = new Map(
      counts.map((row) => [row._id, row.openCount])
    );

    return NextResponse.json({
      emails: emails.map((email) => {
        const openCount = countByTrackingId.get(email.trackingId) || 0;

        return {
          id: String(email._id),
          recipient: email.recipient,
          subject: email.subject,
          sentAt:
            email.createdAt instanceof Date
              ? email.createdAt.toISOString()
              : new Date(email.createdAt).toISOString(),
          trackingId: email.trackingId,
          openCount,
          status: openCount > 0 ? "Opened" : "Unopened",
        };
      }),
    });
  } catch (error) {
    console.error("Failed to load recent emails:", error);
    return NextResponse.json(
      { error: "Could not load tracked emails from the database." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  let payload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 }
    );
  }

  const recipient =
    typeof payload?.recipient === "string" ? payload.recipient.trim().toLowerCase() : "";
  const subjectRaw =
    typeof payload?.subject === "string" ? payload.subject.trim() : "";
  const subject = subjectRaw || "(no subject)";
  const body = typeof payload?.body === "string" ? payload.body : "";

  if (!recipient) {
    return NextResponse.json(
      { error: "Recipient email is required" },
      { status: 400 }
    );
  }
  if (!EMAIL_PATTERN.test(recipient)) {
    return NextResponse.json(
      { error: "Recipient must be a valid email address" },
      { status: 400 }
    );
  }

  const trackingId = randomUUID();
  const baseUrl = String(process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");

  try {
    await dbConnect();
    const email = await Email.create({
      recipient,
      subject: subject.slice(0, 998),
      body,
      trackingId,
      deliveryStatus: "sent",
    });

    return NextResponse.json(
      { email: serializeCreatedEmail(email, baseUrl) },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to register tracking id:", error);
    const reason = error instanceof Error ? error.message : "Unknown database error";
    return NextResponse.json(
      { error: `Failed to register tracking id. ${reason}` },
      { status: 500 }
    );
  }
}
