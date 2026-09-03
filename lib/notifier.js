function formatLocation(city, country) {
  const safeCity = city && city !== "unknown" ? city : "";
  const safeCountry = country && country !== "unknown" ? country : "";
  if (safeCity && safeCountry) return `${safeCity}, ${safeCountry}`;
  if (safeCity) return safeCity;
  if (safeCountry) return safeCountry;
  return "Unknown location";
}

function fieldValue(value, fallback = "Unknown") {
  const text = String(value || "").trim();
  return text || fallback;
}

function isDiscordWebhook(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname.endsWith("discord.com");
  } catch {
    return false;
  }
}

export async function sendWebhookNotification(emailDocument, trackingLog) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL?.trim();
  if (!webhookUrl) return;
  if (!isDiscordWebhook(webhookUrl)) {
    console.warn("DISCORD_WEBHOOK_URL is not a valid Discord webhook URL");
    return;
  }

  const openedAt = trackingLog?.openedAt
    ? new Date(trackingLog.openedAt)
    : new Date();
  const subject = fieldValue(emailDocument?.subject, "(no subject)");
  const recipient = fieldValue(emailDocument?.recipient, "Unknown recipient");
  const device = fieldValue(trackingLog?.device, "Desktop");
  const clientType = fieldValue(trackingLog?.clientType, "Unknown");
  const location = formatLocation(trackingLog?.city, trackingLog?.country);

  const payload = {
    username: "Email Tracker",
    embeds: [
      {
        title: "Email opened",
        color: 0x0f766e,
        fields: [
          { name: "Subject", value: subject.slice(0, 256), inline: false },
          { name: "Recipient", value: recipient.slice(0, 256), inline: true },
          {
            name: "Opened",
            value: openedAt.toUTCString(),
            inline: true,
          },
          {
            name: "Device",
            value: `${device} · ${clientType}`.slice(0, 256),
            inline: true,
          },
          { name: "Location", value: location.slice(0, 256), inline: true },
        ],
        timestamp: openedAt.toISOString(),
      },
    ],
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Webhook responded with ${response.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}
