import { randomUUID } from "crypto";
import nodemailer from "nodemailer";
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Email from "@/models/Email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function serializeEmail(email) {
  return {
    id: String(email._id),
    recipient: email.recipient,
    subject: email.subject,
    body: email.body,
    trackingId: email.trackingId,
    deliveryStatus: email.deliveryStatus,
    deliveryError: email.deliveryError || "",
    createdAt:
      email.createdAt instanceof Date
        ? email.createdAt.toISOString()
        : new Date(email.createdAt).toISOString(),
  };
}

function getBaseUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl || !String(baseUrl).trim()) {
    throw new Error("NEXT_PUBLIC_BASE_URL is not set");
  }
  return String(baseUrl).replace(/\/+$/, "");
}

function createTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error("SMTP_USER and SMTP_PASS must be set in the environment");
  }

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user,
      pass,
    },
  });
}

function validationError(message) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request) {
  let payload;

  try {
    payload = await request.json();
  } catch {
    return validationError("Request body must be valid JSON");
  }

  const recipient =
    typeof payload?.recipient === "string" ? payload.recipient.trim() : "";
  const subject =
    typeof payload?.subject === "string" ? payload.subject.trim() : "";
  const body = typeof payload?.body === "string" ? payload.body.trim() : "";

  if (!recipient) {
    return validationError("Recipient email is required");
  }
  if (!EMAIL_PATTERN.test(recipient)) {
    return validationError("Recipient must be a valid email address");
  }
  if (!subject) {
    return validationError("Subject is required");
  }
  if (!body) {
    return validationError("Body is required");
  }

  let baseUrl;
  let transporter;

  try {
    baseUrl = getBaseUrl();
    transporter = createTransporter();
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Invalid mail configuration";
    return NextResponse.json({ error: reason }, { status: 500 });
  }

  const trackingId = randomUUID();
  const pixelTag = `<img src="${baseUrl}/api/track/${trackingId}.png" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;" />`;
  const html = `${body}${pixelTag}`;

  let email;

  try {
    await dbConnect();
    email = await Email.create({
      recipient,
      subject,
      body,
      trackingId,
      deliveryStatus: "pending",
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown database error";
    return NextResponse.json(
      { error: `Failed to save email record; message was not sent. ${reason}` },
      { status: 500 }
    );
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipient,
      subject,
      html,
    });

    email.deliveryStatus = "sent";
    email.deliveryError = "";
    await email.save();

    return NextResponse.json({ email: serializeEmail(email) }, { status: 200 });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown SMTP error";

    try {
      email.deliveryStatus = "failed";
      email.deliveryError = reason;
      await email.save();
    } catch (updateError) {
      console.error("Failed to mark email as failed:", updateError);
    }

    return NextResponse.json(
      {
        error: `Email was not delivered. ${reason}`,
        trackingId,
        deliveryStatus: "failed",
      },
      { status: 500 }
    );
  }
}
