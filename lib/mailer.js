import { randomUUID } from "crypto";
import nodemailer from "nodemailer";
import dbConnect from "@/lib/mongodb";
import Email from "@/models/Email";
import { prepareTrackedHtml } from "@/lib/rewriteLinks";

function getBaseUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  return baseUrl.replace(/\/+$/, "");
}

function getTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error(
      "SMTP_USER and SMTP_PASS must be defined in the environment"
    );
  }

  if (!global.mailTransporter) {
    global.mailTransporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
    });
  }

  return global.mailTransporter;
}

export async function sendTrackedEmail({ to, subject, htmlBody }) {
  if (!to || typeof to !== "string" || !to.trim()) {
    throw new Error("Recipient (to) is required");
  }

  if (!subject || typeof subject !== "string" || !subject.trim()) {
    throw new Error("Subject is required");
  }

  const recipient = to.trim();
  const trimmedSubject = subject.trim();
  const body = typeof htmlBody === "string" ? htmlBody : "";
  const trackingId = randomUUID();

  let transporter;
  try {
    transporter = getTransporter();
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown SMTP configuration error";
    throw new Error(`Cannot send email: ${reason}`);
  }

  try {
    await dbConnect();
    await Email.create({
      recipient,
      subject: trimmedSubject,
      body,
      trackingId,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown database error";
    throw new Error(
      `Failed to save email record; message was not sent. ${reason}`
    );
  }

  const html = prepareTrackedHtml(body, {
    baseUrl: getBaseUrl(),
    trackingId,
  });

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipient,
      subject: trimmedSubject,
      html,
    });

    return {
      trackingId,
      messageId: info.messageId,
      accepted: info.accepted,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown SMTP error";
    throw new Error(
      `Email was saved (trackingId: ${trackingId}) but sending failed. ${reason}`
    );
  }
}
